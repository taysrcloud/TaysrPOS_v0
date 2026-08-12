# TaysrPOS v0 Trace

This file tracks the new POS rebuild under `C:\xampp\htdocs\TaysrSuite\apps\TaysrPOS_v0`.

Check this file before editing POS v0 code.

## Purpose

TaysrPOS v0 is the active modern POS direction for the suite.

It is inspired by:

- UltimatePOS workflows and useful business logic
- TaysrOptic shell/style quality

It should not blindly copy legacy clutter.

## Current Local Runtime

- Backend port: `4400`
- Frontend dev port: `5400`

## Important Files

- `backend/.env`
- `frontend/src/`
- `PROGRESS.md`
- `../..\\MASTER.md`
- `../..\\MAP.md`

## Known Risks

- Frontend port collides with Platform frontend if both use `5400`
- Register opening logic is critical and easy to regress
- Product creation must stay fast and practical
- UI can drift away from the Taysr shell if legacy POS styling leaks back in
- Encoding corruption has already hit POS work before

## Before-Edit Checks

1. Confirm whether the task belongs to POS v0 and not legacy `apps/TaysrPOS`
2. Check `PROGRESS.md` and suite `MASTER.md` first
3. Verify which runtime is active before debugging:
   - backend
   - frontend dev
   - Docker/Coolify
4. If touching styling, compare with TaysrOptic first
5. If touching workflows, prefer the useful UltimatePOS logic without keeping its clutter

## Product Rules

1. Base direction is ERP + POS
2. Restaurant is an activatable module, not the base app
3. Other products/modules should be controlled from Super Admin, not exposed as random user-facing settings
4. TVA behavior must be respected in tickets and invoices

## Recent Direction

- The app is being rebuilt as a real product, not a themed legacy wrapper
- Product flow, POS workflow, invoices, and settings still need hard implementation work
- Styling must stay consistent with the newer suite quality level

## Update Rule

When POS v0 changes, note:

- workflow added or fixed
- source inspiration used from UltimatePOS
- UI rules preserved
- platform/provisioning impact

## July 16, 2026 - POS tenant isolation contract

- Every authenticated query and mutation derives companyId from the verified user context. No route may use `company.findFirst()`, create a Demo Company, or trust a submitted linked ID without tenant ownership validation.
- Dedicated databases remain supported through AsyncLocalStorage, while companyId scoping is still mandatory as defense in depth and for standalone/shared development databases.
- Product and sale endpoints must never return demo records after a persistence failure. A failed database write is an error, not a successful fake transaction.
- Tenant preferences and role permissions are persisted through `/api/settings`; global browser-storage permission keys are forbidden.
- Regression command: `npm run test:tenant-isolation` from `apps/TaysrPOS_v0/backend`. The test creates two companies, verifies real CRUD, attempts cross-tenant writes, and removes all test records.
- Verified APIs: contacts, products, sales, invoices, purchases, expenses, attendance, settings, locations, warehouses, and stock transfer ownership.

## 2026-07-16 - Stale state after login

- Symptom: opening the register failed on the first login, and newly created customers appeared only after refresh and another login.
- Root cause 1: the frontend initialization effect ran once before authentication, received protected API failures, and never reran after login.
- Root cause 2: POST /api/contacts returned the raw Prisma record while GET /api/contacts returned a mapped Contact. The UI expects name, but the create response contained fullName.
- Durable fix: authentication now gates and keys tenant data initialization; session restoration uses /api/auth/me; contact create/list share one response mapper.
- Tenant-facing state is cleared before loading a user/account to prevent stale data from a previous tenant remaining visible.
- Verification: backend and frontend typechecks passed, production frontend build passed, and browser testing confirmed immediate register/client state plus refresh restoration.

## 2026-07-16 - Refresh unexpectedly returned to login

- Root cause: restoreSession cleared the token for every exception/non-OK response, and apiFetch treated both 401 and 403 as an invalid session.
- Fix: cache the authenticated user, restore it synchronously, verify with /api/auth/me in the background, and clear credentials only on confirmed 401.
- Runtime check: /api/settings currently returns JSON with HTTP 200. Old 404 HTML responses indicate stale backend code, not a missing current route.
- Browser check: five consecutive reloads stayed authenticated; current console had no errors or warnings.

## 2026-07-16 - Supplier creation and contact navigation

- Symptom: New Supplier did nothing because it had no click handler; the only create-contact modal lived inside the POS register and always sent type CUSTOMER.
- Durable fix: one shared contact modal accepts an explicit CUSTOMER or SUPPLIER type and is rendered at the app shell level.
- UX decision: Clients and Suppliers now share one workspace with tabs, matching the useful TaysrOptic navigation pattern without copying Optic-specific fields.
- Data safeguard: loadContacts selects only CUSTOMER/BOTH as the default POS customer, never a SUPPLIER.
- Verification: supplier created via the live UI, appeared immediately in the Suppliers tab, no console errors, then the test record was removed.

## 2026-08-12 - Full ERP parity migration decision

- Decision: TaysrPOS_v0 scope changes from the curated ERP+POS build (documented in `docs/BLUEPRINT.md`
  and `docs/PRODUCT_DECISIONS.md`) to full feature parity with `TaysrPOS-old` / UltimatePOS, including
  the modules those two docs previously rejected (accounting/ledger, external Connector API,
  multi-currency, sales commissions, purchase requisitions, consolidated invoices, warranty,
  notification templates, dashboard configurator, bulk import tools). See `docs/BLUEPRINT.md` and
  `docs/PRODUCT_DECISIONS.md` for the superseded sections, left in place with an override note rather
  than deleted.
- Full plan: `/data/data/com.termux/files/home/.claude/plans/jolly-percolating-robin.md` (Phase 0
  repo hygiene, Phase 1 routing/page structure, Phase 2 shared-foundation refactors, Tracks A-J for
  the individual legacy modules, plus a continuous hardening track).
- Also confirmed live: recurring encoding corruption already flagged in this file previously hit a
  checked-in doc (`PROGRESS.md`, 2026-07-09 entry had backticks replaced by literal backslashes).
  Treat this as an active risk on every edit, not a resolved one - the hardening track adds a
  lightweight pattern-based check for it.

## 2026-08-12 - Phase 1 nav/route registry (scope revised mid-work)

- Workflow: original Phase 1 plan called for adding React Router and extracting all 15 pages out of
  `main.tsx`. Both were withdrawn after discovering `App` has 115 `useState` hooks in one component and
  this environment has no browser/display to verify a UI-behavior change (puppeteer devDependency fails
  to install here: "platform not supported"). Revised to: no router (this is a terminal-style POS with
  live auth/cart/register state - URL/history semantics need visual verification this environment can't
  do), and opportunistic smallest-first extraction via a shared Context instead of prop interfaces (a
  wrong prop name is a compile error with Context; a same-typed prop *swap* is not, and there was no
  runtime check available to catch one).
- What shipped: `pageRenderers` registry replacing the `renderPage()` if-chain; `PosContext` +
  `frontend/src/pages/{RegistersPage,PaymentsPage}.tsx` as the first real extractions, proving the
  pattern; `PageHeader`/`productImage` moved into `frontend/src/components/`.
- UI rules preserved: zero behavior change intended anywhere in this pass - every extraction is a
  mechanical move (same JSX, same logic), not a rewrite. `vite build` output size was checked after each
  step and stayed within noise of the baseline.
- Explicitly deferred: `renderRegister` (the POS cart) - already flagged below as critical/easy-to-regress,
  and this is the one page where a silent Context-wiring mistake costs real money. Do not extract it
  without browser verification. `renderReports`/`renderKitchen` are next smallest but were not started
  this session.
- Platform/provisioning impact: none - purely a frontend file-organization change, no API/schema touched.
- Source inspiration: none from UltimatePOS for this pass - purely a build-out of this codebase's own
  existing `baseModules`/`pageIcon` pattern into a matching dispatch-side registry.

## 2026-08-12 - Track A: receipt/invoice endpoints (return flow deferred)

- Workflow: scoped Track A down to one of its three pieces this session after a risk review. The
  return/credit-note flow and consolidated invoices were both deferred, for different reasons - see
  PROGRESS.md's entry above for the return-flow reasoning (unfiltered read-path fan-out across
  `GET /api/sales`, Paiements, `renderReports`, register Z-report, none of it checkable without a real
  database) and consolidated invoices (net-new, no consumer yet, lower priority). Only the receipt/
  invoice PDF endpoints were judged safe to build and verify in this environment.
- What shipped: `GET /api/sales/:id/receipt` and `GET /api/sales/:id/invoice`, wiring up
  `backend/src/utils/pdf.ts`'s two PDF generators, which existed but were dead code with zero callers.
  Tenant ownership is checked the same way as every other route since the July 16 pass (`findFirst({
  where: { id, companyId } })`, 404 on mismatch) - the whole point of this route was to add auth, so
  reusing a weaker check would have defeated it. Headers (`Content-Type`, `Content-Disposition`) are set
  before the pdfkit stream starts, since `doc.pipe(res)` + `doc.end()` means there is no way to send a
  JSON error once the PDF generator is called - all validation had to complete first.
- Source inspiration: none from UltimatePOS for the endpoint shape - this was closing an already-broken
  feature in this codebase, not porting new behavior. The **fix itself** matters for Moroccan fiscal
  compliance though: both generators had hardcoded demo ICE/RC (`'ICE: 000000000000000'`) instead of the
  tenant's real `Company` fields, which would have shipped legally-wrong documents if this had ever been
  wired up as-is. Now pulls `name`/`legalName`/`address`/`city`/`ice`/`ifNumber`/`rc`/`receiptFooter`
  from the real company record.
- UI rules preserved: frontend buttons keep their existing labels/placement, only the click handler
  changed - from a bare `window.open(apiUrl)` (which cannot carry an Authorization header, so the route
  would 401 even if it existed) to `apiFetch` + blob-URL open, matching the project's own `apiFetch`
  auth pattern used everywhere else.
- Platform/provisioning impact: none - no schema change in this pass (Phase 2 already added what was
  needed), pure route + frontend wiring.
- Verification note for future sessions: `backend/scripts/verify-pdf-generation.ts` is a real runtime
  check (executes pdfkit against synthetic data, asserts a valid `%PDF-` file), not just a typecheck.
  Worth re-running after any future change to `pdf.ts` even before a DB-enabled session is available,
  since it catches failures `tsc` structurally cannot see.

## 2026-08-12 - Phase 2 shared-foundation refactors (safe/additive subset only)

- Workflow: this environment has no reachable Postgres (port 5432 closed) and `prisma migrate diff`
  (the DB-less SQL-preview path) also fails - its schema-engine binary needs a postinstall download
  Termux/Android can't do here, same failure class already logged for `bcrypt`/`puppeteer`. Split Phase
  2's four items by what `prisma validate`/`generate`/`tsc` can actually verify (schema/type-level only)
  versus what needs real row data to convert safely.
- What shipped, additive only: `TaxRate` model + optional `taxRateId` on `Product`/`SaleItem`/
  `InvoiceLine` (existing `tvaRate` snapshot columns untouched - TVA-on-receipts is a hard product rule,
  see the Product Rules section above); `Sale.originalSaleId` + `SaleItem.returnedQty` for the future
  return/credit-note flow; `Expense.isActive`/`updatedAt`; `PUT /:id` edit + soft-deactivate on
  `contact`/`expense`/`location` with tenant-ownership checks (404 cross-tenant, matching the existing
  `Product` pattern from the July 16 tenant-isolation pass); matching coverage added to
  `tenant-isolation-smoke.ts` (written, not run - no DB here).
- Explicitly deferred, needs a live DB: `Purchase.status` String -> enum. Checked real usage in this
  session - only `'PENDING'`/`'RECEIVED'` are ever written today, not the five-state set Phase 2
  originally proposed. A blind conversion would break every `PENDING` row; there's no way to confirm
  no other values exist in real data without a database. Do not convert this column without checking
  actual data first.
- Also fixed along the way: `backend/tsconfig.json` only covered `src/**/*.ts`, so `npm run typecheck`
  silently never checked `backend/scripts/` (including the isolation smoke test itself). Added
  `scripts/**/*.ts` to `include`.
- Source inspiration: `TaxRate`/group-tax shape follows TaysrPOS-old's `TaxRate`/`GroupSubTax` models
  (see `ULTIMATEPOS_TAYSRPOS_DIFF_MAP.md`), simplified to a single self-referencing table instead of
  two.
- Platform/provisioning impact: none directly, but the deferred `Purchase.status` conversion will need
  to run against every provisioned tenant database, not just the dev one - flag this before attempting
  it in a DB-enabled session.

## 2026-07-16 - Restaurant module access contract

- Previous risk: the frontend expected planLimits.modules as a string array, while Platform may store modules as an object. The settings API also accepted restaurantEnabled without checking entitlement.
- Fix: normalize module arrays/objects in login and auth middleware, derive effective Restaurant visibility from entitlement plus tenant activation, protect /api/restaurant with requireModule, and reject unauthorized activation in PUT /api/settings.
- Product rule: Super Admin grants RESTAURANT; an entitled tenant Admin/Manager may enable or disable it for their workspace. Non-entitled users never see the option.
