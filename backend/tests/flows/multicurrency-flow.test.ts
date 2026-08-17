import { describe, it, before, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { getTestServer, closeTestServer, RunningTestServer } from '../helpers/test-server.js';
import { createTestTenant, cleanupTestTenant, TestTenantContext } from '../helpers/test-db.js';
import { getDefaultPrisma } from '../../src/utils/prisma.js';

const prisma = getDefaultPrisma();

describe('Flow 4: Multi-Currency Purchases, Sales & FX Rate Snapshot Immutability Flow', () => {
  let serverCtx: RunningTestServer;
  let tenant: TestTenantContext;
  let eurCurrency: { id: number; code: string; rate: number };
  let usdCurrency: { id: number; code: string; rate: number };

  before(async () => {
    serverCtx = await getTestServer();
    tenant = await createTestTenant('fx-flow');
  });

  after(async () => {
    await cleanupTestTenant(tenant);
    await closeTestServer();
  });

  it('Executes multi-currency lifecycle: Configure FX -> Foreign PO -> Foreign Sale -> FX Rate Update -> Verify Immutability & Base MAD Ledger', async () => {
    const adminToken = tenant.users.ADMIN.token;
    const managerToken = tenant.users.MANAGER.token;
    const cashierToken = tenant.users.CASHIER.token;

    // -------------------------------------------------------------
    // 1. Setup Foreign Currencies (EUR @ 10.85 MAD, USD @ 10.10 MAD)
    // -------------------------------------------------------------
    const createEurRes = await serverCtx.client.post('/api/currencies', {
      code: 'EUR',
      name: 'Euro',
      symbol: '€',
      rate: 10.85,
    }, adminToken);

    assert.strictEqual(createEurRes.status, 201, `EUR creation failed: ${JSON.stringify(createEurRes.body)}`);
    assert.strictEqual(createEurRes.body.success, true);
    eurCurrency = createEurRes.body.currency;
    assert.strictEqual(Number(eurCurrency.rate), 10.85);

    const createUsdRes = await serverCtx.client.post('/api/currencies', {
      code: 'USD',
      name: 'US Dollar',
      symbol: '$',
      rate: 10.10,
    }, adminToken);

    assert.strictEqual(createUsdRes.status, 201, `USD creation failed: ${JSON.stringify(createUsdRes.body)}`);
    assert.strictEqual(createUsdRes.body.success, true);
    usdCurrency = createUsdRes.body.currency;
    assert.strictEqual(Number(usdCurrency.rate), 10.10);

    // Verify list currencies
    const listCurrenciesRes = await serverCtx.client.get('/api/currencies', cashierToken);
    assert.strictEqual(listCurrenciesRes.status, 200);
    assert.strictEqual(listCurrenciesRes.body.currencies.length, 2);

    // -------------------------------------------------------------
    // 2. Foreign-Currency Purchase in EUR
    // -------------------------------------------------------------
    // Supplier invoice of 1,000.00 EUR (at 10.85 MAD/EUR = 10,850.00 MAD)
    // 100 units of product @ 108.50 MAD unitCost = 10,850 MAD total
    const purchaseRes = await serverCtx.client.post('/api/purchases', {
      supplierId: tenant.supplier.id,
      locationId: tenant.location.id,
      status: 'RECEIVED',
      currencyId: eurCurrency.id,
      exchangeRate: 10.85,
      items: [
        { productId: tenant.product.id, quantity: 100, unitCost: 108.5 },
      ],
      total: 10850,
    }, managerToken);

    assert.strictEqual(purchaseRes.status, 200, `EUR Purchase failed: ${JSON.stringify(purchaseRes.body)}`);
    const purchase = purchaseRes.body.purchase;
    assert.strictEqual(purchase.currencyId, eurCurrency.id);
    assert.strictEqual(Number(purchase.exchangeRate), 10.85, 'Exchange rate must snapshot to 10.85');
    assert.strictEqual(Number(purchase.foreignTotal), 1000, 'Foreign total must equal 1000 EUR (10850 / 10.85)');
    assert.strictEqual(Number(purchase.total), 10850, 'Authoritative total must remain in MAD (10850)');

    // Verify Stock incremented by 100 (50 initial + 100 = 150)
    const stockAfterEurPurchase = await prisma.productStock.findFirstOrThrow({
      where: { productId: tenant.product.id, warehouseId: tenant.warehouse.id },
    });
    assert.strictEqual(Number(stockAfterEurPurchase.quantity), 150);

    // Verify Supplier Balance tracked in base currency MAD (10850 MAD)
    const supplierAfterPurchase = await prisma.contact.findUniqueOrThrow({
      where: { id: tenant.supplier.id },
    });
    assert.strictEqual(Number(supplierAfterPurchase.balance), 10850, 'Supplier balance must be authoritative in MAD base currency');

    // -------------------------------------------------------------
    // 3. Foreign-Currency POS Sale in USD
    // -------------------------------------------------------------
    // Sale of 2 units @ 100 MAD + 20% TVA = 240 MAD (at 10.10 MAD/USD = 23.76 USD)
    const saleRes = await serverCtx.client.post('/api/sales', {
      customerId: tenant.customer.id,
      customerName: tenant.customer.fullName,
      locationId: tenant.location.id,
      method: 'CASH',
      status: 'FINAL',
      currencyId: usdCurrency.id,
      exchangeRate: 10.10,
      items: [
        { productId: tenant.product.id, quantity: 2 },
      ],
    }, cashierToken);

    assert.strictEqual(saleRes.status, 201, `USD Sale failed: ${JSON.stringify(saleRes.body)}`);
    const sale = saleRes.body;
    assert.strictEqual(sale.currencyId, usdCurrency.id);
    assert.strictEqual(Number(sale.exchangeRate), 10.10, 'Sale exchange rate must snapshot to 10.10');
    assert.strictEqual(Number(sale.foreignTotal), 23.76, 'Foreign total must equal 23.76 USD (240 / 10.10)');
    assert.strictEqual(Number(sale.total), 240, 'Authoritative total must remain in MAD (240)');

    // Stock decremented by 2 (150 - 2 = 148)
    const stockAfterUsdSale = await prisma.productStock.findFirstOrThrow({
      where: { productId: tenant.product.id, warehouseId: tenant.warehouse.id },
    });
    assert.strictEqual(Number(stockAfterUsdSale.quantity), 148);

    // -------------------------------------------------------------
    // 4. Update FX Exchange Rates & Verify Historical Immutability
    // -------------------------------------------------------------
    // Change EUR rate from 10.85 -> 11.50
    const updateEurRes = await serverCtx.client.put(`/api/currencies/${eurCurrency.id}`, {
      rate: 11.50,
    }, adminToken);
    assert.strictEqual(updateEurRes.status, 200);
    assert.strictEqual(Number(updateEurRes.body.currency.rate), 11.50);

    // Change USD rate from 10.10 -> 10.80
    const updateUsdRes = await serverCtx.client.put(`/api/currencies/${usdCurrency.id}`, {
      rate: 10.80,
    }, adminToken);
    assert.strictEqual(updateUsdRes.status, 200);
    assert.strictEqual(Number(updateUsdRes.body.currency.rate), 10.80);

    // Fetch existing historical purchase: must NOT change retroactively
    const getPurchaseRes = await serverCtx.client.get(`/api/purchases/${purchase.id}`, managerToken);
    assert.strictEqual(getPurchaseRes.status, 200);
    assert.strictEqual(Number(getPurchaseRes.body.purchase.exchangeRate), 10.85, 'Historical purchase exchange rate must remain 10.85');
    assert.strictEqual(Number(getPurchaseRes.body.purchase.foreignTotal), 1000, 'Historical purchase foreign total must remain 1000 EUR');
    assert.strictEqual(Number(getPurchaseRes.body.purchase.total), 10850, 'Historical purchase MAD total must remain 10850 MAD');

    // Fetch existing historical sale: must NOT change retroactively
    const getSalesRes = await serverCtx.client.get('/api/sales', cashierToken);
    assert.strictEqual(getSalesRes.status, 200);
    const existingSale = getSalesRes.body.sales.find((s: any) => s.id === sale.id);
    assert.ok(existingSale, 'Sale must be in sales list');
    assert.strictEqual(Number(existingSale.exchangeRate), 10.10, 'Historical sale exchange rate must remain 10.10');
    assert.strictEqual(Number(existingSale.foreignTotal), 23.76, 'Historical sale foreign total must remain 23.76 USD');
    assert.strictEqual(Number(existingSale.total), 240, 'Historical sale MAD total must remain 240 MAD');

    // -------------------------------------------------------------
    // 5. Verify Contact Ledgers & Accounting Base Currency Integrity
    // -------------------------------------------------------------
    // Supplier ledger shows purchase in MAD
    const supplierLedgerRes = await serverCtx.client.get(`/api/contacts/${tenant.supplier.id}/ledger`, managerToken);
    assert.strictEqual(supplierLedgerRes.status, 200);
    assert.strictEqual(Number(supplierLedgerRes.body.contact.balance), 10850);
    assert.strictEqual(Number(supplierLedgerRes.body.purchases[0].total), 10850);

    // Cash register drawer & cash ledger: sale received 240 MAD
    const cashAccount = await prisma.account.findFirstOrThrow({
      where: { companyId: tenant.company.id, locationId: tenant.location.id },
    });
    assert.strictEqual(Number(cashAccount.currentBalance), 240, 'Cash ledger must hold 240 MAD without FX contamination');

    // Tax Report: TVA collected from the sale
    const taxRes = await serverCtx.client.get('/api/accounting/tax-report', adminToken);
    assert.strictEqual(taxRes.status, 200);
    assert.ok(Number(taxRes.body.tvaCollected) > 30, 'TVA collected must be recorded');
  });
});
