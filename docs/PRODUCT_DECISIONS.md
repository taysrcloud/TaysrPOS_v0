# TaysrPOS v0 Product Decisions

TaysrPOS v0 should use UltimatePOS as a workflow reference, not as a UX or architecture template.

The target user is first a Moroccan retail business owner, cashier, or stock user. Restaurant workers are supported only when the Restaurant module is activated. The app must feel obvious in French first, with Arabic second. If a feature cannot be understood quickly by a normal shop or restaurant team, it should be simplified, hidden behind an advanced toggle, or left out of v0.

## Language Direction

- Primary language: French.
- Secondary language: Arabic.
- English is acceptable only in code, internal identifiers, and developer docs.
- Tenant UI labels, buttons, empty states, errors, and reports should ship in French first.
- Arabic should be planned with RTL-safe layout from the start, but it does not block the French MVP.

## Roles

Keep roles practical:

- ADMIN: account owner or manager. Can configure company, users, products, stock, reports, active modules, and register sessions.
- CASHIER: sells, takes payments, opens/closes own register, sees limited sales history.
- USER: general staff role for products, customers, stock tasks, or restricted back-office work.
- WAITER: restaurant floor, tables, orders, assigned service.
- KITCHEN: kitchen queue only: received, preparing, ready, served.

Avoid exposing a giant permission matrix in v0. Use presets first, then advanced permissions later if clients genuinely need them.

## What To Take From UltimatePOS

Keep the business workflows that are proven:

- POS register with barcode/name/SKU search.
- Walk-in customer and saved customers.
- Cart with quantity, discount, TVA, notes.
- Multiple payment methods and partial/mixed payment.
- Suspend/resume sale.
- Receipt/ticket printing.
- Sales list, returns, and payment follow-up.
- Products, categories, brands, units.
- Stock movements, stock adjustments, transfers, low-stock alerts.
- Purchases from suppliers.
- Cash register open/close with expected vs counted cash.
- Restaurant tables, waiter assignment, kitchen order statuses, only as the Restaurant module.
- Modifiers/options for restaurant items.
- Practical reports: daily sales, product sales, cashier sales, stock alerts, restaurant service report.

## What To Reject Or Hide

Reject or hide the parts that make UltimatePOS feel heavy:

- Installer/update screens.
- Country-specific clutter not needed for Morocco.
- Giant settings pages with dozens of unrelated toggles.
- Global accounting complexity in the POS MVP.
- Too many payment gateway configurations.
- Duplicated connector/API modules.
- Restaurant settings shown to retail-only accounts.
- Advanced product fields on the main add-product page.
- Any form that requires scrolling through irrelevant fields before saving.

## Product Creation UX

The old add-product page is too slow. v0 should have a fast path and an advanced path.

### Fast Product

A cashier/admin should create a sellable product in under 30 seconds with:

- Product name.
- Sale price.
- Category.
- Barcode or auto-generated SKU.
- Initial stock, optional.
- TVA defaults to company rate, usually 20%.
- Unit defaults to piece.
- Currency defaults to MAD.

Save should be visible without scrolling.

### Advanced Product

Advanced fields should live in collapsible sections:

- Purchase price and margin.
- Supplier.
- Brand.
- Multi-warehouse stock.
- Image.
- Low-stock alert.
- Expiry/lot, if enabled.
- Modifiers/options for restaurant items.
- Ingredients/recipe later.

### Restaurant Product

Restaurant item creation should be its own friendly mode and should not appear in the base POS + ERP product form unless the Restaurant module is active:

- Name.
- Price.
- Menu category.
- Send to kitchen yes/no.
- Modifier group: size, toppings, extras.
- Stock tracking optional.

Do not force restaurant users through retail stock fields unless they need them.

## Settings UX

Settings must be split into simple pages:

- Business profile: logo, name, address, ICE, IF, RC, Patente, CNSS.
- Receipt and invoice: footer, display fiscal fields, numbering.
- Caisse: payment methods, register behavior, receipt printer later.
- Stock: warehouses, low stock, barcode/SKU defaults.
- Restaurant: tables, areas, kitchen, service modes, modifiers. Hidden unless the module is active.
- Users and roles: preset-based access.
- Advanced: hidden by default, for support/admin only.

The settings home should show cards with status and short actions, not a long form.

## Navigation

Default tenant navigation should be role-aware:

- ADMIN: Dashboard, Caisse, Produits, Stock, Achats, Clients, Ventes, Rapports, Parametres, Utilisateurs. Restaurant appears only when active.
- CASHIER: Caisse, Ventes, Clients, Mon tiroir.
- USER: the modules assigned by admin, usually Produits, Stock, Clients.
- WAITER: Tables, Commandes, Clients if allowed. Visible only when Restaurant is active.
- KITCHEN: Cuisine only. Visible only when Restaurant is active.

## MVP Build Priority

1. Auth and role presets.
2. Company settings with Moroccan identifiers.
3. Fast product creation.
4. Product list with search, categories, stock status.
5. Retail POS register.
6. Payment and receipt.
7. Cash register open/close.
8. Reports and platform provisioning.
9. Restaurant module activation, tables, and order flow.
10. Kitchen queue when Restaurant is active.

## Design Principle

Every POS screen should answer one question fast:

- What do I sell?
- Who is the customer?
- How do they pay?
- What is in stock?
- What should the kitchen prepare?
- What needs attention today?

If a screen cannot answer its question quickly, it is not ready.


