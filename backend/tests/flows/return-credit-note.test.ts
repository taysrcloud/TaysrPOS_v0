import { describe, it, before, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { getTestServer, closeTestServer, RunningTestServer } from '../helpers/test-server.js';
import { createTestTenant, cleanupTestTenant, TestTenantContext } from '../helpers/test-db.js';
import { getDefaultPrisma } from '../../src/utils/prisma.js';

const prisma = getDefaultPrisma();

describe('Flow 3: Sales Returns, Credit Notes & Supplier Restock Flow', () => {
  let serverCtx: RunningTestServer;
  let tenant: TestTenantContext;
  let secondProduct: { id: number; price: number };

  before(async () => {
    serverCtx = await getTestServer();
    tenant = await createTestTenant('return-flow');

    // Create a second product with 50 MAD unit price and 50 stock
    const p2 = await prisma.product.create({
      data: {
        companyId: tenant.company.id,
        name: `Second Produit ${tenant.marker}`,
        sku: `SKU-P2-${Date.now()}`,
        salePrice: 50,
        purchasePrice: 30,
        tvaRate: 20,
        trackStock: true,
        isActive: true,
      },
    });

    await prisma.productStock.create({
      data: { productId: p2.id, warehouseId: tenant.warehouse.id, quantity: 50 },
    });

    secondProduct = { id: p2.id, price: 50 };
  });

  after(async () => {
    await cleanupTestTenant(tenant);
    await closeTestServer();
  });

  it('Executes sale partial return, full return, cash ledger refund, credit balance reversal, and purchase supplier return', async () => {
    const cashierToken = tenant.users.CASHIER.token;
    const managerToken = tenant.users.MANAGER.token;

    // -------------------------------------------------------------
    // Part 1: Cash Sale -> Partial Return -> Full Return Lifecycle
    // -------------------------------------------------------------

    // 1. Create a finalized multi-line cash sale:
    // Line 1: 3 units of Product 1 @ 100 MAD + 20% TVA = 360 MAD (subtotal 300, tax 60)
    // Line 2: 2 units of Product 2 @ 50 MAD + 20% TVA = 120 MAD (subtotal 100, tax 20)
    // Total = 480 MAD paid in CASH
    const saleRes = await serverCtx.client.post('/api/sales', {
      customerId: tenant.customer.id,
      locationId: tenant.location.id,
      method: 'CASH',
      status: 'FINAL',
      items: [
        { productId: tenant.product.id, quantity: 3 },
        { productId: secondProduct.id, quantity: 2 },
      ],
    }, cashierToken);

    assert.strictEqual(saleRes.status, 201, `Sale creation failed: ${JSON.stringify(saleRes.body)}`);
    const sale = saleRes.body;
    assert.strictEqual(Number(sale.total), 480);
    assert.strictEqual(sale.status, 'Payee');

    const line1 = sale.lines.find((l: any) => l.productId === tenant.product.id);
    const line2 = sale.lines.find((l: any) => l.productId === secondProduct.id);
    assert.ok(line1 && line2, 'Both sale lines must exist');

    // Verify stock decremented:
    // Product 1: 50 - 3 = 47
    // Product 2: 50 - 2 = 48
    const stockP1AfterSale = await prisma.productStock.findFirstOrThrow({
      where: { productId: tenant.product.id, warehouseId: tenant.warehouse.id },
    });
    const stockP2AfterSale = await prisma.productStock.findFirstOrThrow({
      where: { productId: secondProduct.id, warehouseId: tenant.warehouse.id },
    });
    assert.strictEqual(Number(stockP1AfterSale.quantity), 47);
    assert.strictEqual(Number(stockP2AfterSale.quantity), 48);

    // Verify Cash Account Auto-Posted DEBIT 480
    const cashAccount = await prisma.account.findFirstOrThrow({
      where: { companyId: tenant.company.id, locationId: tenant.location.id },
    });
    assert.strictEqual(Number(cashAccount.currentBalance), 480, 'Cash account balance must reflect 480 MAD DEBIT');

    // 2. Perform Partial Return: Return 1 unit of Product 1 (Value: 100 + 20% TVA = 120 MAD)
    const partialReturnRes = await serverCtx.client.post(`/api/sales/${sale.id}/return`, {
      items: [
        { saleItemId: line1.id, quantity: 1 },
      ],
    }, cashierToken);

    assert.strictEqual(partialReturnRes.status, 200, `Partial return failed: ${JSON.stringify(partialReturnRes.body)}`);
    assert.strictEqual(partialReturnRes.body.status, 'Retour', 'Sale status label must indicate return');

    // Verify Product 1 stock restocked by 1 (47 + 1 = 48)
    const stockP1AfterPartial = await prisma.productStock.findFirstOrThrow({
      where: { productId: tenant.product.id, warehouseId: tenant.warehouse.id },
    });
    assert.strictEqual(Number(stockP1AfterPartial.quantity), 48, 'Stock of Product 1 must increment to 48');

    // Verify StockMovement IN created
    const returnMovement1 = await prisma.stockMovement.findFirst({
      where: { productId: tenant.product.id, warehouseId: tenant.warehouse.id, notes: 'Retour Vente' },
      orderBy: { createdAt: 'desc' },
    });
    assert.ok(returnMovement1, 'Stock movement record for return must exist');
    assert.strictEqual(returnMovement1?.type, 'IN');
    assert.strictEqual(Number(returnMovement1?.quantity), 1);

    // Verify Cash Account refunded: CREDIT 120 MAD posted (480 - 120 = 360 MAD balance)
    const cashAccountAfterPartial = await prisma.account.findUniqueOrThrow({
      where: { id: cashAccount.id },
    });
    assert.strictEqual(Number(cashAccountAfterPartial.currentBalance), 360, 'Cash account balance must reflect 120 MAD refund credit');

    // 3. Perform Full Return of Remainder: Return remaining 2 units of Product 1 and 2 units of Product 2 (Value: 240 + 120 = 360 MAD)
    const fullReturnRes = await serverCtx.client.post(`/api/sales/${sale.id}/return`, {
      items: [
        { saleItemId: line1.id, quantity: 2 },
        { saleItemId: line2.id, quantity: 2 },
      ],
    }, cashierToken);

    assert.strictEqual(fullReturnRes.status, 200, `Full return failed: ${JSON.stringify(fullReturnRes.body)}`);

    // Verify DB sale status moved to RETURNED
    const dbSale = await prisma.sale.findUniqueOrThrow({ where: { id: sale.id } });
    assert.strictEqual(dbSale.status, 'RETURNED');

    // Verify all stock fully restored to original 50 units each
    const finalStockP1 = await prisma.productStock.findFirstOrThrow({
      where: { productId: tenant.product.id, warehouseId: tenant.warehouse.id },
    });
    const finalStockP2 = await prisma.productStock.findFirstOrThrow({
      where: { productId: secondProduct.id, warehouseId: tenant.warehouse.id },
    });
    assert.strictEqual(Number(finalStockP1.quantity), 50, 'Product 1 stock must be restored to 50');
    assert.strictEqual(Number(finalStockP2.quantity), 50, 'Product 2 stock must be restored to 50');

    // Verify Cash Account balance fully reversed back to 0 MAD net
    const cashAccountAfterFull = await prisma.account.findUniqueOrThrow({
      where: { id: cashAccount.id },
    });
    assert.strictEqual(Number(cashAccountAfterFull.currentBalance), 0, 'Cash account balance must be 0 after full sale return');

    // -------------------------------------------------------------
    // Part 2: Credit Sale -> Return & Customer Receivable Reversal
    // -------------------------------------------------------------

    // 4. Create a CREDIT sale (2 units @ 100 MAD + 20% TVA = 240 MAD)
    const creditSaleRes = await serverCtx.client.post('/api/sales', {
      customerId: tenant.customer.id,
      locationId: tenant.location.id,
      method: 'CREDIT',
      status: 'FINAL',
      items: [
        { productId: tenant.product.id, quantity: 2 },
      ],
    }, cashierToken);

    assert.strictEqual(creditSaleRes.status, 201, `Credit sale creation failed: ${JSON.stringify(creditSaleRes.body)}`);
    const creditSale = creditSaleRes.body;
    assert.strictEqual(creditSale.status, 'Credit');
    const creditSaleLine = creditSale.lines[0];

    // Verify customer balance incremented by 240 MAD
    const customerAfterCreditSale = await prisma.contact.findUniqueOrThrow({
      where: { id: tenant.customer.id },
    });
    assert.strictEqual(Number(customerAfterCreditSale.balance), 240, 'Customer receivable balance must be 240 MAD');

    // Product 1 stock decremented (50 - 2 = 48)
    const stockAfterCredit = await prisma.productStock.findFirstOrThrow({
      where: { productId: tenant.product.id, warehouseId: tenant.warehouse.id },
    });
    assert.strictEqual(Number(stockAfterCredit.quantity), 48);

    // 5. Return 1 unit on the credit sale (120 MAD credit note reversal)
    const creditReturnRes = await serverCtx.client.post(`/api/sales/${creditSale.id}/return`, {
      items: [
        { saleItemId: creditSaleLine.id, quantity: 1 },
      ],
    }, cashierToken);

    assert.strictEqual(creditReturnRes.status, 200);

    // Verify customer receivable balance decremented from 240 to 120 MAD
    const customerAfterCreditReturn = await prisma.contact.findUniqueOrThrow({
      where: { id: tenant.customer.id },
    });
    assert.strictEqual(Number(customerAfterCreditReturn.balance), 120, 'Customer balance must decrease to 120 MAD after credit return');

    // Product 1 stock restocked to 49 (48 + 1 = 49)
    const stockAfterCreditReturn = await prisma.productStock.findFirstOrThrow({
      where: { productId: tenant.product.id, warehouseId: tenant.warehouse.id },
    });
    assert.strictEqual(Number(stockAfterCreditReturn.quantity), 49);

    // Cash account balance MUST remain 0 (no cash was involved in credit sale or its return)
    const cashAccountAfterCreditReturn = await prisma.account.findUniqueOrThrow({
      where: { id: cashAccount.id },
    });
    assert.strictEqual(Number(cashAccountAfterCreditReturn.currentBalance), 0, 'Cash account must not be modified by credit sales');

    // -------------------------------------------------------------
    // Part 3: Purchase Supplier Return
    // -------------------------------------------------------------

    // 6. Create Purchase (10 units @ 60 MAD = 600 MAD) in RECEIVED status
    const purchaseRes = await serverCtx.client.post('/api/purchases', {
      supplierId: tenant.supplier.id,
      locationId: tenant.location.id,
      status: 'RECEIVED',
      items: [
        { productId: tenant.product.id, quantity: 10, unitCost: 60 },
      ],
      total: 600,
    }, managerToken);

    assert.strictEqual(purchaseRes.status, 200);
    const purchase = purchaseRes.body.purchase;
    const purchaseItem = await prisma.purchaseItem.findFirstOrThrow({ where: { purchaseId: purchase.id } });
    const purchaseItemId = purchaseItem.id;

    // Stock incremented from 49 to 59
    const stockAfterPurchase = await prisma.productStock.findFirstOrThrow({
      where: { productId: tenant.product.id, warehouseId: tenant.warehouse.id },
    });
    assert.strictEqual(Number(stockAfterPurchase.quantity), 59);

    // 7. Perform Supplier Return: Return 4 defective units to supplier (Value: 4 * 60 = 240 MAD)
    const supplierReturnRes = await serverCtx.client.post(`/api/purchases/${purchase.id}/return`, {
      locationId: tenant.location.id,
      items: [
        { purchaseItemId, quantity: 4 },
      ],
    }, managerToken);

    assert.strictEqual(supplierReturnRes.status, 200, `Supplier return failed: ${JSON.stringify(supplierReturnRes.body)}`);
    assert.strictEqual(supplierReturnRes.body.success, true);

    // Verify stock decremented by 4 units (59 - 4 = 55)
    const stockAfterSupplierReturn = await prisma.productStock.findFirstOrThrow({
      where: { productId: tenant.product.id, warehouseId: tenant.warehouse.id },
    });
    assert.strictEqual(Number(stockAfterSupplierReturn.quantity), 55, 'Warehouse stock must decrement by 4 on supplier return');

    // Verify supplier payable balance decremented from 600 to 360 MAD (600 - 240)
    const supplierAfterReturn = await prisma.contact.findUniqueOrThrow({
      where: { id: tenant.supplier.id },
    });
    assert.strictEqual(Number(supplierAfterReturn.balance), 360, 'Supplier balance must decrement to 360 MAD');

    // Verify StockMovement OUT recorded for supplier return
    const supplierMovement = await prisma.stockMovement.findFirst({
      where: { productId: tenant.product.id, warehouseId: tenant.warehouse.id, notes: 'Retour fournisseur' },
    });
    assert.ok(supplierMovement, 'Stock movement for supplier return must exist');
    assert.strictEqual(supplierMovement?.type, 'OUT');
    assert.strictEqual(Number(supplierMovement?.quantity), 4);
  });
});
