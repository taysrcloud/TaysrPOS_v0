import { describe, it, before, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { getTestServer, closeTestServer, RunningTestServer } from '../helpers/test-server.js';
import { createTestTenant, cleanupTestTenant, TestTenantContext } from '../helpers/test-db.js';
import { getDefaultPrisma } from '../../src/utils/prisma.js';

const prisma = getDefaultPrisma();

describe('Flow 1: POS Full Transaction Lifecycle & Cash Register Flow', () => {
  let serverCtx: RunningTestServer;
  let tenant: TestTenantContext;

  before(async () => {
    serverCtx = await getTestServer();
    tenant = await createTestTenant('pos-flow');
  });

  after(async () => {
    await cleanupTestTenant(tenant);
    await closeTestServer();
  });

  it('Executes full register session: Open -> Cash Movement -> Split Sale -> Stock Decrement -> Ledger Post -> Close & Z-Report', async () => {
    const cashierToken = tenant.users.CASHIER.token;
    const adminToken = tenant.users.ADMIN.token;

    // 1. Initial Stock Verification (50 units)
    const initialStock = await prisma.productStock.findFirstOrThrow({
      where: { productId: tenant.product.id, warehouseId: tenant.warehouse.id },
    });
    assert.strictEqual(Number(initialStock.quantity), 50, 'Initial product stock should be 50');

    // 2. Open Cash Register Session with 500 MAD opening cash
    const openRes = await serverCtx.client.post('/api/register/open', {
      initialCash: 500,
      locationId: tenant.location.id,
    }, cashierToken);

    assert.strictEqual(openRes.status, 200, `Register open failed: ${JSON.stringify(openRes.body)}`);
    assert.strictEqual(openRes.body.success, true);
    const sessionId = openRes.body.session.id;
    assert.ok(sessionId, 'Session ID must be returned');
    assert.strictEqual(Number(openRes.body.session.openingCash), 500);

    // Verify duplicate open for same user and location is rejected (409 Conflict)
    const duplicateOpenRes = await serverCtx.client.post('/api/register/open', {
      initialCash: 300,
      locationId: tenant.location.id,
    }, cashierToken);
    assert.strictEqual(duplicateOpenRes.status, 409, 'Duplicate open session must return 409 Conflict');

    // 3. Add Cash Movement (Deposit IN 100 MAD, Withdrawal OUT 50 MAD)
    const moveInRes = await serverCtx.client.post('/api/register/movements', {
      type: 'IN',
      amount: 100,
      note: 'Apport fond de caisse appoint',
      locationId: tenant.location.id,
      sessionId,
    }, cashierToken);
    assert.strictEqual(moveInRes.status, 200, `Cash movement IN failed: ${JSON.stringify(moveInRes.body)}`);
    assert.strictEqual(moveInRes.body.success, true);

    const moveOutRes = await serverCtx.client.post('/api/register/movements', {
      type: 'OUT',
      amount: 50,
      note: 'Achat fournitures d urgence',
      locationId: tenant.location.id,
      sessionId,
    }, cashierToken);
    assert.strictEqual(moveOutRes.status, 200, `Cash movement OUT failed: ${JSON.stringify(moveOutRes.body)}`);
    assert.strictEqual(moveOutRes.body.success, true);

    // Verify movements listing
    const movementsListRes = await serverCtx.client.get('/api/register/movements', cashierToken);
    assert.strictEqual(movementsListRes.status, 200);
    assert.ok(movementsListRes.body.movements.some((m: any) => m.type === 'IN' && m.amount === 100));
    assert.ok(movementsListRes.body.movements.some((m: any) => m.type === 'OUT' && m.amount === 50));

    // 4. Create Multi-tender POS Split Sale (2 units @ 100 MAD + 20% TVA = 240 MAD total)
    // Split payment: 140 MAD CASH + 100 MAD CARD
    const saleRes = await serverCtx.client.post('/api/sales', {
      customerId: tenant.customer.id,
      customerName: tenant.customer.fullName,
      locationId: tenant.location.id,
      method: 'MULTI',
      status: 'FINAL',
      splitPayments: [
        { method: 'CASH', amount: 140 },
        { method: 'CARD', amount: 100 },
      ],
      items: [
        { productId: tenant.product.id, quantity: 2, discount: 0 },
      ],
    }, cashierToken);

    assert.strictEqual(saleRes.status, 201, `Sale creation failed: ${JSON.stringify(saleRes.body)}`);
    const sale = saleRes.body;
    assert.ok(sale.id, 'Sale ID must be present');
    assert.strictEqual(Number(sale.subtotal), 200, 'Subtotal must be 200 MAD');
    assert.strictEqual(Number(sale.taxTotal), 40, 'TVA total must be 40 MAD (20% of 200)');
    assert.strictEqual(Number(sale.total), 240, 'Grand total must be 240 MAD');
    assert.strictEqual(sale.status, 'Payee', 'Completed sale must have unaccented Payee status');
    assert.strictEqual(sale.method, 'MULTI', 'Split sale must have MULTI method');
    assert.strictEqual(sale.payments.length, 2, 'Sale must record both split payment tenders');

    // 5. Verify Atomic Stock Decrement (50 - 2 = 48)
    const updatedStock = await prisma.productStock.findFirstOrThrow({
      where: { productId: tenant.product.id, warehouseId: tenant.warehouse.id },
    });
    assert.strictEqual(Number(updatedStock.quantity), 48, 'Warehouse stock must decrement by exactly 2 units');

    // Verify StockMovement audit record
    const stockMovements = await prisma.stockMovement.findMany({
      where: { productId: tenant.product.id, warehouseId: tenant.warehouse.id, type: 'OUT' },
    });
    assert.ok(stockMovements.length > 0, 'Stock movement OUT record must be recorded');
    assert.strictEqual(Number(stockMovements[0].quantity), 2);
    assert.strictEqual(stockMovements[0].reference, sale.ticket);

    // 6. Verify Cash Account Ledger Auto-Posting
    // Cash account for this location:
    // - Movement IN: DEBIT 100
    // - Movement OUT: CREDIT 50 (delta -50)
    // - Sale received (Cash + Card = 240 received): DEBIT 240
    // Total cash account currentBalance = 100 - 50 + 240 = 290
    const cashAccount = await prisma.account.findFirst({
      where: { companyId: tenant.company.id, locationId: tenant.location.id },
      include: { transactions: true },
    });
    assert.ok(cashAccount, 'Auto-posted cash account must exist for location');
    assert.strictEqual(Number(cashAccount.currentBalance), 290, 'Cash account balance should reflect all posted transactions');

    // 7. Verify Active Register Sessions List & Status
    const sessionsRes = await serverCtx.client.get('/api/register/sessions', cashierToken);
    assert.strictEqual(sessionsRes.status, 200);
    const activeSession = sessionsRes.body.sessions.find((s: any) => s.id === sessionId);
    assert.ok(activeSession, 'Session must appear in sessions list');
    assert.strictEqual(activeSession.status, 'Ouverte');
    assert.strictEqual(activeSession.initialCash, 500);

    // 8. Close Register Session with Counted Cash Drawer
    // Expected cash drawer: 500 (opening) + 100 (in) - 50 (out) + 140 (cash tender from sale) = 690 MAD
    const expectedDrawerCash = 690;
    const countedDrawerCash = 690;

    const closeRes = await serverCtx.client.post('/api/register/close', {
      sessionId,
      countedCash: countedDrawerCash,
      expectedCash: expectedDrawerCash,
    }, cashierToken);

    assert.strictEqual(closeRes.status, 200, `Register close failed: ${JSON.stringify(closeRes.body)}`);
    assert.strictEqual(closeRes.body.success, true);
    assert.strictEqual(Number(closeRes.body.session.countedCash), 690);
    assert.strictEqual(Number(closeRes.body.session.expectedCash), 690);
    assert.strictEqual(Number(closeRes.body.session.difference), 0);
    assert.ok(closeRes.body.session.closedAt, 'closedAt must be populated');

    // 9. Verify Z-Report Totals & Shift Status
    const closedSessionsRes = await serverCtx.client.get('/api/register/sessions', cashierToken);
    assert.strictEqual(closedSessionsRes.status, 200);
    const closedSession = closedSessionsRes.body.sessions.find((s: any) => s.id === sessionId);
    assert.strictEqual(closedSession.status, 'Juste', 'Zero difference session must report status Juste');
    assert.strictEqual(closedSession.actualCash, 690);
    assert.strictEqual(closedSession.difference, 0);

    // 10. Verify PDF Receipt Generation
    const receiptRes = await serverCtx.client.get(`/api/sales/${sale.id}/receipt`, cashierToken);
    assert.strictEqual(receiptRes.status, 200);
    assert.ok(receiptRes.headers.get('content-type')?.includes('application/pdf'), 'Receipt must return application/pdf Content-Type');

    // 11. Accounting & Financial Integrity Check
    const pnlRes = await serverCtx.client.get('/api/accounting/pnl', adminToken);
    assert.strictEqual(pnlRes.status, 200);
    assert.ok(Number(pnlRes.body.totalSales) > 150, 'P&L must reflect net sales revenue');
    assert.ok(Number(pnlRes.body.costOfGoodsSold) >= 100, 'P&L must reflect cost of goods sold (2 * 50 = 100)');

    const taxRes = await serverCtx.client.get('/api/accounting/tax-report', adminToken);
    assert.strictEqual(taxRes.status, 200);
    assert.ok(Number(taxRes.body.tvaCollected) > 30, 'Tax report must record collected TVA');
  });
});
