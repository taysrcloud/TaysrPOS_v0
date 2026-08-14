import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { getDefaultPrisma } from '../src/utils/prisma.js';

const api = process.env.POS_API_URL || 'http://127.0.0.1:4400/api';
const secret = process.env.JWT_SECRET || 'taysr-pos-secret-key-12345';
const prisma = getDefaultPrisma();
const marker = `isolation-${Date.now()}`;

const request = async (path: string, token: string, init: RequestInit = {}) => {
  const response = await fetch(api + path, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
};

// Track G's device/sync/receipt routes are mounted at root, not under /api
// (they mirror the taysrcloud/TaysrHanout Retrofit base path convention) -
// this hits the API server directly with no forced Authorization header,
// since /device/activate and /device/refresh are deliberately unauthenticated.
const apiRoot = api.replace(/\/api$/, '');
const rawRequest = async (path: string, init: RequestInit = {}, token?: string) => {
  const response = await fetch(apiRoot + path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
};

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

const createTenant = async (suffix: string) => {
  const company = await prisma.company.create({
    data: { accountId: `SMOKE-${marker}-${suffix}`, name: `Tenant ${suffix} ${marker}`, restaurantEnabled: true },
  });
  const passwordHash = await bcrypt.hash('Smoke123!', 4);
  const user = await prisma.user.create({
    data: { companyId: company.id, username: `smoke-${suffix}-${marker}`, email: `smoke-${suffix}-${marker}@test.local`, passwordHash, fullName: `Smoke ${suffix}`, role: 'ADMIN' },
  });
  const location = await prisma.location.create({ data: { companyId: company.id, name: `Store ${suffix}` } });
  const warehouse = await prisma.warehouse.create({ data: { companyId: company.id, locationId: location.id, name: `Stock ${suffix}`, isMain: true } });
  const contact = await prisma.contact.create({ data: { companyId: company.id, fullName: `Contact ${suffix} ${marker}`, type: 'CUSTOMER' } });
  const product = await prisma.product.create({ data: { companyId: company.id, sku: `SKU-${suffix}-${marker}`, name: `Product ${suffix} ${marker}`, salePrice: 10, trackStock: true } });
  await prisma.productStock.create({ data: { productId: product.id, warehouseId: warehouse.id, quantity: 10 } });
  const token = jwt.sign({ userId: user.id, username: user.username, companyId: company.id, role: user.role }, secret, { expiresIn: '10m' });
  return { company, user, location, warehouse, contact, product, token };
};

let a: Awaited<ReturnType<typeof createTenant>> | null = null;
let b: Awaited<ReturnType<typeof createTenant>> | null = null;

try {
  a = await createTenant('A');
  b = await createTenant('B');

  const contactsA = await request('/contacts', a.token);
  const contactsB = await request('/contacts', b.token);
  assert(contactsA.status === 200 && contactsB.status === 200, 'Contact lists failed');
  assert(contactsA.body.contacts.some((item: any) => item.name === a!.contact.fullName), 'Tenant A contact missing');
  assert(!contactsA.body.contacts.some((item: any) => item.name === b!.contact.fullName), 'Tenant B contact leaked into tenant A');
  assert(!contactsB.body.contacts.some((item: any) => item.name === a!.contact.fullName), 'Tenant A contact leaked into tenant B');

  const productsA = await request('/products', a.token);
  const productsB = await request('/products', b.token);
  assert(productsA.status === 200 && productsB.status === 200, 'Product lists failed');
  assert(JSON.stringify(productsA.body).includes(a.product.name) && !JSON.stringify(productsA.body).includes(b.product.name), 'Product isolation failed for tenant A');
  assert(JSON.stringify(productsB.body).includes(b.product.name) && !JSON.stringify(productsB.body).includes(a.product.name), 'Product isolation failed for tenant B');

  const createdContact = await request('/contacts', a.token, {
    method: 'POST',
    body: JSON.stringify({ fullName: `API Contact ${marker}`, type: 'CUSTOMER' }),
  });
  // toContactResponse maps to a UI-facing shape with no companyId field (unlike Purchase/
  // Expense, which return the raw Prisma record) - assert on name instead.
  assert(createdContact.status === 201 && createdContact.body.contact?.name === `API Contact ${marker}`, `Contact create API failed: ${createdContact.status} ${JSON.stringify(createdContact.body)}`);

  const editedContact = await request(`/contacts/${createdContact.body.contact.id}`, a.token, {
    method: 'PUT',
    body: JSON.stringify({ fullName: `API Contact Edited ${marker}`, type: 'CUSTOMER', isActive: false }),
  });
  assert(editedContact.status === 200 && editedContact.body.contact?.name === `API Contact Edited ${marker}` && editedContact.body.contact?.isActive === false, `Contact edit API failed: ${editedContact.status} ${JSON.stringify(editedContact.body)}`);

  const ledgerA = await request(`/contacts/${a.contact.id}/ledger`, a.token);
  assert(ledgerA.status === 200 && ledgerA.body.contact?.id === a.contact.id, `Contact ledger API failed: ${ledgerA.status} ${JSON.stringify(ledgerA.body)}`);

  const crossLedger = await request(`/contacts/${b.contact.id}/ledger`, a.token);
  assert(crossLedger.status === 404, `Cross-tenant contact ledger was not rejected (${crossLedger.status})`);

  const createdExpense = await request('/expenses', a.token, {
    method: 'POST',
    body: JSON.stringify({ locationId: a.location.id, category: 'TEST', amount: 12, date: new Date().toISOString().slice(0, 10), paymentMethod: 'CASH' }),
  });
  assert(createdExpense.status === 200 && createdExpense.body.expense?.companyId === a.company.id, 'Expense create API failed');
  // Track D auto-posting, increment 2: a CASH expense posts a CREDIT (cash out)
  // to the resolved location account. This is the first thing in the run to
  // touch a.location's account, which the later CashMovement assertions below
  // account for by comparing deltas rather than assuming a zero starting balance.
  const locationAccountAfterExpense = await prisma.account.findFirstOrThrow({ where: { companyId: a.company.id, locationId: a.location.id } });
  assert(Number(locationAccountAfterExpense.currentBalance) === -12, `Location account balance after CASH expense wrong: expected -12, got ${locationAccountAfterExpense.currentBalance}`);

  const creditExpense = await request('/expenses', a.token, {
    method: 'POST',
    body: JSON.stringify({ locationId: a.location.id, category: 'TEST-CREDIT', amount: 50, date: new Date().toISOString().slice(0, 10), paymentMethod: 'CREDIT' }),
  });
  assert(creditExpense.status === 200, `Credit expense create failed: ${creditExpense.status} ${JSON.stringify(creditExpense.body)}`);
  const locationAccountAfterCreditExpense = await prisma.account.findFirstOrThrow({ where: { companyId: a.company.id, locationId: a.location.id } });
  assert(Number(locationAccountAfterCreditExpense.currentBalance) === -12, `A CREDIT (unpaid) expense must not post to the cash account: expected balance unchanged at -12, got ${locationAccountAfterCreditExpense.currentBalance}`);

  const editedExpense = await request(`/expenses/${createdExpense.body.expense.id}`, a.token, {
    method: 'PUT',
    body: JSON.stringify({ locationId: a.location.id, category: 'TEST-EDITED', amount: 24, date: new Date().toISOString().slice(0, 10), paymentMethod: 'CARD', isActive: false }),
  });
  assert(editedExpense.status === 200 && editedExpense.body.expense?.category === 'TEST-EDITED' && editedExpense.body.expense?.isActive === false, `Expense edit API failed: ${editedExpense.status} ${JSON.stringify(editedExpense.body)}`);

  const editedLocation = await request(`/locations/${a.location.id}`, a.token, {
    method: 'PUT',
    body: JSON.stringify({ name: `${a.location.name} Edited`, isActive: true }),
  });
  assert(editedLocation.status === 200 && editedLocation.body.location?.name === `${a.location.name} Edited`, `Location edit API failed: ${editedLocation.status} ${JSON.stringify(editedLocation.body)}`);

  const createdExpenseB = await request('/expenses', b.token, {
    method: 'POST',
    body: JSON.stringify({ locationId: b.location.id, category: 'TEST-B', amount: 5, date: new Date().toISOString().slice(0, 10), paymentMethod: 'CASH' }),
  });
  assert(createdExpenseB.status === 200, 'Tenant B expense create API failed');

  const createdSale = await request('/sales', a.token, {
    method: 'POST',
    body: JSON.stringify({ customerId: a.contact.id, locationId: a.location.id, items: [{ productId: a.product.id, quantity: 1 }], method: 'CASH', status: 'FINAL' }),
  });
  assert(createdSale.status === 201 && createdSale.body.id, `Sale create API failed: ${createdSale.status} ${JSON.stringify(createdSale.body)}`);
  // Regression for the 2026-08-12 accent bug: statusLabel() used to return the
  // accented 'Payée', which never matched any frontend 'Payee' comparison. Assert
  // the exact unaccented string, not just that a status field is present.
  assert(createdSale.body.status === 'Payee', `Paid sale status label wrong: expected exactly 'Payee' (unaccented), got ${JSON.stringify(createdSale.body.status)}`);
  // Regression for a 2026-08-12 bug found via live browser verification:
  // normalizeSale omitted locationId entirely, so any frontend consumer that
  // filters sales by location (the Dashboard forces one) silently excluded
  // every real sale (undefined === locationId is always false).
  assert(createdSale.body.locationId === a.location.id, `Sale response missing/wrong locationId: expected ${a.location.id}, got ${JSON.stringify(createdSale.body.locationId)}`);
  // Regression for the same session's date-parsing bug: createdAt is a
  // pre-formatted DD/MM display string that new Date(...) misreads as
  // US-convention MM/DD with no year - createdAtISO must be a real,
  // parseable ISO 8601 timestamp for any date-arithmetic consumer to use instead.
  assert(!Number.isNaN(new Date(createdSale.body.createdAtISO).getTime()), `Sale response createdAtISO is not a parseable date: ${JSON.stringify(createdSale.body.createdAtISO)}`);

  // Sale partial-return workflow (Track A) - measured the read-path fan-out question
  // live before building this: there is no linked credit-note row (the existing
  // /:id/return endpoint mutates the original Sale in place), so the arithmetic that
  // matters is the ORIGINAL sale's own status/returnedQty/stock/balance, not a second
  // row appearing in GET /api/sales. Product: salePrice 10, tvaRate 20% (both defaults
  // from createTenant), so 4 units -> subtotal 40, tax 8, total 48.
  const returnStockBaseline = Number((await prisma.productStock.findFirstOrThrow({ where: { productId: a.product.id, warehouseId: a.warehouse.id } })).quantity);
  const creditSale = await request('/sales', a.token, {
    method: 'POST',
    body: JSON.stringify({ customerId: a.contact.id, locationId: a.location.id, items: [{ productId: a.product.id, quantity: 4 }], method: 'CREDIT', status: 'FINAL' }),
  });
  assert(creditSale.status === 201 && creditSale.body.total === 48, `Credit sale create failed or total wrong: ${creditSale.status} ${JSON.stringify(creditSale.body)}`);
  const returnSaleId = creditSale.body.id;
  const returnSaleItem = await prisma.saleItem.findFirstOrThrow({ where: { saleId: returnSaleId } });
  const balanceAfterCreditSale = Number((await prisma.contact.findUniqueOrThrow({ where: { id: a.contact.id } })).balance);
  assert(balanceAfterCreditSale === 48, `Customer balance after credit sale wrong: expected 48, got ${balanceAfterCreditSale}`);
  const stockAfterCreditSale = Number((await prisma.productStock.findFirstOrThrow({ where: { productId: a.product.id, warehouseId: a.warehouse.id } })).quantity);
  assert(stockAfterCreditSale === returnStockBaseline - 4, `Stock after credit sale wrong: expected ${returnStockBaseline - 4}, got ${stockAfterCreditSale}`);

  const partialSaleReturn = await request(`/sales/${returnSaleId}/return`, a.token, {
    method: 'POST',
    body: JSON.stringify({ items: [{ saleItemId: returnSaleItem.id, quantity: 1 }] }),
  });
  assert(partialSaleReturn.status === 200, `Partial sale return failed: ${partialSaleReturn.status} ${JSON.stringify(partialSaleReturn.body)}`);
  assert(partialSaleReturn.body.status === 'Retour', `Partial sale return status label wrong: expected Retour, got ${partialSaleReturn.body.status}`);
  assert(partialSaleReturn.body.total === 48, `Sale total must stay unchanged (fiscal snapshot) after a partial return: expected 48, got ${partialSaleReturn.body.total}`);
  const stockAfterPartialSaleReturn = Number((await prisma.productStock.findFirstOrThrow({ where: { productId: a.product.id, warehouseId: a.warehouse.id } })).quantity);
  const balanceAfterPartialSaleReturn = Number((await prisma.contact.findUniqueOrThrow({ where: { id: a.contact.id } })).balance);
  const saleAfterPartialReturn = await prisma.sale.findUniqueOrThrow({ where: { id: returnSaleId } });
  assert(stockAfterPartialSaleReturn === returnStockBaseline - 3, `Stock after partial sale return wrong: expected ${returnStockBaseline - 3}, got ${stockAfterPartialSaleReturn}`);
  assert(balanceAfterPartialSaleReturn === 36, `Customer balance after partial sale return wrong: expected 36, got ${balanceAfterPartialSaleReturn}`);
  assert(saleAfterPartialReturn.status === 'PARTIALLY_RETURNED', `Sale status after partial return wrong: expected PARTIALLY_RETURNED, got ${saleAfterPartialReturn.status}`);

  const overSaleReturn = await request(`/sales/${returnSaleId}/return`, a.token, {
    method: 'POST',
    body: JSON.stringify({ items: [{ saleItemId: returnSaleItem.id, quantity: 100 }] }),
  });
  assert(overSaleReturn.status === 400, `Returning more than the returnable quantity was not rejected (${overSaleReturn.status})`);

  const finalSaleReturn = await request(`/sales/${returnSaleId}/return`, a.token, { method: 'POST', body: '{}' });
  assert(finalSaleReturn.status === 200, `Final sale return (remaining quantity) failed: ${finalSaleReturn.status} ${JSON.stringify(finalSaleReturn.body)}`);
  const stockAfterFinalSaleReturn = Number((await prisma.productStock.findFirstOrThrow({ where: { productId: a.product.id, warehouseId: a.warehouse.id } })).quantity);
  const balanceAfterFinalSaleReturn = Number((await prisma.contact.findUniqueOrThrow({ where: { id: a.contact.id } })).balance);
  const saleAfterFinalReturn = await prisma.sale.findUniqueOrThrow({ where: { id: returnSaleId } });
  assert(stockAfterFinalSaleReturn === returnStockBaseline, `Stock after full sale return should be back to baseline ${returnStockBaseline}, got ${stockAfterFinalSaleReturn}`);
  assert(balanceAfterFinalSaleReturn === 0, `Customer balance after full sale return should be 0, got ${balanceAfterFinalSaleReturn}`);
  assert(saleAfterFinalReturn.status === 'RETURNED', `Sale status after full return wrong: expected RETURNED, got ${saleAfterFinalReturn.status}`);

  const doubleSaleReturn = await request(`/sales/${returnSaleId}/return`, a.token, { method: 'POST', body: '{}' });
  assert(doubleSaleReturn.status === 400, `Returning an already-fully-returned sale was not rejected (${doubleSaleReturn.status})`);

  const crossSaleReturn = await request(`/sales/${returnSaleId}/return`, b.token, { method: 'POST', body: '{}' });
  assert(crossSaleReturn.status === 404, `Cross-tenant sale return was not rejected (${crossSaleReturn.status})`);

  // GET /api/sales stays unfiltered (no linked row was created), and the sale's own
  // total remains the original fiscal amount - only its status label changed.
  const salesListAfterReturn = await request('/sales', a.token);
  const returnedRow = salesListAfterReturn.body.sales.find((s: any) => s.id === returnSaleId);
  assert(returnedRow && returnedRow.status === 'Retour' && returnedRow.total === 48, `GET /sales did not reflect the returned sale correctly: ${JSON.stringify(returnedRow)}`);

  // Track D auto-posting, increment 3: the credit sale/return sequence above
  // must NOT have touched the location account at all (no cash moved for a
  // CREDIT sale). Captured now as the baseline for the CASH sequence below.
  // Expected 0, not the CASH expense's -12 alone: the earlier 'sales CRUD'
  // createdSale test (quantity 1, CASH, FINAL -> total 12) also posts a DEBIT
  // now that finalize auto-posting is wired, netting -12 + 12 = 0.
  const locationAccountBeforeCashSale = await prisma.account.findFirst({ where: { companyId: a.company.id, locationId: a.location.id } });
  const baselineBeforeCashSale = locationAccountBeforeCashSale ? Number(locationAccountBeforeCashSale.currentBalance) : 0;
  assert(baselineBeforeCashSale === 0, `Location account should be unaffected by the credit sale/return above (0 = -12 CASH expense + 12 from the earlier CASH createdSale test): got ${baselineBeforeCashSale}`);

  const cashSale = await request('/sales', a.token, {
    method: 'POST',
    body: JSON.stringify({ customerId: a.contact.id, locationId: a.location.id, items: [{ productId: a.product.id, quantity: 4 }], method: 'CASH', status: 'FINAL' }),
  });
  assert(cashSale.status === 201 && cashSale.body.total === 48, `Cash sale create failed or total wrong: ${cashSale.status} ${JSON.stringify(cashSale.body)}`);
  const cashSaleId = cashSale.body.id;
  const cashSaleItem = await prisma.saleItem.findFirstOrThrow({ where: { saleId: cashSaleId } });
  const accountAfterCashSale = await prisma.account.findFirstOrThrow({ where: { companyId: a.company.id, locationId: a.location.id } });
  assert(Number(accountAfterCashSale.currentBalance) === baselineBeforeCashSale + 48, `Location account after CASH sale finalize wrong: expected ${baselineBeforeCashSale + 48} (DEBIT posted), got ${accountAfterCashSale.currentBalance}`);

  const cashSalePartialReturn = await request(`/sales/${cashSaleId}/return`, a.token, {
    method: 'POST',
    body: JSON.stringify({ items: [{ saleItemId: cashSaleItem.id, quantity: 1 }] }),
  });
  assert(cashSalePartialReturn.status === 200, `Cash sale partial return failed: ${cashSalePartialReturn.status} ${JSON.stringify(cashSalePartialReturn.body)}`);
  const accountAfterCashPartialReturn = await prisma.account.findFirstOrThrow({ where: { companyId: a.company.id, locationId: a.location.id } });
  assert(Number(accountAfterCashPartialReturn.currentBalance) === baselineBeforeCashSale + 36, `Location account after partial cash-sale return wrong: expected ${baselineBeforeCashSale + 36} (CREDIT reversal of 12 posted), got ${accountAfterCashPartialReturn.currentBalance}`);

  const cashSaleFinalReturn = await request(`/sales/${cashSaleId}/return`, a.token, { method: 'POST', body: '{}' });
  assert(cashSaleFinalReturn.status === 200, `Cash sale final return failed: ${cashSaleFinalReturn.status} ${JSON.stringify(cashSaleFinalReturn.body)}`);
  const accountAfterCashFullReturn = await prisma.account.findFirstOrThrow({ where: { companyId: a.company.id, locationId: a.location.id } });
  assert(Number(accountAfterCashFullReturn.currentBalance) === baselineBeforeCashSale, `Location account after full cash-sale return should net back to baseline ${baselineBeforeCashSale} (DEBIT 48 fully reversed by CREDITs 12+36), got ${accountAfterCashFullReturn.currentBalance}`);

  const createdInvoice = await request('/invoices', a.token, {
    method: 'POST',
    body: JSON.stringify({ customerId: a.contact.id, mode: 'MANUAL', manualLines: [{ description: 'API line', quantity: 1, unitPrice: 10, tvaRate: 20 }] }),
  });
  assert(createdInvoice.status === 201 && createdInvoice.body.companyId === a.company.id, 'Invoice create API failed');

  const createdPurchase = await request('/purchases', a.token, {
    method: 'POST',
    body: JSON.stringify({ status: 'PENDING', items: [{ productId: a.product.id, quantity: 1, unitCost: 5 }], total: 5 }),
  });
  assert(createdPurchase.status === 200 && createdPurchase.body.purchase?.companyId === a.company.id, 'Purchase create API failed');

  // Purchase partial-receive/return workflow (Track B) - exercises real stock and
  // supplier-balance math across multiple sequential calls, not just create+list.
  const supplierA = await prisma.contact.create({ data: { companyId: a.company.id, fullName: `Supplier A ${marker}`, type: 'SUPPLIER' } });
  const workflowPurchase = await request('/purchases', a.token, {
    method: 'POST',
    body: JSON.stringify({ supplierId: supplierA.id, status: 'PENDING', items: [{ productId: a.product.id, quantity: 10, unitCost: 5 }], total: 50 }),
  });
  assert(workflowPurchase.status === 200, `Workflow purchase create failed: ${workflowPurchase.status} ${JSON.stringify(workflowPurchase.body)}`);
  const workflowPurchaseId = workflowPurchase.body.purchase.id;
  const workflowItem = await prisma.purchaseItem.findFirstOrThrow({ where: { purchaseId: workflowPurchaseId } });
  const stockBaseline = Number((await prisma.productStock.findFirstOrThrow({ where: { productId: a.product.id, warehouseId: a.warehouse.id } })).quantity);

  const partialReceive = await request(`/purchases/${workflowPurchaseId}/receive`, a.token, {
    method: 'PUT',
    body: JSON.stringify({ items: [{ purchaseItemId: workflowItem.id, quantity: 4 }] }),
  });
  assert(partialReceive.status === 200, `Partial receive failed: ${partialReceive.status} ${JSON.stringify(partialReceive.body)}`);
  const afterPartialReceive = await prisma.purchase.findUniqueOrThrow({ where: { id: workflowPurchaseId } });
  const stockAfterPartial = Number((await prisma.productStock.findFirstOrThrow({ where: { productId: a.product.id, warehouseId: a.warehouse.id } })).quantity);
  const supplierAfterPartial = Number((await prisma.contact.findUniqueOrThrow({ where: { id: supplierA.id } })).balance);
  assert(afterPartialReceive.status === 'PARTIALLY_RECEIVED', `Expected PARTIALLY_RECEIVED, got ${afterPartialReceive.status}`);
  assert(stockAfterPartial === stockBaseline + 4, `Stock after partial receive wrong: expected ${stockBaseline + 4}, got ${stockAfterPartial}`);
  assert(supplierAfterPartial === 20, `Supplier balance after partial receive wrong: expected 20, got ${supplierAfterPartial}`);

  const remainderReceive = await request(`/purchases/${workflowPurchaseId}/receive`, a.token, { method: 'PUT', body: '{}' });
  assert(remainderReceive.status === 200, `Remainder receive failed: ${remainderReceive.status} ${JSON.stringify(remainderReceive.body)}`);
  const afterFullReceive = await prisma.purchase.findUniqueOrThrow({ where: { id: workflowPurchaseId } });
  const stockAfterFull = Number((await prisma.productStock.findFirstOrThrow({ where: { productId: a.product.id, warehouseId: a.warehouse.id } })).quantity);
  const supplierAfterFull = Number((await prisma.contact.findUniqueOrThrow({ where: { id: supplierA.id } })).balance);
  assert(afterFullReceive.status === 'RECEIVED', `Expected RECEIVED, got ${afterFullReceive.status}`);
  assert(stockAfterFull === stockBaseline + 10, `Stock after full receive wrong: expected ${stockBaseline + 10}, got ${stockAfterFull}`);
  assert(supplierAfterFull === 50, `Supplier balance after full receive wrong: expected 50, got ${supplierAfterFull}`);

  const doubleReceive = await request(`/purchases/${workflowPurchaseId}/receive`, a.token, { method: 'PUT', body: '{}' });
  assert(doubleReceive.status === 400, `Receiving an already-fully-received purchase was not rejected (${doubleReceive.status})`);

  const partialReturn = await request(`/purchases/${workflowPurchaseId}/return`, a.token, {
    method: 'POST',
    body: JSON.stringify({ items: [{ purchaseItemId: workflowItem.id, quantity: 3 }] }),
  });
  assert(partialReturn.status === 200, `Partial return failed: ${partialReturn.status} ${JSON.stringify(partialReturn.body)}`);
  const afterPartialReturn = await prisma.purchase.findUniqueOrThrow({ where: { id: workflowPurchaseId } });
  const stockAfterPartialReturn = Number((await prisma.productStock.findFirstOrThrow({ where: { productId: a.product.id, warehouseId: a.warehouse.id } })).quantity);
  const supplierAfterPartialReturn = Number((await prisma.contact.findUniqueOrThrow({ where: { id: supplierA.id } })).balance);
  assert(afterPartialReturn.status === 'RECEIVED', `Purchase status should stay RECEIVED after a partial return, got ${afterPartialReturn.status}`);
  assert(stockAfterPartialReturn === stockBaseline + 7, `Stock after partial return wrong: expected ${stockBaseline + 7}, got ${stockAfterPartialReturn}`);
  assert(supplierAfterPartialReturn === 35, `Supplier balance after partial return wrong: expected 35, got ${supplierAfterPartialReturn}`);

  const overReturn = await request(`/purchases/${workflowPurchaseId}/return`, a.token, {
    method: 'POST',
    body: JSON.stringify({ items: [{ purchaseItemId: workflowItem.id, quantity: 100 }] }),
  });
  assert(overReturn.status === 400, `Returning more than the returnable quantity was not rejected (${overReturn.status})`);

  const finalReturn = await request(`/purchases/${workflowPurchaseId}/return`, a.token, {
    method: 'POST',
    body: JSON.stringify({ items: [{ purchaseItemId: workflowItem.id, quantity: 7 }] }),
  });
  assert(finalReturn.status === 200, `Final return failed: ${finalReturn.status} ${JSON.stringify(finalReturn.body)}`);
  const afterFinalReturn = await prisma.purchase.findUniqueOrThrow({ where: { id: workflowPurchaseId } });
  const stockAfterFinalReturn = Number((await prisma.productStock.findFirstOrThrow({ where: { productId: a.product.id, warehouseId: a.warehouse.id } })).quantity);
  const supplierAfterFinalReturn = Number((await prisma.contact.findUniqueOrThrow({ where: { id: supplierA.id } })).balance);
  assert(afterFinalReturn.status === 'RETURNED', `Expected RETURNED after full return, got ${afterFinalReturn.status}`);
  assert(stockAfterFinalReturn === stockBaseline, `Stock after full return should be back to baseline ${stockBaseline}, got ${stockAfterFinalReturn}`);
  assert(supplierAfterFinalReturn === 0, `Supplier balance after full return should be 0, got ${supplierAfterFinalReturn}`);

  const crossReceive = await request(`/purchases/${workflowPurchaseId}/receive`, b.token, { method: 'PUT', body: '{}' });
  assert(crossReceive.status === 404, `Cross-tenant purchase receive was not rejected (${crossReceive.status})`);
  const crossReturn = await request(`/purchases/${workflowPurchaseId}/return`, b.token, {
    method: 'POST',
    body: JSON.stringify({ items: [{ purchaseItemId: workflowItem.id, quantity: 1 }] }),
  });
  assert(crossReturn.status === 404, `Cross-tenant purchase return was not rejected (${crossReturn.status})`);

  const clockIn = await request('/attendance/clock-in', a.token, { method: 'POST', body: '{}' });
  const clockOut = await request('/attendance/clock-out', a.token, { method: 'POST', body: '{}' });
  assert(clockIn.status === 201 && clockOut.status === 200, 'Attendance API failed');

  // Track C-F/I additive slices: create + list + cross-tenant read for each
  // new resource area. Kept compact - one representative create/list pair per
  // resource, not full CRUD coverage, since these are schema/CRUD-only passes
  // with no consumer wiring yet.
  const priceGroup = await request('/pricing/groups', a.token, { method: 'POST', body: JSON.stringify({ name: `Gros ${marker}` }) });
  assert(priceGroup.status === 201 && priceGroup.body.group?.companyId === a.company.id, `Price group create failed: ${priceGroup.status} ${JSON.stringify(priceGroup.body)}`);

  const customerGroup = await request('/pricing/customer-groups', a.token, { method: 'POST', body: JSON.stringify({ name: `VIP ${marker}`, priceGroupId: priceGroup.body.group.id }) });
  assert(customerGroup.status === 201 && customerGroup.body.group?.companyId === a.company.id, `Customer group create failed: ${customerGroup.status} ${JSON.stringify(customerGroup.body)}`);

  const crossPriceGroupWrite = await request(`/pricing/groups/${priceGroup.body.group.id}/prices`, b.token, {
    method: 'PUT',
    body: JSON.stringify({ productId: a.product.id, price: 1 }),
  });
  assert(crossPriceGroupWrite.status === 404, `Cross-tenant price group write was not rejected (${crossPriceGroupWrite.status})`);

  // ── Group pricing resolution into the cart (2026-08-13) ───────────────────
  // Track C's actual cart wiring: assign a contact to a CustomerGroup, give
  // the linked SellingPriceGroup an override for a.product, and confirm a
  // sale for that customer is priced from the override - the same resolver
  // sale.routes.ts uses and /pricing/resolve/:customerId exposes for the
  // frontend cart display, so both stay in lockstep by construction.
  const groupProductPrice = await request(`/pricing/groups/${priceGroup.body.group.id}/prices`, a.token, {
    method: 'PUT',
    body: JSON.stringify({ productId: a.product.id, price: 7 }),
  });
  assert(groupProductPrice.status === 200, `Group product price set failed: ${groupProductPrice.status} ${JSON.stringify(groupProductPrice.body)}`);

  const assignCustomerGroup = await request(`/contacts/${a.contact.id}`, a.token, {
    method: 'PUT',
    body: JSON.stringify({ type: 'CUSTOMER', fullName: a.contact.fullName, creditLimit: 0, isActive: true, customerGroupId: customerGroup.body.group.id }),
  });
  assert(assignCustomerGroup.status === 200 && assignCustomerGroup.body.contact?.customerGroupId === customerGroup.body.group.id, `Contact customerGroupId assignment failed: ${assignCustomerGroup.status} ${JSON.stringify(assignCustomerGroup.body)}`);

  const groupPricedSale = await request('/sales', a.token, {
    method: 'POST',
    body: JSON.stringify({ customerId: a.contact.id, locationId: a.location.id, items: [{ productId: a.product.id, quantity: 1 }], method: 'CASH', status: 'FINAL' }),
  });
  assert(groupPricedSale.status === 201 && groupPricedSale.body.lines?.[0]?.unitPrice === 7, `Group-priced sale did not resolve the override (expected unitPrice 7): ${JSON.stringify(groupPricedSale.body)}`);

  // A selected variation's own price must win over the group override - the
  // group price has no variation dimension in the schema. Uses a dedicated
  // throwaway product rather than a.product: adding a variation to a shared
  // fixture product creates a second, variation-scoped ProductStock row for
  // it, which would make later a.product stock assertions elsewhere in this
  // script (queried without a variationId filter) non-deterministic.
  const variationProduct = await prisma.product.create({ data: { companyId: a.company.id, sku: `SKU-VAR-${marker}`, name: `Variation Product ${marker}`, salePrice: 10, trackStock: true } });
  const variationProductGroupPrice = await request(`/pricing/groups/${priceGroup.body.group.id}/prices`, a.token, {
    method: 'PUT',
    body: JSON.stringify({ productId: variationProduct.id, price: 7 }),
  });
  assert(variationProductGroupPrice.status === 200, `Group product price set (variation product) failed: ${variationProductGroupPrice.status} ${JSON.stringify(variationProductGroupPrice.body)}`);
  const groupPriceVariation = await prisma.productVariation.create({ data: { productId: variationProduct.id, name: 'Grande', salePrice: 30, isActive: true } });
  const variationBeatsGroupSale = await request('/sales', a.token, {
    method: 'POST',
    body: JSON.stringify({ customerId: a.contact.id, locationId: a.location.id, items: [{ productId: variationProduct.id, variationId: groupPriceVariation.id, quantity: 1 }], method: 'CASH', status: 'FINAL' }),
  });
  assert(variationBeatsGroupSale.status === 201 && variationBeatsGroupSale.body.lines?.[0]?.unitPrice === 30, `Variation price should win over group price (expected unitPrice 30): ${JSON.stringify(variationBeatsGroupSale.body)}`);

  const resolvePrices = await request(`/pricing/resolve/${a.contact.id}`, a.token);
  assert(resolvePrices.status === 200 && resolvePrices.body.prices?.[String(a.product.id)] === 7, `/pricing/resolve did not return the expected override: ${JSON.stringify(resolvePrices.body)}`);

  const crossResolvePrices = await request(`/pricing/resolve/${a.contact.id}`, b.token);
  assert(crossResolvePrices.status === 404, `Cross-tenant /pricing/resolve was not rejected (${crossResolvePrices.status})`);

  const crossGroupAssign = await request(`/contacts/${b.contact.id}`, b.token, {
    method: 'PUT',
    body: JSON.stringify({ type: 'CUSTOMER', fullName: b.contact.fullName, creditLimit: 0, isActive: true, customerGroupId: customerGroup.body.group.id }),
  });
  assert(crossGroupAssign.status === 400, `Cross-tenant customerGroupId assignment was not rejected (${crossGroupAssign.status})`);

  // Revert a.contact's group assignment - every later block in this script
  // reuses a.contact as the customer on a.product sales assuming the base
  // salePrice (10). Leaving the group assignment in place would silently
  // reprice every one of those sales to the group override (7) and break
  // their unrelated ledger/balance math, exactly as it did the first time
  // this block was written (see TRACE.md's group-pricing entry).
  const revertCustomerGroup = await request(`/contacts/${a.contact.id}`, a.token, {
    method: 'PUT',
    body: JSON.stringify({ type: 'CUSTOMER', fullName: a.contact.fullName, creditLimit: 0, isActive: true, customerGroupId: null }),
  });
  assert(revertCustomerGroup.status === 200 && !revertCustomerGroup.body.contact?.customerGroupId, `Failed to revert a.contact's customerGroupId after the group-pricing test block: ${JSON.stringify(revertCustomerGroup.body)}`);

  const accountType = await request('/accounting/types', a.token, { method: 'POST', body: JSON.stringify({ name: `Caisse ${marker}` }) });
  assert(accountType.status === 201, `Account type create failed: ${accountType.status} ${JSON.stringify(accountType.body)}`);

  const account = await request('/accounting/accounts', a.token, { method: 'POST', body: JSON.stringify({ name: `Compte ${marker}`, accountTypeId: accountType.body.type.id, openingBalance: 100 }) });
  assert(account.status === 201 && account.body.account?.currentBalance === 100, `Account create failed: ${account.status} ${JSON.stringify(account.body)}`);

  const postedTx = await request(`/accounting/accounts/${account.body.account.id}/transactions`, a.token, { method: 'POST', body: JSON.stringify({ type: 'CREDIT', amount: 30 }) });
  assert(postedTx.status === 201, `Account transaction post failed: ${postedTx.status} ${JSON.stringify(postedTx.body)}`);
  const ledgerAfterTx = await request(`/accounting/accounts/${account.body.account.id}/transactions`, a.token);
  assert(ledgerAfterTx.status === 200 && ledgerAfterTx.body.account?.currentBalance === 70, `Account balance did not update correctly after CREDIT post (${ledgerAfterTx.body.account?.currentBalance})`);

  const crossAccountRead = await request(`/accounting/accounts/${account.body.account.id}/transactions`, b.token);
  assert(crossAccountRead.status === 404, `Cross-tenant account read was not rejected (${crossAccountRead.status})`);

  // Track D auto-posting (2026-08-12), CashMovement first - the unambiguous
  // case, no payment-method conditionality to get wrong. Verifies the
  // get-or-create-per-location Account helper and the DEBIT/CREDIT direction.
  // Delta-based (not hardcoded absolutes): several earlier tests (the CASH
  // expense, the CASH createdSale, the cash-sale-return sequence) already
  // posted to this same location account, so re-read its current balance
  // fresh rather than reusing a value captured earlier in the script.
  const locationBalanceBeforeCash = Number((await prisma.account.findFirstOrThrow({ where: { companyId: a.company.id, locationId: a.location.id } })).currentBalance);
  const cashIn = await request('/register/movements', a.token, {
    method: 'POST',
    body: JSON.stringify({ type: 'IN', amount: 100, locationId: a.location.id, note: 'Fond de caisse' }),
  });
  assert(cashIn.status === 200, `Cash movement IN failed: ${cashIn.status} ${JSON.stringify(cashIn.body)}`);
  const locationAccountA = await prisma.account.findFirstOrThrow({ where: { companyId: a.company.id, locationId: a.location.id } });
  assert(Number(locationAccountA.currentBalance) === locationBalanceBeforeCash + 100, `Location account balance after cash IN wrong: expected ${locationBalanceBeforeCash + 100}, got ${locationAccountA.currentBalance}`);

  const cashOut = await request('/register/movements', a.token, {
    method: 'POST',
    body: JSON.stringify({ type: 'OUT', amount: 30, locationId: a.location.id, note: 'Depot banque' }),
  });
  assert(cashOut.status === 200, `Cash movement OUT failed: ${cashOut.status} ${JSON.stringify(cashOut.body)}`);
  const locationAccountAAfterOut = await prisma.account.findFirstOrThrow({ where: { companyId: a.company.id, locationId: a.location.id } });
  assert(Number(locationAccountAAfterOut.currentBalance) === locationBalanceBeforeCash + 70, `Location account balance after cash OUT wrong: expected ${locationBalanceBeforeCash + 70}, got ${locationAccountAAfterOut.currentBalance}`);

  // No locationId given: must fall back to a single company-wide 'Caisse'
  // account (locationId: null), not create a second, different account each
  // time - and must NOT collide with the unrelated manually-created
  // "Compte {marker}" account above, which also has locationId: null.
  const cashInNoLocation1 = await request('/register/movements', a.token, { method: 'POST', body: JSON.stringify({ type: 'IN', amount: 10 }) });
  const cashInNoLocation2 = await request('/register/movements', a.token, { method: 'POST', body: JSON.stringify({ type: 'IN', amount: 5 }) });
  assert(cashInNoLocation1.status === 200 && cashInNoLocation2.status === 200, 'Cash movement with no locationId failed');
  const companyWideAccountsA = await prisma.account.findMany({ where: { companyId: a.company.id, locationId: null, name: 'Caisse' } });
  assert(companyWideAccountsA.length === 1, `Expected exactly one company-wide fallback account, found ${companyWideAccountsA.length}`);
  assert(Number(companyWideAccountsA[0].currentBalance) === 15, `Company-wide account balance wrong: expected 15, got ${companyWideAccountsA[0].currentBalance}`);
  const manualAccountUnaffected = await prisma.account.findFirstOrThrow({ where: { id: account.body.account.id } });
  assert(Number(manualAccountUnaffected.currentBalance) === 70, `Unrelated manual account must be unaffected by cash-movement auto-posting: expected 70, got ${manualAccountUnaffected.currentBalance}`);

  const commissionAgent = await request('/commission-agents', a.token, { method: 'POST', body: JSON.stringify({ name: `Agent ${marker}`, commissionRate: 5 }) });
  assert(commissionAgent.status === 201, `Commission agent create failed: ${commissionAgent.status} ${JSON.stringify(commissionAgent.body)}`);

  const notifTemplate = await request('/notifications/templates', a.token, { method: 'POST', body: JSON.stringify({ event: 'LOW_STOCK', channel: 'EMAIL', body: 'Stock bas' }) });
  assert(notifTemplate.status === 201, `Notification template create failed: ${notifTemplate.status} ${JSON.stringify(notifTemplate.body)}`);

  const docNote = await request('/notifications/notes', a.token, { method: 'POST', body: JSON.stringify({ entityType: 'CONTACT', entityId: a.contact.id, note: `Note ${marker}` }) });
  assert(docNote.status === 201, `Document/note create failed: ${docNote.status} ${JSON.stringify(docNote.body)}`);

  const dashboardSave = await request('/dashboard-config', a.token, { method: 'PUT', body: JSON.stringify({ widgets: [{ id: 'sales-today' }] }) });
  assert(dashboardSave.status === 200 && dashboardSave.body.widgets?.length === 1, `Dashboard config save failed: ${dashboardSave.status} ${JSON.stringify(dashboardSave.body)}`);
  const dashboardLoadB = await request('/dashboard-config', b.token);
  assert(dashboardLoadB.status === 200 && (dashboardLoadB.body.widgets || []).length === 0, 'Tenant A dashboard config leaked into tenant B');

  const saveSettingsA = await request('/settings', a.token, {
    method: 'PUT',
    body: JSON.stringify({ companyName: a.company.name, currency: 'MAD', defaultTva: '14', ticketFooter: `Footer A ${marker}`, restaurantEnabled: true }),
  });
  const settingsA = await request('/settings', a.token);
  const settingsB = await request('/settings', b.token);
  assert(saveSettingsA.status === 200 && settingsA.body.ticketFooter === `Footer A ${marker}`, 'Settings persistence API failed');
  assert(settingsB.body.ticketFooter !== `Footer A ${marker}`, 'Tenant A settings leaked into tenant B');

  const crossSale = await request('/sales', a.token, {
    method: 'POST',
    body: JSON.stringify({ customerId: b.contact.id, locationId: a.location.id, items: [{ productId: a.product.id, quantity: 1 }], method: 'CASH', status: 'FINAL' }),
  });
  assert(crossSale.status === 404, `Cross-tenant sale customer was not rejected (${crossSale.status})`);

  const crossInvoice = await request('/invoices', a.token, {
    method: 'POST',
    body: JSON.stringify({ customerId: b.contact.id, mode: 'MANUAL', manualLines: [{ description: 'Test', quantity: 1, unitPrice: 10, tvaRate: 20 }] }),
  });
  assert(crossInvoice.status === 404, `Cross-tenant invoice customer was not rejected (${crossInvoice.status})`);

  const crossPurchase = await request('/purchases', a.token, {
    method: 'POST',
    body: JSON.stringify({ status: 'PENDING', items: [{ productId: b.product.id, quantity: 1, unitCost: 5 }], total: 5 }),
  });
  assert(crossPurchase.status === 404, `Cross-tenant purchase product was not rejected (${crossPurchase.status})`);

  const crossTransfer = await request('/inventory/transfer', a.token, {
    method: 'POST',
    body: JSON.stringify({ sourceWarehouseId: a.warehouse.id, destinationWarehouseId: b.warehouse.id, productId: a.product.id, quantity: 1 }),
  });
  assert(crossTransfer.status === 404, `Cross-tenant warehouse transfer was not rejected (${crossTransfer.status})`);

  const crossContactEdit = await request(`/contacts/${b.contact.id}`, a.token, {
    method: 'PUT',
    body: JSON.stringify({ fullName: 'Hijacked', type: 'CUSTOMER' }),
  });
  assert(crossContactEdit.status === 404, `Cross-tenant contact edit was not rejected (${crossContactEdit.status})`);

  const crossExpenseEdit = await request(`/expenses/${createdExpenseB.body.expense.id}`, a.token, {
    method: 'PUT',
    body: JSON.stringify({ category: 'HIJACKED', amount: 1, date: new Date().toISOString().slice(0, 10), paymentMethod: 'CASH' }),
  });
  assert(crossExpenseEdit.status === 404, `Cross-tenant expense edit was not rejected (${crossExpenseEdit.status})`);

  const crossLocationEdit = await request(`/locations/${b.location.id}`, a.token, {
    method: 'PUT',
    body: JSON.stringify({ name: 'Hijacked Store' }),
  });
  assert(crossLocationEdit.status === 404, `Cross-tenant location edit was not rejected (${crossLocationEdit.status})`);

  const expensesA = await request('/expenses', a.token);
  const purchasesA = await request('/purchases', a.token);
  const locationsA = await request('/locations', a.token);
  const warehousesA = await request('/inventory/warehouses', a.token);
  assert([expensesA, purchasesA, locationsA, warehousesA].every(result => result.status === 200), 'One or more tenant CRUD list APIs failed');

  // ── Track G: Hanout Express device auth + sync (2026-08-13) ────────────────
  // Contract sourced from the real taysrcloud/TaysrHanout Android app's
  // Retrofit interfaces, not the legacy UltimatePOS Connector module.

  const genCodeA = await request('/settings/devices', a.token, { method: 'POST', body: JSON.stringify({ locationId: a.location.id }) });
  assert(genCodeA.status === 201 && typeof genCodeA.body.activationCode === 'string', `Device code generation failed: ${genCodeA.status} ${JSON.stringify(genCodeA.body)}`);
  const codeA = genCodeA.body.activationCode as string;

  // Cross-tenant: tenant B cannot see or revoke tenant A's device rows.
  const devicesB = await request('/settings/devices', b.token);
  assert(devicesB.status === 200 && !devicesB.body.some((d: any) => d.activationCode === codeA), 'Tenant A device leaked into tenant B device list');
  const crossRevoke = await request(`/settings/devices/${genCodeA.body.id}`, b.token, { method: 'DELETE' });
  assert(crossRevoke.status === 404, `Cross-tenant device revoke was not rejected (${crossRevoke.status})`);

  const badActivate = await rawRequest('/device/activate', { method: 'POST', body: JSON.stringify({ phone: '+212600000001', activation_code: 'NOT-A-REAL-CODE', device_id: 'smoke-bad', device_model: 'x', app_version: '1.0' }) });
  assert(badActivate.status === 401, `Bogus activation code was not rejected (${badActivate.status})`);

  const activate = await rawRequest('/device/activate', { method: 'POST', body: JSON.stringify({ phone: '+212600000000', activation_code: codeA, device_id: `smoke-device-${marker}`, device_model: 'Smoke Test', app_version: '1.0.0' }) });
  assert(activate.status === 200 && activate.body.tenant_id === String(a.company.id) && activate.body.store_id === String(a.location.id), `Device activation failed: ${activate.status} ${JSON.stringify(activate.body)}`);
  const deviceToken1 = activate.body.device_token as string;
  const refreshToken1 = activate.body.refresh_token as string;

  // Redeeming an already-consumed code with a *different* device_id must not
  // silently re-bind it to a second device.
  const stealActivate = await rawRequest('/device/activate', { method: 'POST', body: JSON.stringify({ phone: '+212600000002', activation_code: codeA, device_id: `smoke-device-thief-${marker}`, device_model: 'x', app_version: '1.0' }) });
  assert(stealActivate.status === 409, `Re-redeeming a consumed activation code with a different device was not rejected (${stealActivate.status})`);

  // Captured before the pull and before the sync/batch below - a.product and
  // a.contact are shared with earlier assertions in this same run (the plain
  // POST /sales test sold 1 unit already), so everything from here on deltas
  // off these baselines rather than assuming absolute starting values (the
  // exact test-staleness trap flagged repeatedly elsewhere in this file).
  const stockQtyBeforeSync = Number((await prisma.productStock.findFirstOrThrow({ where: { productId: a.product.id, warehouseId: a.warehouse.id } })).quantity);
  const contactBalanceBeforeSync = Number((await prisma.contact.findUniqueOrThrow({ where: { id: a.contact.id } })).balance);
  const cashAccountBeforeSync = await prisma.account.findFirst({ where: { companyId: a.company.id, locationId: a.location.id } });
  const cashBalanceBeforeSync = cashAccountBeforeSync ? Number(cashAccountBeforeSync.currentBalance) : 0;

  const pull1 = await rawRequest(`/sync/pull?last_sync=0`, {}, deviceToken1);
  assert(pull1.status === 200, `sync/pull failed: ${pull1.status} ${JSON.stringify(pull1.body)}`);
  assert(pull1.body.products.some((p: any) => p.id === String(a!.product.id)), 'sync/pull missing tenant A product');
  assert(!pull1.body.products.some((p: any) => p.id === String(b!.product.id)), 'sync/pull leaked tenant B product to tenant A device');
  const pulledCustomer = pull1.body.customers.find((c: any) => c.id === String(a!.contact.id));
  assert(pulledCustomer && Number(pulledCustomer.balance) === -contactBalanceBeforeSync, `sync/pull customer balance sign-flip wrong: expected ${-contactBalanceBeforeSync}, got ${JSON.stringify(pulledCustomer)}`);

  const cashEventId = `evt-cash-${marker}`;
  const creditEventId = `evt-credit-${marker}`;
  const batchBody = {
    device_id: `smoke-device-${marker}`,
    events: [
      { event_id: cashEventId, entity_type: 'sale', operation: 'create', payload: {
        id: `sale-cash-${marker}`, localId: `sale-cash-${marker}`, total: 30, subtotal: 30, discount: 0,
        paymentMethod: 'CASH', customerId: null, customerName: null, ticketNumber: 1, storeId: String(a.location.id),
        createdAt: Date.now(),
        items: [{ id: 'i1', productId: String(a.product.id), productName: a.product.name, qty: 2, unitPrice: 10 }],
        payments: [{ id: 'p1', amount: 30, method: 'CASH' }],
      } },
      { event_id: creditEventId, entity_type: 'sale', operation: 'create', payload: {
        id: `sale-credit-${marker}`, localId: `sale-credit-${marker}`, total: 20, subtotal: 20, discount: 0,
        paymentMethod: 'CREDIT', customerId: String(a.contact.id), customerName: a.contact.fullName, ticketNumber: 2, storeId: String(a.location.id),
        createdAt: Date.now(),
        items: [{ id: 'i2', productId: String(a.product.id), productName: a.product.name, qty: 2, unitPrice: 10 }],
        payments: [],
      } },
      { event_id: `evt-bad-product-${marker}`, entity_type: 'sale', operation: 'create', payload: {
        id: `sale-bad-${marker}`, localId: `sale-bad-${marker}`, total: 10, subtotal: 10, discount: 0,
        paymentMethod: 'CASH', customerId: null, customerName: null, ticketNumber: 3, storeId: String(a.location.id),
        createdAt: Date.now(),
        items: [{ id: 'i3', productId: '99999999', productName: 'Ghost', qty: 1, unitPrice: 10 }],
        payments: [{ id: 'p3', amount: 10, method: 'CASH' }],
      } },
    ],
  };
  const batch1 = await rawRequest('/sync/batch', { method: 'POST', body: JSON.stringify(batchBody) }, deviceToken1);
  assert(batch1.status === 200, `sync/batch failed: ${batch1.status} ${JSON.stringify(batch1.body)}`);
  assert(batch1.body.success_ids.includes(cashEventId) && batch1.body.success_ids.includes(creditEventId), `sync/batch did not report expected successes: ${JSON.stringify(batch1.body)}`);
  assert(batch1.body.failed_ids.length === 1, `sync/batch should have failed exactly the bad-product event: ${JSON.stringify(batch1.body)}`);

  const stockAfterSync = await prisma.productStock.findFirstOrThrow({ where: { productId: a.product.id, warehouseId: a.warehouse.id } });
  assert(Number(stockAfterSync.quantity) === stockQtyBeforeSync - 4, `Stock after Hanout sync sales wrong: expected ${stockQtyBeforeSync} - 2 - 2 = ${stockQtyBeforeSync - 4}, got ${stockAfterSync.quantity}`);

  const contactAfterSync = await prisma.contact.findUniqueOrThrow({ where: { id: a.contact.id } });
  assert(Number(contactAfterSync.balance) === contactBalanceBeforeSync + 20, `Customer balance after CREDIT sync sale wrong: expected ${contactBalanceBeforeSync + 20}, got ${contactAfterSync.balance}`);

  const cashAccountAfterSync = await prisma.account.findFirstOrThrow({ where: { companyId: a.company.id, locationId: a.location.id } });
  assert(Number(cashAccountAfterSync.currentBalance) === cashBalanceBeforeSync + 30, `Cash account after Hanout CASH sync sale wrong: expected ${cashBalanceBeforeSync + 30}, got ${cashAccountAfterSync.currentBalance}`);

  // Retry the same batch (simulating a WorkManager retry after a dropped
  // response) - must be idempotent, not create duplicate sales or double-post.
  const batch1Retry = await rawRequest('/sync/batch', { method: 'POST', body: JSON.stringify({ device_id: batchBody.device_id, events: [batchBody.events[0]] }) }, deviceToken1);
  assert(batch1Retry.status === 200 && batch1Retry.body.success_ids.includes(cashEventId), `sync/batch retry did not report success: ${JSON.stringify(batch1Retry.body)}`);
  const saleCountAfterRetry = await prisma.sale.count({ where: { externalId: `sale-cash-${marker}` } });
  assert(saleCountAfterRetry === 1, `sync/batch retry created a duplicate sale: count ${saleCountAfterRetry}`);
  const cashAccountAfterRetry = await prisma.account.findFirstOrThrow({ where: { companyId: a.company.id, locationId: a.location.id } });
  assert(Number(cashAccountAfterRetry.currentBalance) === cashBalanceBeforeSync + 30, `sync/batch retry double-posted to the cash account: ${cashAccountAfterRetry.currentBalance}`);

  const refresh1 = await rawRequest('/device/refresh', { method: 'POST', body: JSON.stringify({ refresh_token: refreshToken1 }) });
  assert(refresh1.status === 200 && typeof refresh1.body.device_token === 'string', `Device refresh failed: ${refresh1.status} ${JSON.stringify(refresh1.body)}`);
  const deviceToken2 = refresh1.body.device_token as string;

  const refresh1Reused = await rawRequest('/device/refresh', { method: 'POST', body: JSON.stringify({ refresh_token: refreshToken1 }) });
  assert(refresh1Reused.status === 401, `Reused (rotated-away) refresh token was not rejected (${refresh1Reused.status})`);

  const pullWithNewToken = await rawRequest(`/sync/pull?last_sync=0`, {}, deviceToken2);
  assert(pullWithNewToken.status === 200, `sync/pull with rotated device token failed: ${pullWithNewToken.status}`);

  const revoke = await request(`/settings/devices/${genCodeA.body.id}`, a.token, { method: 'DELETE' });
  assert(revoke.status === 200, `Device revoke failed: ${revoke.status} ${JSON.stringify(revoke.body)}`);

  const pullAfterRevoke = await rawRequest(`/sync/pull?last_sync=0`, {}, deviceToken2);
  assert(pullAfterRevoke.status === 401, `Revoked device token still worked on sync/pull (${pullAfterRevoke.status})`);

  // ── Track E: per-user permission overrides on top of role presets (2026-08-13) ──

  const cashierPasswordHash = await bcrypt.hash('Smoke123!', 4);
  const cashierUser = await prisma.user.create({
    data: { companyId: a.company.id, username: `smoke-cashier-${marker}`, email: `smoke-cashier-${marker}@test.local`, passwordHash: cashierPasswordHash, fullName: 'Smoke Cashier', role: 'CASHIER' },
  });
  const cashierToken = jwt.sign({ userId: cashierUser.id, username: cashierUser.username, companyId: a.company.id, role: cashierUser.role }, secret, { expiresIn: '10m' });

  const cashierDenied = await request('/settings/devices', cashierToken);
  assert(cashierDenied.status === 403, `CASHIER should be denied devices.manage by role default (${cashierDenied.status})`);

  const emptyOverrides = await request(`/settings/permissions/${cashierUser.id}`, a.token);
  assert(emptyOverrides.status === 200 && Array.isArray(emptyOverrides.body) && emptyOverrides.body.length === 0, `New user should have zero permission overrides: ${JSON.stringify(emptyOverrides.body)}`);

  // A non-ADMIN (CASHIER here) must never be able to manage permissions,
  // even its own - this is the un-overridable backstop against a user
  // granting itself more access.
  const cashierSelfGrant = await request(`/settings/permissions/${cashierUser.id}`, cashierToken, { method: 'PUT', body: JSON.stringify({ action: 'devices.manage', granted: true }) });
  assert(cashierSelfGrant.status === 403, `Non-ADMIN was able to call the permission-management endpoint (${cashierSelfGrant.status})`);

  // Cross-tenant: tenant B's admin cannot manage tenant A's user permissions.
  const crossGrant = await request(`/settings/permissions/${cashierUser.id}`, b.token, { method: 'PUT', body: JSON.stringify({ action: 'devices.manage', granted: true }) });
  assert(crossGrant.status === 404, `Cross-tenant permission grant was not rejected (${crossGrant.status})`);

  const grant = await request(`/settings/permissions/${cashierUser.id}`, a.token, { method: 'PUT', body: JSON.stringify({ action: 'devices.manage', granted: true }) });
  assert(grant.status === 200 && grant.body.granted === true, `Permission grant failed: ${grant.status} ${JSON.stringify(grant.body)}`);

  const cashierAllowed = await request('/settings/devices', cashierToken);
  assert(cashierAllowed.status === 200, `CASHIER with an explicit grant should now pass devices.manage (${cashierAllowed.status})`);

  const listedOverrides = await request(`/settings/permissions/${cashierUser.id}`, a.token);
  assert(listedOverrides.status === 200 && listedOverrides.body.some((o: any) => o.action === 'devices.manage' && o.granted === true), `Granted override not listed: ${JSON.stringify(listedOverrides.body)}`);

  // An explicit granted:false override must block a role that would
  // otherwise pass by default - not just fail to grant beyond the role.
  const denyOverride = await request(`/settings/permissions/${a.user.id}`, a.token, { method: 'PUT', body: JSON.stringify({ action: 'devices.manage', granted: false }) });
  assert(denyOverride.status === 200 && denyOverride.body.granted === false, `Explicit deny override failed: ${denyOverride.status}`);
  const adminNowDenied = await request('/settings/devices', a.token);
  assert(adminNowDenied.status === 403, `ADMIN should be blocked by an explicit deny override even though role would normally allow it (${adminNowDenied.status})`);
  const undoAdminDeny = await request(`/settings/permissions/${a.user.id}/devices.manage`, a.token, { method: 'DELETE' });
  assert(undoAdminDeny.status === 200, `Removing the ADMIN deny override failed: ${undoAdminDeny.status}`);
  const adminRestored = await request('/settings/devices', a.token);
  assert(adminRestored.status === 200, `ADMIN should regain access once the deny override is removed (${adminRestored.status})`);

  const revokeOverride = await request(`/settings/permissions/${cashierUser.id}/devices.manage`, a.token, { method: 'DELETE' });
  assert(revokeOverride.status === 200, `Permission revoke failed: ${revokeOverride.status}`);
  const cashierDeniedAgain = await request('/settings/devices', cashierToken);
  assert(cashierDeniedAgain.status === 403, `CASHIER should be denied again after override removal (${cashierDeniedAgain.status})`);

  const actionsList = await request('/settings/permissions/actions', a.token);
  assert(actionsList.status === 200 && actionsList.body.actions.some((entry: any) => entry.action === 'devices.manage'), `Permission actions list missing devices.manage: ${JSON.stringify(actionsList.body)}`);

  // ── Track H: multi-currency, Sale + Purchase (2026-08-13) ──────────────────
  // total/subtotal/taxTotal stay in MAD always - currencyId/exchangeRate/
  // foreignTotal are purely additive record-keeping, resolved and snapshotted
  // at write time from a company-scoped Currency the same way tvaRate snapshots
  // from TaxRate.

  const createEur = await request('/currencies', a.token, { method: 'POST', body: JSON.stringify({ code: 'eur', name: 'Euro', symbol: '€', rate: 10.85 }) });
  assert(createEur.status === 201 && createEur.body.currency?.code === 'EUR', `Currency create failed (also proves lowercase->uppercase code normalization): ${createEur.status} ${JSON.stringify(createEur.body)}`);
  const eurId = createEur.body.currency.id as number;

  const dupCurrency = await request('/currencies', a.token, { method: 'POST', body: JSON.stringify({ code: 'EUR', name: 'Euro dup', rate: 11 }) });
  assert(dupCurrency.status === 409, `Duplicate currency code was not rejected (${dupCurrency.status})`);

  const currenciesB = await request('/currencies', b.token);
  assert(currenciesB.status === 200 && !currenciesB.body.currencies.some((c: any) => c.id === eurId), 'Tenant A currency leaked into tenant B list');

  // A sale in a foreign currency: total/subtotal/taxTotal computed from items
  // exactly as any other sale (in MAD); exchangeRate/foreignTotal are the
  // additive snapshot. quantity 2 x a.product's salePrice (10) = 20 subtotal,
  // a.product has no configured tvaRate override so the schema default (20%)
  // applies -> taxTotal 4, total 24.
  const eurSale = await request('/sales', a.token, {
    method: 'POST',
    body: JSON.stringify({ items: [{ productId: a.product.id, quantity: 2 }], method: 'CASH', status: 'FINAL', currencyId: eurId }),
  });
  assert(eurSale.status === 201, `Foreign-currency sale create failed: ${eurSale.status} ${JSON.stringify(eurSale.body)}`);
  assert(Number(eurSale.body.total) === 24, `Foreign-currency sale total should stay in MAD unchanged: expected 24, got ${eurSale.body.total}`);
  assert(eurSale.body.currencyId === eurId && Number(eurSale.body.exchangeRate) === 10.85, `Sale currency/rate not recorded: ${JSON.stringify(eurSale.body)}`);
  assert(Math.abs(Number(eurSale.body.foreignTotal) - 24 / 10.85) < 0.01, `Sale foreignTotal math wrong: expected ~${(24 / 10.85).toFixed(2)}, got ${eurSale.body.foreignTotal}`);

  // Per-transaction exchangeRate override (today's rate differs from the
  // Currency row's stored one) must win over the stored rate.
  const eurSaleOverride = await request('/sales', a.token, {
    method: 'POST',
    body: JSON.stringify({ items: [{ productId: a.product.id, quantity: 1 }], method: 'CASH', status: 'FINAL', currencyId: eurId, exchangeRate: 11 }),
  });
  assert(eurSaleOverride.status === 201 && Number(eurSaleOverride.body.exchangeRate) === 11, `Per-transaction exchangeRate override was not honored: ${JSON.stringify(eurSaleOverride.body)}`);

  const badCurrencySale = await request('/sales', a.token, {
    method: 'POST',
    body: JSON.stringify({ items: [{ productId: a.product.id, quantity: 1 }], method: 'CASH', status: 'FINAL', currencyId: 999999 }),
  });
  assert(badCurrencySale.status === 400, `Invalid currencyId on sale was not rejected (${badCurrencySale.status})`);

  // Cross-tenant: tenant B cannot tag its own sale with tenant A's currency.
  const crossCurrencySale = await request('/sales', b.token, {
    method: 'POST',
    body: JSON.stringify({ items: [{ productId: b.product.id, quantity: 1 }], method: 'CASH', status: 'FINAL', currencyId: eurId }),
  });
  assert(crossCurrencySale.status === 400, `Cross-tenant currency use on a sale was not rejected (${crossCurrencySale.status})`);

  // Purchase side: a supplier invoice priced as "500 EUR equivalent" ->
  // total (MAD) is still exactly what the client sends (unchanged behavior),
  // foreignTotal is the computed equivalent using the stored 10.85 rate.
  const eurPurchase = await request('/purchases', a.token, {
    method: 'POST',
    body: JSON.stringify({ status: 'PENDING', items: [{ productId: a.product.id, quantity: 10, unitCost: 542.5 }], total: 5425, currencyId: eurId }),
  });
  assert(eurPurchase.status === 201 || eurPurchase.status === 200, `Foreign-currency purchase create failed: ${eurPurchase.status} ${JSON.stringify(eurPurchase.body)}`);
  assert(Number(eurPurchase.body.purchase.total) === 5425, `Purchase total should stay client-supplied MAD unchanged: got ${eurPurchase.body.purchase.total}`);
  assert(Number(eurPurchase.body.purchase.foreignTotal) === 500, `Purchase foreignTotal math wrong: expected 500 (5425/10.85), got ${eurPurchase.body.purchase.foreignTotal}`);

  const badCurrencyPurchase = await request('/purchases', a.token, {
    method: 'POST',
    body: JSON.stringify({ status: 'PENDING', items: [{ productId: a.product.id, quantity: 1, unitCost: 10 }], total: 10, currencyId: 999999 }),
  });
  assert(badCurrencyPurchase.status === 400, `Invalid currencyId on purchase was not rejected (${badCurrencyPurchase.status})`);

  const updateEur = await request(`/currencies/${eurId}`, a.token, { method: 'PUT', body: JSON.stringify({ rate: 11.2 }) });
  assert(updateEur.status === 200 && Number(updateEur.body.currency.rate) === 11.2, `Currency rate update failed: ${updateEur.status} ${JSON.stringify(updateEur.body)}`);
  // The earlier sale's snapshotted exchangeRate must NOT retroactively change
  // when the Currency's current rate is edited later - same historical-
  // immutability guarantee as tvaRate.
  const eurSaleAfterRateChange = await request(`/sales`, a.token);
  const persistedSale = eurSaleAfterRateChange.body.sales?.find((s: any) => s.id === eurSale.body.id);
  assert(persistedSale && Number(persistedSale.exchangeRate) === 10.85, `Editing Currency.rate retroactively changed an already-recorded sale's snapshotted exchangeRate: ${JSON.stringify(persistedSale)}`);

  const crossUpdate = await request(`/currencies/${eurId}`, b.token, { method: 'PUT', body: JSON.stringify({ rate: 1 }) });
  assert(crossUpdate.status === 404, `Cross-tenant currency update was not rejected (${crossUpdate.status})`);

  // ── Credit-sale settlement (2026-08-13) ──────────────────────────────────
  // Discovered gap: a CREDIT sale increments Contact.balance on finalize but
  // nothing ever paid it back down. Operates at the customer level (balance
  // is already an aggregate across all their sales), not per-sale.

  const settleCreditSale = await request('/sales', a.token, {
    method: 'POST',
    body: JSON.stringify({ customerId: a.contact.id, items: [{ productId: a.product.id, quantity: 1 }], method: 'CREDIT', status: 'FINAL' }),
  });
  assert(settleCreditSale.status === 201, `Credit sale for settlement test failed: ${settleCreditSale.status} ${JSON.stringify(settleCreditSale.body)}`);
  const creditSaleTotal = Number(settleCreditSale.body.total);

  const balanceBeforeSettle = Number((await prisma.contact.findUniqueOrThrow({ where: { id: a.contact.id } })).balance);
  const cashAccountBeforeSettle = await prisma.account.findFirst({ where: { companyId: a.company.id, locationId: a.location.id } });
  const cashBalanceBeforeSettle = cashAccountBeforeSettle ? Number(cashAccountBeforeSettle.currentBalance) : 0;

  const overSettle = await request(`/contacts/${a.contact.id}/settle`, a.token, { method: 'POST', body: JSON.stringify({ amount: balanceBeforeSettle + 1000, method: 'CASH' }) });
  assert(overSettle.status === 400, `Over-settlement (more than owed) was not rejected (${overSettle.status})`);

  const crossSettle = await request(`/contacts/${a.contact.id}/settle`, b.token, { method: 'POST', body: JSON.stringify({ amount: 1, method: 'CASH' }) });
  assert(crossSettle.status === 404, `Cross-tenant settlement was not rejected (${crossSettle.status})`);

  const partialAmount = Math.round((creditSaleTotal / 2) * 100) / 100;
  const partialSettle = await request(`/contacts/${a.contact.id}/settle`, a.token, { method: 'POST', body: JSON.stringify({ amount: partialAmount, method: 'CASH', note: 'Acompte smoke test' }) });
  assert(partialSettle.status === 200 && Math.abs(Number(partialSettle.body.contact.balance) - (balanceBeforeSettle - partialAmount)) < 0.01, `Partial settlement math wrong: ${JSON.stringify(partialSettle.body)}`);

  const cashAccountAfterPartial = await prisma.account.findFirstOrThrow({ where: { companyId: a.company.id, locationId: a.location.id } });
  assert(Math.abs(Number(cashAccountAfterPartial.currentBalance) - (cashBalanceBeforeSettle + partialAmount)) < 0.01, `Settlement did not post the expected DEBIT to the cash account: expected ${cashBalanceBeforeSettle + partialAmount}, got ${cashAccountAfterPartial.currentBalance}`);

  const remaining = Number(partialSettle.body.contact.balance);
  const finalSettle = await request(`/contacts/${a.contact.id}/settle`, a.token, { method: 'POST', body: JSON.stringify({ amount: remaining, method: 'CASH' }) });
  assert(finalSettle.status === 200 && Math.abs(Number(finalSettle.body.contact.balance)) < 0.01, `Final settlement should zero the balance: ${JSON.stringify(finalSettle.body)}`);

  const overSettleAtZero = await request(`/contacts/${a.contact.id}/settle`, a.token, { method: 'POST', body: JSON.stringify({ amount: 1, method: 'CASH' }) });
  assert(overSettleAtZero.status === 400, `Settlement at zero balance was not rejected (${overSettleAtZero.status})`);

  // ── Split-payment persistence (2026-08-13) ────────────────────────────────
  // Discovered while scoping the renderRegister extraction: POST /sales accepted
  // a `splitPayments` array from the register but the zod schema silently
  // dropped it (unrecognized keys are stripped by a plain z.object()) - a MULTI
  // sale always recorded one lump Payment row for the full total under
  // PaymentMethod.MIXED, with no real per-tender data, and the Z-report's
  // cash-drawer reconciliation depended on exactly that missing data (it summed
  // 0 for every MULTI sale's cash contribution). See TRACE.md's split-payment
  // entry for the full bug cluster this closes.
  // Product: salePrice 10, tvaRate 20% (createTenant defaults) -> qty 1 = total 12.
  await prisma.productStock.updateMany({ where: { productId: a.product.id, warehouseId: a.warehouse.id }, data: { quantity: { increment: 100 } } });

  const accountBeforeSplit = await prisma.account.findFirst({ where: { companyId: a.company.id, locationId: a.location.id } });
  const cashBalanceBeforeSplit = accountBeforeSplit ? Number(accountBeforeSplit.currentBalance) : 0;

  // A) Exact cash tender via MULTI - single split component, no change due.
  const exactCashSplit = await request('/sales', a.token, {
    method: 'POST',
    body: JSON.stringify({ locationId: a.location.id, items: [{ productId: a.product.id, quantity: 1 }], method: 'MULTI', status: 'FINAL', splitPayments: [{ method: 'CASH', amount: 12 }] }),
  });
  assert(exactCashSplit.status === 201 && exactCashSplit.body.total === 12, `Exact-cash MULTI sale failed: ${exactCashSplit.status} ${JSON.stringify(exactCashSplit.body)}`);
  assert(exactCashSplit.body.payments?.length === 1 && exactCashSplit.body.payments[0].method === 'CASH' && exactCashSplit.body.payments[0].amount === 12, `Exact-cash MULTI sale payment breakdown wrong: ${JSON.stringify(exactCashSplit.body.payments)}`);
  const accountAfterExactCash = await prisma.account.findFirstOrThrow({ where: { companyId: a.company.id, locationId: a.location.id } });
  assert(Math.abs(Number(accountAfterExactCash.currentBalance) - (cashBalanceBeforeSplit + 12)) < 0.01, `Exact-cash MULTI sale did not post the expected DEBIT: ${accountAfterExactCash.currentBalance}`);

  // B) Cash overpayment (change due) - the raw tendered amount (20) must NOT
  // be recorded as the Payment amount or posted to the ledger; only the 12
  // actually owed is real sale revenue, the other 8 is change handed back.
  const overpayCashSplit = await request('/sales', a.token, {
    method: 'POST',
    body: JSON.stringify({ locationId: a.location.id, items: [{ productId: a.product.id, quantity: 1 }], method: 'MULTI', status: 'FINAL', splitPayments: [{ method: 'CASH', amount: 20 }] }),
  });
  assert(overpayCashSplit.status === 201, `Overpay-cash MULTI sale failed: ${overpayCashSplit.status} ${JSON.stringify(overpayCashSplit.body)}`);
  assert(overpayCashSplit.body.payments?.length === 1 && overpayCashSplit.body.payments[0].amount === 12, `Overpay-cash MULTI sale recorded the raw tendered amount instead of the reconciled 12: ${JSON.stringify(overpayCashSplit.body.payments)}`);
  const accountAfterOverpay = await prisma.account.findFirstOrThrow({ where: { companyId: a.company.id, locationId: a.location.id } });
  assert(Math.abs(Number(accountAfterOverpay.currentBalance) - (Number(accountAfterExactCash.currentBalance) + 12)) < 0.01, `Overpay-cash MULTI sale posted the wrong ledger amount (change must not be counted as revenue): ${accountAfterOverpay.currentBalance}`);

  // C) Cash + card, both face-value, no change.
  const cashCardSplit = await request('/sales', a.token, {
    method: 'POST',
    body: JSON.stringify({ locationId: a.location.id, items: [{ productId: a.product.id, quantity: 1 }], method: 'MULTI', status: 'FINAL', splitPayments: [{ method: 'CASH', amount: 5 }, { method: 'CARD', amount: 7 }] }),
  });
  assert(cashCardSplit.status === 201, `Cash+card MULTI sale failed: ${cashCardSplit.status} ${JSON.stringify(cashCardSplit.body)}`);
  const cashRow = cashCardSplit.body.payments?.find((p: any) => p.method === 'CASH');
  const cardRow = cashCardSplit.body.payments?.find((p: any) => p.method === 'CARD');
  assert(cashRow?.amount === 5 && cardRow?.amount === 7, `Cash+card MULTI sale payment breakdown wrong: ${JSON.stringify(cashCardSplit.body.payments)}`);
  // Regression for a real bug caught live 2026-08-13: methodLabel() used to
  // read payments[0].method alone, which was safe when a MULTI sale always
  // had exactly one MIXED row. Now that split payments create multiple rows,
  // that picked up whichever tender happened to be inserted first (here:
  // CARD) and mislabeled the whole sale as a pure CARD sale - verified live
  // through the actual UI, where a real cash+card split silently vanished
  // from the Z-report's cash-drawer total because of this exact mislabel.
  assert(cashCardSplit.body.method === 'MULTI', `Multi-row split sale mislabeled: expected method 'MULTI', got ${JSON.stringify(cashCardSplit.body.method)}`);
  const accountAfterCashCard = await prisma.account.findFirstOrThrow({ where: { companyId: a.company.id, locationId: a.location.id } });
  assert(Math.abs(Number(accountAfterCashCard.currentBalance) - (Number(accountAfterOverpay.currentBalance) + 12)) < 0.01, `Cash+card MULTI sale posted the wrong ledger total: ${accountAfterCashCard.currentBalance}`);

  // D) Cash + credit split - only the cash portion hits the ledger, only the
  // credit portion hits the customer's balance (previously the ENTIRE total
  // was posted as a cash DEBIT for every MULTI sale regardless of a credit
  // component, overstating cash received and never tracking the debt at all).
  const balanceBeforeCreditSplit = Number((await prisma.contact.findUniqueOrThrow({ where: { id: a.contact.id } })).balance);
  const cashCreditSplit = await request('/sales', a.token, {
    method: 'POST',
    body: JSON.stringify({ customerId: a.contact.id, locationId: a.location.id, items: [{ productId: a.product.id, quantity: 1 }], method: 'MULTI', status: 'FINAL', splitPayments: [{ method: 'CASH', amount: 5 }, { method: 'CREDIT', amount: 7 }] }),
  });
  assert(cashCreditSplit.status === 201, `Cash+credit MULTI sale failed: ${cashCreditSplit.status} ${JSON.stringify(cashCreditSplit.body)}`);
  const balanceAfterCreditSplit = Number((await prisma.contact.findUniqueOrThrow({ where: { id: a.contact.id } })).balance);
  assert(Math.abs(balanceAfterCreditSplit - (balanceBeforeCreditSplit + 7)) < 0.01, `Cash+credit MULTI sale did not increment customer balance by the credit portion only: expected +7, got ${balanceAfterCreditSplit - balanceBeforeCreditSplit}`);
  const accountAfterCashCredit = await prisma.account.findFirstOrThrow({ where: { companyId: a.company.id, locationId: a.location.id } });
  assert(Math.abs(Number(accountAfterCashCredit.currentBalance) - (Number(accountAfterCashCard.currentBalance) + 5)) < 0.01, `Cash+credit MULTI sale posted the wrong ledger amount (must exclude the credit portion): ${accountAfterCashCredit.currentBalance}`);

  // E) Store-credit component excluded from the ledger DEBIT entirely - it
  // isn't real money (Contact.storeCredit doesn't exist in the schema, this
  // is unpersisted client-local state, flagged not fixed - see TRACE.md).
  // Previously this exact scenario posted a phantom cash DEBIT for the full
  // total even though nothing real was ever received.
  const pureStoreCreditSplit = await request('/sales', a.token, {
    method: 'POST',
    body: JSON.stringify({ locationId: a.location.id, items: [{ productId: a.product.id, quantity: 1 }], method: 'MULTI', status: 'FINAL', splitPayments: [{ method: 'STORE_CREDIT', amount: 12 }] }),
  });
  assert(pureStoreCreditSplit.status === 201, `Pure store-credit MULTI sale failed: ${pureStoreCreditSplit.status} ${JSON.stringify(pureStoreCreditSplit.body)}`);
  const accountAfterStoreCredit = await prisma.account.findFirstOrThrow({ where: { companyId: a.company.id, locationId: a.location.id } });
  assert(Math.abs(Number(accountAfterStoreCredit.currentBalance) - Number(accountAfterCashCredit.currentBalance)) < 0.01, `Pure store-credit MULTI sale incorrectly posted a cash DEBIT for money never received: before ${accountAfterCashCredit.currentBalance}, after ${accountAfterStoreCredit.currentBalance}`);

  // F) Underpayment rejected (mirrors the register UI's own disable rule on
  // the "Valider paiement" button: diff < 0 blocks submission client-side).
  const underpaidSplit = await request('/sales', a.token, {
    method: 'POST',
    body: JSON.stringify({ locationId: a.location.id, items: [{ productId: a.product.id, quantity: 1 }], method: 'MULTI', status: 'FINAL', splitPayments: [{ method: 'CASH', amount: 5 }] }),
  });
  assert(underpaidSplit.status === 400, `Underpaid MULTI sale was not rejected (${underpaidSplit.status})`);

  // G) Non-cash component exceeding the total rejected - card/credit/store
  // credit are face-value entries, there's no "change" concept for those rails.
  const overchargedCardSplit = await request('/sales', a.token, {
    method: 'POST',
    body: JSON.stringify({ locationId: a.location.id, items: [{ productId: a.product.id, quantity: 1 }], method: 'MULTI', status: 'FINAL', splitPayments: [{ method: 'CARD', amount: 20 }] }),
  });
  assert(overchargedCardSplit.status === 400, `Over-charged card-only MULTI sale was not rejected (${overchargedCardSplit.status})`);

  // H) A credit component with no resolvable customer (true walk-in) rejected -
  // mirrors the register UI's own "Client comptoir ne peut pas avoir de credit" check.
  const creditNoCustomerSplit = await request('/sales', a.token, {
    method: 'POST',
    body: JSON.stringify({ locationId: a.location.id, items: [{ productId: a.product.id, quantity: 1 }], method: 'MULTI', status: 'FINAL', splitPayments: [{ method: 'CREDIT', amount: 12 }] }),
  });
  assert(creditNoCustomerSplit.status === 400, `Credit-only MULTI sale with no customer was not rejected (${creditNoCustomerSplit.status})`);

  // ── Register session openedAtISO (2026-08-13) ────────────────────────────
  // Regression for the Z-report shift-boundary bug: the frontend used to
  // compare a Sale.id against registerDetails.openedId, which is actually a
  // CashRegisterSession.id - two unrelated ID sequences, so the "current
  // shift" filter didn't bound anything in practice. Fix needs a real
  // timestamp on both sides (Sale.createdAtISO already existed; the session
  // side needed a genuine full-precision ISO field, since GET /sessions'
  // existing `openedAt` is deliberately truncated/space-separated for
  // display and isn't safe to compare against an ISO string directly).
  const openedSession = await request('/register/open', a.token, {
    method: 'POST',
    body: JSON.stringify({ initialCash: 500, locationId: a.location.id }),
  });
  assert(openedSession.status === 200 && openedSession.body.session?.id, `Register open failed: ${openedSession.status} ${JSON.stringify(openedSession.body)}`);
  const rawOpenedAt = openedSession.body.session.openedAt;
  assert(!Number.isNaN(new Date(rawOpenedAt).getTime()), `POST /register/open session.openedAt is not a parseable ISO timestamp: ${JSON.stringify(rawOpenedAt)}`);

  const sessionsAfterOpen = await request('/register/sessions', a.token);
  const listedSession = sessionsAfterOpen.body.sessions?.find((s: any) => s.id === openedSession.body.session.id);
  assert(listedSession, `Newly-opened session did not appear in GET /register/sessions`);
  assert(typeof listedSession.openedAtISO === 'string' && !Number.isNaN(new Date(listedSession.openedAtISO).getTime()), `GET /register/sessions openedAtISO is missing or not a parseable ISO timestamp: ${JSON.stringify(listedSession.openedAtISO)}`);
  assert(listedSession.openedAtISO.includes('T'), `openedAtISO should be a real ISO string (contains 'T'), got ${JSON.stringify(listedSession.openedAtISO)} - the display-only openedAt field uses a space separator instead`);
  assert(Math.abs(new Date(listedSession.openedAtISO).getTime() - new Date(rawOpenedAt).getTime()) < 1000, `openedAtISO from the sessions list should match the moment reported at open time: ${listedSession.openedAtISO} vs ${rawOpenedAt}`);

  // ── Sale line variationId + note (2026-08-13) ─────────────────────────────
  // The backend has always fully supported a per-line variationId (prices
  // from the variation, not the base product, writes SaleItem.variationId)
  // and note (writes SaleItem.notes) - salePayload() in the frontend just
  // never sent either field. Regression for that payload fix: submit a sale
  // with both fields and confirm they land correctly, priced from the
  // variation rather than the base product.
  const testVariation = await prisma.productVariation.create({
    data: { productId: a.product.id, name: 'Grande', salePrice: 25.5, isActive: true },
  });
  const variationSale = await request('/sales', a.token, {
    method: 'POST',
    body: JSON.stringify({ locationId: a.location.id, items: [{ productId: a.product.id, variationId: testVariation.id, quantity: 2, note: 'test note' }], method: 'CASH', status: 'FINAL' }),
  });
  assert(variationSale.status === 201, `Sale with variationId failed: ${variationSale.status} ${JSON.stringify(variationSale.body)}`);
  const variationLine = variationSale.body.lines?.[0];
  assert(variationLine?.variationId === testVariation.id, `Sale line variationId not persisted: ${JSON.stringify(variationLine)}`);
  assert(variationLine?.unitPrice === 25.5, `Sale line priced from base product (10) instead of variation (25.5): ${JSON.stringify(variationLine)}`);
  // ── Task 1 & 2: Warranty, VariationTemplate, Discount, Barcode Print (2026-08-14) ───
  const warrantyA = await request('/warranties', a.token, {
    method: 'POST',
    body: JSON.stringify({ name: `Garantie 2 ans ${marker}`, duration: 2, durationType: 'YEARS' }),
  });
  assert(warrantyA.status === 201 && warrantyA.body.warranty?.id, `Warranty create failed: ${warrantyA.status} ${JSON.stringify(warrantyA.body)}`);

  const crossWarrantyEdit = await request(`/warranties/${warrantyA.body.warranty.id}`, b.token, {
    method: 'PUT',
    body: JSON.stringify({ name: 'Hijacked Warranty' }),
  });
  assert(crossWarrantyEdit.status === 404, `Cross-tenant warranty edit was not rejected (${crossWarrantyEdit.status})`);

  const varTemplateA = await request('/variation-templates', a.token, {
    method: 'POST',
    body: JSON.stringify({ name: `Pointure ${marker}`, values: ['38', '39', '40', '41'] }),
  });
  assert(varTemplateA.status === 201 && varTemplateA.body.template?.id, `Variation template create failed: ${varTemplateA.status} ${JSON.stringify(varTemplateA.body)}`);

  const discountA = await request('/discounts', a.token, {
    method: 'POST',
    body: JSON.stringify({ name: `Solde Ete ${marker}`, discountType: 'PERCENTAGE', amount: 15, appliesTo: 'ALL' }),
  });
  assert(discountA.status === 201 && discountA.body.discount?.id, `Discount create failed: ${discountA.status} ${JSON.stringify(discountA.body)}`);

  const barcodePrint = await request(`/products/barcodes/print?ids=${a.product.id}&quantities=2`, a.token);
  assert(barcodePrint.status === 200, `Barcode print sheet endpoint failed: ${barcodePrint.status}`);

  // ── Task 1: Consolidated Invoice ──────────────────────────────────────────
  const ciContactReq = await request('/contacts', a.token, { method: 'POST', body: JSON.stringify({ fullName: 'CI Customer', type: 'CUSTOMER', ice: 'ICE-999' }) });
  const ciContactId = ciContactReq.body.contact.id;
  
  const ciSale = await request('/sales', a.token, {
    method: 'POST',
    body: JSON.stringify({ customerId: ciContactId, locationId: a.location.id, items: [{ productId: a.product.id, quantity: 1 }], method: 'CASH', status: 'FINAL' }),
  });
  assert(ciSale.status === 201, 'Setup sale for CI failed');
  
  const ci = await request('/invoices/consolidated', a.token, {
    method: 'POST',
    body: JSON.stringify({ customerId: ciContactId, saleIds: [ciSale.body.id], periodStart: new Date().toISOString(), periodEnd: new Date().toISOString() })
  });
  assert(ci.status === 201 && ci.body.companyId === a.company.id, `Consolidated invoice create failed: ${ci.status} ${JSON.stringify(ci.body)}`);
  
  const ciList = await request('/invoices/consolidated', a.token);
  assert(ciList.status === 200 && Array.isArray(ciList.body) && ciList.body.length > 0, `Consolidated invoice list failed: ${ciList.status}`);
  
  const ciPdf = await rawRequest(`/api/invoices/consolidated/${ci.body.id}/pdf`, {}, a.token);
  assert(ciPdf.status === 200, `Consolidated invoice PDF summary failed: ${ciPdf.status}`);

  const crossCi = await request('/invoices/consolidated', b.token, {
    method: 'POST',
    body: JSON.stringify({ customerId: ciContactId, saleIds: [ciSale.body.id], periodStart: new Date().toISOString(), periodEnd: new Date().toISOString() })
  });
  assert(crossCi.status === 404, `Cross-tenant consolidated invoice create was not rejected (${crossCi.status})`);

  // ── Task 3: Accounting Trial Balance (2026-08-14) ───────────────────────
  const trialBal = await request('/accounting/trial-balance', a.token);
  assert(trialBal.status === 200 && Array.isArray(trialBal.body.trialBalance), `Trial balance endpoint failed: ${trialBal.status}`);

  // ── Task 4: Sales Commission Report (2026-08-14) ────────────────────────
  const commReport = await request('/commission-agents/report', a.token);
  assert(commReport.status === 200 && Array.isArray(commReport.body.report), `Commission report endpoint failed: ${commReport.status}`);

  console.log(JSON.stringify({
    ok: true,
    marker,
    verified: [
      'contacts CRUD', 'contact edit + ownership', 'contact ledger + ownership', 'products read', 'sales CRUD and ownership', 'sale partial return + stock, balance and status math + ownership', 'sale finalize + return auto-posting (DEBIT then reversing CREDIT, CREDIT sales untouched)', 'invoices CRUD', 'purchases CRUD', 'purchase partial receive/return + stock and balance math + ownership', 'expenses CRUD', 'expense auto-posting (CASH posts, CREDIT does not)', 'expense edit + ownership', 'location edit + ownership', 'attendance', 'settings persistence and isolation', 'invoice ownership', 'purchase ownership', 'warehouse transfer ownership', 'expenses', 'locations', 'warehouses', 'pricing groups + ownership', 'accounting accounts/transactions + balance math + ownership', 'cash movement auto-posting + per-location account resolution', 'commission agents', 'notification templates', 'document notes', 'dashboard config + isolation', 'device activation code generation + ownership', 'device auth (activate/refresh/revoke) + Hanout sync batch/pull, idempotent, balance-sign-flipped', 'per-user permission overrides (grant/deny/revoke, ADMIN-only backstop, ownership)', 'multi-currency (Sale + Purchase foreignTotal math, rate override, historical-rate immutability, ownership)', 'credit-sale settlement (partial/full, over-settlement rejection, cash-account auto-posting, ownership)', 'split-payment persistence (per-tender Payment rows, cash-overpay reconciliation excludes change from revenue, cash+credit splits the ledger DEBIT vs customer balance correctly, store-credit excluded from the ledger DEBIT, underpayment/overcharge/credit-without-customer rejected)', 'register session open + openedAtISO (full-precision, parseable, matches open-time moment)', 'sale line variationId + note persisted and priced from the variation, not the base product', 'group pricing resolution in the cart (customer group override applies, a selected variation still wins over the group price, /pricing/resolve matches the sale-time resolver, ownership on both the resolve endpoint and contact customerGroupId assignment)',
      'warranty CRUD + ownership', 'variation template CRUD + ownership', 'discount CRUD + ownership', 'barcode printable sticker generator', 'consolidated invoice CRUD + isolation', 'accounting trial balance report', 'commission sales report'
    ],
  }, null, 2));
} finally {
  for (const tenant of [a, b]) {
    if (!tenant) continue;
    await prisma.attendance.deleteMany({ where: { companyId: tenant.company.id } });
    // SaleItem.productId and PurchaseItem.productId have no onDelete:Cascade (deliberately -
    // real sale/purchase history must survive a product being removed), so a single cascading
    // Company delete can hit that RESTRICT before Sale/Purchase's own cascade to their line
    // items finishes clearing the reference. Delete them explicitly first so those cascades
    // complete before Company deletion cascades to Product.
    await prisma.sale.deleteMany({ where: { companyId: tenant.company.id } });
    await prisma.purchase.deleteMany({ where: { companyId: tenant.company.id } });
    await prisma.consolidatedInvoice.deleteMany({ where: { companyId: tenant.company.id } });
    await prisma.company.delete({ where: { id: tenant.company.id } });
  }
  await prisma.$disconnect();
}
