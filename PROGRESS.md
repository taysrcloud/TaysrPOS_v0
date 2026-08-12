# TaysrPOS Refactoring & Integration Progress

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
