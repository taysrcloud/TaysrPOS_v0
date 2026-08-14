# Final ERP Completion & Compliance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the remaining high-priority ERP gaps (Facturation Groupée / Consolidated Invoices, Notification Event Wiring, Discount POS Cart Resolver Integration, Frontend Settings UI for ERP Modules, and Legacy MySQL Data Migration Tool) to achieve 100% full ERP parity for TaysrPOS_v0.

**Architecture:** Tenant-isolated Express routes + Prisma models on the backend, integrated into React Vite frontend pages, backed by automated tenant-isolation smoke test assertions and clean TypeScript builds.

**Tech Stack:** Node.js/TypeScript, Express 5, Prisma 7, PostgreSQL, React, Vite, Tailwind/CSS.

## Global Constraints

- Strict tenant isolation: every query must filter by `companyId` (tenantId) or verify tenant ownership.
- All code must run natively on Termux (ARM64 Linux) with pure JS / Node modules (no native x86_64 glibc binary dependencies).
- TVA snapshot immutability: historical sale and invoice totals/rates must never be overwritten on update.
- Clean build: `tsc --noEmit` on backend and frontend must pass with 0 errors.

---

### Task 1: Facturation Groupée (Consolidated Invoices for Moroccan Fiscal Compliance)

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/src/routes/consolidated-invoice.routes.ts`
- Modify: `backend/src/index.ts`
- Modify: `backend/scripts/tenant-isolation-smoke.ts`

**Interfaces:**
- `ConsolidatedInvoice`: `{ id, reference, companyId, locationId, customerId, periodStart, periodEnd, total, taxTotal, status, saleIds: Int[] }`
- `POST /api/invoices/consolidated`: Accepts `{ customerId, saleIds, periodStart, periodEnd }`, validates customer ICE, verifies sales belong to customer and are non-invoiced, aggregates lines, creates ConsolidatedInvoice.
- `GET /api/invoices/consolidated`: Lists consolidated invoices with tenant filter.
- `GET /api/invoices/consolidated/:id/pdf`: Generates A4 PDF summary.

- [ ] **Step 1: Update Prisma Schema for Consolidated Invoice**

Add `ConsolidatedInvoice` model to `backend/prisma/schema.prisma`:
```prisma
model ConsolidatedInvoice {
  id           Int      @id @default(autoincrement())
  companyId    Int
  locationId   Int?
  customerId   Int
  reference    String
  periodStart  DateTime
  periodEnd    DateTime
  total        Decimal  @db.Decimal(12, 2)
  taxTotal     Decimal  @db.Decimal(12, 2)
  status       String   @default("ISSUED")
  notes        String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  company      Company  @relation(fields: [companyId], references: [id], onDelete: Restrict)
  location     Location? @relation(fields: [locationId], references: [id], onDelete: SetNull)
  customer     Contact  @relation(fields: [customerId], references: [id], onDelete: Restrict)
  sales        Sale[]   @relation("ConsolidatedInvoiceSales")

  @@index([companyId])
  @@index([customerId])
}
```
And add `consolidatedInvoiceId Int?` on `Sale` model.

- [ ] **Step 2: Apply Prisma DB Push & Regenerate Client**

Run `PRISMA_SCHEMA_ENGINE_BINARY="$PREFIX/tmp/prisma-arm64/schema-engine-wrapper.sh" node node_modules/prisma/build/index.js db push` in `backend/`.

- [ ] **Step 3: Create `consolidated-invoice.routes.ts`**

Create `backend/src/routes/consolidated-invoice.routes.ts` implementing `GET`, `POST`, and `GET /:id/pdf` with strict tenant isolation and customer ICE validation.

- [ ] **Step 4: Mount route in `backend/src/index.ts`**

Add `app.use('/api/invoices/consolidated', requireAuth, consolidatedInvoiceRoutes);` to `index.ts`.

- [ ] **Step 5: Add Smoke Test Assertions & Run**

Add consolidated invoice creation and tenant isolation assertions to `tenant-isolation-smoke.ts`.

---

### Task 2: Notification Event Triggers & Standalone Discount Cart Resolver Wiring

**Files:**
- Modify: `backend/src/utils/notifications.ts`
- Modify: `backend/src/utils/pricing.ts`
- Modify: `backend/src/routes/sale.routes.ts`
- Modify: `backend/src/routes/inventory.routes.ts`
- Modify: `backend/scripts/tenant-isolation-smoke.ts`

**Interfaces:**
- `triggerNotificationEvent(companyId, eventType, metadata)`: Inserts `DocumentAndNote` row and returns generated notification.
- `resolveActiveDiscounts(companyId, productId, categoryId, brandId)`: Calculates best active discount for item.

- [ ] **Step 1: Wire Notification Triggers in Sale Finalization & Stock Reduction**

Import `triggerNotificationEvent` in `sale.routes.ts` and invoke it on successful sale creation (`NEW_SALE` and `PAYMENT_RECEIVED`).
Invoke `triggerNotificationEvent` in `inventory.routes.ts` when stock falls below `alertQuantity` (`LOW_STOCK`).

- [ ] **Step 2: Wire Active Discount Resolver into Pricing**

Update `resolveCustomerGroupPrices` in `pricing.ts` to query active `Discount` rows (`startDate <= NOW() <= endDate`, matching `companyId`, `productId`/`categoryId`/`brandId`), taking the higher discount between CustomerGroup and standalone Discount.

- [ ] **Step 3: Verify Typecheck & Smoke Test Coverage**

Run `node node_modules/typescript/bin/tsc --noEmit` in `backend/` and run `tenant-isolation-smoke.ts` to confirm zero regressions.

---

### Task 3: Frontend Settings Management UI for Warranties, Variation Templates, Discounts & Devices

**Files:**
- Modify: `frontend/src/pages/SettingsPage.tsx`
- Modify: `frontend/src/pages/ProductsPage.tsx`
- Modify: `frontend/src/components/BarcodePrintModal.tsx`

**Interfaces:**
- Settings tabs: Warranties ("Garanties"), Variation Templates ("Modèles de Variation"), Discounts ("Promotions & Remises"), Devices ("Appareils Sync").

- [ ] **Step 1: Add Garanties management tab in `SettingsPage.tsx`**

Render table listing warranties, form modal to create warranty (`name`, `duration`, `durationType`), and delete handler.

- [ ] **Step 2: Add Modèles de Variation tab in `SettingsPage.tsx`**

Render variation templates list and create form (`name`, `values` tags).

- [ ] **Step 3: Add Promotions & Remises tab in `SettingsPage.tsx`**

Render standalone discounts list and create form (`name`, `discountType`, `amount`, `startDate`, `endDate`, `appliesTo`).

- [ ] **Step 4: Add Appareils Sync tab in `SettingsPage.tsx`**

Render activated devices table and "Générer Code d'Activation" button calling `POST /api/settings/devices`.

- [ ] **Step 5: Wire Barcode Sticker button in `ProductsPage.tsx`**

Add "Imprimer étiquettes" button in `ProductsPage.tsx` action bar that opens `BarcodePrintModal`.

- [ ] **Step 6: Verify Frontend Typecheck & Build**

Run `node node_modules/typescript/bin/tsc --noEmit` and `node node_modules/vite/bin/vite.js build` in `frontend/`.

---

### Task 4: Legacy Data Migration Tool (Track J — MySQL → PostgreSQL)

**Files:**
- Create: `backend/scripts/migrate-legacy-mysql.ts`

**Interfaces:**
- `migrateLegacyData(mysqlUrl, postgresCompanyId)`: Imports Users, Contacts, Products, Categories, Brands, Sales, and Payments from legacy MySQL database into v0 PostgreSQL tenant schema with automatic FK translation and total validation checks.

- [ ] **Step 1: Create `migrate-legacy-mysql.ts` script scaffolding**

Create script with CLI argument parsing (`--mysql-uri`, `--target-company-id`) and dry-run flag (`--dry-run`).

- [ ] **Step 2: Implement entity mappers & total reconciler**

Implement batch transformation mapping legacy MySQL tables (`users`, `contacts`, `products`, `variations`, `transactions`, `transaction_payments`) into Prisma `$transaction` batches. Include financial total reconciliation assertion (`SUM(old_sales) === SUM(new_sales)`).

- [ ] **Step 3: Test dry-run execution and verify clean exit**

Run `node node_modules/tsx/dist/cli.mjs scripts/migrate-legacy-mysql.ts --dry-run` to ensure zero syntax/import errors.

---

### Task 5: Final Comprehensive Verification & Documentation Update

**Files:**
- Modify: `backend/scripts/tenant-isolation-smoke.ts`
- Modify: `PROGRESS.md`
- Modify: `TRACE.md`

- [ ] **Step 1: Execute Tenant Isolation & Smoke Test Suite**

Run full `tenant-isolation-smoke.ts` script against local PostgreSQL database.

- [ ] **Step 2: Execute Workspace Typecheck & Production Build**

Run `node node_modules/typescript/bin/tsc --noEmit` and `node node_modules/vite/bin/vite.js build` on frontend.

- [ ] **Step 3: Update `PROGRESS.md` and `TRACE.md`**

Record final parity completion details in project documentation.
