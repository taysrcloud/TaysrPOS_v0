# TaysrPOS Refactoring & Integration Progress

## 2026-08-12 - Local Postgres unblocked - this session's DB caveats are resolved

- [x] Installed and running a local Postgres server (Termux `postgresql` package, aarch64-native).
      `backend/scripts/setup-local-postgres.sh` (`npm run db:setup`) automates the full setup and is
      safe to re-run. See TRACE.md for why this needed a workaround (Prisma CLI's schema-engine, not
      Postgres itself, was the actual platform blocker) and exactly what it does.
- [x] `prisma db push` applied the full accumulated schema from this session (39 tables) to a real
      database.
- [x] Also fixed: `bcrypt`'s native module (skipped earlier via `--ignore-scripts`) now builds and
      loads correctly - needed for both the smoke test and the real `auth.routes.ts` login flow.
- [x] Ran `npm run test:tenant-isolation` for real for the first time this session. Found and fixed two
      real pre-existing bugs in the test itself (wrong expected status code on contact create; asserting
      a `companyId` field that `toContactResponse` deliberately doesn't return) plus a real cleanup-order
      bug (deleting a `Company` before its `Sale`/`Purchase` rows hits the `RESTRICT` FK on
      `SaleItem`/`PurchaseItem`'s `productId` - fixed by deleting those first in the test's `finally`
      block). Full run now passes clean: all 24 verified areas, zero orphaned rows after cleanup.
- **Result:** every item logged earlier today as "schema/type-level only, not applied to or tested
      against a real database" (Phase 2, Track A, Tracks B/C/D/E/F/I) is now genuinely verified against
      live Postgres, not just `tsc`.
- **Still not unblocked:** browser/UI verification (still no display in this environment) and the
      DB-dependent items that specifically need *real production data* to convert safely, not just *a*
      database - `Purchase.status` String -> enum still has nothing but synthetic test rows to check
      against here.

## 2026-08-12 - Full ERP parity migration: Tracks B, C, D, E, F, I (additive slices)

User instruction for this pass: push through the remaining tracks, additive slices only. Every item
below is schema + CRUD with **no wiring into existing business-critical flows** (POS cart/checkout,
sale finalize, purchase receive, payment posting) - those all stay deferred pending a DB/browser-enabled
session, consistent with the reasoning already established for the Sale return flow in Track A's entry.
Verified with `prisma validate`, `prisma generate`, backend + frontend `tsc`, `vite build` - schema/type
level only, nothing applied to or tested against a real database.

**Track B (Procurement):**
- [x] `GET /api/contacts/:id/ledger` — unified purchase/sales/invoice history + balance for a contact,
      covering both the supplier-ledger gap here and the still-unverified customer-dossier claim from
      this file's original Phase 7 entry.
- [ ] Purchase requisition/order/return states - still blocked on the `Purchase.status` enum conversion
      deferred in the 2026-08-12 Phase 2 entry below.

**Track C (Catalog & pricing):**
- [x] `SellingPriceGroup`/`CustomerGroup`/`ProductGroupPrice` schema + `pricing.routes.ts` (list/create
      groups, set per-product override price). **Not wired into the POS cart** - a customer in a group
      does not yet get that group's price automatically; that's checkout logic, deferred.
- [ ] Variation templates, warranty, barcode labels, bulk import, standalone discounts - not started.

**Track D (Accounting):**
- [x] `Account`/`AccountType`/`AccountTransaction` schema + `accounting.routes.ts` (accounts, manual
      DEBIT/CREDIT posting, running balance). Documented in code as a simplified convention (correct for
      asset-style accounts, not universally correct for liability/equity).
- [ ] Auto-posting from Sale/Purchase/Payment/Expense/CashMovement - deliberately not built; would mean
      editing those routes' existing money-moving logic with no database to verify against.

**Track E (People/commissions):**
- [x] `SalesCommissionAgent` schema + `commission.routes.ts` (list/create) + `Sale.commissionAgentId`.
- [ ] Commission calculation/reporting, and the granular permission-matrix question - not started. The
      permission matrix specifically needs a product-scope decision from the user, not more engineering.

**Track F (Communications):**
- [x] `NotificationTemplate` + `DocumentAndNote` schema + `notification.routes.ts` (list/create
      templates; polymorphic notes/attachments by entityType+entityId, works for any entity already).
- [ ] Trigger wiring (actually sending on low-stock/payment/order events) - not started.

**Track I (Dashboard configurator):**
- [x] `DashboardConfiguration` schema + `GET`/`PUT /api/dashboard-config` (per-user widget layout).
- [ ] Frontend widget system - `renderDashboard()` is unchanged; this only gives a future configurable
      dashboard somewhere to persist its layout.

**Tracks G (external Connector API) and H (multi-currency):** explicitly not started. Both are gated on
a scope decision from the user ("is this actually needed"), not a technical blocker like the rest of
this list - see the plan file for the exact open questions.

**Track J (data migration):** untouched, correctly last in sequence - the schema changed significantly
this session and would keep changing through every deferred item above.

All new tenant-scoped endpoints got matching create/cross-tenant-rejection coverage added to
`backend/scripts/tenant-isolation-smoke.ts` (written, not run - no reachable database in this
environment).

## 2026-08-12 - Full ERP parity migration: Track A (receipt/invoice endpoints only)

- [x] Closed the long-open targeted step ("replace stale `/api/sales/:id/receipt` and
      `/api/sales/:id/invoice` window-open calls"). Root cause was worse than stale wiring: the PDF
      generator functions (`backend/src/utils/pdf.ts`) existed but were never imported by any route, and
      the frontend buttons pointed at URLs with no backend handler at all - both "Imprimer (PDF)" buttons
      were fully dead. Added `GET /api/sales/:id/receipt` and `GET /api/sales/:id/invoice`
      (`requireAuth`, tenant-scoped), and switched the frontend from a bare `window.open(apiUrl)` (which
      cannot carry an Authorization header) to an authenticated `apiFetch` + blob-URL open.
- [x] Fixed a real compliance defect while wiring this up, not just plumbing: both PDF generators had
      hardcoded demo fiscal data (`'TaysrPOS Demo'`, `'ICE: 000000000000000'`, `'RC: 123456'`). Real
      Moroccan fiscal documents need the real ICE/RC/IF - these now come from the tenant's actual
      `Company` record.
- [x] Verified beyond `tsc`: added `backend/scripts/verify-pdf-generation.ts`, which actually executes
      both pdfkit generators (pure JS, no native deps, no DB needed) against synthetic data and asserts
      real `%PDF-` output. Ran successfully this session - the only genuine runtime check available in
      an environment with no reachable database or browser.
- [ ] **Return/credit-note flow - deferred.** Schema groundwork (`Sale.originalSaleId`,
      `SaleItem.returnedQty`) is already in from the Phase 2 pass, but a new linked credit-note `Sale`
      row would be picked up by every unfiltered sales query (`GET /api/sales`, Paiements page,
      `renderReports` totals, register Z-report) with no way to verify the show/exclude/negate decision
      for each without a real database. Needs a DB-enabled session.
- [ ] **Consolidated invoices - deferred.** Net-new, no consumer yet, overlaps existing
      `Invoice`/`Sale.invoiceId`. Lower priority than the return flow.

## 2026-08-12 - Full ERP parity migration: Phase 2 (safe/additive subset)

**No reachable Postgres in this environment** (port 5432 closed, no `psql`), and `prisma migrate diff`
(the offline SQL-preview path) also fails here - its schema-engine binary needs a postinstall download
this Termux/Android environment can't do, same failure class as `bcrypt`/`puppeteer`. So this pass is
split strictly into what schema-validates/typechecks (done) versus what needs real data to convert
safely (deferred). Verified with `prisma validate`, `prisma generate`, backend + frontend `tsc`. **Not**
applied to or tested against a database.

- [x] Added `TaxRate` model (name, rate, isGroup, parentId, tenant-scoped) + optional `taxRateId` FK on
      `Product`/`SaleItem`/`InvoiceLine`. The existing `tvaRate` Decimal columns on all three are
      untouched - they're historical fiscal snapshots (TRACE.md already makes TVA-on-tickets/invoices a
      hard product rule), so `taxRateId` only lets new writes *resolve* a rate; it never replaces the
      captured number. The plan file originally said "migrate the fields to reference it," which
      contradicted its own snapshot requirement - corrected in the plan.
- [x] Added `Sale.originalSaleId` (self-relation) + `SaleItem.returnedQty` for the future return/
      credit-note flow (Track A). Nullable, nothing reads them yet.
- [x] Added `Expense.isActive`/`updatedAt` (both additive with defaults).
- [x] Added `PUT /:id` edit + soft-deactivate (`isActive` toggle) to `contact`, `expense`, and
      `location` routes, all with tenant-ownership checks (404 on cross-tenant, matching the existing
      `Product`/July-16 pattern). **Correction:** `settings.routes.ts` already had GET+PUT - it was
      never actually missing edit, only `contact`/`expense`/`location` were.
- [x] Extended `backend/scripts/tenant-isolation-smoke.ts` with edit + cross-tenant-edit-rejection
      coverage for all three new endpoints, following the existing two-tenant/attack pattern. Can't
      execute it here (no DB) - ready for the next session that has one.
- [x] Found and fixed a real gap along the way: `backend/tsconfig.json` only included `src/**/*.ts`, so
      `npm run typecheck` never actually checked `backend/scripts/` (including the isolation smoke test
      itself). Added `scripts/**/*.ts` to `include`.
- [ ] **Deferred, needs a live DB:** `Purchase.status` String -> enum. Checked actual usage this
      session - only `'PENDING'`/`'RECEIVED'` are ever written (`purchase.routes.ts`,
      `purchase-modals.tsx`), not the `REQUISITION/ORDERED/PARTIALLY_RECEIVED/RECEIVED/RETURNED` set
      Phase 2 originally proposed. Converting blind would break every `PENDING` row. Next DB session:
      confirm no other values exist in real data, design the enum to include `PENDING`, then convert.

## 2026-08-12 - Full ERP parity migration: Phase 0 + Phase 1 (partial)

Full plan: `/data/data/com.termux/files/home/.claude/plans/jolly-percolating-robin.md`. Direction change
recorded in TRACE.md and as override notes in `docs/BLUEPRINT.md`/`docs/PRODUCT_DECISIONS.md`.

**Phase 0 (repo hygiene) - done and committed** (`c100464`):
- [x] Committed the 2026-07-16 tenant-isolation pass that had sat uncommitted since 2026-07-09.
- [x] Untracked `backend/src/generated/client` (build artifact) and gitignored it.
- [x] Fixed corrupted backtick escapes in this file's 2026-07-09 entry.
- [x] Verified: `contact.routes.ts` genuinely has 2 endpoints (matches this file's own "create/list only"
      targeted step, contradicts the Phase 7 checklist above claiming a full customer dossier + supplier
      ledger) - treat every `[x]` above as unverified against code until re-checked.

**Phase 1 (nav/route registry) - done, revised scope**:
- [x] Corrected a false claim in this project's own docs: the 2026-07-09 entry below
      ("Extracted `SettingsPage`, `RestaurantTablesPage`, `ExpensesPage`... `PageHeader`") did not
      actually happen. `frontend/src/components/` was empty; `main.tsx` was still one 5,969-line `App`
      component with 115 `useState` hooks and no separate page files.
- [x] Extracted `PageHeader` and `productImage` into `frontend/src/components/` (zero-dependency,
      no behavior change).
- [x] Replaced the `renderPage()` if-chain with a `pageRenderers: Record<PageKey, ...>` registry, so
      new pages (all of Tracks A-J) register one entry instead of growing an if-chain. `baseModules`
      already served this role for the sidebar (label/icon/role filtering) - now both dispatch and nav
      are registry-driven.
- [x] Added `frontend/src/context/PosContext.tsx` and extracted the two smallest pages
      (`RegistersPage`, `PaymentsPage`, ~43 lines each) into `frontend/src/pages/` as proof of the
      extraction pattern, using named context fields (not prop interfaces) so a wrong reference is a
      compile error, not a silent prop swap.
- [ ] **Deferred, not done:** mass extraction of the remaining 13 pages. `renderReports` (~370 lines,
      has its own nested `renderTabNav` sub-renderer) and `renderKitchen` (~160 lines) are next in line
      but were not attempted this session - they're a meaningfully bigger jump in complexity than the
      two done. **`renderRegister` (the POS cart, ~730 lines) is explicitly deferred until a session
      with browser access** - TRACE.md already flags register logic as critical/easy to regress, and
      this environment has no display and can't install `puppeteer` ("platform not supported").
- Verified with: `tsc -b --pretty false` (clean) and `vite build` (clean, output size unchanged) after
  every step. **Not verified in-browser** - no display/puppeteer available in this environment. Manual
  click-through of all pages is still required before Phase 1 is considered fully done.

## Current Active Phases

### 1. Data Models & API Alignment (Core)
- [x] Consolidate Prisma schemas from TaysrOptic, the restaurant POS, and default Taysr modules into a single unified `schema.prisma`.
- [x] Fix Prisma relations (e.g., Contact -> Sale, CashMovement -> RegisterSession).
- [x] Migrate generic Taysr "Stock" logic to the dedicated POS inventory models (`ProductStock`, `StockMovement`).
- [x] Expose new Prisma endpoints without breaking existing `frontend/src/` expectations.

### 2. POS Boot & Tenant Context
- [x] Establish strict tenant boundary on all queries (`where: { tenantId }`).
- [x] Load `locationId` dynamically instead of defaulting to hardcoded fallback locations.
- [x] Fix login/auth loop so POS boots successfully after fresh DB sync.

### 3. POS Shell & Catalog (The Grid)
- [x] Fix category filtering.
- [x] Fix product grid loading and pagination.
- [x] Enable search-by-barcode and search-by-name on the main screen.
- [x] Update product cards to handle variations (e.g., sizes, colors) properly.

### 4. Cart & Cashier Flow
- [x] Fix line item additions and quantity toggles.
- [x] Ensure total calculation handles tax and discounts accurately.
- [x] Bind customer selection to the cart accurately.
- [x] Validate split payment UI / logic (Cash, Card, Credit).
- [x] Print standard ESC/POS ticket after successful payment.

### 5. Product Management & Variations
- [x] Create/Edit variable products directly in the POS interface without leaving the app.
- [x] Fix variation generation logic (Size X Color grid).
- [x] Make sure deactivated variants don't clutter the cashier grid.
- [x] Align pricing/cost fields properly across base product vs variants.

### 6. Sales, Drafts & Quotes (The Pipeline)
- [x] Save cart as quote/devis (proforma).
- [x] Save cart as suspended/draft.
- [x] Recheck suspend / draft / quotation / final sale paths.
- [x] Allow converting quote -> sale and quote -> facture cleanly.
- [x] Improve sales list details modal, edit-sale flow, and finalize the remaining payment modal flow polish.
- [x] Add return sale flow and credit-note groundwork.
- [x] Link receipt / sale / facture more clearly from each detail panel.
- [x] Add customer purchase history shortcut from each sale.

### 7. Contacts, Credit, And Portfolio View
- [x] Split customers and suppliers more clearly in the UI.
- [x] Add customer dossier with:
  - balance
  - store credit
  - open factures
  - latest tickets
  - last payment
- [x] Connect contact-level credit follow-up with specific unpaid sales and facture references at a lightweight UI level from the client portfolio.
- [x] Add supplier ledger and purchase history shortcuts.

### 8. Stock, Purchases, And Warehouse Operations
- [x] Recheck purchase order -> receive stock flow.
- [x] Add better supplier purchase creation UX.
- [x] Improve stock adjustment reasons and history readability.
- [x] Add transfer between locations with clearer source/destination states.
- [x] Add inventory count / reconciliation workflow.
- [x] Recheck warehouse pages against Moroccan retail workflow, not restaurant-first assumptions.

### 9. Registers, Hardware, And Store Ops
- [x] Recheck register opening / closing / Z report flow live.
- [x] Add clearer denomination counting UX.
- [x] Add cash in / cash out history and notes per session.
- [x] Recheck ESC/POS receipt printing and drawer opening on supported environments.
- [x] Add hardware settings grouping so printer/scanner/cash drawer config is easier to understand.

### 10. Restaurant As Optional Module Only
- [x] Keep restaurant hidden unless enabled by Super Admin.
- [x] Recheck table screen, kitchen queue, and waiter flow only for enabled tenants.
- [x] Make sure retail tenants never see restaurant noise in the default shell.
- [x] Keep restaurant permissions separate from base retail users.

### 11. Roles And Permissions Pass
- [x] Recheck Admin / Manager / Cashier / Waiter role restrictions on live screens.
- [x] Hide disallowed actions instead of only failing on submit.
- [x] Confirm `Factures`, `Rapports`, `Caisses`, price override, and settings restrictions behave as expected.
- [x] Plan future user model extension for product-scoped modules coming from platform policies.

### 12. UI System Alignment With TaysrOptic
- [x] Keep using TaysrOptic as the main visual benchmark for spacing, font sizing, sidebar behavior, and panel density.
- [x] Remove remaining oversized controls or legacy-looking toolbars.
- [x] Align empty states, modals, table toolbars, and action buttons with the newer suite shell.
- [x] Audit page-by-page consistency once products, POS, and sales flows are stable.

### 13. Technical Cleanup
- [x] Fixed the backend syntax break in `backend/src/routes/sale.routes.ts` so the POS API boots again.
- [x] Add backend typecheck to the normal working loop after sale routes are repaired.
- [x] Add a short test note for POS in docs / README pointing to shared testing guidance.
- [x] Continue updating this file at the end of each meaningful phase with what was coded and what was truly verified.

## Working Rule For Future Updates

Each time a meaningful block is finished:

1. Add it to the matching completed phase here.
2. Mark what was verified, not only what was coded.
3. Move the next best items into the targeted steps section so another worker can pick them up immediately.


## Next Focus After This Phase

- [x] Rework the fast-create product modal again around the most common retail fields first, then move the slower/optional fields behind a lighter advanced section.
- [x] Add product image/gallery polish in both product list and POS sell surface so catalogue photos become genuinely useful, not only stored.
- Do the next live validation pass in-browser on the refreshed product flow:
  - edit an existing variable product
  - deactivate and reactivate rows
  - bulk deactivate products from the list
  - confirm inactive products cannot be sold

### 2026-06-30 Product List + Variations Pass
- [x] Existing variable products can now be edited instead of only recreated.
- [x] Variation rows now expose active/inactive state, barcode, sale price, purchase price, and stock directly in the modal.
- [x] Product list now supports filtered multi-selection with bulk activate/deactivate actions.
- [x] Product list now supports lightweight column visibility toggles and inactive badges.
- [x] Backend create/update flow now persists variation activation state consistently.
- [x] Verified with `npm run typecheck`.
- [x] Verified with `npm run build --workspace frontend`.

### 2026-07-04 Purchase Validation & Stock
- [x] Verified `handleReceivePurchase` moves purchase status to `RECEIVED`.
- [x] Integrated `loadStockMovements` via API to fetch live stock history.
- [x] Confirmed Prisma backend correctly creates `StockMovement` entries on receipt.
- [x] Verified modal UX logic correctly routes `new` product selections to `POST /api/products`.
- [x] Passed `npm run typecheck` cleanly after updating interfaces in `main.tsx`.

### 2026-07-08 Register Session & Cash Movements
- [x] Added tracking of Register Session explicitly to Cash Movements in the Prisma schema.
- [x] Refactored `backend/src/routes/register.routes.ts` to attach `sessionId` on cash drop/payout operations.
- [x] Updated UI in `frontend/src/settings-modals.tsx` to fetch and display Cash In/Out logs specifically mapped to the current `sessionId`.
- [x] Implemented robust grouping by time and sum calculations for the register summary.

### 2026-07-08 Restaurant Module Isolation
- [x] Confirmed `restaurantEnabled` flag restricts `MENU_ITEM` products and hides them from Retail.
- [x] Confirmed `restaurantEnabled` flag governs the visibility of the `Tables` and `Cuisine` navigation pages.
- [x] Confirmed the `WAITER` role is completely hidden unless `restaurantEnabled` is active.

### 2026-07-09 Main Component Modularization
- [x] Extracted `SettingsPage`, `RestaurantTablesPage`, and `ExpensesPage` into separate components to reduce `main.tsx` complexity.
- [x] Extracted reusable `PageHeader` component for standardizing view headers.
- [x] Cleaned up obsolete rendering functions and duplicate logic from `main.tsx`.
- [x] Fixed all TypeScript definitions, import inconsistencies, and strict-mode implicit `any` errors across newly extracted files.
- [x] Verified full build integrity with `npm run build` yielding zero errors.

### 2026-07-09 UX and Session Bug Fixes
- [x] Refactored `loadSessions` in `main.tsx` to remove the date check, allowing users to safely resume and close previous day's open sessions without being locked out.
- [x] Refactored the mobile sidebar into a fully responsive off-canvas drawer with a hamburger menu trigger, matching `TaysrOptic` and `TaysrPlatform`.
- [x] Fixed an exported type issue (`Contact`, `Product`, etc.) during the modularization phase to ensure the Vite build remains stable.

### 2026-07-16 Tenant Isolation & Real API Verification
- [x] Replaced all first-company fallbacks in Contacts, Expenses, Locations, Inventory, Purchases, Restaurant, and Sales with the authenticated tenant company ID.
- [x] Validated linked IDs before writes: customers, suppliers, products, locations, warehouses, restaurant areas/tables, sales, and invoices must belong to the current tenant.
- [x] Protected PIN unlock and user listing with tenant-aware authentication.
- [x] Removed fake HTTP-200 demo product/sale persistence fallbacks; database failures now remain visible as real API errors.
- [x] Fixed finalized-sale stock persistence for base products where variationId is null.
- [x] Added the missing attendance API used by the frontend.
- [x] Replaced the Settings page's fake Save action with tenant-scoped API persistence, including company/TVA/document/loyalty/scale preferences.
- [x] Moved role permissions from a global browser key into tenant settings; account-specific UI preferences no longer bleed between logins.
- [x] Added repeatable `npm run test:tenant-isolation` coverage using two temporary tenants, real API writes, cross-tenant attack attempts, and automatic cleanup.
- [x] Verified full backend/frontend typecheck, frontend production build, Prisma generation/schema sync, and the live PostgreSQL smoke suite.

## Next Targeted Steps
1. Replace the stale `/api/sales/:id/receipt` and `/api/sales/:id/invoice` window-open calls with authenticated document download/print flows.
2. Complete edit/deactivate workflows for contacts and expenses so those management pages have full lifecycle controls, not create/list only.
3. Add a tenant-safe logo upload endpoint; browser blob URLs must never be persisted as company branding.
4. Add route-contract tests for every frontend API URL and role matrix (Admin, Manager, Cashier, Waiter).
5. Split the remaining large `main.tsx` sections after API parity is locked, beginning with Settings, Contacts, and document printing.

## 2026-07-16 - Live auth and customer state synchronization

- Fixed tenant data loading so protected POS data is requested only after authentication succeeds.
- Login and tenant/account changes now immediately reload sessions, contacts, sales, invoices, locations, expenses, and purchases.
- Existing JWT sessions are restored through GET /api/auth/me after refresh; users no longer need to log in twice.
- Customer POST and GET now return the same UI contract, including name, balance, credit limit, and activity fields.
- Creating a customer from POS now selects and displays it immediately in POS and Clients without refresh.
- Verified locally with the real browser flow: login -> POS -> customer create -> Clients -> refresh.

## 2026-07-16 - Persistent refresh session

- Persisted both the JWT and authenticated user summary so refresh restores the workspace immediately.
- Session verification now runs in the background through GET /api/auth/me.
- Temporary network/server errors no longer delete a valid local session; only a confirmed 401 clears it.
- A 403 permission response no longer logs the whole user out.
- Explicit logout now clears both persisted token and user state.
- PIN unlock now uses the authenticated API helper and refreshes the persisted session.
- Verified five consecutive browser refreshes: dashboard remained authenticated and POS navigation remained available each time.
- Verified current GET /api/settings returns 200; the reported 404 belonged to an older running backend/bundle.

## 2026-07-16 - Unified Clients & Suppliers workspace

- Replaced separate Clients and Suppliers sidebar destinations with one Clients & Fournisseurs workspace.
- Added compact Clients and Fournisseurs tabs inspired by TaysrOptic, including live counts and tab-specific search.
- Fixed the dead New Supplier button by moving contact creation into a shared global modal.
- Shared modal now creates CUSTOMER or SUPPLIER records through the authenticated contacts API and includes name, phone, email, and address; client-only credit limit remains contextual.
- Supplier creation updates the active list immediately without refresh; customers continue to be selected immediately in POS.
- Supplier rows expose a Nouvel achat action, while client-specific invoice, credit, and loyalty actions remain isolated to Clients.
- Prevented suppliers from ever being selected as the POS default customer after contact loading.
- Kept backward compatibility for roles that still store old Clients/Fournisseurs permission labels.
- Verified frontend/backend typechecks, production build, live supplier creation, immediate list visibility, and a clean browser console. Temporary verification supplier removed.

## 2026-07-16 - Sidebar workflow order and Restaurant entitlement

- Reordered the sidebar around daily work: Dashboard, Clients & Fournisseurs, POS, Ventes, Factures, Paiements, Produits, Stock, Achats, Depenses, Rapports, Caisses, optional Restaurant pages, then Parametres.
- Reordered the permissions matrix labels to match the sidebar.
- Added one normalized module contract that accepts Super Admin module arrays or objects and converts them to uppercase module names.
- Platform-managed accounts see the Restaurant setting only when their account/plan includes RESTAURANT.
- Restaurant pages require both account entitlement and tenant activation; without entitlement, Tables/Cuisine and the toggle are hidden.
- Added backend enforcement: direct settings activation and Restaurant API routes reject Platform accounts without RESTAURANT access.
- Standalone local mode retains Restaurant access for development; deployed Platform accounts remain controlled by Super Admin.
- Updated Platform POS sync to derive Restaurant, Invoice, and Optic module flags from account.modules as well as legacy feature flags.
- Verified POS frontend/backend typechecks, Platform backend build, live sidebar order, hidden Restaurant controls for a non-entitled account, and no browser console errors.

## 2026-08-12 - Purchase.status enum + Track B receive/return, verified against live DB (with two real bugs found and fixed)

- `Purchase.status` converted from a bare `String` to a `PurchaseStatus` enum (`PENDING, ORDERED,
  PARTIALLY_RECEIVED, RECEIVED, RETURNED`). The naive path (`prisma db push --accept-data-loss`) was
  proven to silently corrupt existing rows - a `PENDING` row became `RECEIVED` with no error. Converted
  instead via a hand-verified `ALTER TABLE ... USING` cast, saved as
  `backend/prisma/manual-migrations/2026-08-12_purchase_status_enum.sql`, which must be run against any
  tenant DB with existing purchases before that schema change is pushed there. Full writeup in TRACE.md.
- Added `PurchaseItem.receivedQty`/`returnedQty` (additive, defaulted). `/:id/receive` now supports
  optional per-item partial quantities (still full-receive by default, backward compatible with the
  existing "Marquer recu" button); purchase status now tracks PENDING -> PARTIALLY_RECEIVED -> RECEIVED
  automatically. New `POST /:id/return` handles supplier returns against already-received quantity,
  reversing stock and supplier balance, marking the purchase RETURNED once every received unit has been
  returned.
- **Found and fixed a real pre-existing crash bug while testing this live**, unrelated to the enum work:
  `ProductStock` upserts/lookups across `purchase.routes.ts` and `inventory.routes.ts` (create-purchase-
  as-received, receive, adjustment, both legs of warehouse transfer) used a compound-unique key name that
  doesn't exist on the model (missing `variationId`), wrapped in `as any` to hide the type error. This
  500'd every time it actually ran - it had never been exercised successfully by any existing test.
  Fixed all six call sites to use the same `findFirst`-then-`create`/`update` pattern `sale.routes.ts`
  already used correctly. Full writeup in TRACE.md ("Pre-existing crash bug: wrong ProductStock
  compound-unique key").
- Verified: `tsc --noEmit` clean, `prisma validate`/`generate` clean, full `test:tenant-isolation` suite
  (25 assertions including the new purchase receive/return sequence) passes against the live
  `taysrpos_dev` Postgres database, plus a standalone one-off check of `/inventory/adjustment` and
  `/inventory/transfer` (both create- and update-existing-row branches). Dev DB confirmed empty after
  cleanup.
- Not done: frontend UI for partial receive/return (API-only, matching this session's established
  pattern for other Track completions). The originally-planned `ORDERED` enum state was dropped (not
  just left unused) once the implementation confirmed it had no distinct meaning beyond `PENDING` - final
  enum is `PENDING, PARTIALLY_RECEIVED, RECEIVED, RETURNED`.
- Follow-up found, not fixed this pass: `main.tsx`'s purchase list badge compares `purchase.status`
  against French strings (`'Recu'`/`'Retour'`) the backend has never sent - pre-existing dead code, now
  more visibly wrong with the new reachable statuses. Needs a frontend pass alongside the eventual
  partial-receive/return UI.

## 2026-08-12 - Track A sale partial-return flow, plus a major finding: Reports/Payments status filters likely never matched real data

- Measured before building: the "linked credit-note Sale row" design added to the schema in Phase 2
  (`Sale.originalSaleId`) turned out unnecessary. `POST /sales/:id/return` already existed (full-return
  only) and mutates the original sale in place. Extended it with optional per-item quantities
  (`SaleItem.returnedQty`), proportional stock and customer-balance reversal (correctly accounts for any
  order-level discount rather than assuming uniform pricing), and automatic FINAL -> PARTIALLY_RETURNED ->
  RETURNED status tracking (`PARTIALLY_RETURNED` is a new, additive enum value). `sale.total`/`subtotal`/
  `taxTotal` are never mutated by a return - matches the project's TVA-immutability rule.
- **Major separate finding, flagged directly rather than silently fixed:** `statusLabel()` in
  `sale.routes.ts` returns `'Payée'` (accented), but every frontend status comparison (~20 call sites in
  `main.tsx` - Reports totals, Payments filter, Dashboard, register shift-sales, invoiceable-sales
  detection, payment badges) checks the unaccented `'Payee'`, and the API response is stored with no
  transform in between. Verified at the byte level - these strings have likely never matched for any real
  database-backed sale, meaning Reports/Payments/Dashboard revenue views may currently show empty/wrong
  results against the real backend. Not fixed in this pass - it changes behavior across ~20 call sites at
  once and none of it is visually verifiable without a browser. Needs its own dedicated pass and its own
  commit, separate from any other change, so it can be reverted independently if something looks wrong.
- Added a `RETURNED`/`PARTIALLY_RETURNED` -> `'Retour'` branch to `statusLabel()` - safe on its own since
  `'Retour'` is a pre-existing, currently-unproduced `SaleRecord['status']` value; does not touch the
  accent bug or any existing status's output.
- **Found and fixed a real bug via the live arithmetic assertion**: credit-sale detection broke on a
  *second* partial return because it checked `sale.status === 'FINAL'`, which is no longer true after the
  first return moves status to `PARTIALLY_RETURNED` - balance reversal was silently skipped for the rest
  of the sequence. Fixed by dropping the `FINAL` check.
- Verified live: 4-unit credit sale -> partial return (1 unit: stock +1, balance 48->36,
  PARTIALLY_RETURNED) -> return remainder (stock to baseline, balance ->0, RETURNED) -> re-return and
  cross-tenant return both correctly rejected. Full `test:tenant-isolation` suite (26 assertions) passes.
  Not done: frontend UI for partial return; the accent-bug fix (flagged, not fixed).

## 2026-08-12 - Fixed the statusLabel accent bug (user approved, own commit)

- `sale.routes.ts`'s `statusLabel()` now returns `'Payee'` (unaccented), matching the string every
  frontend status comparison already checks against. Zero frontend changes - the bug was entirely on the
  backend side. Added an explicit regression assertion to `tenant-isolation-smoke.ts` for this exact
  string. Verified: `tsc` clean, full 26-assertion smoke suite passes.
- Not independently verified: the actual browser-visible effect (Reports/Payments/Dashboard should now
  show real totals instead of empty results) - no display in this environment. Judged low-risk enough to
  land without that verification since it's a one-line change matching an already-established frontend
  contract, not new frontend logic.

## 2026-08-12 - Track D auto-posting, increment 1: CashMovement (user chose per-location accounts)

- Asked the user how money-moving events should map to an `Account`, since the schema had no answer to
  derive (no `Account` link anywhere on `Company`/`Location`/`CashRegisterSession`). Chose per-location:
  `Account.locationId Int?` added (additive), `null` = company-wide fallback for events with no location.
- New `backend/src/utils/accounting.ts` (`getOrCreateCashAccount`, `postCashTransaction`), sharing the
  existing debit-increases/credit-decreases convention.
- Wired CashMovement only this pass (the unambiguous case) - `IN` posts DEBIT, `OUT` posts CREDIT, inside
  the same transaction as the movement itself.
- **Found and fixed a real bug via the live smoke test**: the fallback account lookup matched purely on
  `locationId: null`, which also matched an unrelated pre-existing manually-created account (manual
  accounts never set `locationId` either) - the very first live run silently posted into the wrong
  account. Fixed by also matching the reserved name `'Caisse'`.
- Purchase deliberately excluded from this whole track (no cash leg exists in the model - receiving a
  purchase only affects `supplier.balance`, an unpaid payable). Credit-sale settlement has no backend
  endpoint at all, so credit sales can't hit the ledger even after Sale finalize posting lands next. A
  third `Payment`-writing endpoint (`connector.routes.ts /sell`) was found to already be broken (stale
  field names `tsc` doesn't catch through Prisma's generic client) and excluded. Full detail in TRACE.md.
- Verified live: location cash IN/OUT nets correctly; two no-location movements land on the same
  company-wide account without touching the unrelated manual account. Full smoke suite (27 assertions)
  passes.

## 2026-08-12 - Track D auto-posting, increment 2: Expense

- `expense.routes.ts POST /` now posts a CREDIT (cash decrease) unless `paymentMethod === 'CREDIT'`,
  same exclusion rule as Sale's CREDIT method. Scoped to create only - `PUT /:id` edit/deactivate does not
  adjust any previously posted transaction, documented as a known gap.
- Surfaced a real ordering dependency in the smoke test: expense auto-posting and the earlier CashMovement
  assertions (increment 1) now touch the same location account, so hardcoded absolute-balance assertions
  broke. Fixed by making them delta-based instead.
- Verified live: CASH expense posts correctly, CREDIT expense posts nothing, later cash-movement deltas
  land correctly on top. Full smoke suite (29 assertions) passes.

## 2026-08-12 - Track D auto-posting, increment 3 (final): Sale finalize + return reversal

- Both finalize entry points (`POST /` create-and-finalize, `PATCH /:id/finalize` finalize-from-draft)
  now post a DEBIT of the sale total when a real payment happens (not CREDIT). `POST /:id/return` posts a
  compensating CREDIT using the same `balanceDelta` it already computes for the customer-balance reversal
  - no lookup of the original posting needed.
- Two real bugs found while writing live smoke coverage, both in the *test's* assumptions (the auto-
  posting logic itself was correct both times): a stale expected-balance constant that didn't account for
  an earlier CASH sale test now also posting, and a stale "before" snapshot captured too early in the
  script that didn't reflect several intervening postings. Both fixed by re-reading balances fresh right
  before use instead of relying on values captured earlier.
- Verified live: full CASH-sale-and-return sequence nets back to exactly its starting balance; CREDIT
  sales confirmed to never touch the ledger. Full smoke suite (30 assertions) passes, both workspaces
  `tsc` clean.
- **Track D is now feature-complete for this session's scope.** Remaining open, documented gaps (not
  oversights): Expense edit/deactivate doesn't reconcile the ledger, credit-sale settlement has no
  backend endpoint at all, Account reports (trial-balance style) not built, Purchase permanently excluded
  (no cash leg in the model).

## 2026-08-12 - Headless browser unblocked: the "no display" caveat is resolved

- Termux's `x11-repo` ships a real native aarch64 Chromium (despite the repo name, no X server needed at
  runtime for `--headless --no-sandbox`). Installed alongside Puppeteer, pointed at the native binary
  instead of Puppeteer's own (unavailable-on-this-platform) bundled download.
- Verified with a real screenshot of the actual running TaysrPOS login page - real fonts, gradient, and
  form styling. First visual inspection of any UI in this project this session.
- Automated as `frontend/scripts/setup-headless-browser.sh` (`npm run browser:setup`) and a reusable
  one-shot screenshot CLI, `frontend/scripts/screenshot.mjs` (`npm run screenshot -- <url> <output.png>`).
- Not yet done: logging into the actual app with real/seeded credentials and clicking through to
  Reports/Payments to close out today's earlier accent-bug-fix visual-verification gap - the setup is
  ready for it, just not yet exercised against the login-gated UI. Full writeup in TRACE.md.

## 2026-08-12 - Visual verification confirmed the accent fix and found two more real bugs

- Seeded the demo company, created real sales via the API, and drove the actual login + navigation with
  Puppeteer. **Confirmed the accent-bug fix works**: Paiements and Rapports both show correct totals with
  real screenshots as proof.
- **Found and fixed a date-parsing bug**: the backend sent dates as a French DD/MM display string, which
  `new Date(...)` silently misreads as US MM/DD with no year (`"12/08 20:02"` -> December 8, 2001). Every
  Today/Week/Month/Year filter on Rapports and the Dashboard was broken for real data as a result. Fixed
  by adding a real ISO 8601 `createdAtISO` field to the API response and rewriting both period-filter
  functions to use it instead of parsing the display string.
- **Found and fixed a second bug in the same investigation**: the sale API response never included
  `locationId` at all, so the Dashboard's location-scoped filtering silently excluded every real sale
  (comparing `undefined` against a real location ID). Fixed by adding the field - it was already on the
  underlying data, just never mapped into the response.
- Both fixes verified live: the Dashboard went from showing a fake/mock sales chart and 0,00 MAD to
  showing the real 90,00 MAD total and a chart with the actual sale data point. Locked into
  `tenant-isolation-smoke.ts` as two new regression assertions. Full smoke suite (29 assertions) still
  passes, both workspaces' `tsc` clean. Full writeup in TRACE.md.

## 2026-08-12 - Resolved all 12 open Dependabot alerts

- All 12 (7 high, 4 moderate, 1 low) were transitive deps of dev/build-only tooling (Prisma's local-dev
  package, Vite's CSS pipeline, `concurrently`) - never reachable by an attacker against the running app.
  Fixed anyway via `npm audit fix` (only `package-lock.json` changed, no manifest version bumps needed).
  Verified: both workspaces' `tsc` clean, `vite build` succeeds, `prisma generate` succeeds, the
  headless-browser tooling still launches, and the full 29-assertion smoke suite still passes. `npm
  audit` now reports 0 vulnerabilities. Full writeup in TRACE.md.

## 2026-08-13 - Track G: device auth + sync for the real Hanout Express app

- Cloned `taysrcloud/TaysrHanout` (the small-store POS app the user needs API connectivity for) and read
  its actual Retrofit interfaces rather than guessing from the legacy UltimatePOS Connector module -
  found the real contract is a small custom sync protocol (6 endpoints, device-bound auth, thin DTOs),
  not what either `connector.routes.ts` or the legacy module implement. Built it: `Device` model
  (additive schema), `device/activate`+`device/refresh`+`device/logs`, `sync/batch`+`sync/pull`,
  `receipt/send`, plus admin activation-code issuance in Settings.
- Caught two real correctness bugs before they shipped: a balance sign-convention mismatch (v0's
  `Contact.balance` and Hanout's own documented convention are opposite signs - fixed with a negation on
  the pull side) and a data-loss gap in Hanout Express itself (customer credit payments never sync
  up-stream, only sales do - flagged back, not fixable from this side).
- Verified live end-to-end: activation, sync/pull isolation, a mixed batch (2 real sales + 1 deliberately
  invalid), idempotent retry (no duplicate sale, no double-posted ledger entry), refresh-token rotation,
  and immediate rejection of a revoked device. Locked into `tenant-isolation-smoke.ts` (31 assertions
  now, up from 29). Also fixed an unrelated regression hit along the way: yesterday's Prisma version bump
  broke this environment's `db push` workaround in a way that needed a one-line env-var fix. Full
  writeup in TRACE.md.

## 2026-08-13 - Track E: per-user permission overrides (the recommended hybrid model)

- Built exactly what was recommended and approved: the 6 role presets stay untouched, plus a sparse
  `UserPermission` override table an ADMIN can use to grant or revoke one action for one user. Zero
  regression risk - empty by default, identical to today's behavior until an override exists. Migrated
  one real call site as proof (the Track G device-management endpoints), not all ~25 at once - that
  big-bang rewrite was explicitly identified as the highest-risk move available, so further migrations
  wait for real per-store need rather than happening preemptively.
- Deliberate backstop: managing overrides is itself ADMIN-only and not itself overridable, closing off a
  privilege-escalation loop where a granted user could hand out more access.
- Verified live: default role denial, grant, revoke, cross-tenant rejection, and the sharper case of an
  explicit deny overriding a role that would normally pass. 32 assertions now (up from 31), full suite
  clean twice in a row, both workspaces typecheck clean. Full writeup in TRACE.md.

## 2026-08-13 - Track H: multi-currency for Sale + Purchase

- Asked which side needed it first (Moroccan retail: customers pay in MAD, suppliers often invoice in
  EUR/USD) - user chose both in the same pass. Built a new `Currency` model plus optional
  `currencyId`/`exchangeRate`/`foreignTotal` on Sale and Purchase, with `total` staying in MAD always so
  every existing money-math consumer (Track D ledger posting, receipts, Dashboard, Hanout sync) keeps
  working completely unchanged - this was the key design call that made the whole feature zero-risk to
  add.
- Verified live: currency CRUD, foreign-total math on both a sale and a purchase, a per-transaction rate
  override beating the stored rate, invalid/cross-tenant currency rejection, and - the sharper check -
  that editing a currency's rate later does not retroactively change an already-recorded sale's
  snapshotted rate (same immutability guarantee as tax rates). 33 assertions now (up from 32), full suite
  clean twice in a row, both workspaces typecheck clean. Full writeup in TRACE.md.
