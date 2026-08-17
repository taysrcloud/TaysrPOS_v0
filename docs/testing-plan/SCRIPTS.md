# TaysrPOS_v1 Test Scripts & Helpers Reference

This document provides a reference for all testing scripts, database helpers, HTTP clients, and server lifecycle managers across the repository.

---

## 1. Top-Level & Package Scripts

### Root `package.json`
| Script | Command | Purpose |
|---|---|---|
| `"test"` | `npm run test:security --workspace backend && npm run test:api --workspace backend && npm run test:flows --workspace backend` | Runs all backend test tiers sequentially. |
| `"test:full"` | `bash scripts/run-full-verification.sh` | Master test orchestrator running all 5 verification tiers. |
| `"test:backend"` | `npm run test --workspace backend` | Runs all backend test suites. |
| `"test:frontend"` | `npm run test:e2e --workspace frontend` | Runs frontend headless browser E2E smoke tests. |
| `"typecheck"` | `npm run typecheck --workspace backend && npm run typecheck --workspace frontend` | Typechecks both backend and frontend. |

### `backend/package.json`
| Script | Command | Purpose |
|---|---|---|
| `"test"` | `NODE_ENV=test node --import tsx --test --test-concurrency=1 tests/**/*.test.ts` | Runs all backend tests. |
| `"test:security"` | `NODE_ENV=test node --import tsx --test --test-concurrency=1 tests/security/**/*.test.ts` | Runs security hardening tests. |
| `"test:api"` | `NODE_ENV=test node --import tsx --test --test-concurrency=1 tests/integration/**/*.test.ts` | Runs 27-route RBAC, tenant isolation, and fiscal compliance tests. |
| `"test:flows"` | `NODE_ENV=test node --import tsx --test --test-concurrency=1 tests/flows/**/*.test.ts` | Runs transactional business flows. |
| `"typecheck"` | `tsc --noEmit` | Validates backend TypeScript types. |

### `frontend/package.json`
| Script | Command | Purpose |
|---|---|---|
| `"test:e2e"` | `node --import tsx --test --test-concurrency=1 tests/e2e/**/*.e2e.ts` | Runs headless Chromium browser E2E tests. |
| `"typecheck"` | `tsc -b --pretty false` | Validates frontend TypeScript types. |
| `"screenshot"` | `node scripts/screenshot.mjs` | Ad-hoc visual preview screenshot generator. |

---

## 2. Test Helpers Reference

### `backend/tests/helpers/test-db.ts`
```typescript
import { createTestTenant, cleanupTestTenant, TestTenantContext } from './test-db.js';

// Setup isolated tenant
const tenant = await createTestTenant('my-test');
// tenant.company -> { id, accountId, name }
// tenant.users.ADMIN -> { id, username, email, fullName, token }
// tenant.users.CASHIER -> { id, username, email, fullName, token }
// tenant.location -> { id, name }
// tenant.warehouse -> { id, name }
// tenant.product -> { id, name, sku, price }
// tenant.customer -> { id, fullName }
// tenant.supplier -> { id, fullName }

// Teardown tenant
await cleanupTestTenant(tenant);
```

### `backend/tests/helpers/test-client.ts`
```typescript
import { createApiClient, TestApiClient } from './test-client.js';

const client = createApiClient('http://127.0.0.1:4400');
const res = await client.post('/api/sales', payload, cashierToken);
// res -> { status: 200, headers: Headers, body: { ... } }
```

### `backend/tests/helpers/test-server.ts`
```typescript
import { getTestServer, closeTestServer, RunningTestServer } from './test-server.js';

const serverCtx = await getTestServer();
// serverCtx.baseUrl -> 'http://127.0.0.1:4400'
// serverCtx.client -> pre-configured TestApiClient
await closeTestServer();
```

### `frontend/tests/e2e/helpers/browser.ts`
```typescript
import { createTestBrowser, closeTestBrowser, BrowserContext } from './helpers/browser.js';

const { browser, page } = await createTestBrowser();
await page.goto('http://127.0.0.1:5401');
await closeTestBrowser({ browser, page });
```

### `frontend/tests/e2e/helpers/server.ts`
```typescript
import { ensureAppServers, RunningServers } from './helpers/server.js';

const servers = await ensureAppServers();
// Spawns backend (4400) and Vite (5401) if not running
await servers.stop();
```
