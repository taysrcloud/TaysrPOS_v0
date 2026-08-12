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

  console.log(JSON.stringify({
    ok: true,
    marker,
    verified: ['contacts CRUD', 'contact edit + ownership', 'contact ledger + ownership', 'products read', 'sales CRUD and ownership', 'sale partial return + stock, balance and status math + ownership', 'invoices CRUD', 'purchases CRUD', 'purchase partial receive/return + stock and balance math + ownership', 'expenses CRUD', 'expense edit + ownership', 'location edit + ownership', 'attendance', 'settings persistence and isolation', 'invoice ownership', 'purchase ownership', 'warehouse transfer ownership', 'expenses', 'locations', 'warehouses', 'pricing groups + ownership', 'accounting accounts/transactions + balance math + ownership', 'commission agents', 'notification templates', 'document notes', 'dashboard config + isolation'],
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
    await prisma.company.delete({ where: { id: tenant.company.id } });
  }
  await prisma.$disconnect();
}
