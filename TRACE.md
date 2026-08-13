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

## 2026-08-12 - Local Postgres unblocked (Termux/Android aarch64)

**This changes the "no database in this environment" premise behind every deferral logged above and
below on 2026-08-12.** A local Postgres server is now installed, running, and schema-synced - the
tenant-isolation smoke test ran for real against it and passed all 24 assertions.

- Root cause of the earlier "no reachable Postgres" state: Postgres itself was never installed (not a
  platform limitation - Termux's `postgresql` package is aarch64-native and installs/runs cleanly).
  What genuinely doesn't work on this platform is the **Prisma CLI's schema-engine binary**: its
  platform auto-detection reports "unknown OS android" and falls back to a `debian-openssl-1.1.x`
  x86-64 build, which fails with `Exec format error` on this aarch64 device - wrong CPU architecture,
  not just wrong OS.
- Fix: Prisma does publish a real `linux-arm64-openssl-3.0.x` schema-engine build (glibc-linked).
  Termux ships `glibc`/`glibc-runner` packages that let a glibc ARM64 Linux binary run inside Termux's
  Bionic (Android) userland via `grun`. Downloaded that build directly from
  `https://binaries.prisma.sh/all_commits/<engines-hash>/linux-arm64-openssl-3.0.x/schema-engine.gz`
  (hash from `prisma -v`'s "Default Engines Hash" line), wrapped it in a one-line script that execs it
  through `grun`, and pointed the CLI at that wrapper via `PRISMA_SCHEMA_ENGINE_BINARY`. `prisma db push`
  now works normally. This only affects the CLI - Prisma Client's actual runtime queries already went
  through `@prisma/adapter-pg` (pure-JS `pg` driver, no native/wasm query engine involved), so the
  backend server itself never had this problem.
- Also fixed to get here: `bcrypt`'s native addon (skipped via `--ignore-scripts` back in Phase 0/1)
  needed `node-gyp` (distinct from the already-present `node-gyp-build` loader) plus
  `GYP_DEFINES="android_ndk_path="` to work around `gyp`'s Android-target detection expecting an NDK
  path that isn't relevant here (Termux's `clang` builds native Android-compatible binaries directly,
  no NDK cross-compilation needed). Builds clean now; bcrypt is a real runtime dependency of
  `auth.routes.ts`, not just the smoke test, so this matters beyond DB testing.
- Automated as `backend/scripts/setup-local-postgres.sh` (idempotent, re-run anytime) and
  `npm run db:setup` from `backend/`. Does **not** commit the 22MB engine binary to git - the script
  re-downloads it, matching whatever Prisma version is currently installed.
- **Real bugs the live smoke test caught immediately** that `tsc` structurally could not, both in test
  code that had been "written but never run" since earlier in this session:
  1. `POST /contacts` returns `201 Created` (correct REST behavior); the smoke test's create-contact
     assertion checked for `200`. Never executed until now.
  2. That same assertion checked the response for a `companyId` field - but `toContactResponse` maps to
     a UI-facing shape that deliberately omits it (unlike `Purchase`/`Expense`, which return the raw
     Prisma record). Fixed the assertion to check `name` instead.
  3. The test's own cleanup (`finally` block) failed with a Postgres `RESTRICT` violation:
     `SaleItem.productId`/`PurchaseItem.productId` have no `onDelete: Cascade` **by design** (real sale/
     purchase history must survive a product being deleted), so a single cascading `Company` delete hit
     that RESTRICT before `Sale`/`Purchase`'s own cascade to their line items had cleared the reference.
     Fixed by explicitly deleting `Sale` and `Purchase` rows before the `Company` delete in the cleanup
     block. This is exactly the class of finding this whole session's "written, not run" caveats were
     flagging.
- Everything from the 2026-08-12 Phase 2 / Track A / Tracks B-F/I entries above that was previously
  marked "schema/type-level only, not applied to or tested against a real database" is now genuinely
  verified: `prisma db push` applied cleanly, and every tenant-scoped create/edit/ownership assertion
  written across those passes ran for real and passed.
- What's still not unblocked by this: browser/UI verification (still no display in this environment),
  and the specific deferred items that need real *data* to convert safely (`Purchase.status` enum -
  worth re-examining now that a real DB exists to inspect, though this dev DB has no legacy data to
  check against; the Sale return/credit-note read-path fan-out question).

## 2026-08-12 - Tracks B/C/D/E/F/I: additive schema + CRUD batch

- Workflow: given the standing instruction to keep moving through the remaining tracks with additive
  slices only, batched the schema-safe portion of six tracks into one pass rather than one track per
  session. The dividing line used throughout: additive (new tables/columns/endpoints, nothing existing
  reads them) shipped; anything requiring edits to existing money-moving or checkout logic
  (`renderRegister`, sale finalize, purchase receive, payment/expense/cash-movement posting) stayed
  deferred, matching the reasoning already established for the Track A return-flow deferral.
- New route files: `pricing.routes.ts` (Track C), `accounting.routes.ts` (Track D), `commission.routes.ts`
  (Track E), `notification.routes.ts` (Track F), `dashboard.routes.ts` (Track I). New endpoint on
  existing `contact.routes.ts`: `GET /:id/ledger` (Track B). All mounted in `index.ts` behind the same
  `requireAuth` pattern every other route uses, with per-route `requireRole` where a write should be
  admin/manager-only, matching the existing convention.
- Source inspiration: `TaxRate`-adjacent group-tax shape already noted in the Phase 2 entry;
  `SellingPriceGroup`/`CustomerGroup`/`ProductGroupPrice` mirrors old app's
  `SellingPriceGroup.php`/`CustomerGroup.php`/`VariationGroupPrice.php` at a schema level, simplified to
  skip the variation-level granularity (prices are per-product, not per-variation, in this pass).
  `Account`/`AccountType`/`AccountTransaction` mirrors `app/Account.php`/`AccountType.php`/
  `AccountTransaction.php`, simplified to a single debit-increases/credit-decreases convention instead
  of the old app's fuller account-type-aware posting rules.
- UI rules preserved: none of this touches `main.tsx` - every addition is backend schema + API only, no
  frontend surface yet for any of the six tracks. Nothing here is user-visible until a future pass wires
  it into an actual screen.
- Platform/provisioning impact: six new models are now part of every provisioned tenant's schema once
  this is pushed to a real database. None of them are required for existing functionality to keep
  working (all nullable/optional relations, all separate tables) - a tenant that never uses pricing
  groups, accounting, commissions, notifications, or the dashboard configurator sees no behavior change.
- Verification note: this is schema/type-level only (`prisma validate`, `prisma generate`, `tsc` for
  both workspaces, `vite build`). Every new tenant-scoped endpoint has matching
  create/cross-tenant-rejection assertions written into `tenant-isolation-smoke.ts`, but the script
  itself could not be executed in this environment (no reachable Postgres). Treat all six tracks'
  "done" items as reviewed-and-typed, not applied-and-tested, until a session with database access runs
  the smoke script for real.

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

## 2026-08-12 - Purchase.status enum conversion: `db push` proven unsafe on real data

**Concrete finding, not a theoretical caveat: `prisma db push --accept-data-loss` silently corrupts
data on a String -> enum column conversion when the table has existing rows.** This was the exact
deferred item flagged in the Phase 2 entry above ("do not convert this column without checking actual
data first") - checked it properly now that Postgres is available, and the naive path failed.

- Reproduced directly: inserted a `Purchase` row with `status='PENDING'` (String column, matching what
  real usage has always written), ran `prisma db push --accept-data-loss` with the schema changed to
  `PurchaseStatus` enum (`PENDING, ORDERED, PARTIALLY_RECEIVED, RECEIVED, RETURNED`). The push succeeded
  with no error - just the standard "There might be data loss" warning - but the schema engine resolved
  the type change as a **drop-and-recreate of the column**. The row's status silently became `'RECEIVED'`
  (the new column default), not `'PENDING'`. No exception, no partial-failure signal - a query for that
  row after the push returns wrong data with total confidence.
- Root cause: Postgres has no automatic text->enum cast, so when `db push` needs to change a column's
  type to an enum it doesn't know how to preserve, it drops and recreates rather than failing loudly.
- Fix verified the correct way: reset the column back to `text`, re-inserted the same `PENDING` row, then
  applied `ALTER TABLE "Purchase" ALTER COLUMN status TYPE "PurchaseStatus" USING status::"PurchaseStatus"`
  by hand. Postgres CAN perform this as an in-place cast (every value ever written - `'PENDING'`,
  `'RECEIVED'` - is a member of the new enum), and the row came back with `status='PENDING'` intact.
  Confirmed the resulting column definition is byte-for-byte identical to what `db push` produces
  (`not null default 'RECEIVED'::"PurchaseStatus"`), so this isn't a workaround with drift risk.
- Saved as `backend/prisma/manual-migrations/2026-08-12_purchase_status_enum.sql` +
  `backend/prisma/manual-migrations/README.md` (new directory, new pattern: this project has no
  `prisma migrate` history, so any future type-changing column conversion should follow the same
  by-hand-verify-then-save-as-dated-SQL approach rather than trusting `db push`'s data-loss prompt to be
  survivable).
- **Platform impact, not yet resolved:** `backend/src/routes/platform.routes.ts`'s `/provision-tenant`
  writes to whatever tenant DB `X-Tenant-DB` points at via `runWithTenantDatabase` - it does not push
  schema itself, so schema deployment to tenant databases happens externally, via whatever runs
  `prisma db push` (this repo's only mechanism today - `npm run prisma:push` / `db:setup`). **Any
  already-provisioned tenant with a real `PENDING` purchase is exposed to exactly the corruption
  reproduced above** if this schema change (or any future type-changing one) is deployed the same way.
  This needs surfacing to whoever owns tenant deploys before this schema change ships past dev - not
  something to silently patch around in code.
- `npm run prisma:push` was fixed this session to point at the aarch64 engine wrapper (previously
  undocumented/broken on this platform) - this makes the unsafe path *more* reachable, not safer. The
  `db push` "data loss" warning must be treated as a hard stop on any non-empty/non-disposable database,
  full stop; see `backend/prisma/manual-migrations/README.md` for the by-hand alternative.
- Applied to `taysrpos_dev` via the verified SQL (not `db push`), confirmed `prisma db push` reports
  "already in sync" afterward, full `test:tenant-isolation` suite (24 assertions) still passes.
- **Follow-up, same day:** the enum originally shipped with a fifth value, `ORDERED`, intended for a
  future requisition/order distinction. Track B's actual implementation (see below) found no distinct
  meaning for it - `PENDING` already covers "created, not yet received" - so it was dropped before
  anything could reference it (`prisma db push --accept-data-loss`, safe here since the dev DB had zero
  `Purchase` rows at the time; confirmed via `SELECT count(*) FROM "Purchase" WHERE status='ORDERED'` = 0
  before applying). `PurchaseStatus` is now `PENDING, PARTIALLY_RECEIVED, RECEIVED, RETURNED`. Updated
  `backend/prisma/manual-migrations/2026-08-12_purchase_status_enum.sql` to match - that file is meant to
  be the canonical reference for provisioning this enum on a tenant DB from scratch, so it must reflect
  the final shape, not the intermediate one.

## 2026-08-12 - Pre-existing crash bug: wrong ProductStock compound-unique key

**Found live, by the new Track B purchase partial-receive test - a genuine pre-existing defect, not
something introduced this session.** `ProductStock`'s real compound unique constraint is
`[productId, warehouseId, variationId]` (Prisma-generated key name
`productId_warehouseId_variationId`), but `purchase.routes.ts` (purchase create-as-RECEIVED, and the
`/:id/receive` handler) and `inventory.routes.ts` (stock adjustment, warehouse transfer both legs) all
used a two-field key `productId_warehouseId` wrapped in `as any` to suppress the type error. At runtime
this throws `Unknown argument productId_warehouseId` and the request 500s.

- **Why this was never caught before:** the only existing smoke-test coverage that touched these code
  paths either avoided triggering them (`createdPurchase` in `tenant-isolation-smoke.ts` creates with
  `status: 'PENDING'`, which skips the stock-upsert branch entirely) or only checked a cross-tenant
  *rejection* (`crossTransfer` expects 404, returned before the buggy upsert is ever reached). The
  success path of purchase receipt, purchase-created-as-received, stock adjustment, and warehouse
  transfer had **never actually been exercised** by any test in this project, despite being core
  stock-movement functionality. This is the same "written but never run" risk category the rest of this
  session's TRACE entries have been flagging, just found in code that predates this session rather than
  code written during it.
- **Also tried and rejected:** using the correct 3-field key name with `variationId: null` explicitly.
  This fails to typecheck (`Type 'null' is not assignable to type 'number'` on the Prisma-generated
  compound-unique input) - this Prisma version's generated types don't accept `null` in a compound-unique
  selector even though the underlying column is nullable, because Postgres unique constraints treat
  multiple NULLs as distinct rows, so equality-matching on a NULL column through a unique-key shorthand
  isn't guaranteed unique. `sale.routes.ts`'s stock-decrement code already avoids this entirely by using
  `findFirst` with a plain multi-field filter instead of the compound-unique shorthand - that pattern is
  correct and is what all six fixed call sites now use (`findFirst` -> `create` or `update` by `id`,
  instead of `findUnique`/`upsert` by compound key).
- Fixed in `purchase.routes.ts` (3 call sites: create-as-RECEIVED, `/:id/receive`, `/:id/return`) and
  `inventory.routes.ts` (3 call sites: `/adjustment`, `/transfer` source leg, `/transfer` destination
  leg). Verified live: the extended `tenant-isolation-smoke.ts` purchase workflow (partial receive -> full
  receive -> partial return -> full return) now passes end-to-end with correct stock quantities and
  supplier-balance math at every step; a separate one-off script (`scripts/tmp-verify-inventory.ts`, run
  and deleted, not committed) confirmed `/inventory/adjustment` and `/inventory/transfer` both the
  create-destination-row and update-existing-row branches.
- No schema change involved - this was a pure application-code bug, so no migration/data-loss risk like
  the `Purchase.status` entry above. Safe to have applied directly.

## 2026-08-12 - Track A sale return flow: measured first, found the design was already different than planned

**The "linked credit-note Sale row" design from Phase 2 (`Sale.originalSaleId`, added specifically for
this) was never actually needed.** Before building anything, read the existing `POST /sales/:id/return`
endpoint fully (it already existed - full return only, no partial support) and ran a live experiment:
created a real sale via the API, then inserted a simulated linked-return row directly via Prisma to see
how `GET /api/sales` and the contact ledger actually handle it. Both include it unfiltered, as expected -
but the bigger finding was that `sale.routes.ts`'s `statusLabel()` has **no special case for `RETURNED`
at all**, so a return row falls through to the default branch and is labeled identically to a normal
paid sale (`'Payée'`). That would make a returned sale visually indistinguishable from a completed one
in every list that reads this label.

- **Separate, much larger finding surfaced by this same investigation:** `statusLabel()` returns `'Payée'`
  (with the accent, U+00E9) but every frontend comparison (`frontend/src/main.tsx`, ~20 call sites -
  Reports, Payments, Dashboard, register shift-sales, invoiceable-sales detection, payment badges) checks
  against `'Payee'` (no accent), and `data.sales` from the API is stored with zero transform in between
  (`setSales(data.sales)` at `main.tsx:843`). Verified at the byte level (`Pay\303\251e` vs `Payee`) -
  this is not a rendering illusion. **Every `status === 'Payee'` filter in the frontend has likely never
  matched a single real API-sourced sale.** This is independent of returns and much higher severity -
  flagged to the user directly, not fixed in this pass (fixing it changes behavior across ~20 call sites
  simultaneously - Reports goes from always-empty to populated, `isSaleSelectable` starts accepting rows
  it currently rejects - and none of that is visually verifiable without a browser). Left as its own,
  clearly-scoped follow-up, not silently patched or silently ignored.
- Given the existing endpoint mutates the ORIGINAL sale in place (no new row), the `Sale.originalSaleId`
  self-relation added in Phase 2 for a linked-row design is now genuinely unused by any route. Kept in
  schema rather than dropped (unlike the `Purchase.status` `ORDERED` cleanup) - it's a free nullable
  column, not a value blocking a finished workflow, and a future exchange/credit-note flow is a plausible
  consumer; removing it later would need the same `USING`-cast discipline as any other destructive change.
  Schema comment updated to say it's unused by the current design.
- Extended `/:id/return` with optional per-item quantities (`SaleItem.returnedQty`, mirroring the
  Purchase pattern), proportional stock reversal (skips non-stock-tracked/SERVICE lines, matching the
  pre-existing behavior), and proportional customer-balance reversal derived from each line's actual
  `lineTotal` share of `sale.total` (correctly folds in any order-level discount rather than assuming
  uniform per-unit pricing). `Sale.status` now tracks FINAL -> PARTIALLY_RETURNED -> RETURNED
  automatically; new `PARTIALLY_RETURNED` enum value added (additive, no data-loss). `sale.total`/
  `subtotal`/`taxTotal` are never mutated by a return - only `status` and each item's `returnedQty` - so
  the original fiscal document amount stays exactly what was charged, consistent with the project's
  TVA-immutability rule.
- Added a `RETURNED`/`PARTIALLY_RETURNED` -> `'Retour'` branch to `statusLabel()` (that string is already
  a recognized `SaleRecord['status']` value on the frontend, unaccented, so this one branch is safe on
  its own - unlike the accent bug above, it doesn't change what any *existing* status maps to).
- **Found and fixed a real bug via the new arithmetic assertion**, not just a status/shape check: the
  credit-sale detection (`wasCredit = ... || (sale.status === 'FINAL' && payments.length === 0)`) broke
  on a *second* partial return, because by then `sale.status` had already moved to `PARTIALLY_RETURNED`
  from the first return call, so the `=== 'FINAL'` check silently failed and balance reversal was skipped
  for the rest of the return sequence. Caught immediately by asserting the exact expected balance after a
  second return call, not just checking the HTTP status. Fixed by dropping the `FINAL` check in favor of
  "zero payments and not still DRAFT/SUSPENDED" - a criterion that stays true across the whole
  return-in-progress lineage instead of only on the first call.
- Verified live: 4-unit credit sale (subtotal 40, tax 8, total 48) -> partial return (1 unit) -> assert
  stock +1, balance 48->36, status PARTIALLY_RETURNED -> return remainder -> assert stock back to
  baseline, balance 36->0, status RETURNED -> re-return rejected (400) -> cross-tenant return rejected
  (404) -> `GET /api/sales` still shows the sale with its original `total: 48` and `status: 'Retour'`.
  Full `test:tenant-isolation` suite (26 assertions) passes; dev DB confirmed empty after cleanup.

## 2026-08-12 - Fixed the statusLabel accent bug (user-approved, separate commit as agreed)

Dropped the accent: `sale.routes.ts`'s `statusLabel()` now returns `'Payee'` instead of `'Payée'`,
matching the string every frontend comparison (`frontend/src/main.tsx`, ~20 call sites) already checks
against. No frontend code changed - the frontend's own contract was already correct, the backend was the
one producing a string nothing could match. Added an explicit regression assertion to
`tenant-isolation-smoke.ts` (`createdSale.body.status === 'Payee'`, exact match) rather than relying on
it being implicitly covered by the return-flow test's status checks. Verified: `tsc` clean, full
`test:tenant-isolation` suite (26 assertions, all still passing) against the live DB. Landed as its own
commit per the plan from the prior entry, so it can be reverted independently of the Track A return work
it was found alongside.

**Still not independently verified:** the actual visual/behavioral effect in the browser (Reports
totals populating, Payments filter buckets working, register shift-sales showing correctly, badge
colors) - this environment has no display. The fix is a one-line change matching an already-established
string contract on the frontend side, which is why it was judged low-risk enough to land without that
verification; a future session with browser access should still confirm Reports/Payments/Dashboard now
show real data instead of empty results.

## 2026-08-12 - Track D auto-posting, increment 1: CashMovement + per-location account model

**Blocked, then unblocked by a user decision, not more measurement.** Unlike the Sale-return read-path
question, there was no way to discover the right target-account model by inspecting live data - the
schema had zero linkage from `Company`/`Location`/`CashRegisterSession` to any `Account`, and no
asset/liability/equity category on `AccountType`. Asked the user directly: per-company single account,
per-location, or payment-method mapping. **Chosen: per-location**, matching how `Warehouse` is already
scoped per-`Location`.

- Added `Account.locationId Int?` (nullable FK to `Location`) - purely additive, no data-loss `db push`.
  `null` means a company-wide fallback account, used when a money-moving event has no `locationId` (e.g.
  an expense recorded without a location). Deliberately NOT "the company's first location" - the existing
  warehouse-fallback pattern's non-determinism is tolerable for stock, not for a ledger, where the same
  untargeted event should always land in the same account over time.
- New `backend/src/utils/accounting.ts`: `getOrCreateCashAccount(tx, companyId, locationId)` and
  `postCashTransaction(tx, account, type, amount, reference, note?)`, sharing the exact debit-increases/
  credit-decreases convention already documented in `accounting.routes.ts`.
- **Found and fixed a real bug via the live smoke test, not just a status check**: the get-or-create
  helper's first version matched the company-wide fallback purely on `{companyId, locationId: null}` -
  but accounts created manually via `accounting.routes.ts` also never set `locationId`, so the very first
  live run silently posted a `CashMovement`'s auto-entry into an **unrelated, pre-existing manually-created
  account** (`Compte {marker}` from an earlier test step), inflating its balance from 70 to 85. Fixed by
  also matching on the reserved name `'Caisse'` for the null-location case, so the auto-posting bucket
  can never collide with a user's own generically-named account. (A location-scoped lookup didn't have
  this problem: `accounting.routes.ts`'s create-account endpoint doesn't expose `locationId` in its zod
  schema at all, so only this new helper ever sets a non-null one.)
- Wired **CashMovement only** this increment (`register.routes.ts POST /movements`) - the unambiguous
  case, no payment-method conditionality to get wrong, chosen deliberately as the first slice per the
  advisor consultation before writing any Sale/Expense/Purchase code. `IN` posts a `DEBIT`, `OUT` posts a
  `CREDIT`, inside the same `$transaction` as the `CashMovement` row itself (not a follow-up write).
- **Purchase excluded from this entire track, not just deferred**: receiving a purchase only increments
  `supplier.balance` (a payable) - there is no cash leg in this codebase's current model (no "pay
  supplier" endpoint exists anywhere). Posting a `CREDIT` to cash for an unpaid purchase would be a
  straight modeling error under the existing asset-account-only convention. This is a deliberate scope
  exclusion, documented so a future session doesn't read "not done" as an oversight.
- **Credit-sale settlement has no backend endpoint at all** (checked: `openSaleSettlement` in
  `frontend/src/main.tsx` is a modal-opener with no dedicated backend route - `PATCH /:id/finalize`
  handles the *initial* finalize-with-method choice, not a later payoff of an existing credit balance).
  Credit sales therefore cannot currently generate any real cash-ledger entry at settlement time even
  after Sale finalize posting is wired (still pending, next increment) - documented as a separate,
  pre-existing gap, not something this track can hook into since the target code doesn't exist.
- **Third `Payment` writer found and excluded**: `connector.routes.ts`'s `/sell` endpoint (a legacy
  mobile-sync bridge, unrelated to the `Sale.originalSaleId`-style Track A work) creates `Payment` rows
  too, but writes field names that don't exist on the current schema (`subTotal` vs `subtotal`, `userId`
  on `Sale` which has no such field, `name` on `Contact` which uses `fullName`). TypeScript's excess-
  property checking does not catch this through Prisma's generically-typed `create()` calls - `tsc`
  reports zero errors despite the mismatch, a real soundness gap worth remembering for future "tsc clean"
  claims about this codebase. This endpoint is very likely already non-functional at runtime,
  independent of anything in this track; not wired into auto-posting, not fixed (out of scope), flagged
  for a future dedicated look.
- **Return-reversal decision made before touching Sale finalize (next increment), not after**: since
  `AccountTransaction` has no `saleId` link (only a free-text `reference`), the plan for the next
  increment is to compute the reversal amount directly from the same `balanceDelta` the return handler
  already calculates, rather than looking up the original posting - avoiding a dependency on a
  traceability feature that doesn't exist yet. `reference` will use a documented prefix convention
  (`SALE-{id}`, `SALE-RETURN-{id}`, etc.) for at least grep-level traceability until/unless a dedicated
  FK or `DocumentAndNote`-style polymorphic link is added.
- Verified live: cash IN (100) then OUT (30) at a real location -> account balance 70; two no-location
  cash movements (10, 5) both land on the SAME company-wide account, balance 15, confirmed NOT to have
  touched the unrelated manual account (still exactly 70). Full `test:tenant-isolation` suite (27
  assertions) passes; dev DB confirmed empty after cleanup.

## 2026-08-12 - Track D auto-posting, increment 2: Expense

Wired `expense.routes.ts`'s `POST /` create handler: posts a `CREDIT` (cash decrease) to the resolved
location account unless `paymentMethod === 'CREDIT'`, mirroring the same "not yet paid, no cash left"
exclusion already applied to Sale's `CREDIT` method (`Expense.paymentMethod` is a free-text `String`
field, no enum, but the value comparison is the same). Posted inside the same `$transaction` as the
`Expense` row.

- **Deliberately scoped to create only.** `PUT /:id` (edit/deactivate) does not adjust any previously
  posted `AccountTransaction` - changing an expense's amount or `paymentMethod` after the fact does not
  reverse or re-post the ledger entry. Documented directly above the edit handler as a known, flagged gap
  (matching the same class of decision as excluding Purchase from this whole track), not a silent
  omission - reconciling an edit means reversing the old amount and posting the new one, or skipping
  entirely if `paymentMethod` moved to/from `CREDIT`, and that's real scope for a future increment.
- **Real ordering dependency this surfaced in the smoke test, worth remembering for future additions**:
  the existing `createdExpense` assertion (CASH, amount 12, at `a.location`) runs earlier in the script
  than the CashMovement assertions added in increment 1 - once Expense auto-posting landed, both now
  touch the *same* location account, so the CashMovement assertions' hardcoded absolute balances (100,
  70) were no longer correct starting from a non-zero balance. Fixed by making them delta-based (capture
  the balance right before each cash movement, assert the expected *change*) instead of assuming a
  zero-balance start - the correct pattern for any future addition that shares an account across multiple
  smoke-test sections, since account balances accumulate across the whole script run by design.
- Verified live: CASH expense (12) posts a CREDIT, balance -12; CREDIT expense (50) posts nothing,
  balance unchanged at -12; the later CashMovement IN/OUT deltas land correctly on top of that starting
  balance. Full `test:tenant-isolation` suite (29 assertions) passes; dev DB confirmed empty after
  cleanup.

## 2026-08-12 - Track D auto-posting, increment 3 (final): Sale finalize + return reversal

The riskiest increment of this whole track, sequenced last as planned - two finalize entry points plus
the return handler built in Track A, all money-moving code paths.

- **`POST /` (create-and-finalize):** posts a `DEBIT` of `total` to the resolved location's account
  right after the `Payment` row is created, only when `data.method !== 'CREDIT'`. `location` was already
  resolved earlier in the handler for warehouse lookup, reused directly.
- **`PATCH /:id/finalize` (finalize-from-draft):** same rule, using `sale.locationId` (this handler
  doesn't resolve a `location` variable the way the primary path does). Same `!isCredit` guard as its
  existing `Payment.create` branch.
- **`POST /:id/return`:** posts a compensating `CREDIT` of the exact same `balanceDelta` the handler
  already computes for the customer-balance reversal (see Track A's 2026-08-12 entry), when
  `!wasCredit && payments.length > 0` - i.e. only when the original sale actually posted a cash `DEBIT`
  at finalize in the first place. Deliberately does NOT look up the original `AccountTransaction` (no
  `saleId` link exists - see increment 1's note) - recomputing the amount independently from data the
  return handler already has is simpler and doesn't need that traceability feature to exist first.
  `reference` uses `SALE-{id}` for the forward post and `SALE-RETURN-{id}` for the reversal - a documented
  prefix convention, grep-level traceable, not a queryable FK.
- **Two real test bugs found while writing the live smoke coverage** (not application bugs - the auto-
  posting logic itself worked correctly both times; the test's own assumptions were wrong):
  1. A new assertion checking the location account was "unaffected by the credit-sale/return sequence"
     assumed the balance would still be the CASH expense's `-12` from increment 2 - but the pre-existing
     `createdSale` test (quantity 1, `CASH`, `FINAL` -> total 12) *also* now posts a `DEBIT`, since it
     runs before this new block and finalize auto-posting is now wired. `-12 + 12 = 0`, not `-12`. Fixed
     the expected value.
  2. The increment-1 CashMovement assertions captured their "balance before" snapshot from a variable set
     much earlier in the script (`locationAccountAfterExpense`, right after the CASH expense) - once the
     cash-sale-and-return sequence was inserted between that capture point and the CashMovement section,
     the snapshot went stale (real balance had moved through +12 DEBIT, -12/-36 CREDIT reversals netting
     back to 0, none of which the stale variable reflected). Fixed by re-reading the account balance fresh
     immediately before the CashMovement section instead of reusing an earlier capture - the durable
     lesson from both bugs: **any assertion that shares an account across multiple smoke-test sections
     must capture its "before" baseline as close to the point of use as possible, not once near the top
     of the script**, since later-added sections keep changing what "before" actually means.
- Verified live end-to-end: CASH sale (4 units, total 48) -> account +48 (DEBIT) -> partial return (1
  unit) -> account -12 (CREDIT reversal) -> full remainder return -> account -36 more, net back to exactly
  the pre-sale baseline (0 change over the whole sequence). Separately confirmed the CREDIT sale/return
  sequence from Track A never touches the account at all. Full `test:tenant-isolation` suite (30
  assertions) passes; dev DB confirmed empty after cleanup. Backend and frontend `tsc` both clean.
- **Track D is now feature-complete for this session's scope**: CashMovement, Expense (create only),
  and Sale (finalize + return) all auto-post against the per-location account model. Purchase remains
  permanently out of scope (no cash leg in the model). Expense edit/deactivate, credit-sale settlement,
  and Account reports (trial-balance style) remain open, documented gaps for a future pass - not
  oversights.

## 2026-08-12 - Headless browser unblocked (Termux/Android aarch64) - the "no display" caveat is resolved

**This changes the "no browser in this environment" premise repeated in nearly every entry above and in
the plan file.** A real, native headless Chromium now runs in this environment, with full Puppeteer
scripted automation (click, type, wait for selector, screenshot) - not just static rendering.

- Root cause of the earlier "puppeteer fails to install here" note: Puppeteer's own postinstall tries to
  download a bundled Chromium build with no aarch64/Termux target, the same failure category as the
  Prisma schema-engine and bcrypt problems solved earlier this session.
- Fix: Termux's `x11-repo` (a separate package source, enabled via `pkg install x11-repo`) ships a real
  **native aarch64 Chromium build** (`chromium` package, currently 149.0.7827.155). Despite the repo
  name, no X server, X11 forwarding, or `termux-x11` app is needed at runtime - `chromium-browser
  --headless --no-sandbox` genuinely renders without a display, verified first via CLI
  (`--screenshot=out.png`) against both a static HTML file and the live Vite dev server, then via
  Puppeteer (`executablePath` pointed at the Termux binary, its own download skipped with
  `PUPPETEER_SKIP_DOWNLOAD=true`) driving the same binary with full page-interaction APIs.
- Verified concretely: took a real 1280x900 screenshot of the actual running TaysrPOS login page
  (`http://127.0.0.1:5173`, Vite dev server) - real fonts, real gradient, real form styling, not a blank
  or broken render. This is the first time any UI in this project has been visually inspected during this
  session; every prior "not visually verified" caveat (the accent-bug fix's actual browser effect, Phase
  1's deferred `renderKitchen`/`renderReports`/`renderRegister` extraction, Track C's POS-cart price-group
  wiring, and more) is now something a session in this environment can actually check, not just claim.
- Automated as `frontend/scripts/setup-headless-browser.sh` (idempotent, re-run anytime, mirrors
  `backend/scripts/setup-local-postgres.sh`'s pattern and rationale) and
  `frontend/scripts/screenshot.mjs` (reusable one-shot screenshot CLI: `node scripts/screenshot.mjs <url>
  <output.png> [--width=] [--height=] [--full-page]`). For scripted interaction beyond a single
  screenshot (login flows, clicking through pages), import `puppeteer` directly and reuse the same
  `launch()` options (`executablePath` = `$PREFIX/bin/chromium-browser`, `args: ['--no-sandbox']`) -
  `screenshot.mjs` only covers "load a URL and screenshot it."
- **What this does NOT yet solve:** no seeded/known test credentials were used to actually log into the
  app and click through authenticated pages this session (this capability was set up, not yet exercised
  against the real login-gated UI) - a future session should log in (real or seeded test account),
  navigate to Reports/Payments, and screenshot them to close out the accent-bug fix's outstanding
  browser-verification item from earlier today. Also unverified: whether Chromium's software rendering
  path (`--disable-gpu`, no real GPU access in this sandboxed environment) produces pixel-accurate output
  for anything relying on hardware-accelerated CSS effects - fine for the standard form/table/card UI
  this project uses, worth a second look before trusting it for anything more visually exotic.

## 2026-08-12 - Accent-bug fix visually confirmed; a second, separate date-filter bug found

Used the newly-set-up headless browser to close out the accent-bug fix's outstanding verification item.
Seeded the demo company (`backend/src/scripts/seed.ts`, `accountId: 'pos-v0-demo'`, admin/admin123),
created one real product and two real `FINAL` sales via the API (CASH 54 MAD, CARD 36 MAD), then drove
the actual login form and navigation with Puppeteer.

- **Confirmed, with real screenshots: the accent-bug fix works.** The Paiements page shows both sales
  correctly - `Total: 90,00 MAD`, `2 Transactions`, both rows tagged the green `Payee` badge with correct
  method (Especes/Carte) and amount. The Rapports page's default "Toutes" (all-time) period shows the
  same `90,00 MAD`, `2 Tickets Encaissés`, and a real rendered bar chart. Before today's fix, both of
  these were guaranteed to show zero for any real sale - confirmed now that they don't.
- **Found a second, separate bug while checking the obvious next thing (non-default period filters):**
  switching Rapports to "Ce mois" (this month) - or Aujourd'hui/Cette semaine/Cette annee - zeroes out
  sales created *seconds earlier, the same day*. Root cause, verified directly:
  `new Date("12/08 20:02")` (the exact format `normalizeSale` sends, DD/MM HH:mm via
  `toLocaleString('fr-FR', ...)`, no year) parses in Chromium as **December 8, 2001** - JS's loose date
  parser reads "12/08" as US-convention MM/DD, and defaults the missing year to an unrelated baseline.
  Every downstream `getMonth()`/`getFullYear()` comparison against `now` then fails for any real sale,
  every day of the year except (by coincidence) December.
- The two consumers of this logic - `matchesPeriod` (`main.tsx:1094`, used by the Dashboard) and
  `filterByPeriod` (`main.tsx:3681`, used by Rapports) - were both clearly written against the *old*
  mock/seed data convention, where `createdAt` held literal relative French strings ("Aujourd'hui",
  "Hier", "Lundi"...) and period-matching was a simple substring check. Real API data has never used that
  format, so every date-based period other than "Toutes"/"all" has likely always been broken for any
  sale created outside a coincidental match. `'week'` in `matchesPeriod` has the opposite failure mode
  (over-inclusive: if a `createdAt` string contains no day-name substring, the ternary falls through to
  `true`), so a "this week" dashboard filter may currently show *everything*, not nothing - not verified
  by screenshot, inferred from reading the exact branch.
- **Not fixed this pass** - found while doing something the user hadn't asked for yet (checking period
  filters beyond the specific accent-bug item), flagged rather than silently patched, matching this
  session's established discipline for out-of-scope findings. The real fix is for the backend to send an
  unambiguous, parseable timestamp (ISO 8601) instead of a pre-formatted French display string, and for
  the frontend to format for *display* separately from what it uses for *filtering* - conflating the two
  is the root design mistake, not just the specific date format chosen.
- Diagnostic scripts (`verify-accent-fix.mjs`, `verify-period-filter.mjs`) were one-off and deleted after
  use, matching this session's pattern for scratch verification tooling - not committed.
- Seeded demo company/users left in the dev database intentionally (`pos-v0-demo`, this is the project's
  own designated demo seed, not synthetic smoke-test data) - available for manual browser exploration:
  `admin`/`admin123`, `manager`/`manager123`, `cashier`/`cashier123`.

## 2026-08-12 - Two more real bugs found and fixed via live browser verification

Continuing the same investigation as the accent-bug confirmation above - fixed two more, both found by
comparing behavior across pages that share logic but didn't share the same bug symptom, which is exactly
the kind of cross-page inconsistency a browser catches and an API-only test cannot.

**Bug 1: date-parsing.** Verified directly: `new Date("12/08 20:02")` (the exact display-string format
`normalizeSale` sends) parses as **December 8, 2001** in Chromium - JS reads DD/MM as US-convention
MM/DD, and defaults the missing year to an unrelated baseline. Every `Today`/`Week`/`Month`/`Year` period
filter on both Rapports (`filterByPeriod`) and the Dashboard (`matchesPeriod`) built its comparison on
top of this string, so real sales created the same day never matched anything but "Toutes"/"all".

- Fix: added `createdAtISO` to `normalizeSale`'s output (`sale.routes.ts`) - a real ISO 8601 timestamp,
  additive alongside the existing pre-formatted `createdAt` display string (left untouched - it's still
  used correctly in ~15 places purely for rendering, none of which needed to change). Added the same
  field to the local optimistic-sale constructor (`localSaleFromCart`) for consistency before a real API
  round-trip replaces it.
- Rewrote `matchesPeriod` to do real date arithmetic for every period (today/week/month/year) against
  `createdAtISO`, replacing the old French-relative-string heuristics (`.includes('aujourd')`, day-name
  substrings) that were clearly written against an old mock/seed-data convention and never worked against
  real API data. `filterByPeriod` (Rapports) now just calls the shared `matchesPeriod` instead of
  duplicating a second, differently-broken version of the same logic.
- Left the day-bucketing chart key (`sale.createdAt.split(' ')[0]`, two call sites) as-is - it's a string
  grouping key operating on already-period-filtered data, not a `Date` parse, so it doesn't have this bug;
  only a narrow multi-year edge case remains there, out of scope for this pass.

**Bug 2: `normalizeSale` never included `locationId` in its output at all.** Found by contrasting Rapports
(worked, once Bug 1 was fixed) against the Dashboard (still showed `0,00 MAD` after the date fix). Traced
it: the Dashboard force-syncs `dashboardLocationFilter` to `currentLocationId` via a `useEffect`
(`setDashboardLocationFilter(currentLocationId)`), then filters `sales` with
`s.locationId === dashboardLocationFilter`. Since every real API sale had `locationId: undefined`, that
comparison was always false, silently excluding every real sale from the Dashboard's metrics and its
"Ventes de la periode" chart (which was rendering an entirely different, apparently mock dataset as a
result - a curve labelled Lun-Sam with a tooltip reading "Ven ventes: 390" that had nothing to do with
any real data in the system).

- Fix: added `locationId: sale.locationId ?? null` to `normalizeSale`'s output - purely additive, the raw
  Prisma `sale` object already carried this field (no query changed), it just was never mapped through.

**Verification method for both**: seeded the project's own demo company (`backend/src/scripts/seed.ts`,
`pos-v0-demo`), created one real product and two real `FINAL` sales via the API, then used Puppeteer to
actually log in and click through Paiements, Rapports (multiple period filters), and the Dashboard,
screenshotting each state before and after each fix. This is the first time in this project's history
that a reported "the numbers don't match" claim was checked by literally looking at the rendered page
rather than reasoning about the code - and it found bugs at every step. Locked into
`tenant-isolation-smoke.ts` as two new assertions (`locationId` present and correct, `createdAtISO`
parseable) so neither can silently regress. Full smoke suite (29 assertions) still passes; both
workspaces' `tsc` clean. Demo company/seed data (`admin`/`admin123` etc.) left in the dev database
intentionally for future manual exploration.

## 2026-08-12 - Dependabot alerts resolved (all 12 were transitive dev/build-tool deps)

- GitHub flagged 12 open alerts (7 high, 4 moderate, 1 low) on `package-lock.json` after the last push.
  Traced every one before touching anything - none were direct dependencies of the app itself:
  - `fast-uri`, `hono`, `valibot` - pulled in by Prisma's local-dev tooling (`@prisma/dev`, used by
    `prisma dev`/Prisma Studio), a devDependency of `prisma` in `backend/package.json`. Never runs in
    the deployed backend, which only imports `@prisma/client`.
  - `nanoid`, `postcss` - pulled in by `vite`'s CSS/build pipeline. `vite` is declared under frontend
    `dependencies` (arguably should be `devDependencies` - it's a build tool, not shipped in `dist/`),
    but its transitive deps never ship in the built bundle either way; they only run during
    `npm run build`/`npm run dev`.
  - `shell-quote` - pulled in by `concurrently` (root devDependency, used only to run npm scripts in
    parallel).
  None of the vulnerable code paths (URL host-confusion parsing, SSR memoization, ID generation,
  sourcemap auto-loading, shell-argument parsing) are reachable by an attacker against the running app -
  they only execute on a developer's or CI's machine during build/dev. Still worth fixing since GitHub
  will keep alerting and the fix was non-breaking.
- Ran `PUPPETEER_SKIP_DOWNLOAD=true npm audit fix` at the root (the env var is required here because a
  plain `npm install`/`npm audit fix` reinstalls `node_modules` and re-triggers Puppeteer's postinstall,
  which fails outright on Termux/aarch64 - same root cause documented in the headless-browser setup
  entry above). Result: 0 vulnerabilities, only `package-lock.json` changed (643 insertions/276
  deletions) - no `package.json` version ranges needed bumping, every fix resolved transitively.
- Verified nothing broke from the reinstall: backend `tsc --noEmit` clean, frontend `tsc -b` clean,
  `vite build` succeeds, `prisma generate` succeeds against the bumped `prisma@7.9.1`, the native
  Chromium/Puppeteer headless-browser setup still launches and reports its version correctly, and the
  full `tenant-isolation-smoke.ts` suite (29 assertions) still passes against a live backend + Postgres.
  (Verification note: `tsc`/`vite`/`prisma`'s own bin scripts use a `#!/usr/bin/env node` shebang, which
  fails to exec in this particular shell session with `sh: 1: tsc: not found` because Termux's
  `env` doesn't live at `/usr/bin/env` and this session's shell isn't getting `termux-exec`'s
  `LD_PRELOAD` redirect - unrelated to the dependency bump, worked around here by invoking `node
  <path-to-bin>` directly instead of relying on shebang/PATH resolution. Flagging this here in case a
  future session hits the same "tsc not found" red herring after a clean `npm install`.)

## 2026-08-13 - Phase 1: extracted renderKitchen and renderReports out of main.tsx

- Previously deferred pending browser access (now available). Pure structural refactor, no intended
  behavior change - followed the established pattern from the earlier `RegistersPage`/`PaymentsPage`
  extraction exactly: named-export component, `usePos()` destructuring the exact identifier names used
  as closures before (a wrong reference is a compile error, not a silently swapped prop), registered in
  `pageRenderers` in place of the old closure call.
- **`matchesPeriod` promoted from an App-internal closure to a module-level pure function** (next to
  `formatMoney`/`methodLabel`), since it turned out to have zero dependency on component state - it only
  ever touched its own two arguments. This was the one real decision the earlier structure-mapping pass
  flagged as needing resolution before Reports could extract cleanly; confirmed correct by a clean
  `tsc` immediately after the move (if it had secretly closed over anything, that would have been a
  compile error, not a runtime surprise).
- `PosContextValue` grew by ten fields across the two pages (`products`, `visibleProducts`,
  `lowStockProducts`, `locations`, `reportsTab`/`setReportsTab`, `reportPeriod`/`setReportPeriod`,
  `dashboardLocationFilter`/`setDashboardLocationFilter` for Reports; `draftSales`, `kitchenFilter`/
  `setKitchenFilter`, `markKitchenReady` for Kitchen). `Product` and `Location` types had to be exported
  from `main.tsx` for the first time - neither was needed outside the file until now.
- `renderKitchen`'s call site had restaurant-module gating baked in
  (`restaurantEnabled ? renderKitchen() : renderDashboard()`) - preserved exactly, just swapping the
  closure call for `<KitchenPage />`.
- **Verified live through the actual rendered UI**, not just `tsc`: Reports renders correctly with real
  aggregated data (174 MAD CA, 75 MAD margin, 5 tickets, matching the session's accumulated demo data),
  tab-switching works. Kitchen doesn't even appear in the sidebar for this demo company (restaurant
  module disabled) - toggled `restaurantEnabled` on temporarily via the Settings API to actually reach
  and screenshot the real `KitchenPage` component (not just confirm the dashboard-fallback branch),
  confirmed it renders pixel-correct (KDS dark theme, empty-state messaging, category filters, service
  counters), then reverted the setting back to `false` afterward so the demo company's configuration
  wasn't left changed by a verification step.
- Full suite still 34/34 (no backend changes this pass), both workspaces typecheck clean, fresh build
  succeeds.
- **Not done, deliberately, same session:** `renderRegister` (the POS cart, ~700 lines) - explicitly the
  highest-stakes remaining extraction, sequenced as its own dedicated pass with its own thorough
  verification given a silent bug there costs real money.

## 2026-08-13 - Frontend: currency management and per-user permissions in Settings

- Two new Settings tabs, backed entirely by endpoints built earlier today (`currency.routes.ts` for
  Track H, the `/api/settings/permissions/*` endpoints for Track E) that had no UI yet.
- **Devises tab**: lists configured currencies (code/name/symbol/rate/status), an inline rate editor
  (`onBlur` triggers `PUT /api/currencies/:id`, no separate save step), and an add-currency form. Matches
  the existing product-form-panel visual style rather than introducing a new pattern.
- **Utilisateurs tab rewritten entirely** - it was a static, hardcoded single-admin-row mock with a
  disabled "+ Ajouter" button and zero API call, confirmed while reading it for this work (a fourth
  confirmed case of this project's docs/UI overstating what's actually wired, after `contact.routes.ts`,
  the Settings/Restaurant/Tables/Expenses "extraction" claim, and now this). Rewrote it to load real users
  (`GET /api/auth/users`) and render one checkbox column per known permission action (currently just
  `devices.manage`, fetched from `GET /api/settings/permissions/actions` rather than hardcoded, so a
  future second action needs no frontend change). Each checkbox reflects the *effective* permission
  (override if one exists, else the role default) and toggling computes the minimal correct API call:
  create/update an override when diverging from the role default, delete it when converging back - never
  leaves a redundant override sitting around that merely restates what the role already grants.
- **Verified live through the actual rendered UI**: EUR (pre-existing from Track H's manual testing) and
  a newly-created USD both render correctly in the Devises tab; the Utilisateurs tab correctly showed all
  three real demo users with their real roles and the exact default checkbox states role-default logic
  predicts (ADMIN/MANAGER checked, CASHIER unchecked). One verification-script bug (not an app bug) is
  worth recording: a bad DOM selector in the test script toggled the wrong row's checkbox - it hit ADMIN
  instead of CASHIER - which incidentally exercised the sharper case anyway (an explicit deny override
  correctly beating a role that would otherwise grant access), confirmed via direct DB query
  (`UserPermission` row with `granted: false`), then cleaned up via the API so the demo admin account
  wasn't left without device-management access.
- Full suite still 34/34 (unaffected - no backend changes this pass, pure frontend), both workspaces
  typecheck clean, fresh build succeeds.

## 2026-08-13 - Frontend: partial purchase receive/return and sale return, both real bugs

- Confirmed a finding from an earlier exploration pass this session, in the actual code, not just from
  memory: `handleReturnPurchase` and `handleReturnSale` in `main.tsx` were **both 100% local-state
  mutations with zero API calls** - the "Retourner" buttons had never once hit the backend, despite
  `POST /purchases/:id/return` and `POST /sales/:id/return` existing and working server-side since
  Track B/A (2026-08-12). Separately, `PurchaseRecord.status` was typed as a French union
  (`'Recu'|'Retour'|...`) the API never actually sends - it sends the real `PurchaseStatus` enum
  (`PENDING`/`PARTIALLY_RECEIVED`/`RECEIVED`/`RETURNED`) unmodified (`purchase.routes.ts` has no
  French-label translation, unlike `sale.routes.ts`'s `statusLabel()`). Every comparison against those
  French strings silently always failed: the status badge always fell to a plain default class, and the
  purchase-return action button (gated on `status === 'Recu'`) never rendered for any real API-sourced
  purchase.
- **Purchase side:** added `purchaseStatusLabel`/`purchaseStatusBadgeClass` helpers (`purchase-modals.tsx`)
  mapping the real enum to French display text. Added `GET /api/purchases/:id` (full item detail with
  `receivedQty`/`returnedQty` - the list endpoint only ever returned an item *count*, not enough to
  drive a quantity picker). New `PurchaseDetailModal` component: per-line quantity inputs for both
  receive (default = remaining) and return (default = 0, capped at returnable), calling the real
  `PUT /:id/receive` / `POST /:id/return` endpoints. Deleted `handleReturnPurchase` entirely (dead,
  wrong logic) rather than patching it.
- **Sale side:** added `id`/`returnedQty` to `normalizeSale`'s `lines` output (`sale.routes.ts`) - neither
  existed in the API response before, and both are required to target a specific `SaleItem` for a
  partial return. New `SaleReturnModal` component (`sale-modals.tsx`), same per-line quantity-picker
  pattern, calling the real `POST /:id/return`. The "Retourner" button's gating condition changed from a
  bare `sale.status === 'Payee'` check to computing returnability directly from the lines
  (`quantity - returnedQty > 0` on any line) - the old check couldn't distinguish "fully returned,
  nothing left" from "partially returned, more available" since both map to the same `'Retour'` display
  status. Deleted `handleReturnSale` entirely, same reasoning as the purchase side.
- **Verified live through the actual rendered UI, not just the API**, using the headless-browser
  tooling: logged in, navigated to Achats, opened a real `PENDING` purchase, entered a partial receive
  quantity (4 of 10), submitted, and confirmed both the modal (now showing `PARTIALLY_RECEIVED` /
  "Partiellement reçu" with a `Retourner` action newly available) and the underlying database
  (`receivedQty=4`, supplier balance +20, purchase status `PARTIALLY_RECEIVED`) updated correctly.
  Separately, navigated to Ventes, opened a real `FINAL` sale's receipt, clicked `Retourner`, entered a
  partial return quantity (1 of 3), submitted, and confirmed the sale correctly moved to
  `PARTIALLY_RETURNED` with `SaleItem.returnedQty=1` while `Sale.total` correctly stayed at its original
  historical value (immutable, as designed - only the returned-quantity tracking changed). Screenshots
  captured at every step.
- One unrelated environment gotcha hit and worth noting: the backend dev server was running via plain
  `tsx` (no watch mode), so the new `GET /:id` route and the `returnedQty` field change weren't live until
  the server was manually restarted - it returned a stale 404 on first attempt. Not a code bug; just a
  reminder that this project's dev-server invocation doesn't auto-reload.
- Full suite re-run after these changes: 34/34 `tenant-isolation-smoke.ts` assertions still pass
  (unaffected - these were pure frontend + response-shape additions, no behavior change to the core
  return/receive math), both workspaces' `tsc` clean, fresh `vite build` succeeds.

## 2026-08-13 - Credit-sale settlement endpoint (closes a gap flagged twice earlier this session)

- Both the original migration audit and Track D's writeup flagged this: a `CREDIT` sale increments
  `Contact.balance` on finalize (and a return correctly reverses it), but nothing anywhere ever recorded
  the customer actually paying that balance back down in cash. `POST /api/contacts/:id/settle`.
- **Operates at the customer level, not per-sale.** `Contact.balance` is already an aggregate across all
  of a customer's outstanding sales (that's how the CREDIT-finalize increment itself works - it's not
  tracked per-sale anywhere), so there's no per-sale "amount still owed" to settle against without
  inventing new tracking. Matches the existing (rougher) precedent already in `connector.routes.ts`'s
  `contactapi-payment` handler, done properly here.
- Reduces `Contact.balance`, posts a Track D `DEBIT` (cash received) to the resolved location account via
  the existing `getOrCreateCashAccount`/`postCashTransaction` helpers, and logs an audit trail via
  `DocumentAndNote` (entityType `'contact'`) rather than `Payment` - `Payment.saleId` is a required FK to
  one specific sale, and this is deliberately not tied to one.
- Rejects over-payment (amount > current balance) and settlement at a zero balance, both with a clear
  message rather than silently clamping or creating a negative balance.
- Verified live: a credit sale for a real customer, a rejected over-payment, a partial settlement with
  exact balance and cash-account math, a final settlement zeroing the balance, and settlement-at-zero
  correctly rejected afterward. Locked into `tenant-isolation-smoke.ts` (34 assertions now, up from 33,
  including a cross-tenant rejection check). Full suite passes twice in a row with zero orphaned rows.
  Both workspaces' `tsc` clean.

## 2026-08-13 - Track H: multi-currency for Sale + Purchase

- Scope question resolved before building: in a Moroccan retail context, customers almost always pay in
  MAD but suppliers importing goods often invoice in EUR/USD - Sale and Purchase needed different
  treatment, so this was worth asking rather than assuming. User chose both, same pass.
- **Design principle: `total`/`subtotal`/`taxTotal` on Sale and Purchase stay in the company currency
  (MAD) always, computed exactly as before with zero change to that logic.** `currencyId`/
  `exchangeRate`/`foreignTotal` are purely additive record-keeping - the recorded equivalent in another
  currency, not a replacement source of truth. This was the deciding factor over the alternative
  (letting a foreign amount drive the MAD total): every existing consumer of `total` - Track D
  auto-posting, PDF receipts, Dashboard/Reports, supplier-balance increments, the Hanout Express sync
  ingestion built yesterday - keeps reading it completely unchanged, so this carries zero regression risk
  to four tracks' worth of already-verified money math.
- New `Currency` model (company-scoped: `code`, `name`, `symbol`, `rate` - manually maintained, no live
  FX API, matching how `TaxRate.rate` is already manually configured rather than fetched). Each
  Sale/Purchase resolves and snapshots the rate at write time into its own `exchangeRate` field - same
  resolve-then-snapshot pattern as `TaxRate` -> `tvaRate`, so editing a `Currency`'s current rate later
  never rewrites an already-recorded document's historical rate. Verified this specific guarantee live,
  not just assumed it: created a sale, changed the `Currency`'s rate afterward, re-fetched the sale, and
  confirmed its `exchangeRate` was untouched.
- A per-transaction `exchangeRate` override is accepted and takes precedence over the `Currency`'s
  stored rate (today's actual FX rate can differ from whatever was last typed into the currency record) -
  verified live.
- `backend/src/routes/currency.routes.ts`: list/create/update, company-scoped, `ADMIN`/`MANAGER` for
  writes. Sale and Purchase creation both accept optional `currencyId` (+ optional `exchangeRate`
  override); an invalid or cross-tenant `currencyId` is rejected with 400 before the transaction starts,
  same place location/warehouse/table are already validated.
- Verified live end-to-end against the real dev DB: EUR currency created (lowercase code normalizes to
  uppercase, duplicate code rejected), a 2-unit sale correctly computed `total=24` MAD unchanged with
  `foreignTotal` correctly derived at the stored 10.85 rate, a second sale with an explicit rate override
  correctly used 11 instead, an invalid `currencyId` rejected on both Sale and Purchase, cross-tenant
  currency use rejected, a purchase framed as "500 EUR equivalent" correctly kept `total=5425` MAD
  (client-supplied, unchanged from today's behavior) with `foreignTotal=500` computed correctly, and
  Track D's existing ledger posting confirmed completely unaffected (both currency-tagged sales still
  posted their exact MAD amounts). Locked into `tenant-isolation-smoke.ts` (33 assertions now, up from
  32). Full suite passes twice in a row with zero orphaned rows. Both workspaces' `tsc` clean. Schema
  change applied additively, no `--accept-data-loss` needed.
- **Not built this pass, deliberately:** no frontend currency picker/display anywhere (API-only, matching
  this session's established backend-first pattern - useful today for anyone integrating directly, e.g.
  a future accounting export or admin tool). Purchase's write direction stays "client sends the MAD
  total, currency is additive metadata" rather than "client sends the foreign total and MAD is derived" -
  decided this way for symmetry and to avoid inventing an asymmetric contract; if real usage later shows
  purchasers want to type the foreign invoice amount and have MAD computed, that's naturally a frontend
  concern (the form does that math client-side before submitting the same MAD-total shape this API
  already expects), not a backend contract change. No live FX rate lookup - manual only, by design.

## 2026-08-13 - Track G: real device auth + sync for Hanout Express (not the legacy Connector module)

- **Corrects a stale assumption from the 2026-08-12 plan/baseline.** That doc treated
  `backend/src/routes/connector.routes.ts` as "unrelated to parity - Platform sync bridge" and treated
  Track G (external Connector API) as an unstarted, need-to-confirm-demand item modeled on the legacy
  `TaysrPOS-old/Modules/Connector` (30+ REST endpoints, Laravel Passport OAuth2). Neither is right.
  `connector.routes.ts` already has a comment - `status: 'FINAL', // Hanout-express syncs finalized
  sales` - proving a prior pass built it *for* Hanout Express, and the user confirmed a real client
  (`taysrcloud/TaysrHanout`, an Android/web POS for small Moroccan corner stores) needs this. But cloning
  that repo and reading its actual Retrofit interfaces (`DeviceApiService`, `SyncApiService` under
  `app/.../data/remote/`) showed the real contract is neither what `connector.routes.ts` implements nor
  the legacy UltimatePOS Connector module - it's a small, custom, purpose-built sync protocol: 6
  endpoints total (`device/activate`, `device/refresh`, `device/logs`, `sync/batch`, `sync/pull`,
  `receipt/send`), device-bound auth (not user login), and deliberately thin DTOs (`{id, name, price,
  barcode}` for products, `{id, name, phone, balance}` for customers - no stock/tax/category data
  requested at all). `connector.routes.ts` is untouched by this work; nothing calls it today, but it
  might still serve some other consumer, so it was left alone rather than assumed dead.
- **Real bug found in Hanout Express itself, not fixed here (can't - it's a separate repo), just
  flagged:** `CustomerRepository.kt` never enqueues a sync event - only `SaleRepository` does, and only
  `entityType: "sale"`. Customers flow server-to-app only (`SyncRepository.pullUpdates()`'s own comment:
  "Server is authoritative for name + balance"). A cashier collecting a credit-debt payment on the
  Hanout tablet updates the local Room balance only; the next periodic pull-sync (every 15 min, or
  immediately after any sale) would silently overwrite it back to the stale server value. This is a real
  data-loss risk in that app, worth relaying to whoever maintains `taysrcloud/TaysrHanout`.
- **Sign-convention mismatch caught before it shipped:** Hanout's own README documents a
  negative-balance convention ("balance = -120 -> customer owes 120"). v0's `Contact.balance` is the
  opposite - positive means the customer owes the store (a receivable; it's incremented on a CREDIT
  sale). Pulling the raw value across would have shown every debtor as having store credit and vice
  versa. Fixed by negating in `GET /sync/pull`'s customer mapping only - the CREDIT-sale balance
  increment on the ingest side stays in v0's own convention, since that's server-side authoritative
  math, never transmitted from the client.
- **Schema (additive only):** `Device` model (`companyId`, `locationId`, `activationCode`, `phone`,
  `deviceId`, `deviceModel`, `appVersion`, `refreshTokenHash`, `activatedAt`/`lastSeenAt`/`revokedAt`) -
  a second auth path parallel to the existing user-JWT one (`oauth.routes.ts`), since a device
  authenticates as itself, bound to one `Location`, not as a logged-in `User`. `Sale.externalId String?
  @unique` - idempotency key for sales pushed from a device, since `SyncWorker` retries whole batches on
  failure and the client generates its own UUID client-side.
- **Refresh-token storage: SHA-256 digest, not bcrypt.** Initially reached for bcrypt (matching
  `User.passwordHash`) before realizing that's the wrong tool here - a refresh token is already a random
  256-bit value, not a low-entropy secret like a password, and Hanout's `/device/refresh` call sends
  only the token itself (no `device_id`), so the lookup has to be indexed. Bcrypt is deliberately slow
  and non-deterministic (correct for passwords, wrong for this); a deterministic SHA-256 digest gives an
  O(1) unique-indexed lookup with no meaningful security loss given the token's own entropy - the same
  pattern GitHub/OAuth providers use for PATs and refresh tokens.
- **Prisma's own AI-safety guard fired** on the `db push --accept-data-loss` needed to apply this
  (purely additive - new table + two new nullable/unique columns, unlike the `Purchase.status`
  conversion earlier this session, which the same flag proved genuinely destructive on). Stopped and got
  explicit user consent before proceeding, per the guard's own required protocol - target was confirmed
  as the local dev database only, and the resulting diff was exactly what was expected: one new
  unique-constraint check, no drops.
- **Unrelated regression found and fixed along the way:** `db push` failed with an opaque `Error: Schema
  engine error:` and no other detail. Root cause: yesterday's Dependabot fix bumped `prisma`
  7.8.0 -> 7.9.1, and this Termux/aarch64 environment requires manually invoking `db push` with
  `PRISMA_SCHEMA_ENGINE_BINARY` pointed at a separately-downloaded ARM64 engine binary (see the
  `setup-local-postgres.sh` comment header) - that env var just wasn't set in this shell invocation. Not
  a version-hash mismatch (checked: the cached engine's hash matched `prisma -v`'s reported hash
  exactly) - purely a missed env var. Documented here since the opaque error message gives no hint what
  actually went wrong.
- **Verified live end-to-end**, not just typed: generated an activation code via the new
  `POST /api/settings/devices`, activated a real device, confirmed `sync/pull` returns only that
  tenant's products/customers with the balance sign correctly flipped, pushed a mixed batch (CASH sale,
  CREDIT sale, and one deliberately-bad product id) and confirmed exact stock/balance/ledger math plus
  correct partial failure (the bad-product event failed cleanly, the other two succeeded, no partial
  writes leaked from the failed one), retried the same batch and confirmed no duplicate `Sale` row or
  double-posted ledger entry, rotated a refresh token and confirmed the old one is immediately rejected,
  and confirmed a revoked device is rejected on its very next request even though its JWT is still
  cryptographically unexpired. All of this is now locked into `tenant-isolation-smoke.ts` (31 assertions
  total, up from 29) including two cross-tenant checks (device-list/revoke ownership, and a
  re-redeem-with-different-device-id rejection). Full suite passes twice in a row with zero orphaned
  rows left behind; both workspaces' `tsc` clean.
- **Not built:** `device/logs` accepts and drops (no retention) - low priority per this pass's scoping.
  Product/customer *push* from Hanout (only pull exists, matching what the app actually needs today).
  Admin UI in Settings for the new activation-code endpoints (API-only, matching this session's
  established pattern of shipping backend-first, UI later once browser-available sessions pick it up).

## 2026-08-13 - Track E: per-user permission overrides on top of role presets

- Implemented exactly the hybrid model recommended and explicitly approved by the user, not the full
  UltimatePOS-style permission matrix the project's own original docs warned against building: the 6
  `UserRole` presets stay completely unchanged, and a new sparse `UserPermission { userId, action,
  granted }` table lets an ADMIN grant or revoke one specific action for one specific user without
  touching the role system. Empty by default - a user with zero override rows gets exactly today's
  `requireRole()` behavior, so the mechanism is zero-regression-risk to introduce.
- `requirePermission(action)` middleware checks the override table first (explicit grant or explicit
  deny both short-circuit), then falls back to a `DEFAULT_ROLE_PERMISSIONS` map keyed by action.
  Deliberately did **not** retrofit all ~25 existing `requireRole()` call sites at once - that was the
  identified highest-regression-risk move available in this codebase (hundreds of gated actions, no
  visual UI, one wrong swap silently grants or denies the wrong thing). Instead migrated exactly one
  real call site as the first concrete usage and end-to-end proof: the three device-management endpoints
  (`POST/GET/DELETE /api/settings/devices`) built earlier today for Track G, chosen because it's low
  business risk (activation codes, not money) and something a store owner might plausibly want to
  delegate to a trusted non-admin employee. `DEFAULT_ROLE_PERMISSIONS['devices.manage'] =
  ['ADMIN','MANAGER']` reproduces the exact `requireRole(['ADMIN','MANAGER'])` behavior it replaced, so
  nothing changes for any existing user until an ADMIN actually creates an override.
- **Deliberate backstop against privilege escalation:** the permission-*management* endpoints themselves
  (`GET/PUT/DELETE /api/settings/permissions/...`) are gated with `requireRole(['ADMIN'])` directly, not
  `requirePermission()`. Letting that be delegated would let a MANAGER (or anyone granted any permission)
  grant themselves more access - the role system stays the un-overridable root of trust for who can hand
  out overrides, even though overrides can now bypass the role system everywhere else.
- Verified live end-to-end against the real dev DB: a CASHIER correctly denied by role default, granted
  access via an explicit override, verified working, then denied again after the override was removed. A
  non-ADMIN (the CASHIER) correctly blocked from calling the permission-management endpoints at all, even
  to grant itself something. Cross-tenant: one company's ADMIN cannot manage another company's user
  permissions (404). The sharper case - an explicit `granted: false` override blocking an ADMIN from an
  action their role would normally allow, then restoring access once the override is removed - also
  verified live, since a grant-only override system wouldn't actually prove the override table is
  checked *before* the role fallback rather than just supplementing it.
- Locked into `tenant-isolation-smoke.ts` as a new block (32 assertions total, up from 31). Full suite
  passes twice in a row with zero orphaned rows (the new `UserPermission` rows cascade-delete via `User`
  the same way `Device` rows cascade via `Company`/`Location`). Both workspaces' `tsc` clean. Schema
  change is additive only (`db push` succeeded without needing `--accept-data-loss` this time - no
  existing table's shape changed).
- **Not done, by design:** no other route was migrated from `requireRole` to `requirePermission` yet.
  The mechanism is real and proven, but per the same reasoning that ruled out a big-bang rewrite,
  further migrations should happen action-by-action, only where a real store has actually asked for
  finer control than its current role grants - not preemptively.

## 2026-07-16 - Restaurant module access contract

- Previous risk: the frontend expected planLimits.modules as a string array, while Platform may store modules as an object. The settings API also accepted restaurantEnabled without checking entitlement.
- Fix: normalize module arrays/objects in login and auth middleware, derive effective Restaurant visibility from entitlement plus tenant activation, protect /api/restaurant with requireModule, and reject unauthorized activation in PUT /api/settings.
- Product rule: Super Admin grants RESTAURANT; an entitled tenant Admin/Manager may enable or disable it for their workspace. Non-entitled users never see the option.

## 2026-08-13 - renderRegister extraction: measured, then deliberately deferred (not started)

- Began the fourth Phase 1 page extraction per explicit user instruction ("Continue now, both" -
  approving Kitchen/Reports and Register in the same session). Read `renderRegister` in `main.tsx`
  (confirmed boundary: starts line 1958, ends before `renderProducts` at line 2690 - ~732 lines) and
  read the first third of its body (lines 1958-2207) to inventory its dependencies before writing any
  extraction code, the same discipline used for the three prior successful extractions.
- **Measurement that changed the plan:** that first third alone already touches 40+ distinct pieces of
  App state/handlers - register open/close, location/table selectors, the full command-bar button row
  (Z-report, cash movements, cancel/clear, calculator, customer display, fullscreen), the customer/search/
  catalog workflow chips, the cart table with permission-gated price/discount editing, totals breakdown,
  suspend/draft/quote action chips, and a store-credit top-up modal - versus 4 fields for the Kitchen
  extraction and 10 for Reports (`##2026-08-13 Phase 1: extracted renderKitchen and renderReports`
  above). The remaining two-thirds of the function (payment modal, split payment across methods, credit
  settlement, receipt/kitchen routing) was not yet read, but extrapolating from the first third, the full
  `PosContextValue` surface for this one page is plausibly 80-120 fields.
- Stopped here and consulted before writing any code (not a "ran out of time" stop - a deliberate
  risk call). Reasoning against proceeding this session:
  1. The safety property that made Kitchen/Reports low-risk - `usePos()` destructuring the *same
     identifier names* used as closures in `main.tsx`, so a wrong reference is a compile error - degrades
     as the field count grows. With ~100 same-typed fields (multiple `(v: string) => void` setters,
     multiple `number` totals like `cartSubtotal`/`cartLineDiscount`/`cartTax`/`cartTotal`), a swap
     between two same-typed fields still typechecks clean. `tsc` catches a missing prop, not a swapped
     one - this exact risk is already written into this file's own Phase 1 section, and it scales
     directly with field count.
  2. The headless-browser verification loop used all session has a demonstrated ceiling: three separate
     selector/assertion bugs this session were only caught by screenshot inspection, not the script's own
     assertion (ADMIN-vs-CASHIER checkbox mis-click during Track E verification; a `sidebar` vs `tab`
     click-target mixup; a case-sensitivity text-match miss during Kitchen verification). Those were
     harmless on Settings toggles. Verifying the Register page combinatorially - split payment across
     four methods, credit settlement, price-override permission gating, the kitchen auto-suspend
     `document.getElementById`+`setTimeout` interaction, suspend/resume round-trip, Z-report - by
     DOM-scripting alone is a materially bigger job than the extraction itself, and this is the one page
     in the app where an unverified silent bug costs real money (per this file's own repeated framing all
     session).
  3. The user's "Continue now, both" approval was given before this measurement existed - the estimate at
     the time was "two extractions, the second one bigger," not "40+ deps in a third of the file, ~100
     projected total." Surfacing the actual number and recommending deferral is giving the user the input
     they'd have needed to make the same call, not overriding their instruction.
- **No edits made to `main.tsx` for this piece.** `git status` confirmed clean before writing this entry.
  Task #24 stays pending in the task tracker with this file as the record of why.
- **Real blocker going forward is no longer "no browser" (resolved 2026-08-12) - it's "no functional
  test coverage for the cart/payment math."** The concrete unblocking path: add cart-math and
  payment-flow coverage to `backend/scripts/tenant-isolation-smoke.ts` (or an equivalent frontend-logic
  test) *before* attempting this extraction, so a swapped-field regression fails a test instead of
  waiting to be caught in production. If a future session wants to make progress on this page without
  that prerequisite, the lower-risk partial move is extracting the self-contained modals inside
  `renderRegister` (variable-product picker, store-credit top-up, suspend-ticket modal) as standalone
  components with explicit props - each is small and independently verifiable - while leaving the actual
  cart-math and payment core inside `main.tsx` untouched until it has test coverage.

## 2026-08-13 - Split-payment persistence: a real bug cluster found building the renderRegister test-coverage prerequisite

Per the previous entry's own recommendation ("add cart-math/payment-flow assertions to
tenant-isolation-smoke.ts... before attempting this extraction"), started there instead of the
extraction itself. Reading the actual payment-submission path (`salePayload`/`completeSale` in
`main.tsx`, `POST /api/sales` in `sale.routes.ts`) to write realistic assertions surfaced a real,
previously-undiscovered, multi-part bug in split/MULTI payments - not a hypothetical risk, a live one.

**Bug 1 - split payments were never persisted at all.** The register already collected a real
cash/card/credit breakdown (`paymentForm`) and sent it as `payload.splitPayments` on every MULTI
checkout. `saleSchema` never declared that field, and a plain `z.object()` silently strips unrecognized
keys (no error) - so every split-payment sale, ever, recorded exactly one `Payment` row for the full
total under `PaymentMethod.MIXED`, with zero record of the actual tender mix.
**Bug 2 - the Z-report's cash-drawer reconciliation returned 0 for the cash portion of every MULTI
sale**, not because it lacked data (it had none to lack) but because its own `reduce` only had a branch
for `s.method === 'CASH'` and silently fell through to `return sum` for `'MULTI'`. Every split-payment
sale a cashier ever closed out under-counted the till's expected cash by exactly its real cash portion.

**Fix (`backend/src/routes/sale.routes.ts`):** `saleSchema` gained an optional `splitPayments` array.
Reconciliation logic added before the transaction, informed by reading the actual payment-modal UI
(`frontend/src/main.tsx` ~2300-2360) rather than assuming: CASH is the only tender with a real "change"
concept (the UI explicitly allows overpaying in cash and shows change due), so CARD/CREDIT/STORE_CREDIT
are taken at face value and validated against `total`, while CASH is the remainder "plug" capped at
what's actually still owed - cash entered above that is change handed back, never sale revenue, and is
now never recorded as a Payment amount or posted to the ledger (verified live: a 20 MAD cash tender
against a 12 MAD total records a `Payment` of exactly 12, not 20). One `Payment` row is now created per
real tender component instead of one lump MIXED row. The ledger DEBIT is `total - creditPortion -
storeCreditPortion` (previously always the full `total`, regardless of how much was actually credit or
fake store-credit) - closes a real ledger-corruption case: a MULTI sale with a credit or store-credit
component used to post the ENTIRE total as cash received, even for a sale where zero real cash/card
money changed hands. `normalizeSale` now returns the real `payments` breakdown so the frontend Z-report
has real data to read instead of client-local optimistic state that never survived a page reload.

**STORE_CREDIT handling, deliberately scoped down after advisor review:** `Contact.storeCredit` does
not exist anywhere in the schema - the register's store-credit balance/top-up
(`topupContact`/`topupAmount`, `contact.storeCredit`) is entirely local frontend state that `contact.
routes.ts` always reports as `0`, wiped on every refresh. The first draft of this fix rejected
STORE_CREDIT split components outright as "an honest failure" - wrong: a live UI code-path (storeCredit
alone, or storeCredit mixed with cash) already sends it today and currently completes (wrongly, but
completes) via the pre-fix lump-MIXED path; rejecting it would have turned that into a hard checkout
failure with a full cart and no way forward, a live-register regression introduced by a hardening pass.
Corrected: STORE_CREDIT is accepted, recorded as a `Payment` row (mapped to `PaymentMethod.MIXED`, code
comment marks it as not a real tracked rail), and excluded from the ledger DEBIT - closes the "phantom
cash for money never received" case without touching whether checkout succeeds. Building real
STORE_CREDIT persistence (a `Contact.storeCredit` field + redemption endpoint) is a separate feature,
correctly out of scope here, and is now flagged explicitly rather than silently left broken.

**Bug 3 - found live, not in the smoke suite, while verifying the fix through the real UI (not just the
API):** `methodLabel()` derived a sale's overall payment-method label from `sale.payments?.[0]?.method`
alone. That was safe when a MULTI sale always had exactly one row (tagged MIXED). Once split payments
create one row per tender, `payments[0]` is just whichever component the transaction happened to insert
first (non-cash components before the cash "plug", per the fix above) - so a genuine cash+card split
came back labeled `'CARD'`, not `'MULTI'`. Caught by running an actual checkout through the headless
browser (admin/admin123, demo tenant `pos-v0-demo`, product "Cafe Expresso" temporarily stocked to 100
- see below) with a real 20 MAD cash + 16 MAD card split (36 MAD total, 2 units): the Z-report's "Ventes
espèces" figure came back 138 MAD instead of the independently-computed correct 158 MAD, a 20 MAD gap
matching the split sale's cash portion exactly. Root-caused to the mislabel, fixed by checking
`payments.length > 1` before inspecting a single row. Re-verified live after the fix: Z-report showed
158 MAD, matching a hand-computed sum across every real PAID sale in the tenant. This is exactly the
class of bug the previous entry warned the headless-browser loop has a ceiling on - the smoke suite's
own assertions (which checked the `payments` array's contents but never `body.method` on a multi-row
sale) would not have caught it; only the live click-through did. A regression assertion for this
specific case (`cashCardSplit.body.method === 'MULTI'`) is now in the smoke suite so it can't regress
silently again.

**Bug 4 - found, flagged, deliberately NOT fixed in this pass:** the Z-report's "current shift" filter
(`shiftSales = sales.filter(s => s.status === 'Payee' && s.id >= registerDetails.openedId)`) compares a
`Sale.id` against `registerDetails.openedId`, which is actually a `CashRegisterSession.id` (confirmed by
reading where `openedId` is set - `session.id` at two call sites in `main.tsx`). These are two entirely
unrelated auto-increment sequences. Confirmed live against the demo tenant: the open session's id is 1,
every real sale's id is 34-158, so the filter `s.id >= 1` matches literally every sale the tenant has
ever recorded, not just the current shift - the Z-report's cash-drawer reconciliation is not bounded by
shift at all in this tenant, and will not be bounded correctly in any real deployment either, since a
sale's id and a register session's id have no relationship. This is a distinct root cause from bugs 1-3
above (a real shift boundary needs either `CashRegisterSession.openedAt` compared against a sale's
`createdAtISO`, or a `Sale.registerSessionId` FK - not a small change) and was out of the scope the
advisor set for this pass. Flagged here for a deliberate decision, not silently left for the next person
to rediscover.

**Verification:** 8 new smoke-suite assertions (exact cash tender, cash overpayment excluded from the
ledger as change, cash+card split rows and ledger sum, cash+credit split dividing correctly between the
ledger DEBIT and the customer's balance, store-credit excluded from the ledger DEBIT, underpayment
rejected, non-cash-exceeding-total rejected, credit-with-no-customer rejected) plus the `methodLabel`
regression assertion above - 9 total, all passing, full suite (43 assertions now) passing twice in a row
with zero orphaned rows. Backend and frontend `tsc --noEmit` clean, frontend `vite build` clean. Live
verification through the actual rendered UI (not just the API) as described above, including catching
and fixing bug 3, which the API-level smoke suite alone would have missed. Demo-tenant side effects
(`Cafe Expresso` stock temporarily raised to 100 to have enough units to sell) reverted to its original
value (-12) afterward; the one real sale created during live verification (36 MAD, ticket TCK-5389262)
was left in the demo tenant's history, consistent with how that tenant has been used as a working
scratch environment all session (unlike the boolean-setting reverts done for earlier verification
passes, unwinding a real finalized sale's stock/ledger/payment rows is not a simple revert and this
demo company already carries other test activity from earlier today).

## 2026-08-13 - RegisterPage extraction: the full dependency audit and the move itself

With the split-payment prerequisite committed (`ca2e3e7`) and the test suite green, resumed the
`renderRegister` extraction per explicit user approval ("Proceed now"). Finished the full-body read
(the earlier entry had only read the first third) and then, before writing any code, audited every
free identifier the function references against the *entire* file - not just a sample - specifically
because the previous entry's whole concern was that a same-typed-field swap between two of the ~90
candidates would pass `tsc` silently.

**Audit method:** for every candidate identifier, `grep -n '\bidentifier\b' main.tsx`, filter to hits
outside the `renderRegister` line range, and check **both the bare name and its setter** (e.g.
`topupContact` and `setTopupContact` separately) - the bare-name check alone missed real cases. Concrete
example: `topupContact`/`topupAmount` looked register-exclusive by bare name (only the declaration line
outside range), but the Contacts page's "Recharger" button calls `setTopupContact(contact)` directly -
a bare-name-only audit would have relocated this state into `RegisterPage.tsx` as page-local, silently
breaking that button on a completely different, unrelated page the first time someone clicked it. Caught
before any code was written by checking every setter's outside-range usage too. `actualCash` was a
similar near-miss for a different reason: bare-name hits at lines 267/386-387 turned out to be a
same-named field on the unrelated `RegisterHistory` type (false positive), but a real hit at the credit-
settlement flow on the Contacts page (`setActualCash` bumping the register's counted-cash figure when a
customer pays down credit from that page) confirmed it genuinely must thread, not relocate.

**Result of the audit - two categories, not one:**
- **Relocated to `RegisterPage.tsx` as page-local state** (confirmed zero usage anywhere else in the
  file, bare name and setter both): the calculator (`calcOpen/calcDisplay/calcPrev/calcOp` + the
  `calcPress` function, previously a sibling closure defined *after* `renderRegister`), the Z-report's
  denomination counter, the cash-movement form, the line-price-override form, the open-register form, the
  payment/cash-movement/z-report modal-open booleans, `suspendType` (but not `suspendNote` - see below),
  `selectedCategory` (with `registerProducts` now computed locally from context's `visibleProducts` +
  `search` + local `selectedCategory`), and the entire Transactions-modal cluster
  (`transactionsTab`/`transactionTabs`/`currentTransactions`/`currentTransactionsTotal`/
  `currentTransactionsDue`/`latestSuspendedSale` - `transactionsModalOpen` itself still threads, since
  `resumeSale` in `App` closes it on resume). Also found and dropped one genuinely dead variable in the
  same cluster, `latestDraftLikeSale` - declared, never read anywhere.
- **Threaded via `PosContextValue`** (~48 new fields - full list in `frontend/src/context/PosContext.tsx`,
  ordered to match `RegisterPage`'s `usePos()` destructure so the two lists are diffable by eye): every
  piece of state a same-page-elsewhere `App` function (`completeSale`, `salePayload`,
  `localSaleFromCart`, `recordDraft`, `addToCart`, `clearCart`, `loadProducts`, the Contacts page's
  settlement/top-up/message flows, the app shell's fullscreen-aware sidebar) reads via closure rather
  than receives as a parameter. Notably `suspendNote`/`selectedTable` thread (read by `localSaleFromCart`
  via closure) while `suspendType` doesn't (passed as a plain argument to `recordDraft(suspendType)`,
  never read via closure) - the parameter-vs-closure distinction, not just "is it used elsewhere", is
  what actually determines relocatable vs. threaded.

**The move itself, mechanically:** extracted the JSX body via `sed -n '1966,2674p' main.tsx` into a
scratch file, then reassembled `RegisterPage.tsx` as `header + that file + footer` via `cat` - the JSX
itself was never opened in an editor or retyped, only concatenated. Verified this mechanically after the
fact (the safety check `tsc` can't do): re-extracted the JSX region from the final `RegisterPage.tsx` and
diffed it against the original scratch file. Not byte-identical on the first pass - `cmp` found a
difference at character 40 of line 1, which turned out to be `main.tsx`'s file-wide CRLF line endings
(the original extraction preserved them; the new file, after two small edits via the Edit tool, had been
resaved LF-only). Stripped `\r` from both sides and re-diffed: identical. This is the concrete form of
the "identifier-set diff" safeguard discussed in the previous entry - it caught nothing wrong here, which
is itself the point: a real swapped identifier would have shown up as a genuine content diff surviving
the CRLF strip, not merely a line-ending artifact.

**Verification, matching the five-point minimum agreed before starting:**
1. Cart totals after adding 2 units of a known product (15 MAD, 20% tax) read exactly `36,00 MAD` -
   same figure the split-payment work's live check produced pre-extraction.
2. A real cash(20)+card(16) split checkout completed and persisted two `Payment` rows
   (`CASH:20, CARD:16`) - confirmed both via the rendered post-checkout page and a direct DB read.
3. The Z-report's "Ventes espèces" figure read `178,00 MAD` after the above - exactly the pre-extraction
   baseline of `158,00 MAD` (captured in the split-payment entry above) plus this run's `20 MAD` cash
   portion. This is a real before/after regression comparison against a previously-captured number, not
   a fresh guess, and it confirms the `methodLabel`/cash-attribution fix from the previous entry survived
   the extraction intact.
4. Suspend → resume round-trip: cart cleared after suspending (`Sauvegarder`), then reappeared correctly
   after `Reprendre` from the suspended-tickets list - exercises `setSuspendType`/`setSuspendNote`/
   `recordDraft`/`resumeSale`, four of the fields flagged as highest same-typed-swap risk.
5. Edit-line price-override modal: opened via the row's edit icon, overrode the unit price to 12 MAD,
   confirmed the cart row recomputed to `12,00 MAD` price / `12,00 MAD` line total (1 unit) after
   applying - exercises `editLineForm`'s three string fields plus `setCart`.
All five passed on the first run. Backend `tenant-isolation-smoke.ts` (43 assertions) still passes
after a mid-session Postgres restart (the Termux-hosted server was killed by the OS during verification -
an environment hiccup unrelated to this change, logged as `FATAL: terminating connection due to
unexpected postmaster exit`; restarted with `pg_ctl start`, backend reconnected without needing its own
restart). Both workspaces `tsc --noEmit` clean, `vite build` clean. Demo-tenant stock top-up (product 43,
"Cafe Expresso") reverted to its original `-12` afterward; the two real sales created during this and the
split-payment verification pass were left in the tenant's history, same rationale as before.

**Not done in this pass, deliberately:** no attempt to shrink `PosContextValue` further than the audit
required - every threaded field earned its place by a confirmed cross-page usage, not by convenience.
Task #26 (Z-report shift-boundary bug) remains open and is unrelated to this extraction.

## 2026-08-13 - Fixed the Z-report shift-boundary bug (task #26)

Real fix, not just a comparison-operator swap. `registerDetails.openedId` is a `CashRegisterSession.id`;
comparing a `Sale.id` against it (`s.id >= registerDetails.openedId`) never bounded anything, since the
two are unrelated auto-increment sequences. The correct boundary is a timestamp comparison, and that
needed a real fix on *both* sides, not just the comparison itself:

- `Sale.createdAtISO` already existed (added in an earlier session for the same class of problem -
  `createdAt` is a pre-formatted display string, unsafe to parse or compare).
- The session side had no equivalent. `GET /register/sessions`' existing `openedAt` field is
  deliberately truncated and space-separated for display
  (`s.openedAt.toISOString().replace('T', ' ').substring(0, 16)`) - comparing it directly against a
  real ISO string would have been a *second*, more subtle bug: since `' '` (space) sorts before `'T'`
  lexicographically, a naive string comparison between the two different formats would evaluate as
  "session opened before every sale" unconditionally, for any session on any day. Would have looked
  like a fix, produced a plausible-looking number, and been wrong in a different way. Caught by tracing
  the actual field format before writing the comparison, not by testing after the fact.

**Fix:** added a genuine full-precision `openedAtISO` field alongside the existing display `openedAt`
in `GET /register/sessions`'s response (additive, existing `openedAt` untouched) and in the frontend's
`registerDetails` state (both where it's set from `POST /register/open`'s response - which already
returns a real ISO timestamp via Prisma's default JSON serialization, so no backend change was needed
there - and where it's set from the "already open on page load" effect in `main.tsx`, reading the new
`GET /sessions` field). `RegisterPage.tsx`'s Z-report block now filters
`s.createdAtISO >= registerDetails.openedAtISO`, both real ISO 8601 strings, safe to compare
lexicographically.

**Verified live, not just by inspection - this bug specifically needed a real "before vs after" check**
since a plausible-but-wrong number is easy to miss by eye: before the fix, the demo tenant's Z-report
read `178,00 MAD` (every historical sale's cash ever recorded - see the RegisterPage extraction entry
above, where this exact figure was captured as a baseline without yet knowing it was wrong). Queried the
database directly for the actual open session's `openedAt` and computed the correct answer independently
(only sales created at or after that moment: two sales, 20 MAD cash each, in-shift correct total = 40
MAD). Reloaded the Z-report in the browser after the fix: read exactly `40,00 MAD`, with `Ventes
globales` correctly showing `72,00 MAD` (both in-shift sales' totals) rather than every sale ever made.
Confirmed the 7 sales that predate this session are now correctly excluded.

New smoke assertions (`POST /register/open` returns a parseable ISO `session.openedAt`; `GET
/register/sessions` returns a matching, full-precision, parseable `openedAtISO` containing `'T'`, not the
truncated display format) - 44 total now, full suite passes twice in a row. Both workspaces typecheck and
build clean.

## 2026-08-13 - Sale payload was silently dropping variationId and note

Investigating before starting Track C's group-pricing-in-cart work (advisor call, see PROGRESS.md), found
`salePayload()` in `main.tsx` sent only `{ productId, quantity, discount }` per cart line - never
`variationId` or `note` - even though the backend has always fully supported both: `sale.routes.ts`'s
`rawLines` computation looks up the variation, prices from `variation.salePrice` (falling back to the
base product only when no variation is given), writes `SaleItem.variationId`, and throws
`VARIATION_NOT_FOUND` on an invalid one; `note` writes straight to `SaleItem.notes`. Every variable-product
sale had therefore always been priced and recorded as the base product, silently ignoring whatever
variation was actually selected in the cart.

Distinguished from a second, superficially similar gap found in the same investigation: the "Modifier le
prix" manual price override (`line.customPrice`) has no payload field at all, and that's *correct* -
`saleSchema`'s `items` has no price field by design, since a client-supplied price on a POS endpoint would
let a compromised or modified client set its own price with no server check. Fixing that for real needs a
permission-gated server-side field (the UI already gates the override button on
`ACTION:OVERRIDE_PRICE` from Track E's permission system, but a client-side UI gate is not an
authorization boundary - the endpoint would need to re-check the permission itself). Deliberately left
unfixed and separately flagged - not folded into this pass.

**Fix:** one-line change to `salePayload()`'s `items` mapping - added `variationId: line.variation?.id`
and `note: line.note`, both fields `CartLine` already carries.

**Verified live**, since the demo tenant had zero products with any variation (`SELECT count(*) FROM
"ProductVariation"` = 0) - a temporary script created a real variation on the demo product
(`salePrice: 25.5` against the base product's `10`), logged in as the real demo admin (swapping the
password hash out and back in a `finally` block so the account's real credentials were never disturbed),
POSTed a sale with `variationId` + `note` through the actual `/api/sales` endpoint, and confirmed all
three: `SaleItem.variationId` set correctly, `unitPrice` read `25.5` (the variation's price, not the base
product's `10`), and `notes` persisted. Script and its test variation both deleted after; confirmed
`ProductVariation` count back to 0 and the admin's original password hash restored. Regression assertion
added to `tenant-isolation-smoke.ts` (45 total now), full suite passes twice in a row. Frontend typecheck
clean.

## 2026-08-13 - Group pricing resolved into the POS cart (Track C)

Built the actual resolution the previous entry's fix was a prerequisite for: a customer assigned to a
`CustomerGroup` with a linked `SellingPriceGroup` now gets that group's `ProductGroupPrice` override
applied automatically, both in the cart's displayed total and in what checkout actually charges.

**Precedence rule** (same on both sides, deliberately): a manual price override (`line.customPrice`)
always wins first; then a selected variation's own `salePrice` (`ProductGroupPrice` has no variation
dimension in the schema, so a variation's own price stands regardless of the customer's group); then the
customer's resolved group-price override for the base product; then the product's own `salePrice`.

**Shared resolver, not two implementations:** `backend/src/utils/pricing.ts`'s
`resolveCustomerGroupPrices()` is the single source of truth, called from two places - `sale.routes.ts`
at write time (so the actual charge is correct) and a new `GET /pricing/resolve/:customerId` (so the cart
can show the same number before checkout). Deliberately architected this way so the cart's displayed price
and the sale's charged price can't drift apart from each other. Returns an empty map (not an error) for a
customer with no group, or a group with no linked price group - both are valid "no override" states, not
failure states.

**Closed a real prerequisite gap along the way:** `contact.routes.ts` had no way to assign a customer to a
group at all - `customerGroupId` wasn't in `contactSchema`/`contactEditSchema`. Added it, plus
`assertCustomerGroupOwnership()` (a cross-tenant check on both `POST /contacts` and `PUT /contacts/:id`,
since `customerGroupId` is a foreign key into another tenant-scoped table and both handlers previously
spread the parsed body straight into Prisma with no check on this specific field).

**Frontend:** new `linePrice(line, groupPrices)` helper is now the single place cart/checkout math reads a
line's price from, replacing several duplicated inline expressions (`cartSubtotal`/`cartTax`,
`updateLineDiscount`'s discount cap, `localSaleFromCart`). A new `groupPrices` state, refetched via
`GET /pricing/resolve/:customerId` whenever the selected customer changes, backs it. Contacts page gained
a group-assignment dropdown per customer row (`updateContactGroup()`), populated from a new
`GET /pricing/customer-groups` fetch.

**Self-caught bug before shipping:** the edit-line-price modal's `basePrice` (used to detect whether a
cashier's typed price differs from the "true" underlying price, to decide whether to set/clear
`line.customPrice`) was initially wired to the same `linePrice()` helper as everywhere else - wrong here
specifically, since `linePrice()` itself reads `line.customPrice` first, which would make an existing
override impossible to ever clear (typing the real price back in would still compare unequal against the
stale override `linePrice()` was itself reading). Caught in self-review before running anything; reverted
to a hand-written expression that deliberately excludes `customPrice`.

**Test-authoring bugs caught by the existing suite's own assertions failing on re-run** (both fixed, both
were bugs in the new test code, not the product): (1) the "variation beats group price" assertion
initially added a `ProductVariation` to the shared `a.product` fixture, which silently created a second
`ProductStock` row (compound-unique on `[productId, warehouseId, variationId]`) and broke an unrelated,
later stock assertion further down the same script run that queried without a `variationId` filter -
fixed by using a dedicated throwaway product instead of the shared fixture. (2) the group-pricing block
assigned `a.contact` to the test `CustomerGroup` and never reverted it, so every later block reusing
`a.contact` as the customer on an `a.product` sale (the split-payment tests) silently repriced from the
base `salePrice` (10) to the group override (7), corrupting their ledger-DEBIT assertions - fixed with an
explicit revert (`customerGroupId: null`) at the end of the block, with a comment explaining the general
rule: any state change to a shared tenant fixture must be reverted before later blocks reuse it, or a
dedicated throwaway fixture must be used instead.

**Verified live end-to-end through the actual rendered UI**, not just the API - seeded a real
`SellingPriceGroup`/`CustomerGroup`/`ProductGroupPrice` (group price 9.50 vs. the demo product's base
15.00) directly against the demo tenant (companyId 45), then drove a real headless-Chromium session
through the actual app: assigned Ahmed Hanout to the group via the new Contacts dropdown, selected him as
the cart customer in POS, added the group-priced product, and confirmed the cart line read 9,50 MAD (not
15,00 MAD), with the TVA and total computed correctly off that price. Screenshots captured at each step.
All test fixtures and the customer's group assignment reverted afterward; confirmed zero orphaned rows.
Note for future sessions: mid-verification, Postgres, the backend, and the Vite dev server were all found
to have been silently killed (matching this environment's documented "Termux OS can kill background
processes" risk) - all three needed a manual restart before the browser run could succeed; not caused by
this change.

Two new assertion blocks added (variationId/note + group pricing); `tenant-isolation-smoke.ts` now carries
200 `assert()` calls across 38 named coverage areas, full suite passes twice in a row. Both workspaces
typecheck and build clean.
