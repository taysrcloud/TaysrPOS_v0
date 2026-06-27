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
- [ ] Confirm the success panel shows the resolved credentials and sync status correctly.
- [ ] Log into POS from the real frontend using the generated tenant login.
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
- [ ] Add a cleaner facture settings card in `Parametres` instead of burying options in generic template text.
- [ ] Add manual facture line editing with product autocomplete as an optional fast path.
- [ ] Add ability to create a facture directly from customer/account page, not only from POS tickets.
- [ ] Add ability to create a facture directly from sales history selected rows.
- [ ] Add status on factures:
  - brouillon
  - validee
  - partiellement payee
  - payee
  - annulee
- [ ] Add payment recording against factures themselves.
- [ ] Add PDF/download/share flow for factures.
- [ ] Replace JSON-in-notes manual facture storage with a proper invoice-lines model in Prisma.

### 4. POS / Caisse Workflow Properly Rebuilt
- [ ] Rework the main POS page to feel closer to UltimatePOS workflow but with cleaner Taysr UI.
- [ ] Add stronger top action flow for:
  - customer selection
  - fast product search
  - barcode scan
  - quantity / discount / override actions
  - suspend / draft / quote / finalize
- [ ] Finish live browser validation of split payment, credit sale, and partial payment flows.
- [ ] Improve recent transactions drawer and recovery of suspended carts.
- [ ] Add stronger cashier-oriented keyboard flow.
- [ ] Add optional direct facture issue after finalizing a sale.

### 5. Products Phase - UltimatePOS Inspired But Cleaner
- [ ] Finish fast product creation for retail users with fewer noisy fields up front.
- [ ] Add product image upload and product gallery polish.
- [ ] Add barcode / SKU generation helpers.
- [ ] Tighten category / brand / unit / TVA / opening stock UX.
- [ ] Add purchase price, sale price, margin hints, and stock opening quantity in one compact flow.
- [ ] Add variable products / declinaisons pass with cleaner editing UX.
- [ ] Modernize the product list actions, filters, bulk actions, and column controls.
- [ ] Add low-stock visibility, stock value, and movement shortcuts from the product list.

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
- [ ] Connect contact-level credit follow-up with specific unpaid sales and facture references.
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
- [ ] Keep restaurant hidden unless enabled by Super Admin.
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
- [ ] Add backend typecheck to the normal working loop after sale routes are repaired.
- [ ] Add a short test note for POS in docs / README pointing to shared testing guidance.
- [ ] Continue updating this file at the end of each meaningful phase with what was coded and what was truly verified.

## Working Rule For Future Updates

Each time a meaningful block is finished:

1. Add it to the matching completed phase here.
2. Mark what was verified, not only what was coded.
3. Move the next best items into the targeted steps section so another worker can pick them up immediately.



