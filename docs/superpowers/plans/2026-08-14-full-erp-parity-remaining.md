# Full ERP Parity Migration (Remaining Tasks) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete all remaining ERP feature parity tasks (Variation Templates, Warranties, Barcode Labels, Standalone Discounts, Accounting Reports & Reconciliation, Sales Commission Reports, Event Notification Triggers, and Dashboard Widget Customization) for TaysrPOS_v0.

**Architecture:** Tenant-isolated Express routes + Prisma PostgreSQL models on the backend, integrated into Vite React frontend components with context-driven state management. Verification via `tenant-isolation-smoke.ts` and TypeScript typechecks.

**Tech Stack:** Node.js/TypeScript, Express 5, Prisma 7, PostgreSQL, React, Vite.

## Global Constraints

- Strict tenant isolation: every query includes `where: { tenantId }` or verifies parent tenant ownership.
- Pure JS/native dependencies only (must run cleanly in Termux environment).
- TVA snapshot immutability on sales and invoices.
- Clean TypeScript build (`tsc --noEmit` clean on backend and frontend).

---

### Task 1: Track C — Warranty Management & Variation Templates (Backend + Schema + API)

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/src/routes/warranty.routes.ts`
- Create: `backend/src/routes/variation-template.routes.ts`
- Modify: `backend/src/server.ts`
- Modify: `backend/scripts/tenant-isolation-smoke.ts`

**Interfaces:**
- `Warranty`: `{ id, name, description?, duration, durationType: "DAYS"|"MONTHS"|"YEARS", tenantId }`
- `VariationTemplate`: `{ id, name, values: string[], tenantId }`

- [ ] **Step 1: Update Prisma schema for Warranty and VariationTemplate**

Add `Warranty` and `VariationTemplate` models to `backend/prisma/schema.prisma` and add `warrantyId` to `Product`.
Run `node node_modules/prisma/build/index.js db push` or `prisma generate`.

- [ ] **Step 2: Create `warranty.routes.ts` and `variation-template.routes.ts`**

Implement CRUD operations for Warranties and Variation Templates with tenant isolation (`tenantId`).

- [ ] **Step 3: Register routes in `server.ts`**

Mount `/api/warranties` and `/api/variation-templates` with `requireAuth` middleware.

- [ ] **Step 4: Verify backend typecheck and add smoke test coverage**

Run backend typecheck and update `tenant-isolation-smoke.ts` with assertions for Warranty and VariationTemplate CRUD and cross-tenant rejection.

---

### Task 2: Track C — Standalone Discounts & Barcode Generator (Backend + Schema + API)

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/src/routes/discount.routes.ts`
- Modify: `backend/src/routes/product.routes.ts`
- Modify: `backend/src/utils/pricing.ts`

**Interfaces:**
- `Discount`: `{ id, name, discountType: "FIXED"|"PERCENTAGE", amount, startDate, endDate, appliesTo: "ALL"|"CATEGORY"|"BRAND"|"PRODUCT", brandId?, categoryId?, productIds: Int[], locationId?, tenantId }`
- `GET /api/products/barcodes/print?productIds=1,2&quantities=2,5`: Returns SVG/HTML barcode grid for thermal sticker printing.

- [ ] **Step 1: Update Prisma schema for Discount model**

Add `Discount` model to `backend/prisma/schema.prisma`.

- [ ] **Step 2: Create `discount.routes.ts` and wire pricing resolver**

Implement CRUD for Discounts. Update `resolveCustomerGroupPrices` in `pricing.ts` or add `resolveActiveDiscounts` to calculate active product discounts in POS cart.

- [ ] **Step 3: Create Barcode Sheet Generator Endpoint in `product.routes.ts`**

Implement `GET /api/products/barcodes/print` returning an HTML page with Code128 barcode stickers ready for printing.

- [ ] **Step 4: Verify typecheck and smoke test coverage**

Run backend typecheck and test discount resolution and barcode generation in smoke test.

---

### Task 3: Track D — Accounting Reports & Expense Ledger Reconciliation

**Files:**
- Modify: `backend/src/routes/accounting.routes.ts`
- Modify: `backend/src/routes/expense.routes.ts`
- Modify: `backend/scripts/tenant-isolation-smoke.ts`

**Interfaces:**
- `GET /api/accounting/trial-balance`: Returns debit/credit balances across all accounts.
- `GET /api/accounting/ledger/:accountId`: Returns chronological list of AccountTransactions with running balance.
- `PUT /api/expenses/:id`: Adjusts linked `AccountTransaction` when expense amount/paymentMethod changes.

- [ ] **Step 1: Add `trial-balance` and `ledger` endpoints to `accounting.routes.ts`**

Implement trial balance calculation (sum of DEBITs vs CREDITs per Account) and detailed per-account ledger transactions query.

- [ ] **Step 2: Implement Expense edit/deactivate ledger reconciliation in `expense.routes.ts`**

When an expense is updated (`PUT /:id`), adjust or recreate the linked `AccountTransaction`. When deactivated, reverse the posted transaction.

- [ ] **Step 3: Verify backend typecheck and add smoke test coverage**

Run smoke assertions for trial balance, ledger reporting, and expense update transaction reconciliation.

---

### Task 4: Track E & F — Sales Commission Reports & Event Notification Triggers

**Files:**
- Create: `backend/src/routes/commission.routes.ts`
- Create: `backend/src/utils/notifications.ts`
- Modify: `backend/src/routes/sale.routes.ts`
- Modify: `backend/src/routes/inventory.routes.ts`

**Interfaces:**
- `GET /api/commissions/report?startDate=...&endDate=...&agentId=...`: Computes agent sales, total revenue, and total commission earned.
- `triggerNotificationEvent(tenantId, type, data)`: Creates `DocumentAndNote` / notification log entries for `LOW_STOCK`, `PAYMENT_RECEIVED`, `NEW_SALE`.

- [ ] **Step 1: Implement Sales Commission Reporting in `commission.routes.ts`**

Build `GET /api/commissions/report` summarizing sales grouped by `commissionAgentId` with percentage calculations.

- [ ] **Step 2: Implement Event Notification helper `notifications.ts` and wire triggers**

Wire `triggerNotificationEvent` calls into `sale.routes.ts` (PAYMENT_RECEIVED / NEW_SALE) and stock reduction in `inventory.routes.ts` / POS finalize (LOW_STOCK).

- [ ] **Step 3: Verify typecheck and smoke test coverage**

Add assertions in `tenant-isolation-smoke.ts` for commission reports and notification trigger execution.

---

### Task 5: Track C, D, E, H, I — Frontend UI Integration (Settings, Products, Reports, Dashboard)

**Files:**
- Create: `frontend/src/components/BarcodePrintModal.tsx`
- Modify: `frontend/src/pages/SettingsPage.tsx`
- Modify: `frontend/src/pages/ReportsPage.tsx`
- Modify: `frontend/src/pages/DashboardPage.tsx`

**Interfaces:**
- Devises, Warranties, Variation Templates, Discounts tabs in Settings.
- Barcode Sticker Print button in Product List.
- Account Ledger, Trial Balance, and Sales Commissions tabs in Reports.
- Configurable Dashboard widgets based on `DashboardConfiguration`.

- [ ] **Step 1: Add Devises, Warranties, Templates, Discounts management in Settings UI**

Add tabs/sections in Settings page for creating and managing Warranties, Variation Templates, and Standalone Discounts.

- [ ] **Step 2: Add Barcode Print Modal in Product List UI**

Create `BarcodePrintModal.tsx` allowing cashiers to select items & quantities and trigger printable barcode sticker sheet.

- [ ] **Step 3: Add Accounting & Commission Reports tabs in Reports UI**

Add "Comptabilité" (Trial Balance & Ledger) and "Commissions" tabs in `ReportsPage.tsx`.

- [ ] **Step 4: Implement Configurable Dashboard Widgets in `DashboardPage.tsx`**

Allow users to toggle/reorder dashboard widgets saved via `GET/PUT /api/dashboard-config`.

- [ ] **Step 5: Verify Frontend Typecheck & Build**

Run frontend typecheck and `vite build` to ensure clean build.

---

### Task 6: Full ERP Migration Verification & Documentation

**Files:**
- Modify: `backend/scripts/tenant-isolation-smoke.ts`
- Modify: `PROGRESS.md`
- Modify: `TRACE.md`

- [ ] **Step 1: Execute Full Tenant Isolation & ERP Feature Smoke Suite**

Run `tenant-isolation-smoke.ts` with all assertion areas green.

- [ ] **Step 2: Execute Frontend Build Check**

Run build across backend and frontend workspaces.

- [ ] **Step 3: Update `PROGRESS.md` and `TRACE.md`**

Record all completed migration tracks, verification steps, and test results.
