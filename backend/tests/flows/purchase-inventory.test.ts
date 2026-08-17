import { describe, it, before, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { getTestServer, closeTestServer, RunningTestServer } from '../helpers/test-server.js';
import { createTestTenant, cleanupTestTenant, TestTenantContext } from '../helpers/test-db.js';
import { getDefaultPrisma } from '../../src/utils/prisma.js';

const prisma = getDefaultPrisma();

describe('Flow 2: Purchase, Receiving & Warehouse Inventory Flow', () => {
  let serverCtx: RunningTestServer;
  let tenant: TestTenantContext;
  let secondaryWarehouseId: number;

  before(async () => {
    serverCtx = await getTestServer();
    tenant = await createTestTenant('purchase-flow');

    // Create a secondary warehouse for multi-warehouse transfer testing
    const secondaryWh = await prisma.warehouse.create({
      data: {
        companyId: tenant.company.id,
        locationId: tenant.location.id,
        name: `Entrepot Secondaire ${tenant.marker}`,
        isMain: false,
        isActive: true,
      },
    });
    secondaryWarehouseId = secondaryWh.id;
  });

  after(async () => {
    await cleanupTestTenant(tenant);
    await closeTestServer();
  });

  it('Executes full purchase lifecycle: PO -> Partial Receive -> Full Receive -> Settle -> Adjust -> Transfer', async () => {
    const managerToken = tenant.users.MANAGER.token;

    // 1. Initial Stock Verification (50 units in main warehouse)
    const initialStock = await prisma.productStock.findFirstOrThrow({
      where: { productId: tenant.product.id, warehouseId: tenant.warehouse.id },
    });
    assert.strictEqual(Number(initialStock.quantity), 50, 'Initial product stock should be 50');

    // 2. Create Purchase Order in PENDING status (20 units @ 60 MAD = 1200 MAD total)
    const createPoRes = await serverCtx.client.post('/api/purchases', {
      supplierId: tenant.supplier.id,
      locationId: tenant.location.id,
      status: 'PENDING',
      items: [
        { productId: tenant.product.id, quantity: 20, unitCost: 60 },
      ],
      total: 1200,
    }, managerToken);

    assert.strictEqual(createPoRes.status, 200, `PO creation failed: ${JSON.stringify(createPoRes.body)}`);
    assert.strictEqual(createPoRes.body.success, true);
    const po = createPoRes.body.purchase;
    assert.strictEqual(po.status, 'PENDING');

    // Verify stock is UNCHANGED while in PENDING status (50 units)
    const stockAfterPo = await prisma.productStock.findFirstOrThrow({
      where: { productId: tenant.product.id, warehouseId: tenant.warehouse.id },
    });
    assert.strictEqual(Number(stockAfterPo.quantity), 50, 'Stock must not increment for PENDING purchase');

    // Verify supplier balance is UNCHANGED while in PENDING status (0 MAD)
    const supplierBeforeReceive = await prisma.contact.findUniqueOrThrow({
      where: { id: tenant.supplier.id },
    });
    assert.strictEqual(Number(supplierBeforeReceive.balance), 0, 'Supplier balance must not increment for PENDING purchase');

    // 3. Partial Receiving: Receive 12 of the 20 items
    const poDetailRes = await serverCtx.client.get(`/api/purchases/${po.id}`, managerToken);
    assert.strictEqual(poDetailRes.status, 200);
    const purchaseItemId = poDetailRes.body.purchase.items[0].id;

    const partialReceiveRes = await serverCtx.client.put(`/api/purchases/${po.id}/receive`, {
      locationId: tenant.location.id,
      items: [
        { purchaseItemId, quantity: 12 },
      ],
    }, managerToken);

    assert.strictEqual(partialReceiveRes.status, 200, `Partial receive failed: ${JSON.stringify(partialReceiveRes.body)}`);
    assert.strictEqual(partialReceiveRes.body.success, true);

    // Verify purchase status moved to PARTIALLY_RECEIVED
    const poAfterPartial = await prisma.purchase.findUniqueOrThrow({
      where: { id: po.id },
    });
    assert.strictEqual(poAfterPartial.status, 'PARTIALLY_RECEIVED');

    // Verify stock incremented by 12 (50 + 12 = 62)
    const stockAfterPartial = await prisma.productStock.findFirstOrThrow({
      where: { productId: tenant.product.id, warehouseId: tenant.warehouse.id },
    });
    assert.strictEqual(Number(stockAfterPartial.quantity), 62, 'Stock must increment by 12 units');

    // Verify supplier balance incremented by 12 * 60 = 720 MAD
    const supplierAfterPartial = await prisma.contact.findUniqueOrThrow({
      where: { id: tenant.supplier.id },
    });
    assert.strictEqual(Number(supplierAfterPartial.balance), 720, 'Supplier balance must increment by received value 720 MAD');

    // 4. Complete Receiving: Receive remaining 8 items
    const fullReceiveRes = await serverCtx.client.put(`/api/purchases/${po.id}/receive`, {
      locationId: tenant.location.id,
      items: [
        { purchaseItemId, quantity: 8 },
      ],
    }, managerToken);

    assert.strictEqual(fullReceiveRes.status, 200, `Full receive failed: ${JSON.stringify(fullReceiveRes.body)}`);

    // Verify purchase status moved to RECEIVED
    const poAfterFull = await prisma.purchase.findUniqueOrThrow({
      where: { id: po.id },
    });
    assert.strictEqual(poAfterFull.status, 'RECEIVED');

    // Verify stock incremented to 70 (62 + 8 = 70)
    const stockAfterFull = await prisma.productStock.findFirstOrThrow({
      where: { productId: tenant.product.id, warehouseId: tenant.warehouse.id },
    });
    assert.strictEqual(Number(stockAfterFull.quantity), 70, 'Stock must increment by remaining 8 units to 70 total');

    // Verify supplier balance incremented to 1200 MAD
    const supplierAfterFull = await prisma.contact.findUniqueOrThrow({
      where: { id: tenant.supplier.id },
    });
    assert.strictEqual(Number(supplierAfterFull.balance), 1200, 'Supplier balance must equal full PO total 1200 MAD');

    // 5. Create Direct RECEIVED Purchase (10 units @ 50 MAD = 500 MAD)
    const directPurchaseRes = await serverCtx.client.post('/api/purchases', {
      supplierId: tenant.supplier.id,
      locationId: tenant.location.id,
      status: 'RECEIVED',
      items: [
        { productId: tenant.product.id, quantity: 10, unitCost: 50 },
      ],
      total: 500,
    }, managerToken);

    assert.strictEqual(directPurchaseRes.status, 200);
    assert.strictEqual(directPurchaseRes.body.success, true);

    // Verify stock incremented from 70 to 80
    const stockAfterDirect = await prisma.productStock.findFirstOrThrow({
      where: { productId: tenant.product.id, warehouseId: tenant.warehouse.id },
    });
    assert.strictEqual(Number(stockAfterDirect.quantity), 80, 'Stock must increment to 80 after direct purchase');

    // Verify supplier balance incremented to 1700 MAD (1200 + 500)
    const supplierAfterDirect = await prisma.contact.findUniqueOrThrow({
      where: { id: tenant.supplier.id },
    });
    assert.strictEqual(Number(supplierAfterDirect.balance), 1700, 'Supplier balance must be 1700 MAD');

    // 6. Supplier Contact Ledger & Balance Settlement
    const supplierLedgerRes = await serverCtx.client.get(`/api/contacts/${tenant.supplier.id}/ledger`, managerToken);
    assert.strictEqual(supplierLedgerRes.status, 200);
    assert.strictEqual(supplierLedgerRes.body.purchases.length, 2, 'Supplier ledger must contain both purchases');
    assert.strictEqual(Number(supplierLedgerRes.body.contact.balance), 1700);

    // Settle 1000 MAD of the supplier payable
    const settleRes = await serverCtx.client.post(`/api/contacts/${tenant.supplier.id}/settle`, {
      amount: 1000,
      method: 'CASH',
      locationId: tenant.location.id,
      note: 'Acompte reglement fournisseur',
    }, managerToken);

    assert.strictEqual(settleRes.status, 200, `Supplier settlement failed: ${JSON.stringify(settleRes.body)}`);
    assert.strictEqual(Number(settleRes.body.contact.balance), 700, 'Supplier balance must be decremented to 700 MAD');

    // 7. Verify Inventory Movements Audit Trail
    const movementsRes = await serverCtx.client.get('/api/inventory/movements', managerToken);
    assert.strictEqual(movementsRes.status, 200);
    const inMovements = movementsRes.body.movements.filter((m: any) => m.productId === tenant.product.id && m.type === 'IN');
    assert.ok(inMovements.length >= 3, 'Must record stock IN movements for partial, full, and direct purchases');

    // 8. Physical Inventory Count & Stock Adjustment (-5 units: 80 -> 75)
    const adjustRes = await serverCtx.client.post('/api/inventory/adjustment', {
      locationId: tenant.location.id,
      adjustments: [
        { productId: tenant.product.id, quantity: 75, reason: 'Inventaire tournant' },
      ],
    }, managerToken);

    assert.strictEqual(adjustRes.status, 200, `Inventory adjustment failed: ${JSON.stringify(adjustRes.body)}`);
    assert.strictEqual(adjustRes.body.success, true);

    const stockAfterAdjust = await prisma.productStock.findFirstOrThrow({
      where: { productId: tenant.product.id, warehouseId: tenant.warehouse.id },
    });
    assert.strictEqual(Number(stockAfterAdjust.quantity), 75, 'Stock must adjust to counted quantity 75');

    const adjMovement = await prisma.stockMovement.findFirst({
      where: { productId: tenant.product.id, warehouseId: tenant.warehouse.id, reference: 'Inventaire tournant' },
    });
    assert.ok(adjMovement, 'Adjustment movement must exist');
    assert.strictEqual(adjMovement?.type, 'OUT');
    assert.strictEqual(Number(adjMovement?.quantity), 5);

    // 9. Inter-Warehouse Transfer (15 units from Main -> Secondary)
    const transferRes = await serverCtx.client.post('/api/inventory/transfer', {
      sourceWarehouseId: tenant.warehouse.id,
      destinationWarehouseId: secondaryWarehouseId,
      productId: tenant.product.id,
      quantity: 15,
      notes: 'Reapprovisionnement rayon',
    }, managerToken);

    assert.strictEqual(transferRes.status, 200, `Inventory transfer failed: ${JSON.stringify(transferRes.body)}`);
    assert.strictEqual(transferRes.body.success, true);

    // Verify source warehouse stock decremented (75 - 15 = 60)
    const sourceStock = await prisma.productStock.findFirstOrThrow({
      where: { productId: tenant.product.id, warehouseId: tenant.warehouse.id },
    });
    assert.strictEqual(Number(sourceStock.quantity), 60, 'Source warehouse stock must be decremented to 60');

    // Verify destination warehouse stock incremented (0 + 15 = 15)
    const destStock = await prisma.productStock.findFirstOrThrow({
      where: { productId: tenant.product.id, warehouseId: secondaryWarehouseId },
    });
    assert.strictEqual(Number(destStock.quantity), 15, 'Destination warehouse stock must be incremented to 15');
  });
});
