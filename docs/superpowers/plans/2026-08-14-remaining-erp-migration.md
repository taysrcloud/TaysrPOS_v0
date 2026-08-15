# Remaining ERP Migration Tasks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the remaining migration tasks (Financial Reports, POS Checkout Commission Agent & Multi-Currency pickers, Bulk Data Import Tools, Configurable Dashboard Widget UI) to complete the TaysrPOS_v0 ERP feature scope.

**Architecture:** Express routes + Prisma models on the backend with strict tenant isolation, integrated into React Vite frontend pages, backed by automated tenant-isolation smoke test assertions and clean TypeScript builds.

**Tech Stack:** Node.js/TypeScript, Express 5, Prisma 7, PostgreSQL, React, Vite, CSS.

## Global Constraints

- Strict tenant isolation: every query must filter by `companyId` (tenantId) or verify tenant ownership.
- Pure JS/Node modules running natively on Termux (ARM64 Linux).
- TVA snapshot immutability: historical sale/purchase totals must remain immutable.
- Clean build: `tsc --noEmit` on backend and frontend must pass with 0 errors.

---

### Task 1: Financial & Accounting Reports (Track D)

**Files:**
- Modify: `backend/src/routes/accounting.routes.ts`
- Modify: `backend/scripts/tenant-isolation-smoke.ts`
- Modify: `frontend/src/pages/ReportsPage.tsx`

**Interfaces:**
- `GET /api/accounting/ledger/:accountId`: Accepts `startDate`, `endDate`. Returns `{ account, openingBalance, currentBalance, transactions: [] }`.
- `GET /api/accounting/pnl`: Accepts `startDate`, `endDate`, `locationId`. Returns `{ totalSales, costOfGoodsSold, grossProfit, totalExpenses, netProfit }`.
- `GET /api/accounting/tax-report`: Accepts `startDate`, `endDate`. Returns `{ tvaCollected, tvaDeductible, netTvaPayable }`.

- [ ] **Step 1: Implement Ledger, P&L, and Tax Audit endpoints in `accounting.routes.ts`**

Add `GET /ledger/:accountId`, `GET /pnl`, and `GET /tax-report` with `companyId` filtering to `backend/src/routes/accounting.routes.ts`.

- [ ] **Step 2: Add frontend UI tabs in `ReportsPage.tsx`**

Update `ReportsPage.tsx` to add "Grand Livre", "Compte de Résultat (P&L)", and "Rapport TVA" tabs displaying financial metrics and date range pickers.

- [ ] **Step 3: Add Smoke Test Assertions & Run**

Add ledger, P&L, and tax audit assertions to `backend/scripts/tenant-isolation-smoke.ts` and verify execution.

- [ ] **Step 4: Commit**

`git add . && git commit -m "feat(accounting): add per-account ledger, P&L, and TVA audit report endpoints and UI"`

---

### Task 2: POS Checkout & Cart Integration (Tracks E & H)

**Files:**
- Modify: `backend/src/routes/sale.routes.ts`
- Modify: `frontend/src/pages/RegisterPage.tsx`
- Modify: `frontend/src/main.tsx`
- Modify: `backend/scripts/tenant-isolation-smoke.ts`

**Interfaces:**
- `Sale`: accepts optional `commissionAgentId: Int` and `currencyId: Int`, `exchangeRate: Decimal`.

- [ ] **Step 1: Support `commissionAgentId` and currency fields in `sale.routes.ts`**

Ensure `salePostSchema` validates `commissionAgentId`, `currencyId`, and `exchangeRate`, saving them on `Sale` record creation.

- [ ] **Step 2: Wire Commission Agent & Currency selectors in `RegisterPage.tsx`**

Add dropdowns in POS checkout panel allowing cashiers to select a Commission Agent (`GET /api/commission-agents`) and Currency (`GET /api/currencies`).

- [ ] **Step 3: Add Smoke Test Assertions & Run**

Extend `tenant-isolation-smoke.ts` to create a sale with a commission agent and multi-currency exchange rate.

- [ ] **Step 4: Commit**

`git add . && git commit -m "feat(pos): wire sales commission agent and multi-currency selectors into checkout UI and API"`

---

### Task 3: Bulk Data Import Tools (Track C)

**Files:**
- Create: `backend/src/routes/import.routes.ts`
- Modify: `backend/src/index.ts`
- Modify: `frontend/src/pages/ProductsPage.tsx`
- Modify: `backend/scripts/tenant-isolation-smoke.ts`

**Interfaces:**
- `POST /api/imports/products`: Accepts `{ products: [{ name, sku, price, cost, barcode, categoryName, brandName }] }`. Creates missing Categories/Brands and inserts Products in batch `$transaction`.
- `POST /api/imports/stock`: Accepts `{ stockItems: [{ sku, quantity, locationId }] }`. Upserts `ProductStock` records.

- [ ] **Step 1: Create `backend/src/routes/import.routes.ts`**

Implement batch product import and opening stock import handlers with Zod schema validation and tenant scoping.

- [ ] **Step 2: Mount import routes in `index.ts`**

Add `app.use('/api/imports', requireAuth, importRoutes);` to `backend/src/index.ts`.

- [ ] **Step 3: Add Import modal/button in `ProductsPage.tsx`**

Add "Importer Produits (CSV)" button in `ProductsPage.tsx` allowing users to upload/paste CSV product data.

- [ ] **Step 4: Add Smoke Test Coverage & Run**

Add product import and opening stock import assertions to `tenant-isolation-smoke.ts`.

- [ ] **Step 5: Commit**

`git add . && git commit -m "feat(import): add bulk product and opening stock import endpoints and UI modal"`

---

### Task 4: Configurable Dashboard System (Track I)

**Files:**
- Modify: `frontend/src/main.tsx` (Dashboard page renderer)

**Interfaces:**
- `DashboardConfiguration`: `{ widgets: Array<{ id: string, enabled: boolean, order: number }> }`

- [ ] **Step 1: Connect `GET /api/dashboard-config` and `PUT /api/dashboard-config` in Dashboard**

Fetch user's `DashboardConfiguration` on mount. Save updated layout configuration on change.

- [ ] **Step 2: Implement Configurable Widget Display**

Allow users to toggle and rearrange dashboard widgets (Chiffre d'Affaires, Ventes Récentes, Alerte Stock, Top Produits, Comptabilité Rapide).

- [ ] **Step 3: Run Frontend Typecheck & Build**

Verify clean `tsc --noEmit` and `vite build` in `frontend/`.

- [ ] **Step 4: Commit**

`git add . && git commit -m "feat(dashboard): implement user-configurable widget dashboard system"`

---

### Task 5: Final Comprehensive Verification & Documentation Update

**Files:**
- Modify: `PROGRESS.md`
- Modify: `TRACE.md`

- [ ] **Step 1: Execute Full Smoke Test Suite**

Run `node node_modules/tsx/dist/cli.mjs scripts/tenant-isolation-smoke.ts` against PostgreSQL.

- [ ] **Step 2: Execute Workspace Typecheck & Production Build**

Run `node node_modules/typescript/bin/tsc --noEmit` and `node node_modules/vite/bin/vite.js build`.

- [ ] **Step 3: Update `PROGRESS.md` and `TRACE.md`**

Document completion of remaining migration tasks and final verification statistics.

- [ ] **Step 4: Commit**

`git add . && git commit -m "docs(progress): record completion of remaining ERP migration work and final verification"`
