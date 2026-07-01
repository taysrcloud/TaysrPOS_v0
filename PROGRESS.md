# TaysrPOS v0 - Development Roadmap And Progress

This file tracks the real current state of the rebuild, the source inspiration, what is already implemented, and the next targeted steps.

## Source Inspiration

The main workflow inspiration for this rebuild is the legacy `TaysrPOS` app, which itself is based on `UltimatePOS`.

This v0 app is not a direct port. It keeps the useful business flows from that source while rebuilding them in the Taysr suite stack:

- TypeScript backend
- React frontend
- Prisma
- PostgreSQL
- Platform-provisioned tenants
- Shared Super Admin control plane

## Completed Improvements

### Phase A: Foundation And Login UI
- [x] Restyled the `TaysrPOS_v0` login page around the newer Taysr shell direction.
- [x] Added Quick PIN unlock flow for fast cashier switching.
- [x] Moved the login request to the new `login` payload instead of old username-only submission.

### Phase B: Super Admin Bridge And Tenant Provisioning
- [x] Wired `TaysrPOS_v0` into the platform as a real `POS` product-type tenant.
- [x] Added `POST /api/platform/provision-tenant` in the POS backend.
- [x] Synced platform account data into POS company records, including Moroccan company fields and enabled modules.
- [x] Synced first tenant admin creation from Super Admin into POS.
- [x] Fixed the POS provisioning secret mismatch so POS tenant sync no longer fails silently.
- [x] Updated Super Admin backend responses so tenant sync failure is surfaced instead of hidden.
- [x] Validated one full backend flow end to end:
  - create POS account in Super Admin
  - provision tenant into POS
  - seed tenant admin user
  - log into POS successfully

### Phase C: Super Admin UI Feedback For POS Tenants
- [x] Added a post-create success panel in Super Admin Accounts.
- [x] Show resolved tenant login data after account creation:
  - account code
  - admin username
  - admin email
  - temporary password
  - tenant sync state
- [x] Added quick copy actions for both email login and username login.
- [x] Added direct jump from the success panel to the created account details page.

### Phase D: POS Login And Multi-Tenant Access
- [x] Updated POS backend login to support email or username.
- [x] Added tenant-aware login resolution with optional `accountId`.
- [x] Added 409 account-selection flow when the same login exists in multiple tenants.
- [x] Added POS frontend UI for choosing the correct account after a multi-tenant conflict.

### Phase E: Product, Inventory, Facture, Register, Hardware Foundations
- [x] Structured product variations support.
- [x] Consolidated facture generation from multiple tickets.
- [x] Advanced stock, purchase, warehouse, and adjustment foundations.
- [x] Z-report, multi-register, and cash movement foundations.
- [x] Barcode / printer / drawer integration foundations.

## Verified In This Round

- [x] Platform frontend TypeScript check passed.
- [x] POS frontend TypeScript check passed.
- [x] Progress file refreshed to reflect the real current state.
- [x] Live register check confirmed the POS "always open" state came from a genuinely open cash session in demo tenant data, not only from frontend selection bugs.
- [x] Closed the lingering demo open session through the repaired register API to validate the closed-state path again.
- [x] Improved sales table actions so paid sales expose Ticket + Facture and draft-like sales expose Details + Reprendre directly from list views.
- [x] Added direct credit-settlement actions from sales and payments lists with remaining-due visibility and a sale-level encaissement modal.
- [x] Sorted the payments queue so open credits surface first and exposed quick outstanding-credit stats in the toolbar.
- [x] Added a dedicated dashboard period filter so KPI cards, chart, credit queue, and recent sales react to today / week / month / year views.
- [x] Added client-side facture shortcuts from the Clients portfolio, with automatic ticket-based invoicing when eligible tickets exist and fallback to Facture libre otherwise.
- [x] Client portfolio now shows open credit and invoiceable-ticket hints directly in each customer row for faster follow-up.
- [x] Added selection-based invoice creation directly from the sales history table, with same-customer guardrails before opening the shared ticket-invoice modal.
- [x] Added facture status management directly from the invoice list with tenant-side labels for brouillon, validee, partiellement payee, payee, and annulee.
- [x] Added payment recording against factures themselves, including remaining-due checks and lightweight payment history stored in invoice metadata.
- [x] Reworked invoice settings in `Parametres` into a cleaner facture control card with clearer defaults for grouped vs detailed tickets and ticket-reference visibility.
- [x] Added facture export/share actions so accountants can open, print, export, or share a facture summary directly from the invoice workspace.
- [x] Added a product-assisted fast path in `Facture libre` so choosing a known catalogue item can prefill description, sale price, and TVA.
- [x] Replaced new manual-facture storage with a proper `InvoiceLine` Prisma model path, while keeping a legacy metadata fallback so older factures still render.
- [x] Added a clearer POS workflow strip so customer, scan/search, draft/devis/suspend, remise, and encaissement actions stay visible together for cashiers.
- [x] Reworked the recent-transactions workspace so suspended tickets, drafts, devis, and finalized tickets are easier to scan, reopen, and settle from one modal.
- [x] Aligned the Docker-served POS runtime so the image can serve the built frontend and API from the same local port.
- [x] Added Docker runtime bootstrapping for Prisma and container-safe POS DB wiring so local image startup is closer to one-command.
- [x] Verified the local POS API health endpoint and seeded admin login against PostgreSQL.
- [x] Verified the auth API returns `restaurantEnabled: false` for the retail demo tenant after backend restart.
- [x] Verified backend and frontend TypeScript checks pass together with `npm run typecheck`.
- [x] Verified the production frontend build completes with Vite 8.
- [ ] Repeat the final rendered Products/sidebar pass after the browser-control connection is available; the earlier rendered pass exposed the Restaurant visibility regression, and the corrected API contract is verified.
- [x] Local backend and frontend typechecks now run successfully again after dependency cleanup.

### Phase H: Product Management And Tenant Module Guardrails
- [x] Replaced the hard-coded POS frontend API address with same-origin production routing and a local port `4400` fallback.
- [x] Added tenant-scoped product editing for Admin and Manager roles.
- [x] Product edits now update catalogue fields, prices, TVA, photo, SKU/barcode, and base stock without crossing company boundaries.
- [x] Base-stock edits create explicit `MODIFICATION-PRODUIT` stock movements.
- [x] Added EAN-13-style barcode generation and kept automatic/manual SKU behavior.
- [x] Added safe product duplication with cleared barcode and opening stock.
- [x] Replaced placeholder product-list controls with working Sell, Edit, Duplicate, and Open Stock actions.
- [x] Added product-list summaries for references, low-stock alerts, and purchase stock value.
- [x] Removed the duplicated product search/filter toolbar and added a proper empty state.
- [x] Fixed standalone login against the current `passwordHash` Prisma contract.
- [x] Stopped hard-coding Restaurant as active: login now carries the tenant company setting, and retail tenants receive only the POS module.
- [x] PIN unlock preserves the authenticated tenant module set.
### Phase F: POS Layout Swap
- [x] Swapped POS layout to Products left, Cart right (matching UltimatePOS).
- [x] Moved search bar and category tabs into the products panel.
- [x] Moved customer picker into the cart panel header.
- [x] Updated CSS grid columns for the new layout proportions.

### Phase G: Docker-Only Dependencies + Super Admin Optic Fix
- [x] Deleted all local `node_modules` folders (~2GB) across all apps and platform.
- [x] Dependencies now live inside Docker images only (`npm ci` in Dockerfiles).
- [x] Created root `.gitignore` for TaysrSuite.
- [x] Fixed Super Admin account creation for OPTIC: auto-provisions tenant database + syncs admin user on account creation.
- [x] Added INVOICE schema path support in `provisionTenantDatabase`.
- [x] Added INVOICE-specific seeding branch with Company (platformAccountId) and User (OWNER role).
- [x] INVOICE accounts correctly use shared database (no per-tenant DB creation).

## Important Current Notes

- `apps/TaysrPOS` remains the legacy reference/source of workflow inspiration.
- `apps/TaysrPOS_v0` is the active rebuild intended to replace it from the platform side.
- Restaurant remains an optional module, not the base experience for every tenant.
- Super Admin controls products, plans, limits, and module enablement. Those platform controls should not leak as confusing tenant-facing settings.

## Next Targeted Steps

These are the next best tasks to take in parallel if needed.

### 1. Browser Validation Pass
- [ ] Create a fresh POS tenant from the Super Admin UI.
- [ ] Validate the Docker image locally end to end on the unified POS port after rebuild.
- [ ] Confirm the success panel shows the resolved credentials and sync status correctly.
- [ ] Log into POS from the real frontend using the generated tenant login.
- [ ] Run Prisma generate/migrate for the new `InvoiceLine` model in the runtime, then validate both legacy and new manual factures render correctly.
- [ ] Trigger the multi-account selector with a duplicated login and verify the correct tenant opens.
- [ ] Validate the sidebar for Admin, Manager, and Cashier after login.

### 2. Super Admin -> POS Product Bridge
- [ ] Recheck product-type account creation specifically against `TaysrPOS_v0` instead of legacy POS.
- [ ] Confirm full tenant fields sync correctly into POS company settings:
  - company name
  - email
  - phone
  - address
  - ICE / IF / RC / Patente
  - logo
  - enabled modules
- [ ] Add clearer sync-state and error-state reporting on account details.
- [ ] Add manual reprovision / resync actions with visible result feedback.
- [ ] Confirm reset-password from Super Admin updates the POS tenant user correctly.

### 3. Factures / Invoices Hardening
- [x] Restore `Factures` in the permissions label map so the sidebar can show it again.
- [x] Add facture settings for ticket display mode:
  - summary tickets
  - detailed tickets
  - show / hide ticket references
  - show / hide ticket dates
- [x] Add `Facture libre` creation without starting from POS tickets.
- [x] Update facture viewer so manual factures and grouped ticket factures both render correctly.
- [x] Add a cleaner facture settings card in `Parametres` instead of burying options in generic template text.
- [x] Add manual facture line editing with product autocomplete as an optional fast path.
- [x] Add ability to create a facture directly from customer/account page, not only from POS tickets.
- [x] Add ability to create a facture directly from sales history selected rows.
- [x] Add status on factures:
  - brouillon
  - validee
  - partiellement payee
  - payee
  - annulee
- [x] Add payment recording against factures themselves.
- [x] Add PDF/download/share flow for factures.
- [x] Replace JSON-in-notes manual facture storage with a proper invoice-lines model in Prisma.

### 4. POS / Caisse Workflow Properly Rebuilt
- [ ] Rework the main POS page to feel closer to UltimatePOS workflow but with cleaner Taysr UI.
- [x] Add stronger top action flow for:
  - customer selection
  - fast product search
  - barcode scan
  - quantity / discount / override actions
  - suspend / draft / quote / finalize
- [ ] Finish live browser validation of split payment, credit sale, and partial payment flows.
- [x] Improve recent transactions drawer and recovery of suspended carts.
- [ ] Add richer resume actions from recent sales, including quote -> sale and suspend -> finalize shortcuts directly in the side panel.
- [ ] Add stronger cashier-oriented keyboard flow.
- [ ] Add optional direct facture issue after finalizing a sale.

### 5. Products Phase - UltimatePOS Inspired But Cleaner
- [ ] Finish fast product creation for retail users with fewer noisy fields up front.
- [ ] Add product image upload and product gallery polish.
- [x] Add barcode / SKU generation helpers.
- [x] Tighten category / brand / unit / TVA / opening stock UX.
- [x] Add purchase price, sale price, margin hints, and stock opening quantity in one compact flow.
- [ ] Add variable products / declinaisons pass with cleaner editing UX.
- [ ] Finish product list modernization with bulk actions and column visibility; row actions, filters, summaries, and empty state are complete.
- [x] Add low-stock visibility, stock value, and movement shortcuts from the product list.

### 6. Sales, Quotes, And After-Sale Workflow
- [ ] Recheck suspend / draft / quotation / final sale paths.
- [ ] Allow converting quote -> sale and quote -> facture cleanly.
- [ ] Improve sales list details modal, edit-sale flow, and finalize the remaining payment modal flow polish.
- [ ] Add return sale flow and credit-note groundwork.
- [ ] Link receipt / sale / facture more clearly from each detail panel.
- [ ] Add customer purchase history shortcut from each sale.

### 7. Contacts, Credit, And Portfolio View
- [ ] Split customers and suppliers more clearly in the UI.
- [ ] Add customer dossier with:
  - balance
  - store credit
  - open factures
  - latest tickets
  - last payment
- [x] Connect contact-level credit follow-up with specific unpaid sales and facture references at a lightweight UI level from the client portfolio.
- [ ] Add supplier ledger and purchase history shortcuts.

### 8. Stock, Purchases, And Warehouse Operations
- [ ] Recheck purchase order -> receive stock flow.
- [ ] Add better supplier purchase creation UX.
- [ ] Improve stock adjustment reasons and history readability.
- [ ] Add transfer between locations with clearer source/destination states.
- [ ] Add inventory count / reconciliation workflow.
- [ ] Recheck warehouse pages against Moroccan retail workflow, not restaurant-first assumptions.

### 9. Registers, Hardware, And Store Ops
- [ ] Recheck register opening / closing / Z report flow live.
- [ ] Add clearer denomination counting UX.
- [ ] Add cash in / cash out history and notes per session.
- [ ] Recheck ESC/POS receipt printing and drawer opening on supported environments.
- [ ] Add hardware settings grouping so printer/scanner/cash drawer config is easier to understand.

### 10. Restaurant As Optional Module Only
- [x] Keep restaurant hidden unless enabled by Super Admin.
- [ ] Recheck table screen, kitchen queue, and waiter flow only for enabled tenants.
- [ ] Make sure retail tenants never see restaurant noise in the default shell.
- [ ] Keep restaurant permissions separate from base retail users.

### 11. Roles And Permissions Pass
- [ ] Recheck Admin / Manager / Cashier / Waiter role restrictions on live screens.
- [ ] Hide disallowed actions instead of only failing on submit.
- [ ] Confirm `Factures`, `Rapports`, `Caisses`, price override, and settings restrictions behave as expected.
- [ ] Plan future user model extension for product-scoped modules coming from platform policies.

### 12. UI System Alignment With TaysrOptic
- [ ] Keep using TaysrOptic as the main visual benchmark for spacing, font sizing, sidebar behavior, and panel density.
- [ ] Remove remaining oversized controls or legacy-looking toolbars.
- [ ] Align empty states, modals, table toolbars, and action buttons with the newer suite shell.
- [ ] Audit page-by-page consistency once products, POS, and sales flows are stable.

### 13. Technical Cleanup
- [x] Fixed the backend syntax break in `backend/src/routes/sale.routes.ts` so the POS API boots again.
- [x] Add backend typecheck to the normal working loop after sale routes are repaired.
- [ ] Add a short test note for POS in docs / README pointing to shared testing guidance.
- [ ] Continue updating this file at the end of each meaningful phase with what was coded and what was truly verified.

## Working Rule For Future Updates

Each time a meaningful block is finished:

1. Add it to the matching completed phase here.
2. Mark what was verified, not only what was coded.
3. Move the next best items into the targeted steps section so another worker can pick them up immediately.









## Next Focus After This Phase

- Rework the fast-create product modal again around the most common retail fields first, then move the slower/optional fields behind a lighter advanced section.
- Add product image/gallery polish in both product list and POS sell surface so catalogue photos become genuinely useful, not only stored.
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

Next targeted steps from here:
- Rework the fast-create product modal around the most common retail fields first, with slower options tucked behind a lighter advanced section.
- Add product image/gallery polish in both catalogue and POS selling surfaces.
- Do a live browser pass on the refreshed product flow: edit a variable product, bulk deactivate products, and confirm inactive products cannot be sold.

### 2026-06-30 Fast Product Create Pass
- [x] Product creation now starts with a retail-first quick surface: name, sale price, TVA, stock, category, barcode, and SKU.
- [x] Slower catalogue fields now sit behind an advanced section instead of crowding the default flow.
- [x] New-product opening now defaults to the lighter create view, while product editing opens with advanced settings visible.
- [x] Variable-product editing remains available inside the same modal after the fast-create cleanup.

### 2026-06-30 Product Image + Catalogue Polish Pass
- [x] Product advanced settings now explain where product photos are used and allow removing the current image without resetting the rest of the form.
- [x] Product side preview now gives a clearer catalogue / POS readiness summary instead of only showing a raw image block.
- [x] POS product cards now show cleaner category/photo chips so catalogue images are useful during selling, not just stored in the record.
- [x] Product list rows now expose photo state and faster visual badges directly in the main cell, with a photo count added to the toolbar summary.
- [x] Verified with `npm run typecheck`.
- [x] Verified with `npm run build --workspace frontend`.

Next targeted steps from here:
- Do the live browser pass on the refreshed product flow: upload/edit photos, edit a variable product, bulk deactivate products, and confirm inactive products cannot be sold from POS.
- Recheck whether product photos should appear on detailed invoices / printable sales documents, not only catalogue surfaces.
- Move to the stock workflow pass after the live product validation, especially opening quantity, stock movements, and inventory count UX.

### 2026-06-30 Variable Sale Flow Hardening Pass
- [x] POS cart add flow now blocks inactive products and inactive declinaisons with explicit status feedback instead of relying only on button state.
- [x] POS sale payload now sends `variationId` and line notes, so variable products travel correctly from the cart into saved sales.
- [x] Backend sale creation now validates active declinaisons, prices variable lines from the selected variation, and decrements stock on the matching variation stock row.
- [x] Normalized sale lines now carry product image and note data, which lets A4 invoice views render richer line detail from the same sale source.
- [x] Detailed invoice views now show product thumbnails and line notes when available instead of flattening every line to plain text only.
- [x] Verified with `npm run typecheck`.
- [x] Verified with `npm run build --workspace frontend`.

Next targeted steps from here:
- Do the live browser pass on the product and POS flow: create/edit a variable product, sell one active declinaison, confirm an inactive declinaison is blocked, and verify the resulting invoice view.
- Recheck stock movement visibility in the stock pages for variation-based sales so accountants can actually see which declinaison moved.
- After the live validation, move into the stock workflow pass itself: opening quantity adjustments, inventory count, and reconciliation UX.

### 2026-06-30 Stock Movement Visibility Pass
- [x] Stock page now loads real inventory movements from the API instead of showing only the local manual-adjustment placeholder list.
- [x] Inventory movement API now supports location scoping and returns a cleaner mapped payload with product, depot, reference, note, and variation hint fields.
- [x] Stock history view now reads as a movement ledger: date, type, product, quantity, depot, and reference/note instead of a vague adjustments-only table.
- [x] Variation-based POS sales now surface their declinaison hint in stock history when that information is available from movement notes.
- [x] Manual stock adjustments now reload movement history immediately after save so the stock page stays trustworthy.
- [x] Verified with `npm run typecheck`.
- [x] Verified with `npm run build --workspace frontend`.

Next targeted steps from here:
- Do the live browser pass on product + POS + stock together: sell a declinaison, open stock history, and confirm the movement row is understandable for a real operator.
- Strengthen the stock workspace itself after that validation: variation-aware inventory count, opening quantity corrections, and clearer reconciliation actions.
- Revisit transfer workflow so inter-depot moves read as a complete two-sided story in the ledger, not just raw technical rows.

### 2026-07-01 Register Gate + POS Layout Stabilization Pass
- [x] Pulled the latest upstream edits into `TaysrOptic` and `TaysrInvoice` before continuing local POS work, so the workspace is back in sync with GitHub where those repos were behind.
- [x] Fixed the register-session selection bug in POS: the frontend no longer treats any company-open session as the current cashier session, and the register sessions API now returns `userId` so the UI can scope correctly.
- [x] Verified the closed-register path live: after closing the active admin session, opening POS now lands on the `Caisse fermee` prompt instead of dropping straight into the selling screen.
- [x] Reworked the POS workspace sizing so the screen behaves like a bounded application surface: command bar, workflow cards, product grid, cart, totals, and footer actions now stay inside the viewport instead of pushing the bottom actions out of sight.
- [x] Fixed the POS panel grid definitions so both product-side and cart-side sections line up with their actual children instead of creating implicit rows that made the layout drift.
- [x] Removed the phantom two-column wrapper from the POS search rows, which was causing the search field and quick-add button to stretch and misalign.
- [x] Tightened workflow-card density and footer wrapping so the POS surface reads closer to the newer Taysr shell instead of oversized legacy blocks.
- [x] Corrected the visible POS shell branding from `ERP` to `POS` in the tenant sidebar to stop the cross-app branding bleed noted in `MAP.md`.
- [x] Normalized the most visible register-screen mojibake strings to ASCII-safe French so the closed-register modal no longer shows broken accented text.
- [x] Verified with `npm run typecheck`.
- [x] Verified with `npm run build --workspace frontend`.
- [x] Verified in the in-app browser on `http://127.0.0.1:5400` with the local backend on `http://127.0.0.1:4400`.

Next targeted steps from here:
- Reopen a fresh register session and do one more live POS pass with real products in cart, so we validate the stabilized layout under a non-empty sale.
- Remove remaining restaurant leakage from the retail demo tenant shell and sidebar when `restaurantEnabled` is false, because the live local admin still exposes table and cuisine controls.
- Continue with the next MAP-aligned POS cleanup: split the giant register surface into smaller components so register logic, workflow cards, and footer actions can evolve without destabilizing each other.

### 2026-07-01 POS Encoding Recovery Pass
- repaired app-wide mojibake in `frontend/src/main.tsx` using a controlled cp1252-to-utf8 recovery pass instead of manual one-off label edits
- fixed the one JSX placeholder line that broke during recovery (`scalePrefix` example input)
- cleaned the last surviving kitchen-note artifact in the kitchen board view
- re-ran `npm run typecheck` and `npm run build --workspace frontend` successfully after the recovery
- live-checked the running app shell and dashboard text in browser; broken `?...` style strings are no longer present in the rendered snapshot
- next targeted step: do a UI wording pass to restore proper French accents consistently where we intentionally kept temporary ASCII-safe labels during earlier stabilization
