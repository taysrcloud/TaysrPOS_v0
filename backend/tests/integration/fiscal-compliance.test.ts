import { describe, it, before, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { getTestServer, closeTestServer, RunningTestServer } from '../helpers/test-server.js';
import { createTestTenant, cleanupTestTenant, TestTenantContext } from '../helpers/test-db.js';
import { getDefaultPrisma } from '../../src/utils/prisma.js';

const prisma = getDefaultPrisma();

describe('Integration: Moroccan Fiscal Compliance & TVA Calculations', () => {
  let serverCtx: RunningTestServer;
  let tenant: TestTenantContext;
  let customerWithIceId: number;
  let customerWithoutIceId: number;

  let product20: { id: number; price: number };
  let product14: { id: number; price: number };
  let product10: { id: number; price: number };
  let product07: { id: number; price: number };
  let product00: { id: number; price: number };

  before(async () => {
    serverCtx = await getTestServer();
    tenant = await createTestTenant('fiscal-comp');

    // 1. Create Moroccan compliant customer with 15-digit ICE
    const custWithIce = await prisma.contact.create({
      data: {
        companyId: tenant.company.id,
        fullName: 'Société Marocaine SARL',
        type: 'CUSTOMER',
        ice: '001523456000089',
        ifNumber: '45678912',
        address: '15 Boulevard Zerktouni, Casablanca',
      },
    });
    customerWithIceId = custWithIce.id;

    // 2. Create customer without ICE
    const custWithoutIce = await prisma.contact.create({
      data: {
        companyId: tenant.company.id,
        fullName: 'Particulier Sans ICE',
        type: 'CUSTOMER',
        ice: null,
      },
    });
    customerWithoutIceId = custWithoutIce.id;

    // 3. Create products with Moroccan standard TVA rates: 20%, 14%, 10%, 7%, 0%
    const p20 = await prisma.product.create({
      data: {
        companyId: tenant.company.id,
        name: 'Produit Matériel (TVA 20%)',
        sku: `SKU-20-${Date.now()}`,
        salePrice: 100,
        tvaRate: 20,
        trackStock: true,
      },
    });
    await prisma.productStock.create({
      data: { productId: p20.id, warehouseId: tenant.warehouse.id, quantity: 100 },
    });
    product20 = { id: p20.id, price: 100 };

    const p14 = await prisma.product.create({
      data: {
        companyId: tenant.company.id,
        name: 'Appareil Électrique (TVA 14%)',
        sku: `SKU-14-${Date.now()}`,
        salePrice: 80,
        tvaRate: 14,
        trackStock: true,
      },
    });
    await prisma.productStock.create({
      data: { productId: p14.id, warehouseId: tenant.warehouse.id, quantity: 100 },
    });
    product14 = { id: p14.id, price: 80 };

    const p10 = await prisma.product.create({
      data: {
        companyId: tenant.company.id,
        name: 'Restauration / Hôtellerie (TVA 10%)',
        sku: `SKU-10-${Date.now()}`,
        salePrice: 50,
        tvaRate: 10,
        trackStock: true,
      },
    });
    await prisma.productStock.create({
      data: { productId: p10.id, warehouseId: tenant.warehouse.id, quantity: 100 },
    });
    product10 = { id: p10.id, price: 50 };

    const p07 = await prisma.product.create({
      data: {
        companyId: tenant.company.id,
        name: 'Produit Alimentaire / Pharma (TVA 7%)',
        sku: `SKU-07-${Date.now()}`,
        salePrice: 20,
        tvaRate: 7,
        trackStock: true,
      },
    });
    await prisma.productStock.create({
      data: { productId: p07.id, warehouseId: tenant.warehouse.id, quantity: 100 },
    });
    product07 = { id: p07.id, price: 20 };

    const p00 = await prisma.product.create({
      data: {
        companyId: tenant.company.id,
        name: 'Produit Exonéré (TVA 0%)',
        sku: `SKU-00-${Date.now()}`,
        salePrice: 40,
        tvaRate: 0,
        trackStock: true,
      },
    });
    await prisma.productStock.create({
      data: { productId: p00.id, warehouseId: tenant.warehouse.id, quantity: 100 },
    });
    product00 = { id: p00.id, price: 40 };
  });

  after(async () => {
    await cleanupTestTenant(tenant);
    await closeTestServer();
  });

  // -------------------------------------------------------------
  // 1. Moroccan Consolidated Invoices (Facturation Groupée) & ICE Validation
  // -------------------------------------------------------------
  describe('Moroccan Consolidated Invoices & ICE Validation', () => {
    it('Rejects consolidated invoice creation for customer without ICE (400)', async () => {
      const token = tenant.users.ADMIN.token;

      // Create a finalized sale for customer without ICE
      const saleRes = await serverCtx.client.post('/api/sales', {
        customerId: customerWithoutIceId,
        method: 'CASH',
        status: 'FINAL',
        locationId: tenant.location.id,
        items: [{ productId: product20.id, quantity: 1, discount: 0 }],
      }, token);
      assert.strictEqual(saleRes.status, 201);

      const consolidatedRes = await serverCtx.client.post('/api/invoices/consolidated', {
        customerId: customerWithoutIceId,
        saleIds: [saleRes.body.id],
        periodStart: '2026-01-01',
        periodEnd: '2026-12-31',
      }, token);

      assert.strictEqual(consolidatedRes.status, 400, 'Customer without ICE must be rejected with 400');
      assert.match(consolidatedRes.body.error, /Customer must have an ICE for consolidated invoices/i);
    });

    it('Successfully generates consolidated invoice for customer with valid ICE across multiple sales', async () => {
      const token = tenant.users.ADMIN.token;

      // Create 2 finalized sales for customer with ICE
      const sale1 = await serverCtx.client.post('/api/sales', {
        customerId: customerWithIceId,
        method: 'CASH',
        status: 'FINAL',
        locationId: tenant.location.id,
        items: [{ productId: product20.id, quantity: 2, discount: 0 }], // subtotal=200, tax=40, total=240
      }, token);
      assert.strictEqual(sale1.status, 201);

      const sale2 = await serverCtx.client.post('/api/sales', {
        customerId: customerWithIceId,
        method: 'CASH',
        status: 'FINAL',
        locationId: tenant.location.id,
        items: [{ productId: product07.id, quantity: 5, discount: 0 }], // subtotal=100, tax=7, total=107
      }, token);
      assert.strictEqual(sale2.status, 201);

      const saleIds = [sale1.body.id, sale2.body.id];

      const consolidatedRes = await serverCtx.client.post('/api/invoices/consolidated', {
        customerId: customerWithIceId,
        saleIds,
        periodStart: '2026-01-01',
        periodEnd: '2026-12-31',
      }, token);

      assert.strictEqual(consolidatedRes.status, 201, `Consolidated invoice should be created with 201, got ${consolidatedRes.status}`);
      assert.ok(consolidatedRes.body.id);
      assert.ok(consolidatedRes.body.reference.startsWith('CI-'));

      // Total = 240 + 107 = 347
      // TaxTotal = 40 + 7 = 47
      assert.strictEqual(Number(consolidatedRes.body.total), 347);
      assert.strictEqual(Number(consolidatedRes.body.taxTotal), 47);

      const consolidatedId = consolidatedRes.body.id;

      // Verify PDF / HTML view includes customer ICE and company information
      const pdfRes = await serverCtx.client.get(`/api/invoices/consolidated/${consolidatedId}/pdf`, token);
      assert.strictEqual(pdfRes.status, 200);
      assert.match(pdfRes.body, /001523456000089/, 'Consolidated invoice view must include customer ICE');
      assert.match(pdfRes.body, /Société Marocaine SARL/, 'Consolidated invoice view must include customer name');

      // Verify sales cannot be consolidated a second time
      const duplicateRes = await serverCtx.client.post('/api/invoices/consolidated', {
        customerId: customerWithIceId,
        saleIds,
        periodStart: '2026-01-01',
        periodEnd: '2026-12-31',
      }, token);
      assert.strictEqual(duplicateRes.status, 400, 'Already consolidated sales must be rejected');
      assert.match(duplicateRes.body.error, /No valid sales found for consolidation/i);
    });
  });

  // -------------------------------------------------------------
  // 2. TVA Calculations Accuracy on Moroccan Tax Rates
  // -------------------------------------------------------------
  describe('TVA Calculations Accuracy Across Moroccan Rates', () => {
    it('Accurately calculates line-level and order-level TVA on multi-rate baskets (20%, 14%, 10%, 7%, 0%)', async () => {
      const token = tenant.users.CASHIER.token;

      // Basket:
      // - 2 x Product 20% (100 MAD each): net = 200, tax = 40, lineTotal = 240
      // - 1 x Product 14% (80 MAD each): net = 80, tax = 11.20, lineTotal = 91.20
      // - 2 x Product 10% (50 MAD each): net = 100, tax = 10.00, lineTotal = 110.00
      // - 3 x Product 7% (20 MAD each): net = 60, tax = 4.20, lineTotal = 64.20
      // - 1 x Product 0% (40 MAD each): net = 40, tax = 0, lineTotal = 40.00
      // Subtotal = 200 + 80 + 100 + 60 + 40 = 480 MAD
      // TaxTotal = 40 + 11.20 + 10.00 + 4.20 + 0 = 65.40 MAD
      // Total = 480 + 65.40 = 545.40 MAD

      const saleRes = await serverCtx.client.post('/api/sales', {
        customerId: customerWithIceId,
        method: 'CASH',
        status: 'FINAL',
        locationId: tenant.location.id,
        items: [
          { productId: product20.id, quantity: 2, discount: 0 },
          { productId: product14.id, quantity: 1, discount: 0 },
          { productId: product10.id, quantity: 2, discount: 0 },
          { productId: product07.id, quantity: 3, discount: 0 },
          { productId: product00.id, quantity: 1, discount: 0 },
        ],
      }, token);

      assert.strictEqual(saleRes.status, 201);
      const sale = saleRes.body;

      assert.strictEqual(Number(sale.subtotal), 480, `Subtotal expected 480, got ${sale.subtotal}`);
      assert.strictEqual(Number(sale.taxTotal), 65.4, `TaxTotal expected 65.4, got ${sale.taxTotal}`);
      assert.strictEqual(Number(sale.total), 545.4, `Total expected 545.4, got ${sale.total}`);
      assert.strictEqual(Number(sale.discountTotal), 0);
    });

    it('Accurately computes TVA with line-level discounts and order-level discount rates', async () => {
      const token = tenant.users.CASHIER.token;

      // Product 20% (100 MAD unitPrice) with line discount of 10 MAD per unit for 2 units
      // Line net = (100 - 10) * 2 = 180 MAD
      // Line tax = 180 * 0.20 = 36 MAD
      // Line total = 216 MAD
      // Order discount rate: 10%
      // Subtotal = 100 * 2 = 200 MAD
      // Line discount total = 10 * 2 = 20 MAD
      // Order discount = (200 - 20) * 0.10 = 18 MAD
      // Discount total = 20 + 18 = 38 MAD
      // Tax total = 36 MAD
      // Final Total = subtotal (200) - discountTotal (38) + taxTotal (36) = 198 MAD

      const saleRes = await serverCtx.client.post('/api/sales', {
        customerId: customerWithIceId,
        method: 'CASH',
        status: 'FINAL',
        discountRate: 10,
        locationId: tenant.location.id,
        items: [
          { productId: product20.id, quantity: 2, discount: 10 },
        ],
      }, token);

      assert.strictEqual(saleRes.status, 201);
      const sale = saleRes.body;

      assert.strictEqual(Number(sale.subtotal), 200, `Subtotal should be 200, got ${sale.subtotal}`);
      assert.strictEqual(Number(sale.discountTotal), 38, `Discount total should be 38, got ${sale.discountTotal}`);
      assert.strictEqual(Number(sale.taxTotal), 36, `Tax total should be 36, got ${sale.taxTotal}`);
      assert.strictEqual(Number(sale.total), 198, `Total should be 198, got ${sale.total}`);
    });
  });

  // -------------------------------------------------------------
  // 3. Unaccented Moroccan Status Labels
  // -------------------------------------------------------------
  describe('Unaccented Moroccan Status Labels', () => {
    it('Returns unaccented "Payee" status on completed cash sale', async () => {
      const token = tenant.users.CASHIER.token;
      const res = await serverCtx.client.post('/api/sales', {
        customerId: customerWithIceId,
        method: 'CASH',
        status: 'FINAL',
        locationId: tenant.location.id,
        items: [{ productId: product20.id, quantity: 1, discount: 0 }],
      }, token);

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.status, 'Payee', 'Status must be unaccented "Payee" (never "Payée")');
    });

    it('Returns "Credit" status on credit sale', async () => {
      const token = tenant.users.CASHIER.token;
      const res = await serverCtx.client.post('/api/sales', {
        customerId: customerWithIceId,
        method: 'CREDIT',
        status: 'FINAL',
        locationId: tenant.location.id,
        items: [{ productId: product20.id, quantity: 1, discount: 0 }],
      }, token);

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.status, 'Credit', 'Status must be "Credit" for credit sales');
    });

    it('Returns "Suspendue" status on suspended sale', async () => {
      const token = tenant.users.CASHIER.token;
      const res = await serverCtx.client.post('/api/sales', {
        customerId: customerWithIceId,
        method: 'CASH',
        status: 'SUSPENDED',
        locationId: tenant.location.id,
        items: [{ productId: product20.id, quantity: 1, discount: 0 }],
      }, token);

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.status, 'Suspendue', 'Status must be "Suspendue" for suspended sales');
    });

    it('Returns "Devis" status on draft quote', async () => {
      const token = tenant.users.CASHIER.token;
      // In saleSchema, status: 'QUOTE' maps to note: 'DEVIS', status: 'DRAFT'
      const res = await serverCtx.client.post('/api/sales', {
        customerId: customerWithIceId,
        method: 'CASH',
        status: 'QUOTE',
        locationId: tenant.location.id,
        items: [{ productId: product20.id, quantity: 1, discount: 0 }],
      }, token);

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.status, 'Devis', 'Status must be "Devis" for quotes');
    });

    it('Returns "Retour" status on returned sale', async () => {
      const token = tenant.users.CASHIER.token;
      const saleRes = await serverCtx.client.post('/api/sales', {
        customerId: customerWithIceId,
        method: 'CASH',
        status: 'FINAL',
        locationId: tenant.location.id,
        items: [{ productId: product20.id, quantity: 1, discount: 0 }],
      }, token);

      assert.strictEqual(saleRes.status, 201);
      const saleId = saleRes.body.id;

      const returnRes = await serverCtx.client.post(`/api/sales/${saleId}/return`, {}, token);
      assert.strictEqual(returnRes.status, 200);
      assert.strictEqual(returnRes.body.status, 'Retour', 'Status must be "Retour" after return');
    });
  });

  // -------------------------------------------------------------
  // 4. Fiscal Documents PDF Generation
  // -------------------------------------------------------------
  describe('Fiscal Documents PDF Generation', () => {
    it('Generates PDF receipt with application/pdf Content-Type', async () => {
      const token = tenant.users.CASHIER.token;
      const saleRes = await serverCtx.client.post('/api/sales', {
        customerId: customerWithIceId,
        method: 'CASH',
        status: 'FINAL',
        locationId: tenant.location.id,
        items: [{ productId: product20.id, quantity: 1, discount: 0 }],
      }, token);

      assert.strictEqual(saleRes.status, 201);
      const saleId = saleRes.body.id;

      const receiptRes = await serverCtx.client.get(`/api/sales/${saleId}/receipt`, token);
      assert.strictEqual(receiptRes.status, 200);
      const contentType = receiptRes.headers.get('content-type') || '';
      assert.ok(contentType.includes('application/pdf'), `Content-Type should be application/pdf, got ${contentType}`);
    });

    it('Generates PDF invoice with application/pdf Content-Type', async () => {
      const token = tenant.users.CASHIER.token;
      const saleRes = await serverCtx.client.post('/api/sales', {
        customerId: customerWithIceId,
        method: 'CASH',
        status: 'FINAL',
        locationId: tenant.location.id,
        items: [{ productId: product20.id, quantity: 1, discount: 0 }],
      }, token);

      assert.strictEqual(saleRes.status, 201);
      const saleId = saleRes.body.id;

      const invoiceRes = await serverCtx.client.get(`/api/sales/${saleId}/invoice`, token);
      assert.strictEqual(invoiceRes.status, 200);
      const contentType = invoiceRes.headers.get('content-type') || '';
      assert.ok(contentType.includes('application/pdf'), `Content-Type should be application/pdf, got ${contentType}`);
    });
  });
});
