# Taysr ERP v1 Blueprint

This app is a clean generic ERP and POS platform (Taysr ERP v1), built as a modern TypeScript/React/Postgres application.

The app follows the Taysr suite architecture:

- TypeScript backend
- React frontend
- Prisma
- PostgreSQL
- Platform-provisioned tenants
- Product-specific roles and feature flags
- Shared Taysr shell/branding patterns

## Why Rebuild

This codebase is a clean generic ERP fork (TaysrPOS_v1) derived from TaysrPOS_v0. All restaurant-specific logic (tables, kitchen display, waiters, modifiers) has been removed to produce a streamlined, generic ERP & POS platform for retail, wholesale, and services.

## Market And Product Signals

Research notes from Moroccan/French POS & ERP patterns:

- POS systems need fast touch-friendly checkout, barcode scanner support, receipt printer support, cash drawer workflows, and split/multiple payment modes.
- Modern omnichannel POS and ERP products emphasize unified stock, customer loyalty/clienteling, purchase/procurement, reporting, offline mode, and API-first integrations.
- Moroccan company identity must support ICE and related fiscal identifiers. ICE is a unique 15-digit Moroccan company identifier.

Compliance note: fiscal and invoicing rules should be validated against official Moroccan tax sources before production launch.

## Core ERP Modules

### Core Retail POS

- Fast product search by name, SKU, barcode.
- Touch product/category grid.
- Walk-in customer plus saved customer accounts.
- Cart with quantity, discount, tax, note.
- Suspend/resume sale.
- Draft, quotation/proforma, final sale.
- Cash, card, cheque, bank transfer, customer credit, mixed payment.
- Receipt/ticket print.
- Sales list with returns and payment follow-up.

### Inventory

- Products, categories, brands, units.
- Base retail products, services, bundles, and stock items.
- Purchase cost, sale price, TVA rate.
- Multi-warehouse support.
- Stock movements: purchase in, sale out, transfer, adjustment, return.
- Low-stock alerts.
- Product stock history.

### Contacts

- Customers.
- Suppliers.
- Contact balance and credit limit.
- ICE/IF fields for B2B customers.
- Ledger/history later.

### Cash Register

- Open register session.
- Opening cash.
- Cash in/out adjustments.
- Expected cash, counted cash, difference.
- Close register.
- Per cashier/day summary.

### Reports

- Daily sales.
- Sales by cashier.
- Sales by product/category.
- Restaurant sales by table/waiter.
- Payment method summary.
- Stock alerts.
- Profit approximation using purchase price.

## Modules To Leave Out Of v0

> **Superseded 2026-08-12:** this section's exclusions are overridden by a full-ERP-parity migration
> decision. Every module listed below is now in scope — see
> `/data/data/com.termux/files/home/.claude/plans/jolly-percolating-robin.md` and the matching
> 2026-08-12 entry in `TRACE.md` for the plan and rationale. Left in place, not deleted, so the
> original curated-scope reasoning stays visible.

These are not deleted forever, but they should not enter the first clean build:

- Old installer/update routes.
- Old public register page.
- AdminLTE/DataTables UI patterns.
- Heavy third-party payment gateway set.
- Country-specific modules unrelated to Morocco.
- Complex recurring/subscription invoices.
- Loyalty/reward points.
- Full accounting chart of accounts.
- Manufacturing/recipe costing beyond simple restaurant ingredients.
- Bookings/reservations.
- Advanced kitchen display hardware integration.

## Moroccan Defaults

Company setup should include:

- Company name, legal name, logo.
- Phone, email, address, city.
- ICE, IF, RC, Patente, CNSS.
- Currency fixed to MAD by default.
- TVA default rate 20%.
- Receipt footer and fiscal display toggles.

Product and sale display should format MAD consistently and keep code `MAD`. Display symbol can be configured later as `MAD`, `DH`, or `Dhs`.

## Roles

Initial roles:

- ADMIN: full tenant control.
- MANAGER: daily operations, reports, inventory, users except owner-level settings.
- CASHIER: POS sale, payments, own register.
- WAITER: restaurant floor orders, tables, assigned orders.
- KITCHEN: kitchen queue/status only.
- USER: general staff role for products, customers, stock tasks, or restricted back-office work.

Super Admin remains in the Platform app and provisions POS tenants/users/plans. Tenant users belong to a POS company, so usernames/emails should be unique per company, not globally.

## v0 Data Model

The first Prisma schema in `backend/prisma/schema.prisma` includes:

- Company
- User
- Location
- Contact
- Category
- Brand
- Unit
- Product
- Warehouse
- ProductStock
- StockMovement
- RestaurantArea
- RestaurantTable
- ModifierGroup
- ModifierOption
- Sale
- SaleItem
- SaleItemModifier
- Payment
- Purchase
- PurchaseItem
- CashRegisterSession

Important design choice: the base POS + ERP module owns `Sale`, `SaleItem`, `Payment`, products, stock, customers, purchases, and reports. Restaurant is activated per tenant and extends the same sale model through `Sale.channel`, `Sale.tableId`, `Sale.waiterId`, and item kitchen status, without forcing restaurant UI on retail tenants.

## MVP Screen Map

### Tenant App

- Login
- Dashboard
- POS register
- Restaurant floor, only when Restaurant is active
- Kitchen queue, only when Restaurant is active
- Products
- Stock
- Customers and suppliers
- Purchases
- Sales
- Cash register
- Reports
- Settings
- Users

### Super Admin Integration

- Create/edit POS account.
- Save full company data, including logo and Moroccan identifiers.
- Assign plan and limits.
- Create tenant users with POS roles.
- Provision POS v0 database/company.
- Open tenant health/check page.

## UX Direction

The new POS should feel closer to Invoice/Optic, but denser where checkout needs speed. It must be French-first, Arabic-second, and much simpler than UltimatePOS for daily users.

Principles:

- Fixed Taysr sidebar and compact topbar.
- Checkout is a tool, not a landing page.
- Inputs should be calm and predictable, with no oversized legacy styling.
- Product search and cart should never fight for space.
- Restaurant floor should be hidden unless the Restaurant module is active; when active, it should be visual but not decorative: table status, order age, waiter, amount.
- Kitchen queue should be hidden unless Restaurant is active; when active, it should be big, readable, and touch-friendly.
- Tables/lists should use modern filters, compact actions, and clear empty states.

## Migration Strategy

Do not migrate by copying Blade/PHP code.

Recommended path:

1. Freeze the old POS feature map.
2. Build v0 schema and API.
3. Build MVP screens with seed data.
4. Add platform provisioning.
5. Build import scripts from old MySQL tables into Postgres:
   - businesses -> Company
   - users -> User
   - contacts -> Contact
   - products/variations -> Product
   - business_locations -> Location
   - transactions -> Sale/Purchase
   - transaction_sell_lines -> SaleItem
   - transaction_payments -> Payment
   - cash_registers -> CashRegisterSession
   - res_tables -> RestaurantTable
   - modifiers -> ModifierGroup/ModifierOption
6. Compare totals and stock movement summaries before switching tenants.

## First Build Order

1. Auth and tenant company settings.
2. Product/category/unit/brand CRUD for POS + ERP retail.
3. Basic stock movements.
4. Retail POS register with cart and payment.
5. Cash register open/close.
6. Sales list and receipts.
7. Reports and platform provisioning for POS v0.
8. Restaurant module activation.
9. Restaurant areas/tables.
10. Restaurant order flow and kitchen queue.


## Product Creation Rule

The default add-product page must be fast and retail-first: name, sale price, category, barcode/SKU, optional initial stock, and save. Purchase price, supplier, warehouses, expiry, modifiers, kitchen routing, and recipe fields belong in advanced sections or dedicated Restaurant module product mode.

## Settings Rule

Settings must be split into business profile, receipt/invoice, caisse, stock, restaurant, users/roles, and advanced. Do not reproduce the UltimatePOS settings wall.



