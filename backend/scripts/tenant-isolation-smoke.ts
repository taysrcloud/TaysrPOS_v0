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
  assert(createdContact.status === 200 && createdContact.body.contact?.companyId === a.company.id, 'Contact create API failed');

  const editedContact = await request(`/contacts/${createdContact.body.contact.id}`, a.token, {
    method: 'PUT',
    body: JSON.stringify({ fullName: `API Contact Edited ${marker}`, type: 'CUSTOMER', isActive: false }),
  });
  assert(editedContact.status === 200 && editedContact.body.contact?.name === `API Contact Edited ${marker}` && editedContact.body.contact?.isActive === false, `Contact edit API failed: ${editedContact.status} ${JSON.stringify(editedContact.body)}`);

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

  const clockIn = await request('/attendance/clock-in', a.token, { method: 'POST', body: '{}' });
  const clockOut = await request('/attendance/clock-out', a.token, { method: 'POST', body: '{}' });
  assert(clockIn.status === 201 && clockOut.status === 200, 'Attendance API failed');

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
    verified: ['contacts CRUD', 'contact edit + ownership', 'products read', 'sales CRUD and ownership', 'invoices CRUD', 'purchases CRUD', 'expenses CRUD', 'expense edit + ownership', 'location edit + ownership', 'attendance', 'settings persistence and isolation', 'invoice ownership', 'purchase ownership', 'warehouse transfer ownership', 'expenses', 'locations', 'warehouses'],
  }, null, 2));
} finally {
  for (const tenant of [a, b]) {
    if (!tenant) continue;
    await prisma.attendance.deleteMany({ where: { companyId: tenant.company.id } });
    await prisma.company.delete({ where: { id: tenant.company.id } });
  }
  await prisma.$disconnect();
}
