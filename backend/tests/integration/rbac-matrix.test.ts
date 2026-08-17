import { describe, it, before, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { getTestServer, closeTestServer, RunningTestServer } from '../helpers/test-server.js';
import { createTestTenant, cleanupTestTenant, TestTenantContext } from '../helpers/test-db.js';

describe('Integration: 27-Route RBAC Matrix & Role Permissions', () => {
  let serverCtx: RunningTestServer;
  let tenant: TestTenantContext;

  before(async () => {
    serverCtx = await getTestServer();
    tenant = await createTestTenant('rbac-matrix');
  });

  after(async () => {
    await cleanupTestTenant(tenant);
    await closeTestServer();
  });

  // -------------------------------------------------------------
  // 1. Unauthenticated baseline check across routes (401 Unauthorized)
  // -------------------------------------------------------------
  describe('Unauthenticated access protection', () => {
    it('Rejects requests without bearer token with 401 Unauthorized', async () => {
      const endpoints = [
        '/api/sales',
        '/api/products',
        '/api/locations',
        '/api/contacts',
        '/api/expenses',
        '/api/purchases',
        '/api/register/sessions',
        '/api/inventory/stock',
        '/api/invoices',
        '/api/attendance',
        '/api/settings',
        '/api/pricing/groups',
        '/api/accounting/accounts',
        '/api/commission-agents',
        '/api/notifications/templates',
        '/api/dashboard-config',
        '/api/currencies',
        '/api/warranties',
        '/api/variation-templates',
        '/api/discounts',
        '/api/auth/me',
      ];

      for (const endpoint of endpoints) {
        const res = await serverCtx.client.get(endpoint);
        assert.strictEqual(res.status, 401, `Endpoint ${endpoint} must require authentication (got ${res.status})`);
      }
    });
  });

  // -------------------------------------------------------------
  // 2. Sales & POS Operations (CASHIER, MANAGER, ADMIN permitted)
  // -------------------------------------------------------------
  describe('Sales & POS Operations', () => {
    it('CASHIER can list sales and create POS sales', async () => {
      const token = tenant.users.CASHIER.token;

      const listRes = await serverCtx.client.get('/api/sales', token);
      assert.strictEqual(listRes.status, 200, 'Cashier should be allowed to list sales');

      const createRes = await serverCtx.client.post('/api/sales', {
        customerId: tenant.customer.id,
        method: 'CASH',
        status: 'FINAL',
        locationId: tenant.location.id,
        items: [
          {
            productId: tenant.product.id,
            quantity: 2,
            discount: 0,
          },
        ],
      }, token);

      assert.strictEqual(createRes.status, 201, `Cashier should be allowed to create sales, got ${createRes.status}: ${JSON.stringify(createRes.body)}`);
      assert.ok(createRes.body.id, 'Created sale should have an id');

      const saleId = createRes.body.id;
      const receiptRes = await serverCtx.client.get(`/api/sales/${saleId}/receipt`, token);
      assert.strictEqual(receiptRes.status, 200, 'Cashier should be allowed to fetch receipt PDF');
    });

    it('MANAGER can list sales and create POS sales', async () => {
      const token = tenant.users.MANAGER.token;

      const createRes = await serverCtx.client.post('/api/sales', {
        customerId: tenant.customer.id,
        method: 'CASH',
        status: 'FINAL',
        locationId: tenant.location.id,
        items: [
          {
            productId: tenant.product.id,
            quantity: 1,
            discount: 0,
          },
        ],
      }, token);

      assert.strictEqual(createRes.status, 201, 'Manager should be allowed to create sales');
    });

    it('ADMIN can list sales and create POS sales', async () => {
      const token = tenant.users.ADMIN.token;

      const createRes = await serverCtx.client.post('/api/sales', {
        customerId: tenant.customer.id,
        method: 'CASH',
        status: 'FINAL',
        locationId: tenant.location.id,
        items: [
          {
            productId: tenant.product.id,
            quantity: 1,
            discount: 0,
          },
        ],
      }, token);

      assert.strictEqual(createRes.status, 201, 'Admin should be allowed to create sales');
    });
  });

  // -------------------------------------------------------------
  // 3. Catalog & Products: Cashier/User browse only, Manager/Admin manage
  // -------------------------------------------------------------
  describe('Catalog & Products Management', () => {
    it('All roles (USER, CASHIER, MANAGER, ADMIN) can browse products', async () => {
      for (const role of ['USER', 'CASHIER', 'MANAGER', 'ADMIN'] as const) {
        const token = tenant.users[role].token;
        const res = await serverCtx.client.get('/api/products', token);
        assert.strictEqual(res.status, 200, `${role} should be allowed to browse products`);
        assert.ok(Array.isArray(res.body.products), `${role} should receive products list`);
      }
    });

    it('CASHIER and USER are forbidden (403) from creating or editing products', async () => {
      const productPayload = {
        name: 'Unauthorized Product Test',
        salePrice: 150,
        categoryName: 'General',
        initialStock: 10,
        trackStock: true,
      };

      for (const role of ['CASHIER', 'USER'] as const) {
        const token = tenant.users[role].token;

        const createRes = await serverCtx.client.post('/api/products', productPayload, token);
        assert.strictEqual(createRes.status, 403, `${role} must be forbidden (403) from creating products`);

        const updateRes = await serverCtx.client.put(`/api/products/${tenant.product.id}`, productPayload, token);
        assert.strictEqual(updateRes.status, 403, `${role} must be forbidden (403) from updating products`);

        const bulkRes = await serverCtx.client.patch('/api/products/bulk', { productIds: [tenant.product.id], updates: { salePrice: 120 } }, token);
        assert.strictEqual(bulkRes.status, 403, `${role} must be forbidden (403) from bulk updating products`);
      }
    });

    it('MANAGER and ADMIN are permitted to create and edit products', async () => {
      const managerToken = tenant.users.MANAGER.token;
      const adminToken = tenant.users.ADMIN.token;

      const mgrCreateRes = await serverCtx.client.post('/api/products', {
        name: `Manager Product ${Date.now()}`,
        salePrice: 120,
        categoryName: 'General',
        initialStock: 5,
        trackStock: true,
      }, managerToken);
      assert.strictEqual(mgrCreateRes.status, 201, `Manager should be able to create product, got ${mgrCreateRes.status}`);

      const createdProductId = mgrCreateRes.body.id;

      const adminUpdateRes = await serverCtx.client.put(`/api/products/${createdProductId}`, {
        name: `Admin Updated Product ${Date.now()}`,
        salePrice: 130,
        categoryName: 'General',
        initialStock: 5,
        trackStock: true,
      }, adminToken);
      assert.strictEqual(adminUpdateRes.status, 200, `Admin should be able to update product, got ${adminUpdateRes.status}`);
    });
  });

  // -------------------------------------------------------------
  // 4. Cash Register Operations (CASHIER, MANAGER, ADMIN permitted)
  // -------------------------------------------------------------
  describe('Cash Register Operations', () => {
    it('CASHIER can view register sessions, open session, add movement, and close session', async () => {
      const token = tenant.users.CASHIER.token;

      const sessionsRes = await serverCtx.client.get('/api/register/sessions', token);
      assert.strictEqual(sessionsRes.status, 200, 'Cashier should be allowed to view register sessions');

      const openRes = await serverCtx.client.post('/api/register/open', {
        locationId: tenant.location.id,
        initialCash: 100,
      }, token);
      assert.strictEqual(openRes.status, 200, 'Cashier should be allowed to open register session');
      assert.ok(openRes.body.session?.id, 'Open session should return created session id');

      const sessionId = openRes.body.session.id;

      const moveRes = await serverCtx.client.post('/api/register/movements', {
        locationId: tenant.location.id,
        sessionId,
        type: 'IN',
        amount: 50,
        note: 'Additional float',
      }, token);
      assert.strictEqual(moveRes.status, 200, 'Cashier should be allowed to register cash movements');

      const closeRes = await serverCtx.client.post('/api/register/close', {
        sessionId,
        countedCash: 150,
        expectedCash: 150,
      }, token);
      assert.strictEqual(closeRes.status, 200, 'Cashier should be allowed to close register session');
    });
  });

  // -------------------------------------------------------------
  // 5. Accounting & Ledger Management (ADMIN, MANAGER permitted; CASHIER, USER 403)
  // -------------------------------------------------------------
  describe('Accounting & Ledger RBAC', () => {
    it('CASHIER and USER are forbidden (403) on accounting mutations', async () => {
      for (const role of ['CASHIER', 'USER'] as const) {
        const token = tenant.users[role].token;

        const typeRes = await serverCtx.client.post('/api/accounting/types', { name: 'Banque' }, token);
        assert.strictEqual(typeRes.status, 403, `${role} must be forbidden (403) on POST /api/accounting/types`);

        const accRes = await serverCtx.client.post('/api/accounting/accounts', { name: 'Compte CIH', openingBalance: 1000 }, token);
        assert.strictEqual(accRes.status, 403, `${role} must be forbidden (403) on POST /api/accounting/accounts`);

        const txRes = await serverCtx.client.post('/api/accounting/accounts/1/transactions', { type: 'DEBIT', amount: 500 }, token);
        assert.strictEqual(txRes.status, 403, `${role} must be forbidden (403) on POST /api/accounting/accounts/:id/transactions`);
      }
    });

    it('MANAGER and ADMIN are permitted on accounting mutations', async () => {
      const mgrToken = tenant.users.MANAGER.token;
      const adminToken = tenant.users.ADMIN.token;

      const typeRes = await serverCtx.client.post('/api/accounting/types', { name: `Type-${Date.now()}` }, mgrToken);
      assert.strictEqual(typeRes.status, 201, `Manager should be allowed to create account types, got ${typeRes.status}`);

      const accRes = await serverCtx.client.post('/api/accounting/accounts', {
        name: `Account-${Date.now()}`,
        accountTypeId: typeRes.body.type.id,
        openingBalance: 500,
      }, adminToken);
      assert.strictEqual(accRes.status, 201, `Admin should be allowed to create accounts, got ${accRes.status}`);

      const txRes = await serverCtx.client.post(`/api/accounting/accounts/${accRes.body.account.id}/transactions`, {
        type: 'DEBIT',
        amount: 200,
        note: 'Deposit',
      }, mgrToken);
      assert.strictEqual(txRes.status, 201, `Manager should be allowed to post transactions, got ${txRes.status}`);
    });
  });

  // -------------------------------------------------------------
  // 6. Sales Commission Agents (ADMIN, MANAGER permitted; CASHIER, USER 403)
  // -------------------------------------------------------------
  describe('Sales Commission Agents RBAC', () => {
    it('CASHIER and USER are forbidden (403) on POST /api/commission-agents', async () => {
      for (const role of ['CASHIER', 'USER'] as const) {
        const token = tenant.users[role].token;
        const res = await serverCtx.client.post('/api/commission-agents', {
          name: 'Agent Test',
          commissionRate: 5,
        }, token);
        assert.strictEqual(res.status, 403, `${role} must be forbidden (403) on commission agent creation`);
      }
    });

    it('MANAGER and ADMIN can create commission agents and view reports', async () => {
      const mgrToken = tenant.users.MANAGER.token;
      const adminToken = tenant.users.ADMIN.token;

      const mgrRes = await serverCtx.client.post('/api/commission-agents', {
        name: `Agent-${Date.now()}`,
        commissionRate: 5,
      }, mgrToken);
      assert.strictEqual(mgrRes.status, 201, `Manager should be allowed to create agent, got ${mgrRes.status}`);

      const adminReportRes = await serverCtx.client.get('/api/commission-agents/report', adminToken);
      assert.strictEqual(adminReportRes.status, 200, 'Admin should be allowed to view commission report');
    });
  });

  // -------------------------------------------------------------
  // 7. Settings & Device Fleet Management (ADMIN, MANAGER permitted; CASHIER, USER 403)
  // -------------------------------------------------------------
  describe('Settings & Device Fleet RBAC', () => {
    it('CASHIER and USER are forbidden (403) on device fleet management', async () => {
      for (const role of ['CASHIER', 'USER'] as const) {
        const token = tenant.users[role].token;

        const listRes = await serverCtx.client.get('/api/settings/devices', token);
        assert.strictEqual(listRes.status, 403, `${role} must be forbidden (403) on GET /api/settings/devices`);

        const createRes = await serverCtx.client.post('/api/settings/devices', { locationId: tenant.location.id }, token);
        assert.strictEqual(createRes.status, 403, `${role} must be forbidden (403) on POST /api/settings/devices`);

        const delRes = await serverCtx.client.delete('/api/settings/devices/1', token);
        assert.strictEqual(delRes.status, 403, `${role} must be forbidden (403) on DELETE /api/settings/devices/:id`);

        const updateSettingsRes = await serverCtx.client.put('/api/settings', { companyName: 'Hacked Store' }, token);
        assert.strictEqual(updateSettingsRes.status, 403, `${role} must be forbidden (403) on PUT /api/settings`);
      }
    });

    it('MANAGER and ADMIN are permitted on device fleet management', async () => {
      const mgrToken = tenant.users.MANAGER.token;
      const adminToken = tenant.users.ADMIN.token;

      const createRes = await serverCtx.client.post('/api/settings/devices', { locationId: tenant.location.id }, mgrToken);
      assert.strictEqual(createRes.status, 201, `Manager should be allowed to register device, got ${createRes.status}`);
      assert.ok(createRes.body.activationCode, 'Device activationCode should be generated');

      const deviceId = createRes.body.id;
      const listRes = await serverCtx.client.get('/api/settings/devices', adminToken);
      assert.strictEqual(listRes.status, 200, 'Admin should be allowed to list devices');

      const deleteRes = await serverCtx.client.delete(`/api/settings/devices/${deviceId}`, mgrToken);
      assert.strictEqual(deleteRes.status, 200, 'Manager should be allowed to revoke device');
    });
  });

  // -------------------------------------------------------------
  // 8. Locations Management (ADMIN only; MANAGER, CASHIER, USER 403)
  // -------------------------------------------------------------
  describe('Locations RBAC (Admin-Only Mutations)', () => {
    it('MANAGER, CASHIER, and USER are forbidden (403) from creating or modifying locations', async () => {
      for (const role of ['MANAGER', 'CASHIER', 'USER'] as const) {
        const token = tenant.users[role].token;

        const createRes = await serverCtx.client.post('/api/locations', { name: `Store-${role}-${Date.now()}` }, token);
        assert.strictEqual(createRes.status, 403, `${role} must be forbidden (403) from POST /api/locations`);

        const updateRes = await serverCtx.client.put(`/api/locations/${tenant.location.id}`, { name: 'Renamed Store' }, token);
        assert.strictEqual(updateRes.status, 403, `${role} must be forbidden (403) from PUT /api/locations/:id`);
      }
    });

    it('ADMIN can create and modify locations', async () => {
      const adminToken = tenant.users.ADMIN.token;

      const createRes = await serverCtx.client.post('/api/locations', {
        name: `New Admin Location ${Date.now()}`,
        address: '123 Boulevard d’Anfa, Casablanca',
      }, adminToken);
      assert.strictEqual(createRes.status, 200, `Admin should be able to create locations, got ${createRes.status}`);

      const locationId = createRes.body.location.id;
      const updateRes = await serverCtx.client.put(`/api/locations/${locationId}`, {
        name: `Updated Admin Location ${Date.now()}`,
      }, adminToken);
      assert.strictEqual(updateRes.status, 200, `Admin should be able to update locations, got ${updateRes.status}`);
    });
  });

  // -------------------------------------------------------------
  // 9. Permissions & Overrides Management (ADMIN only; MANAGER, CASHIER, USER 403)
  // -------------------------------------------------------------
  describe('Permission Overrides RBAC (Admin-Only)', () => {
    it('MANAGER, CASHIER, and USER are forbidden (403) from permission overrides', async () => {
      const cashierUserId = tenant.users.CASHIER.id;

      for (const role of ['MANAGER', 'CASHIER', 'USER'] as const) {
        const token = tenant.users[role].token;

        const actionsRes = await serverCtx.client.get('/api/settings/permissions/actions', token);
        assert.strictEqual(actionsRes.status, 403, `${role} must be forbidden (403) from GET /api/settings/permissions/actions`);

        const getPermsRes = await serverCtx.client.get(`/api/settings/permissions/${cashierUserId}`, token);
        assert.strictEqual(getPermsRes.status, 403, `${role} must be forbidden (403) from GET /api/settings/permissions/:userId`);

        const putPermsRes = await serverCtx.client.put(`/api/settings/permissions/${cashierUserId}`, { action: 'devices.manage', granted: true }, token);
        assert.strictEqual(putPermsRes.status, 403, `${role} must be forbidden (403) from PUT /api/settings/permissions/:userId`);
      }
    });

    it('ADMIN can manage user permission overrides', async () => {
      const adminToken = tenant.users.ADMIN.token;
      const cashierUserId = tenant.users.CASHIER.id;

      const actionsRes = await serverCtx.client.get('/api/settings/permissions/actions', adminToken);
      assert.strictEqual(actionsRes.status, 200, 'Admin should be allowed to view permission actions');

      const grantRes = await serverCtx.client.put(`/api/settings/permissions/${cashierUserId}`, {
        action: 'devices.manage',
        granted: true,
      }, adminToken);
      assert.strictEqual(grantRes.status, 200, 'Admin should be allowed to grant permission override');

      const userPermsRes = await serverCtx.client.get(`/api/settings/permissions/${cashierUserId}`, adminToken);
      assert.strictEqual(userPermsRes.status, 200, 'Admin should be allowed to read user overrides');

      const revokeRes = await serverCtx.client.delete(`/api/settings/permissions/${cashierUserId}/devices.manage`, adminToken);
      assert.strictEqual(revokeRes.status, 200, 'Admin should be allowed to delete permission override');
    });
  });

  // -------------------------------------------------------------
  // 10. Operational Matrix (Purchases, Invoices, Inventory, Pricing, Currencies, Warranties, Discounts, Imports)
  // -------------------------------------------------------------
  describe('Operational Routes RBAC Matrix', () => {
    it('CASHIER is forbidden (403) across elevated operational endpoints', async () => {
      const token = tenant.users.CASHIER.token;

      // Purchases
      const purchaseRes = await serverCtx.client.post('/api/purchases', {
        supplierId: tenant.supplier.id,
        items: [{ productId: tenant.product.id, quantity: 10, unitCost: 50 }],
        total: 500,
      }, token);
      assert.strictEqual(purchaseRes.status, 403, 'Cashier must be 403 on POST /api/purchases');

      // Invoices
      const invoiceRes = await serverCtx.client.post('/api/invoices', {
        customerId: tenant.customer.id,
        mode: 'MANUAL',
        manualLines: [{ description: 'Item A', quantity: 1, unitPrice: 100, tvaRate: 20 }],
      }, token);
      assert.strictEqual(invoiceRes.status, 403, 'Cashier must be 403 on POST /api/invoices');

      // Inventory adjustment
      const adjRes = await serverCtx.client.post('/api/inventory/adjustment', {
        adjustments: [{ productId: tenant.product.id, quantity: 5 }],
      }, token);
      assert.strictEqual(adjRes.status, 403, 'Cashier must be 403 on POST /api/inventory/adjustment');

      // Pricing groups
      const priceGroupRes = await serverCtx.client.post('/api/pricing/groups', { name: 'Wholesale' }, token);
      assert.strictEqual(priceGroupRes.status, 403, 'Cashier must be 403 on POST /api/pricing/groups');

      // Currencies
      const currRes = await serverCtx.client.post('/api/currencies', { code: 'EUR', name: 'Euro', rate: 10.8 }, token);
      assert.strictEqual(currRes.status, 403, 'Cashier must be 403 on POST /api/currencies');

      // Warranties
      const warrantyRes = await serverCtx.client.post('/api/warranties', { name: '2 Years', duration: 24, durationType: 'MONTHS' }, token);
      assert.strictEqual(warrantyRes.status, 403, 'Cashier must be 403 on POST /api/warranties');

      // Variation templates
      const varTemplateRes = await serverCtx.client.post('/api/variation-templates', { name: 'Colors', values: ['Red', 'Blue'] }, token);
      assert.strictEqual(varTemplateRes.status, 403, 'Cashier must be 403 on POST /api/variation-templates');

      // Discounts
      const discRes = await serverCtx.client.post('/api/discounts', { name: 'Promo 10%', discountType: 'PERCENTAGE', amount: 10 }, token);
      assert.strictEqual(discRes.status, 403, 'Cashier must be 403 on POST /api/discounts');

      // Notification templates
      const notifRes = await serverCtx.client.post('/api/notifications/templates', { event: 'ORDER_READY', channel: 'SMS', body: 'Ready' }, token);
      assert.strictEqual(notifRes.status, 403, 'Cashier must be 403 on POST /api/notifications/templates');

      // Imports
      const importRes = await serverCtx.client.post('/api/imports/products', { products: [{ name: 'Imported', salePrice: 10 }] }, token);
      assert.strictEqual(importRes.status, 403, 'Cashier must be 403 on POST /api/imports/products');
    });

    it('MANAGER and ADMIN have elevated operational access', async () => {
      const mgrToken = tenant.users.MANAGER.token;
      const adminToken = tenant.users.ADMIN.token;

      // Purchases (Manager)
      const purchaseRes = await serverCtx.client.post('/api/purchases', {
        supplierId: tenant.supplier.id,
        items: [{ productId: tenant.product.id, quantity: 5, unitCost: 40 }],
        total: 200,
      }, mgrToken);
      assert.strictEqual(purchaseRes.status, 200, `Manager should be permitted on POST /api/purchases, got ${purchaseRes.status}`);

      // Invoices (Admin)
      const invoiceRes = await serverCtx.client.post('/api/invoices', {
        customerId: tenant.customer.id,
        mode: 'MANUAL',
        manualLines: [{ description: 'Service Consulting', quantity: 1, unitPrice: 200, tvaRate: 20 }],
      }, adminToken);
      assert.strictEqual(invoiceRes.status, 201, `Admin should be permitted on POST /api/invoices, got ${invoiceRes.status}`);

      // Inventory adjustment (Manager)
      const adjRes = await serverCtx.client.post('/api/inventory/adjustment', {
        adjustments: [{ productId: tenant.product.id, quantity: 45 }],
      }, mgrToken);
      assert.strictEqual(adjRes.status, 200, `Manager should be permitted on POST /api/inventory/adjustment, got ${adjRes.status}`);

      // Pricing groups (Admin)
      const priceGroupRes = await serverCtx.client.post('/api/pricing/groups', { name: `VIP Group ${Date.now()}` }, adminToken);
      assert.strictEqual(priceGroupRes.status, 201, `Admin should be permitted on POST /api/pricing/groups, got ${priceGroupRes.status}`);

      // Currencies (Manager)
      const currRes = await serverCtx.client.post('/api/currencies', {
        code: 'EUR',
        name: 'Euro Currency',
        rate: 10.85,
      }, mgrToken);
      assert.strictEqual(currRes.status, 201, `Manager should be permitted on POST /api/currencies, got ${currRes.status}`);

      // Warranties (Admin)
      const warrantyRes = await serverCtx.client.post('/api/warranties', {
        name: `Warranty-${Date.now()}`,
        duration: 12,
        durationType: 'MONTHS',
      }, adminToken);
      assert.strictEqual(warrantyRes.status, 201, `Admin should be permitted on POST /api/warranties, got ${warrantyRes.status}`);

      // Variation templates (Manager)
      const varTemplateRes = await serverCtx.client.post('/api/variation-templates', {
        name: `Sizes-${Date.now()}`,
        values: ['S', 'M', 'L', 'XL'],
      }, mgrToken);
      assert.strictEqual(varTemplateRes.status, 201, `Manager should be permitted on POST /api/variation-templates, got ${varTemplateRes.status}`);

      // Discounts (Admin)
      const discRes = await serverCtx.client.post('/api/discounts', {
        name: `Discount-${Date.now()}`,
        discountType: 'PERCENTAGE',
        amount: 15,
      }, adminToken);
      assert.strictEqual(discRes.status, 201, `Admin should be permitted on POST /api/discounts, got ${discRes.status}`);
    });
  });

  // -------------------------------------------------------------
  // 11. General & Common Routes (Contacts, Attendance, Dashboard Config, Auth me)
  // -------------------------------------------------------------
  describe('General & Common Routes Accessibility', () => {
    it('All authenticated roles can access contacts, attendance, dashboard-config, and profile me', async () => {
      for (const role of ['USER', 'CASHIER', 'MANAGER', 'ADMIN'] as const) {
        const token = tenant.users[role].token;

        const meRes = await serverCtx.client.get('/api/auth/me', token);
        assert.strictEqual(meRes.status, 200, `${role} should access /api/auth/me`);
        assert.strictEqual(meRes.body.user.role, role);

        const contactsRes = await serverCtx.client.get('/api/contacts', token);
        assert.strictEqual(contactsRes.status, 200, `${role} should access /api/contacts`);

        const attRes = await serverCtx.client.get('/api/attendance', token);
        assert.strictEqual(attRes.status, 200, `${role} should access /api/attendance`);

        const clockInRes = await serverCtx.client.post('/api/attendance/clock-in', {}, token);
        assert.strictEqual(clockInRes.status, 201, `${role} should be able to clock-in`);

        const clockOutRes = await serverCtx.client.post('/api/attendance/clock-out', {}, token);
        assert.strictEqual(clockOutRes.status, 200, `${role} should be able to clock-out`);

        const dashGetRes = await serverCtx.client.get('/api/dashboard-config', token);
        assert.strictEqual(dashGetRes.status, 200, `${role} should access /api/dashboard-config`);

        const dashPutRes = await serverCtx.client.put('/api/dashboard-config', {
          widgets: [{ id: 'sales-widget', visible: true }],
        }, token);
        assert.strictEqual(dashPutRes.status, 200, `${role} should update own dashboard config`);
      }
    });
  });
});
