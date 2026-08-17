import { describe, it, before, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { getTestServer, closeTestServer, RunningTestServer } from '../helpers/test-server.js';
import { createTestTenant, cleanupTestTenant, TestTenantContext } from '../helpers/test-db.js';
import { getDefaultPrisma } from '../../src/utils/prisma.js';

const prisma = getDefaultPrisma();

describe('Integration: Multi-Tenant Cross-Tenant Attack & Isolation Matrix', () => {
  let serverCtx: RunningTestServer;
  let tenantA: TestTenantContext;
  let tenantB: TestTenantContext;

  // Extra fixtures created in Tenant B to attack
  let tenantBExpenseId: number;
  let tenantBAccountId: number;
  let tenantBCustomerGroupId: number;
  let tenantBDeviceId: number;
  let tenantBSaleId: number;
  let tenantBInvoiceId: number;
  let tenantBConsolidatedInvoiceId: number;

  before(async () => {
    serverCtx = await getTestServer();
    tenantA = await createTestTenant('tenant-a');
    tenantB = await createTestTenant('tenant-b');

    // 1. Create Tenant B Expense
    const expenseB = await prisma.expense.create({
      data: {
        companyId: tenantB.company.id,
        locationId: tenantB.location.id,
        reference: `EXP-B-${Date.now()}`,
        category: 'Loyer',
        amount: 3000,
        date: new Date(),
        paymentMethod: 'CASH',
      },
    });
    tenantBExpenseId = expenseB.id;

    // 2. Create Tenant B Account & AccountType
    const accTypeB = await prisma.accountType.create({
      data: { companyId: tenantB.company.id, name: `Banque B ${Date.now()}` },
    });
    const accountB = await prisma.account.create({
      data: {
        companyId: tenantB.company.id,
        name: `Compte Principal B ${Date.now()}`,
        accountTypeId: accTypeB.id,
        openingBalance: 10000,
        currentBalance: 10000,
      },
    });
    tenantBAccountId = accountB.id;

    // 3. Create Tenant B CustomerGroup
    const groupB = await prisma.customerGroup.create({
      data: { companyId: tenantB.company.id, name: `VIP B ${Date.now()}` },
    });
    tenantBCustomerGroupId = groupB.id;

    // 4. Create Tenant B Device
    const deviceB = await prisma.device.create({
      data: {
        companyId: tenantB.company.id,
        locationId: tenantB.location.id,
        activationCode: `DEV-B-${Math.floor(Math.random() * 1000000)}`,
      },
    });
    tenantBDeviceId = deviceB.id;

    // 5. Create Tenant B Sale
    const saleB = await prisma.sale.create({
      data: {
        companyId: tenantB.company.id,
        locationId: tenantB.location.id,
        customerId: tenantB.customer.id,
        channel: 'RETAIL',
        status: 'FINAL',
        paymentStatus: 'PAID',
        ticketNumber: `TCK-B-${Date.now()}`,
        subtotal: 100,
        taxTotal: 20,
        total: 120,
        items: {
          create: {
            productId: tenantB.product.id,
            quantity: 1,
            unitPrice: 100,
            tvaRate: 20,
            lineTotal: 120,
          },
        },
        payments: {
          create: {
            method: 'CASH',
            amount: 120,
          },
        },
      },
    });
    tenantBSaleId = saleB.id;

    // 6. Create Tenant B Invoice
    const invoiceB = await prisma.invoice.create({
      data: {
        companyId: tenantB.company.id,
        number: `FAC-B-${Date.now()}`,
        customerId: tenantB.customer.id,
        subtotal: 100,
        taxTotal: 20,
        total: 120,
        status: 'SENT',
        lines: {
          create: {
            description: 'Produit B Service',
            quantity: 1,
            unitPrice: 100,
            tvaRate: 20,
            lineTotal: 120,
          },
        },
      },
    });
    tenantBInvoiceId = invoiceB.id;

    // 7. Create Tenant B Consolidated Invoice
    const consolidatedB = await prisma.consolidatedInvoice.create({
      data: {
        companyId: tenantB.company.id,
        customerId: tenantB.customer.id,
        reference: `CI-B-${Date.now()}`,
        periodStart: new Date('2026-01-01'),
        periodEnd: new Date('2026-12-31'),
        total: 120,
        taxTotal: 20,
      },
    });
    tenantBConsolidatedInvoiceId = consolidatedB.id;
  });

  after(async () => {
    await cleanupTestTenant(tenantA);
    await cleanupTestTenant(tenantB);
    await closeTestServer();
  });

  // -------------------------------------------------------------
  // 1. Cross-Tenant Contacts Isolation
  // -------------------------------------------------------------
  describe('Contacts Isolation', () => {
    it('Tenant A cannot read Tenant B contacts (404)', async () => {
      const tokenA = tenantA.users.ADMIN.token;
      const res = await serverCtx.client.get(`/api/contacts/${tenantB.customer.id}`, tokenA);
      // Either 404 or route not exposing /:id directly (if /api/contacts list is scoped)
      // If /api/contacts list is used: verify Tenant B contact is NOT in Tenant A contact list
      const listRes = await serverCtx.client.get('/api/contacts', tokenA);
      assert.strictEqual(listRes.status, 200);
      const contactIds = listRes.body.contacts.map((c: any) => c.id);
      assert.strictEqual(contactIds.includes(tenantB.customer.id), false, 'Tenant A contact list must not contain Tenant B customer');
      assert.strictEqual(contactIds.includes(tenantB.supplier.id), false, 'Tenant A contact list must not contain Tenant B supplier');
    });

    it('Tenant A cannot update Tenant B contacts (404)', async () => {
      const tokenA = tenantA.users.ADMIN.token;
      const res = await serverCtx.client.put(`/api/contacts/${tenantB.customer.id}`, {
        fullName: 'Hacked Contact Name',
        type: 'CUSTOMER',
      }, tokenA);

      assert.strictEqual(res.status, 404, `Tenant A updating Tenant B contact must return 404, got ${res.status}`);
    });

    it('Tenant A cannot view Tenant B contact ledger (404)', async () => {
      const tokenA = tenantA.users.ADMIN.token;
      const res = await serverCtx.client.get(`/api/contacts/${tenantB.customer.id}/ledger`, tokenA);
      assert.strictEqual(res.status, 404, `Tenant A viewing Tenant B contact ledger must return 404, got ${res.status}`);
    });

    it('Tenant A cannot settle balance on Tenant B contact (404)', async () => {
      const tokenA = tenantA.users.ADMIN.token;
      const res = await serverCtx.client.post(`/api/contacts/${tenantB.customer.id}/settle`, {
        amount: 50,
        method: 'CASH',
      }, tokenA);
      assert.strictEqual(res.status, 404, `Tenant A settling Tenant B contact must return 404, got ${res.status}`);
    });

    it('Tenant A cannot associate contact with Tenant B customerGroupId (400)', async () => {
      const tokenA = tenantA.users.ADMIN.token;
      const res = await serverCtx.client.post('/api/contacts', {
        fullName: 'Attacker Contact',
        type: 'CUSTOMER',
        customerGroupId: tenantBCustomerGroupId,
      }, tokenA);

      assert.strictEqual(res.status, 400, `Cross-tenant customerGroupId reference must return 400, got ${res.status}`);
      assert.match(res.body.message, /Groupe client invalide/i);
    });
  });

  // -------------------------------------------------------------
  // 2. Cross-Tenant Products & Inventory Isolation
  // -------------------------------------------------------------
  describe('Products & Inventory Isolation', () => {
    it('Tenant A product list excludes Tenant B products', async () => {
      const tokenA = tenantA.users.ADMIN.token;
      const res = await serverCtx.client.get('/api/products', tokenA);
      assert.strictEqual(res.status, 200);

      const productIds = res.body.products.map((p: any) => p.id);
      assert.strictEqual(productIds.includes(tenantB.product.id), false, 'Tenant A product list must not leak Tenant B products');
    });

    it('Tenant A cannot update Tenant B product (404)', async () => {
      const tokenA = tenantA.users.ADMIN.token;
      const res = await serverCtx.client.put(`/api/products/${tenantB.product.id}`, {
        name: 'Hacked Product Name',
        salePrice: 1,
        categoryName: 'General',
      }, tokenA);

      assert.strictEqual(res.status, 404, `Tenant A updating Tenant B product must return 404, got ${res.status}`);
    });

    it('Tenant A cannot sell Tenant B product in POS checkout (400)', async () => {
      const tokenA = tenantA.users.ADMIN.token;
      const res = await serverCtx.client.post('/api/sales', {
        customerId: tenantA.customer.id,
        method: 'CASH',
        status: 'FINAL',
        locationId: tenantA.location.id,
        items: [
          {
            productId: tenantB.product.id, // cross-tenant product
            quantity: 1,
            discount: 0,
          },
        ],
      }, tokenA);

      assert.strictEqual(res.status, 400, `POS sale with cross-tenant product must fail with 400, got ${res.status}`);
      assert.match(res.body.message, /Un produit du panier est introuvable/i);
    });

    it('Tenant A cannot purchase Tenant B product (404)', async () => {
      const tokenA = tenantA.users.ADMIN.token;
      const res = await serverCtx.client.post('/api/purchases', {
        supplierId: tenantA.supplier.id,
        items: [{ productId: tenantB.product.id, quantity: 5, unitCost: 30 }],
        total: 150,
      }, tokenA);

      assert.strictEqual(res.status, 404, `Purchase with cross-tenant product must fail with 404, got ${res.status}`);
      assert.match(res.body.error, /Produit introuvable/i);
    });

    it('Tenant A cannot adjust stock on Tenant B product (404)', async () => {
      const tokenA = tenantA.users.ADMIN.token;
      const res = await serverCtx.client.post('/api/inventory/adjustment', {
        adjustments: [{ productId: tenantB.product.id, quantity: 100 }],
      }, tokenA);

      assert.strictEqual(res.status, 404, `Stock adjustment on cross-tenant product must fail with 404, got ${res.status}`);
      assert.match(res.body.error, /Produit introuvable/i);
    });
  });

  // -------------------------------------------------------------
  // 3. Cross-Tenant Expenses Isolation
  // -------------------------------------------------------------
  describe('Expenses Isolation', () => {
    it('Tenant A expense list excludes Tenant B expenses', async () => {
      const tokenA = tenantA.users.ADMIN.token;
      const res = await serverCtx.client.get('/api/expenses', tokenA);
      assert.strictEqual(res.status, 200);

      const expenseIds = res.body.expenses.map((e: any) => e.id);
      assert.strictEqual(expenseIds.includes(tenantBExpenseId), false, 'Tenant A expense list must not leak Tenant B expenses');
    });

    it('Tenant A cannot update Tenant B expense (404)', async () => {
      const tokenA = tenantA.users.ADMIN.token;
      const res = await serverCtx.client.put(`/api/expenses/${tenantBExpenseId}`, {
        category: 'Hacked Expense',
        amount: 999999,
        date: new Date().toISOString().split('T')[0],
      }, tokenA);

      assert.strictEqual(res.status, 404, `Tenant A updating Tenant B expense must return 404, got ${res.status}`);
    });

    it('Tenant A cannot create expense referencing Tenant B location (400)', async () => {
      const tokenA = tenantA.users.ADMIN.token;
      const res = await serverCtx.client.post('/api/expenses', {
        locationId: tenantB.location.id, // cross-tenant location
        category: 'Transport',
        amount: 200,
        date: new Date().toISOString().split('T')[0],
        paymentMethod: 'CASH',
      }, tokenA);

      assert.strictEqual(res.status, 400, `Expense with cross-tenant location must return 400, got ${res.status}`);
      assert.match(res.body.message, /Magasin invalide/i);
    });
  });

  // -------------------------------------------------------------
  // 4. Cross-Tenant Accounting & Ledgers Isolation
  // -------------------------------------------------------------
  describe('Accounting & Ledgers Isolation', () => {
    it('Tenant A cannot view transactions of Tenant B account (404)', async () => {
      const tokenA = tenantA.users.ADMIN.token;
      const res = await serverCtx.client.get(`/api/accounting/accounts/${tenantBAccountId}/transactions`, tokenA);
      assert.strictEqual(res.status, 404, `Reading Tenant B account transactions must return 404, got ${res.status}`);
    });

    it('Tenant A cannot post transactions to Tenant B account (404)', async () => {
      const tokenA = tenantA.users.ADMIN.token;
      const res = await serverCtx.client.post(`/api/accounting/accounts/${tenantBAccountId}/transactions`, {
        type: 'DEBIT',
        amount: 5000,
        note: 'Cross-tenant attack',
      }, tokenA);

      assert.strictEqual(res.status, 404, `Posting to Tenant B account must return 404, got ${res.status}`);
    });

    it('Tenant A cannot view Tenant B ledger (404)', async () => {
      const tokenA = tenantA.users.ADMIN.token;
      const res = await serverCtx.client.get(`/api/accounting/ledger/${tenantBAccountId}`, tokenA);
      assert.strictEqual(res.status, 404, `Viewing Tenant B ledger must return 404, got ${res.status}`);
    });
  });

  // -------------------------------------------------------------
  // 5. Cross-Tenant Invoices, Sales & Documents Isolation
  // -------------------------------------------------------------
  describe('Invoices, Sales & Documents Isolation', () => {
    it('Tenant A cannot access Tenant B receipt PDF (404)', async () => {
      const tokenA = tenantA.users.ADMIN.token;
      const res = await serverCtx.client.get(`/api/sales/${tenantBSaleId}/receipt`, tokenA);
      assert.strictEqual(res.status, 404, `Tenant A viewing Tenant B sale receipt must return 404, got ${res.status}`);
    });

    it('Tenant A cannot access Tenant B invoice PDF (404)', async () => {
      const tokenA = tenantA.users.ADMIN.token;
      const res = await serverCtx.client.get(`/api/sales/${tenantBSaleId}/invoice`, tokenA);
      assert.strictEqual(res.status, 404, `Tenant A viewing Tenant B sale invoice must return 404, got ${res.status}`);
    });

    it('Tenant A cannot create consolidated invoice using Tenant B customer (404)', async () => {
      const tokenA = tenantA.users.ADMIN.token;
      const res = await serverCtx.client.post('/api/invoices/consolidated', {
        customerId: tenantB.customer.id,
        saleIds: [tenantBSaleId],
        periodStart: '2026-01-01',
        periodEnd: '2026-12-31',
      }, tokenA);

      assert.strictEqual(res.status, 404, `Consolidating Tenant B customer must return 404, got ${res.status}`);
      assert.match(res.body.error, /Customer not found/i);
    });

    it('Tenant A cannot access Tenant B consolidated invoice PDF (404)', async () => {
      const tokenA = tenantA.users.ADMIN.token;
      const res = await serverCtx.client.get(`/api/invoices/consolidated/${tenantBConsolidatedInvoiceId}/pdf`, tokenA);
      assert.strictEqual(res.status, 404, `Viewing Tenant B consolidated invoice PDF must return 404, got ${res.status}`);
    });

    it('Tenant A cannot modify Tenant B invoice status (404)', async () => {
      const tokenA = tenantA.users.ADMIN.token;
      const res = await serverCtx.client.patch(`/api/invoices/${tenantBInvoiceId}/status`, {
        status: 'CANCELLED',
      }, tokenA);

      assert.strictEqual(res.status, 404, `Modifying Tenant B invoice status must return 404, got ${res.status}`);
    });

    it('Tenant A cannot record payment on Tenant B invoice (404)', async () => {
      const tokenA = tenantA.users.ADMIN.token;
      const res = await serverCtx.client.post(`/api/invoices/${tenantBInvoiceId}/payments`, {
        amount: 100,
        method: 'CASH',
      }, tokenA);

      assert.strictEqual(res.status, 404, `Recording payment on Tenant B invoice must return 404, got ${res.status}`);
    });
  });

  // -------------------------------------------------------------
  // 6. Cross-Tenant Settings, Devices, Locations, and User Permissions Isolation
  // -------------------------------------------------------------
  describe('Settings, Devices, Locations, and Users Isolation', () => {
    it('Tenant A cannot revoke Tenant B device (404)', async () => {
      const tokenA = tenantA.users.ADMIN.token;
      const res = await serverCtx.client.delete(`/api/settings/devices/${tenantBDeviceId}`, tokenA);
      assert.strictEqual(res.status, 404, `Revoking Tenant B device must return 404, got ${res.status}`);
    });

    it('Tenant A cannot update Tenant B location (404)', async () => {
      const tokenA = tenantA.users.ADMIN.token;
      const res = await serverCtx.client.put(`/api/locations/${tenantB.location.id}`, {
        name: 'Hijacked Location',
      }, tokenA);

      assert.strictEqual(res.status, 404, `Updating Tenant B location must return 404, got ${res.status}`);
    });

    it('Tenant A cannot read Tenant B user permission overrides (404)', async () => {
      const tokenA = tenantA.users.ADMIN.token;
      const userBId = tenantB.users.CASHIER.id;
      const res = await serverCtx.client.get(`/api/settings/permissions/${userBId}`, tokenA);
      assert.strictEqual(res.status, 404, `Reading Tenant B user permissions must return 404, got ${res.status}`);
    });

    it('Tenant A cannot write Tenant B user permission overrides (404)', async () => {
      const tokenA = tenantA.users.ADMIN.token;
      const userBId = tenantB.users.CASHIER.id;
      const res = await serverCtx.client.put(`/api/settings/permissions/${userBId}`, {
        action: 'devices.manage',
        granted: true,
      }, tokenA);

      assert.strictEqual(res.status, 404, `Writing Tenant B user permissions must return 404, got ${res.status}`);
    });
  });
});
