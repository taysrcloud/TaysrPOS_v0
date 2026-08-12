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

## 2026-07-16 - Restaurant module access contract

- Previous risk: the frontend expected planLimits.modules as a string array, while Platform may store modules as an object. The settings API also accepted restaurantEnabled without checking entitlement.
- Fix: normalize module arrays/objects in login and auth middleware, derive effective Restaurant visibility from entitlement plus tenant activation, protect /api/restaurant with requireModule, and reject unauthorized activation in PUT /api/settings.
- Product rule: Super Admin grants RESTAURANT; an entitled tenant Admin/Manager may enable or disable it for their workspace. Non-entitled users never see the option.
