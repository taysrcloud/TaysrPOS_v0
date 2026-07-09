# TaysrPOS Refactoring & Integration Progress

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
- [x] Extracted \SettingsPage\, \RestaurantTablesPage\, and \ExpensesPage\ into separate components to reduce \main.tsx\ complexity.
- [x] Extracted reusable \PageHeader\ component for standardizing view headers.
- [x] Cleaned up obsolete rendering functions and duplicate logic from \main.tsx\.
- [x] Fixed all TypeScript definitions, import inconsistencies, and strict-mode implicit `any` errors across newly extracted files.
- [x] Verified full build integrity with `npm run build` yielding zero errors.

### 2026-07-09 UX and Session Bug Fixes
- [x] Refactored `loadSessions` in `main.tsx` to remove the date check, allowing users to safely resume and close previous day's open sessions without being locked out.
- [x] Refactored the mobile sidebar into a fully responsive off-canvas drawer with a hamburger menu trigger, matching `TaysrOptic` and `TaysrPlatform`.
- [x] Fixed an exported type issue (`Contact`, `Product`, etc.) during the modularization phase to ensure the Vite build remains stable.
