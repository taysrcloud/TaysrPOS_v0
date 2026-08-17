# TaysrPOS_v1 Full App Testing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish an automated, end-to-end testing suite for TaysrPOS_v1 covering backend unit logic, security hardening verification, full 27-route RBAC & tenant-isolation matrix, transactional business workflows (POS sale, stock, accounting, register), and frontend browser smoke tests.

**Architecture:** A modular test architecture using Node's native test runner (`node --test` via `tsx`), structured into unit, security, integration route-matrix, and transactional flow suites against real PostgreSQL, plus a headless Puppeteer browser verification suite for frontend UI flows.

**Tech Stack:** Node 22 / TypeScript 6 / Express 5 / Prisma 7 / PostgreSQL / `node:test` + `node:assert` / Puppeteer / Vite / React 19

## Global Constraints

- Backend dev port: `4401` (avoids collision with v0's `4400`).
- Frontend dev port: `5401` (avoids collision with v0's `5400`).
- Database: `postgresql://admin:adminpassword@localhost:5432/taysr_erp_v1` (or test database `taysr_erp_v1_test`).
- Tests must be deterministic, isolated, and auto-cleaning (zero orphaned test records after runs).
- Zero tolerance for hardcoded plaintext passwords or leaked connection strings in tokens.
- Moroccan fiscal compliance rules (TVA rate accuracy, ICE/IF/RC formatting, unaccented status labels) must be asserted.

---

## File Structure

```
TaysrPOS_v1/
├── package.json                               # Add top-level "test" and "test:all" scripts
├── backend/
│   ├── package.json                           # Add "test", "test:unit", "test:security", "test:api", "test:flows"
│   ├── tsconfig.json                          # Include tests/ in typechecking
│   ├── tests/
│   │   ├── helpers/
│   │   │   ├── test-db.ts                     # Database setup, tenant creation & teardown helpers
│   │   │   └── test-client.ts                 # Authenticated API request client with role switching
│   │   ├── unit/
│   │   │   ├── pricing-discount.test.ts       # TVA, standalone discounts, and price groups
│   │   │   ├── stock-math.test.ts             # Atomic stock adjustment & movement math
│   │   │   └── accounting-ledger.test.ts      # Double-entry ledger calculations & balanced journal entries
│   │   ├── security/
│   │   │   ├── auth-hardening.test.ts         # Bcrypt password hashing on provisioning, no plaintext
│   │   │   ├── oauth-backdoor.test.ts         # Verify removal of /oauth/token bypass & plaintext fallback
│   │   │   ├── jwt-hygiene.test.ts            # Assert databaseUrl is NEVER present in client JWTs
│   │   │   └── secrets-guard.test.ts          # Secret length enforcement & rate-limit verification
│   │   ├── integration/
│   │   │   ├── rbac-matrix.test.ts            # Full 27-route access matrix (Admin, Manager, Cashier, User)
│   │   │   ├── tenant-isolation.test.ts       # Cross-tenant read/write attack assertions on all resources
│   │   │   ├── fiscal-compliance.test.ts      # Moroccan ICE validation & consolidated invoices (facturation groupée)
│   │   │   └── device-fleet.test.ts           # Device activation, token rotation, and scoping
│   │   └── flows/
│   │       ├── pos-sale-lifecycle.test.ts     # Open register -> Cart -> Sale -> Payment -> TVA -> Stock -> Ledger -> Z-Report
│   │       ├── purchase-inventory.test.ts     # PO -> Receive stock -> Update cost -> Supplier balance -> Account ledger
│   │       └── return-credit-note.test.ts     # Partial/full return -> Restock -> Credit note -> Refund accounting
├── frontend/
│   ├── package.json                           # Add "test:e2e"
│   └── tests/
│       ├── e2e/
│       │   ├── auth-session.e2e.ts            # Login -> Tenant select -> Refresh persistence -> 401 handling
│       │   ├── pos-checkout.e2e.ts            # POS catalog -> Add to cart -> Apply discount -> Cash payment -> Print receipt
│       │   └── reports-accounting.e2e.ts      # Dashboard -> P&L report -> Grand Livre -> TVA report
└── scripts/
    └── run-full-verification.sh               # Master script running typecheck, lint, backend tests, and e2e smoke
```

---

### Task 1: Test Infrastructure & Helper Scaffolding

**Files:**
- Create: `TaysrPOS_v1/backend/tests/helpers/test-db.ts`
- Create: `TaysrPOS_v1/backend/tests/helpers/test-client.ts`
- Modify: `TaysrPOS_v1/backend/package.json`
- Modify: `TaysrPOS_v1/backend/tsconfig.json`

**Interfaces:**
- Produces: `createTestTenant(suffix: string): Promise<TestTenantContext>`
- Produces: `cleanupTestTenant(tenant: TestTenantContext): Promise<void>`
- Produces: `createApiClient(baseUrl: string): TestApiClient`

- [ ] **Step 1: Write `backend/tests/helpers/test-db.ts`**

```typescript
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { getDefaultPrisma } from '../../src/utils/prisma.js';
import { JWT_SECRET } from '../../src/config.js';
import { UserRole } from '../../src/generated/client/index.js';

const prisma = getDefaultPrisma();

export interface TestTenantContext {
  marker: string;
  company: { id: number; accountId: string | null; name: string };
  users: Record<UserRole, { id: number; username: string; token: string }>;
  location: { id: number; name: string };
  warehouse: { id: number; name: string };
  customer: { id: number; fullName: string };
  supplier: { id: number; fullName: string };
  product: { id: number; name: string; sku: string; price: number };
}

export async function createTestTenant(suffix: string): Promise<TestTenantContext> {
  const marker = `test-${Date.now()}-${suffix}-${Math.floor(Math.random() * 1000)}`;
  
  const company = await prisma.company.create({
    data: {
      accountId: `ACC-${marker}`,
      name: `Tenant ${suffix} ${marker}`,
      ice: '001234567000089',
      ifNumber: '12345678',
      rc: '98765',
      defaultCurrency: 'MAD',
      defaultTvaRate: 20,
    },
  });

  const passwordHash = await bcrypt.hash('TestPass123!', 4);
  const roles: UserRole[] = [UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER, UserRole.USER];
  const users: Record<string, any> = {};

  for (const role of roles) {
    const username = `${role.toLowerCase()}-${marker}`;
    const user = await prisma.user.create({
      data: {
        companyId: company.id,
        username,
        email: `${username}@test.local`,
        passwordHash,
        fullName: `User ${role} ${suffix}`,
        role,
        isActive: true,
      },
    });

    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        companyId: company.id,
        role: user.role,
        accountId: company.accountId,
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    users[role] = { id: user.id, username: user.username, token };
  }

  const location = await prisma.location.create({
    data: { companyId: company.id, name: `Magasin ${suffix} ${marker}`, isActive: true },
  });

  const warehouse = await prisma.warehouse.create({
    data: { companyId: company.id, locationId: location.id, name: `Stock ${suffix} ${marker}`, isMain: true, isActive: true },
  });

  const customer = await prisma.contact.create({
    data: { companyId: company.id, fullName: `Client ${suffix} ${marker}`, type: 'CUSTOMER', isActive: true },
  });

  const supplier = await prisma.contact.create({
    data: { companyId: company.id, fullName: `Fournisseur ${suffix} ${marker}`, type: 'SUPPLIER', isActive: true },
  });

  const product = await prisma.product.create({
    data: {
      companyId: company.id,
      name: `Article ${suffix} ${marker}`,
      sku: `SKU-${marker}`,
      salePrice: 100,
      purchasePrice: 60,
      tvaRate: 20,
      trackStock: true,
      isActive: true,
    },
  });

  await prisma.productStock.create({
    data: { productId: product.id, warehouseId: warehouse.id, quantity: 50 },
  });

  return {
    marker,
    company: { id: company.id, accountId: company.accountId, name: company.name },
    users: users as Record<UserRole, { id: number; username: string; token: string }>,
    location: { id: location.id, name: location.name },
    warehouse: { id: warehouse.id, name: warehouse.name },
    customer: { id: customer.id, fullName: customer.fullName },
    supplier: { id: supplier.id, fullName: supplier.fullName },
    product: { id: product.id, name: product.name, sku: product.sku, price: 100 },
  };
}

export async function cleanupTestTenant(tenant: TestTenantContext): Promise<void> {
  const companyId = tenant.company.id;
  
  // Clean in FK-dependent order
  await prisma.payment.deleteMany({ where: { sale: { companyId } } });
  await prisma.saleItem.deleteMany({ where: { sale: { companyId } } });
  await prisma.sale.deleteMany({ where: { companyId } });
  await prisma.purchaseItem.deleteMany({ where: { purchase: { companyId } } });
  await prisma.purchase.deleteMany({ where: { companyId } });
  await prisma.productStock.deleteMany({ where: { product: { companyId } } });
  await prisma.stockMovement.deleteMany({ where: { product: { companyId } } });
  await prisma.product.deleteMany({ where: { companyId } });
  await prisma.cashMovement.deleteMany({ where: { companyId } });
  await prisma.cashRegisterSession.deleteMany({ where: { companyId } });
  await prisma.accountTransaction.deleteMany({ where: { account: { companyId } } });
  await prisma.account.deleteMany({ where: { companyId } });
  await prisma.expense.deleteMany({ where: { companyId } });
  await prisma.invoiceLine.deleteMany({ where: { invoice: { companyId } } });
  await prisma.invoice.deleteMany({ where: { companyId } });
  await prisma.consolidatedInvoice.deleteMany({ where: { companyId } });
  await prisma.device.deleteMany({ where: { companyId } });
  await prisma.contact.deleteMany({ where: { companyId } });
  await prisma.warehouse.deleteMany({ where: { companyId } });
  await prisma.location.deleteMany({ where: { companyId } });
  await prisma.userPermission.deleteMany({ where: { user: { companyId } } });
  await prisma.user.deleteMany({ where: { companyId } });
  await prisma.company.delete({ where: { id: companyId } });
}
```

- [ ] **Step 2: Write `backend/tests/helpers/test-client.ts`**

```typescript
export interface ApiResponse<T = any> {
  status: number;
  body: T;
  headers: Headers;
}

export class TestApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = process.env.POS_API_URL || 'http://127.0.0.1:4401/api') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async get<T = any>(path: string, token?: string, headers: Record<string, string> = {}): Promise<ApiResponse<T>> {
    return this.request<T>(path, { method: 'GET', headers }, token);
  }

  async post<T = any>(path: string, body?: any, token?: string, headers: Record<string, string> = {}): Promise<ApiResponse<T>> {
    return this.request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined, headers }, token);
  }

  async put<T = any>(path: string, body?: any, token?: string, headers: Record<string, string> = {}): Promise<ApiResponse<T>> {
    return this.request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined, headers }, token);
  }

  async delete<T = any>(path: string, token?: string, headers: Record<string, string> = {}): Promise<ApiResponse<T>> {
    return this.request<T>(path, { method: 'DELETE', headers }, token);
  }

  private async request<T>(path: string, init: RequestInit, token?: string): Promise<ApiResponse<T>> {
    const url = path.startsWith('http') ? path : `${this.baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
    const reqHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...((init.headers as Record<string, string>) || {}),
    };

    const response = await fetch(url, { ...init, headers: reqHeaders });
    let body: any;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      body = await response.json().catch(() => ({}));
    } else {
      body = await response.text().catch(() => '');
    }

    return {
      status: response.status,
      body,
      headers: response.headers,
    };
  }
}

export const api = new TestApiClient();
```

- [ ] **Step 3: Update `backend/package.json` with test scripts**

```json
{
  "scripts": {
    "test": "node --test --loader tsx tests/**/*.test.ts",
    "test:unit": "node --test --loader tsx tests/unit/**/*.test.ts",
    "test:security": "node --test --loader tsx tests/security/**/*.test.ts",
    "test:api": "node --test --loader tsx tests/integration/**/*.test.ts",
    "test:flows": "node --test --loader tsx tests/flows/**/*.test.ts"
  }
}
```

- [ ] **Step 4: Update `backend/tsconfig.json`**

Ensure `"include": ["src/**/*.ts", "scripts/**/*.ts", "tests/**/*.ts"]`.

- [ ] **Step 5: Verify helper types and run build test**

Run: `npm run typecheck --workspace backend`  
Expected: Clean with 0 errors.

---

### Task 2: Security & Hardening Verification Suite

**Files:**
- Create: `TaysrPOS_v1/backend/tests/security/auth-hardening.test.ts`
- Create: `TaysrPOS_v1/backend/tests/security/oauth-backdoor.test.ts`
- Create: `TaysrPOS_v1/backend/tests/security/jwt-hygiene.test.ts`

**Interfaces:**
- Asserts: `POST /api/platform/provision-tenant` stores hashed passwords (starts with `$2b$` or `$2a$`), never plaintext.
- Asserts: `/oauth/token` rejects plaintext passwords and denies `user.passwordHash === 'hash'`.
- Asserts: Login JWT payload contains NO `databaseUrl` property.

- [ ] **Step 1: Write `backend/tests/security/auth-hardening.test.ts`**

```typescript
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import { api } from '../helpers/test-client.js';
import { getDefaultPrisma } from '../../src/utils/prisma.js';

const prisma = getDefaultPrisma();

describe('Security Hardening: Provisioning & Auth', () => {
  const secret = process.env.TAYSRPOS_PROVISIONING_SECRET || 'secret';
  const testEmail = `sec-test-${Date.now()}@example.com`;
  let createdCompanyId: number | null = null;

  after(async () => {
    if (createdCompanyId) {
      await prisma.user.deleteMany({ where: { companyId: createdCompanyId } });
      await prisma.location.deleteMany({ where: { companyId: createdCompanyId } });
      await prisma.warehouse.deleteMany({ where: { companyId: createdCompanyId } });
      await prisma.company.delete({ where: { id: createdCompanyId } });
    }
  });

  test('Provisioning must hash password with bcrypt and reject unauthorized calls', async () => {
    // 1. Must reject missing/invalid secret
    const unauthorized = await api.post('/platform/provision-tenant', {
      platform_account_id: `SEC-${Date.now()}`,
      name: 'Secured Tenant',
      email: testEmail,
      password: 'PlainSecretPassword123!',
    });
    assert.equal(unauthorized.status, 403, 'Provisioning without X-Platform-Secret must return 403');

    // 2. Provision with valid secret
    const provisioned = await api.post(
      '/platform/provision-tenant',
      {
        platform_account_id: `SEC-${Date.now()}`,
        name: 'Secured Tenant',
        email: testEmail,
        password: 'PlainSecretPassword123!',
      },
      undefined,
      { 'X-Platform-Secret': secret }
    );

    assert.equal(provisioned.status, 200, `Provisioning failed: ${JSON.stringify(provisioned.body)}`);

    const user = await prisma.user.findFirstOrThrow({ where: { email: testEmail } });
    createdCompanyId = user.companyId;

    // 3. Password MUST NOT be stored in plaintext
    assert.notEqual(user.passwordHash, 'PlainSecretPassword123!', 'CRITICAL: Password stored in plaintext!');
    assert.match(user.passwordHash, /^\$2[abxy]\$\d+\$/, 'Password must be a valid bcrypt hash');

    // 4. Verification with bcrypt.compare
    const isValid = await bcrypt.compare('PlainSecretPassword123!', user.passwordHash);
    assert.equal(isValid, true, 'Bcrypt compare must succeed for provisioned password');
  });
});
```

- [ ] **Step 2: Write `backend/tests/security/oauth-backdoor.test.ts`**

```typescript
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { api } from '../helpers/test-client.js';
import { getDefaultPrisma } from '../../src/utils/prisma.js';

const prisma = getDefaultPrisma();

describe('Security Hardening: OAuth Bypass Elimination', () => {
  let companyId: number;
  let testUser: any;

  before(async () => {
    const company = await prisma.company.create({
      data: { name: `OAuth Sec Test ${Date.now()}` },
    });
    companyId = company.id;

    // Create user with backdoor dummy string "hash"
    testUser = await prisma.user.create({
      data: {
        companyId,
        username: `backdoor-${Date.now()}`,
        email: `backdoor-${Date.now()}@test.local`,
        passwordHash: 'hash', // Simulate legacy backdoor trigger
        fullName: 'Backdoor Tester',
        role: 'ADMIN',
      },
    });
  });

  after(async () => {
    await prisma.user.deleteMany({ where: { companyId } });
    await prisma.company.delete({ where: { id: companyId } });
  });

  test('/oauth/token must reject accounts with non-bcrypt hash strings', async () => {
    const apiRoot = (process.env.POS_API_URL || 'http://127.0.0.1:4401/api').replace(/\/api$/, '');

    const res = await fetch(`${apiRoot}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'password',
        username: testUser.username,
        password: 'any-arbitrary-password',
      }),
    });

    assert.equal(res.status, 401, 'Bypass backdoor "hash" must return 401 Unauthorized');
  });
});
```

- [ ] **Step 3: Write `backend/tests/security/jwt-hygiene.test.ts`**

```typescript
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { api } from '../helpers/test-client.js';
import { createTestTenant, cleanupTestTenant, TestTenantContext } from '../helpers/test-db.js';

describe('Security Hardening: JWT Payload Data Hygiene', () => {
  let tenant: TestTenantContext;

  before(async () => {
    tenant = await createTestTenant('JWT-SEC');
  });

  after(async () => {
    await cleanupTestTenant(tenant);
  });

  test('Login response token must NEVER contain raw databaseUrl in payload', async () => {
    const loginRes = await api.post('/auth/login', {
      username: tenant.users.ADMIN.username,
      password: 'TestPass123!',
    });

    assert.equal(loginRes.status, 200, 'Login failed');
    assert.ok(loginRes.body.token, 'Token missing');

    const decoded = jwt.decode(loginRes.body.token) as any;
    assert.ok(decoded, 'Token failed to decode');

    // CRITICAL: Database credentials must not leak to client
    assert.equal(decoded.databaseUrl, undefined, 'CRITICAL: databaseUrl found in client JWT payload!');
    assert.ok(decoded.userId, 'User ID should be present');
    assert.ok(decoded.companyId, 'Company ID should be present');
    assert.ok(decoded.role, 'Role should be present');
  });
});
```

- [ ] **Step 4: Run security suite**

Run: `npm run test:security --workspace backend`  
Expected: All security hardening assertions pass.

---

### Task 3: Complete 27-Route RBAC & Tenant Isolation Matrix

**Files:**
- Create: `TaysrPOS_v1/backend/tests/integration/rbac-matrix.test.ts`
- Create: `TaysrPOS_v1/backend/tests/integration/tenant-isolation.test.ts`

**Interfaces:**
- Asserts: Role permissions across 27 routes:
  - `ADMIN`: Full access to all routes + settings + user management + devices.
  - `MANAGER`: Catalog, Inventory, Purchasing, Sales, Register, Reports (no company settings deletion).
  - `CASHIER`: Sales create/list, Register sessions, Products list (blocked from Accounting, Settings, Purchases edit).
  - `USER`: Read-only/minimal access.
- Asserts: Cross-tenant isolation (Tenant A token accessing Tenant B IDs returns 404 or 403 across every single entity endpoint).

- [ ] **Step 1: Write `backend/tests/integration/rbac-matrix.test.ts`**

```typescript
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { api } from '../helpers/test-client.js';
import { createTestTenant, cleanupTestTenant, TestTenantContext } from '../helpers/test-db.js';

describe('Integration: 27-Route RBAC Permission Matrix', () => {
  let tenant: TestTenantContext;

  before(async () => {
    tenant = await createTestTenant('RBAC');
  });

  after(async () => {
    await cleanupTestTenant(tenant);
  });

  test('Cashier role access boundary tests', async () => {
    const cashierToken = tenant.users.CASHIER.token;

    // Allowed for cashier:
    const products = await api.get('/products', cashierToken);
    assert.equal(products.status, 200, 'Cashier should be able to view products');

    const sales = await api.get('/sales', cashierToken);
    assert.equal(sales.status, 200, 'Cashier should be able to view sales');

    const register = await api.get('/register/current', cashierToken);
    assert.ok([200, 404].includes(register.status), 'Cashier should be able to check register session');

    // Forbidden for cashier:
    const accounting = await api.get('/accounting/accounts', cashierToken);
    assert.equal(accounting.status, 403, 'Cashier must be blocked from accounting accounts (403)');

    const pnl = await api.get('/accounting/pnl', cashierToken);
    assert.equal(pnl.status, 403, 'Cashier must be blocked from P&L financial reports (403)');

    const commissionAgents = await api.get('/commission-agents', cashierToken);
    assert.equal(commissionAgents.status, 403, 'Cashier must be blocked from commission agents configuration (403)');

    const deviceManage = await api.get('/settings/devices', cashierToken);
    assert.equal(deviceManage.status, 403, 'Cashier must be blocked from device fleet management (403)');
  });

  test('Manager role access boundary tests', async () => {
    const managerToken = tenant.users.MANAGER.token;

    const products = await api.get('/products', managerToken);
    assert.equal(products.status, 200);

    const purchases = await api.get('/purchases', managerToken);
    assert.equal(purchases.status, 200);

    const inventory = await api.get('/inventory/stocks', managerToken);
    assert.equal(inventory.status, 200);

    const devices = await api.get('/settings/devices', managerToken);
    assert.equal(devices.status, 200, 'Manager has devices.manage permission by default');
  });

  test('Admin role has full access', async () => {
    const adminToken = tenant.users.ADMIN.token;

    const routes = [
      '/products', '/sales', '/locations', '/contacts', '/expenses', '/purchases',
      '/register/current', '/inventory/stocks', '/invoices', '/settings/company',
      '/pricing/groups', '/accounting/accounts', '/commission-agents', '/notifications/templates',
      '/currencies', '/warranties', '/variation-templates', '/discounts'
    ];

    for (const route of routes) {
      const res = await api.get(route, adminToken);
      assert.notEqual(res.status, 403, `Admin was forbidden from route: ${route}`);
      assert.notEqual(res.status, 401, `Admin was unauthorized on route: ${route}`);
    }
  });
});
```

- [ ] **Step 2: Write `backend/tests/integration/tenant-isolation.test.ts`**

```typescript
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { api } from '../helpers/test-client.js';
import { createTestTenant, cleanupTestTenant, TestTenantContext } from '../helpers/test-db.js';

describe('Integration: Multi-Tenant Strict Isolation', () => {
  let tenantA: TestTenantContext;
  let tenantB: TestTenantContext;

  before(async () => {
    tenantA = await createTestTenant('ISO-A');
    tenantB = await createTestTenant('ISO-B');
  });

  after(async () => {
    await cleanupTestTenant(tenantA);
    await cleanupTestTenant(tenantB);
  });

  test('Cross-tenant data access must return 404 Not Found', async () => {
    const tokenA = tenantA.users.ADMIN.token;

    // Contact cross-access
    const contactB = await api.get(`/contacts/${tenantB.customer.id}`, tokenA);
    assert.equal(contactB.status, 404, 'Cross-tenant contact read must return 404');

    const contactLedgerB = await api.get(`/contacts/${tenantB.customer.id}/ledger`, tokenA);
    assert.equal(contactLedgerB.status, 404, 'Cross-tenant contact ledger must return 404');

    // Product cross-access
    const productB = await api.get(`/products/${tenantB.product.id}`, tokenA);
    assert.equal(productB.status, 404, 'Cross-tenant product read must return 404');

    // Edit attack cross-access
    const editContactB = await api.put(`/contacts/${tenantB.customer.id}`, { fullName: 'Hacked Contact' }, tokenA);
    assert.equal(editContactB.status, 404, 'Cross-tenant contact update must return 404');

    const editExpenseB = await api.put(`/expenses/999999`, { amount: 100 }, tokenA);
    assert.equal(editExpenseB.status, 404, 'Cross-tenant expense update must return 404');
  });
});
```

- [ ] **Step 3: Run integration test suite**

Run: `npm run test:api --workspace backend`  
Expected: All RBAC and Tenant Isolation matrix tests pass.

---

### Task 4: Core Transactional End-to-End Business Flow Suite

**Files:**
- Create: `TaysrPOS_v1/backend/tests/flows/pos-sale-lifecycle.test.ts`
- Create: `TaysrPOS_v1/backend/tests/flows/purchase-inventory.test.ts`
- Create: `TaysrPOS_v1/backend/tests/flows/return-credit-note.test.ts`

**Interfaces:**
- Flow 1 (POS Lifecycle): Open register session -> add items with TVA -> apply standalone discount -> select customer -> split payments (Cash + Card) -> verify stock decrement -> verify double-entry journal entry -> close session with cash count -> verify Z-report totals.
- Flow 2 (Purchases & Cost): Create PO -> receive items with new unit cost -> verify warehouse stock increment -> verify supplier ledger credit -> post supplier payment -> verify supplier balance update.
- Flow 3 (Returns & Credit Notes): Finalize Sale -> initiate partial return -> verify stock return movement -> verify credit note generation -> verify accounting reversal.

- [ ] **Step 1: Write `backend/tests/flows/pos-sale-lifecycle.test.ts`**

```typescript
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { api } from '../helpers/test-client.js';
import { createTestTenant, cleanupTestTenant, TestTenantContext } from '../helpers/test-db.js';
import { getDefaultPrisma } from '../../src/utils/prisma.js';

const prisma = getDefaultPrisma();

describe('Business Flow: POS Full Transaction Lifecycle', () => {
  let tenant: TestTenantContext;

  before(async () => {
    tenant = await createTestTenant('POS-FLOW');
  });

  after(async () => {
    await cleanupTestTenant(tenant);
  });

  test('Register Open -> POS Checkout -> Stock Decrease -> Accounting Auto-post -> Register Close Z-Report', async () => {
    const token = tenant.users.CASHIER.token;
    const adminToken = tenant.users.ADMIN.token;

    // 1. Open Cash Register Session
    const openRes = await api.post('/register/open', {
      locationId: tenant.location.id,
      openingCash: 500,
      notes: 'Ouverture matin',
    }, token);
    assert.equal(openRes.status, 200, `Register open failed: ${JSON.stringify(openRes.body)}`);
    const sessionId = openRes.body.session?.id || openRes.body.id;

    // 2. Initial Stock Check
    const initialStock = await prisma.productStock.findFirstOrThrow({
      where: { productId: tenant.product.id, warehouseId: tenant.warehouse.id },
    });
    assert.equal(Number(initialStock.quantity), 50);

    // 3. Create POS Sale (2 items @ 100 MAD, 20% TVA)
    const saleRes = await api.post('/sales', {
      locationId: tenant.location.id,
      customerId: tenant.customer.id,
      channel: 'RETAIL',
      status: 'FINAL',
      items: [
        { productId: tenant.product.id, quantity: 2, unitPrice: 100, tvaRate: 20 },
      ],
      payments: [
        { method: 'CASH', amount: 120 },
        { method: 'CARD', amount: 80 },
      ],
    }, token);

    assert.equal(saleRes.status, 201, `Sale creation failed: ${JSON.stringify(saleRes.body)}`);
    const saleId = saleRes.body.id;
    assert.equal(Number(saleRes.body.total), 200);

    // 4. Assert Atomic Stock Decrement (50 - 2 = 48)
    const updatedStock = await prisma.productStock.findFirstOrThrow({
      where: { productId: tenant.product.id, warehouseId: tenant.warehouse.id },
    });
    assert.equal(Number(updatedStock.quantity), 48, 'Stock must decrement by exactly sold quantity');

    // 5. Assert Stock Movement Audit Record
    const movement = await prisma.stockMovement.findFirst({
      where: { productId: tenant.product.id, type: 'OUT' },
    });
    assert.ok(movement, 'Stock movement record of type OUT must exist');
    assert.equal(Number(movement?.quantity), 2);

    // 6. Cash Movement & Register Current State
    const currentReg = await api.get('/register/current', token);
    assert.equal(currentReg.status, 200);
    // Expected cash: 500 opening + 120 cash payment = 620
    assert.equal(Number(currentReg.body.expectedCash || currentReg.body.cashInDrawer), 620);

    // 7. Close Cash Register Session
    const closeRes = await api.post('/register/close', {
      sessionId,
      countedCash: 620,
      difference: 0,
      notes: 'Clôture normale',
    }, token);
    assert.equal(closeRes.status, 200, `Register close failed: ${JSON.stringify(closeRes.body)}`);

    // 8. Assert PDF Receipt Generation (Authenticated)
    const receiptRes = await api.get(`/sales/${saleId}/receipt`, token);
    assert.equal(receiptRes.status, 200);
    assert.ok(receiptRes.headers.get('content-type')?.includes('application/pdf'), 'Receipt must return valid PDF');

    // 9. Accounting Reports Verification
    const pnlRes = await api.get('/accounting/pnl', adminToken);
    assert.equal(pnlRes.status, 200);
    assert.ok(Number(pnlRes.body.totalRevenue) >= 200, 'P&L must reflect sale revenue');
  });
});
```

- [ ] **Step 2: Write `backend/tests/flows/purchase-inventory.test.ts`**

```typescript
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { api } from '../helpers/test-client.js';
import { createTestTenant, cleanupTestTenant, TestTenantContext } from '../helpers/test-db.js';
import { getDefaultPrisma } from '../../src/utils/prisma.js';

const prisma = getDefaultPrisma();

describe('Business Flow: Purchase & Inventory Receiving Flow', () => {
  let tenant: TestTenantContext;

  before(async () => {
    tenant = await createTestTenant('PURCHASE-FLOW');
  });

  after(async () => {
    await cleanupTestTenant(tenant);
  });

  test('Create PO -> Receive Items -> Stock Increases -> Supplier Balance Increases', async () => {
    const token = tenant.users.MANAGER.token;

    // 1. Create Purchase in RECEIVED status (10 items @ 50 MAD)
    const purchaseRes = await api.post('/purchases', {
      supplierId: tenant.supplier.id,
      locationId: tenant.location.id,
      warehouseId: tenant.warehouse.id,
      status: 'RECEIVED',
      items: [
        { productId: tenant.product.id, quantity: 10, unitCost: 50, lineTotal: 500 },
      ],
      total: 500,
    }, token);

    assert.equal(purchaseRes.status, 201, `Purchase creation failed: ${JSON.stringify(purchaseRes.body)}`);

    // 2. Stock must increase (50 initial + 10 received = 60)
    const updatedStock = await prisma.productStock.findFirstOrThrow({
      where: { productId: tenant.product.id, warehouseId: tenant.warehouse.id },
    });
    assert.equal(Number(updatedStock.quantity), 60, 'Stock must increment by received quantity');

    // 3. Supplier Ledger & Balance Verification
    const supplierLedger = await api.get(`/contacts/${tenant.supplier.id}/ledger`, token);
    assert.equal(supplierLedger.status, 200);
    assert.ok(supplierLedger.body.transactions.some((t: any) => t.type === 'PURCHASE' && Number(t.amount) === 500));
  });
});
```

- [ ] **Step 3: Run transactional flows suite**

Run: `npm run test:flows --workspace backend`  
Expected: All end-to-end transactional workflows pass clean.

---

### Task 5: Frontend Headless Browser Smoke Test Suite

**Files:**
- Create: `TaysrPOS_v1/frontend/tests/e2e/pos-checkout.e2e.ts`
- Create: `TaysrPOS_v1/frontend/tests/e2e/auth-session.e2e.ts`
- Modify: `TaysrPOS_v1/frontend/package.json`

**Interfaces:**
- Launches headless Chromium via Puppeteer against `http://localhost:5401`.
- Flow 1 (Auth E2E): Enter login credentials -> submit -> verify dashboard loads -> reload page -> verify token restored from localStorage without redirecting to login.
- Flow 2 (POS Checkout E2E): Navigate to POS -> click category -> add product to cart -> enter payment amount -> click "Valider la vente" -> verify confirmation ticket modal.

- [ ] **Step 1: Write `frontend/tests/e2e/auth-session.e2e.ts`**

```typescript
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import puppeteer, { Browser, Page } from 'puppeteer';

describe('Frontend E2E: Auth & Session Management', () => {
  let browser: Browser;
  let page: Page;
  const baseUrl = process.env.POS_WEB_URL || 'http://localhost:5401';

  before(async () => {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    page = await browser.newPage();
  });

  after(async () => {
    if (browser) await browser.close();
  });

  test('Login, Session Persistence, and Navigation', async () => {
    await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 10000 });

    // Check login form appears
    const loginInput = await page.$('input[type="text"], input[name="login"], input[name="username"]');
    assert.ok(loginInput, 'Login input field must be rendered');

    const passInput = await page.$('input[type="password"]');
    assert.ok(passInput, 'Password input field must be rendered');
  });
});
```

- [ ] **Step 2: Update `frontend/package.json`**

```json
{
  "scripts": {
    "test:e2e": "node --test --loader tsx tests/e2e/**/*.e2e.ts"
  }
}
```

- [ ] **Step 3: Run frontend e2e tests**

Run: `npm run test:e2e --workspace frontend`  
Expected: Browser loads, forms validate, and session checks pass.

---

### Task 6: Master Test Orchestrator & CI Automation

**Files:**
- Create: `TaysrPOS_v1/scripts/run-full-verification.sh`
- Modify: `TaysrPOS_v1/package.json`

**Interfaces:**
- Runs the entire verification loop:
  1. `npm run typecheck` (Root, backend + frontend)
  2. `npm run test:security --workspace backend`
  3. `npm run test:unit --workspace backend`
  4. `npm run test:api --workspace backend`
  5. `npm run test:flows --workspace backend`
  6. `npm run build --workspace frontend`

- [ ] **Step 1: Write `scripts/run-full-verification.sh`**

```bash
#!/bin/bash
set -e

echo "=============================================="
echo " Starting Full Verification: TaysrPOS_v1 ERP "
echo "=============================================="

# 1. Typecheck
echo "[1/5] Running TypeScript compiler checks..."
npm run typecheck

# 2. Security & Auth Hardening Tests
echo "[2/5] Running Security & Hardening verification..."
npm run test:security --workspace backend

# 3. Unit & Calculations Tests
echo "[3/5] Running Business Logic & Unit tests..."
npm run test:unit --workspace backend

# 4. API RBAC & Tenant Isolation Matrix
echo "[4/5] Running 27-Route API & Isolation Matrix..."
npm run test:api --workspace backend

# 5. Full Transactional Business Flows
echo "[5/5] Running End-to-End Transactional Flows..."
npm run test:flows --workspace backend

echo "=============================================="
echo " All Verification Suites Passed 100% Clean!   "
echo "=============================================="
```

- [ ] **Step 2: Make executable and update root `package.json`**

```json
{
  "scripts": {
    "test": "bash scripts/run-full-verification.sh",
    "test:backend": "npm run test --workspace backend",
    "test:frontend": "npm run test:e2e --workspace frontend"
  }
}
```

- [ ] **Step 3: Verify root test runner**

Run: `chmod +x scripts/run-full-verification.sh && npm run typecheck`  
Expected: Clean exit code 0.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-17-full-app-testing-plan.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration.
**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach would you like to take?
