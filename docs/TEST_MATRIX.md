# TaysrPOS_v1 Test Matrix

This document provides the full test matrix mapping all 27 API routes, role permissions, multi-tenant isolation attack vectors, fiscal compliance rules, and end-to-end business workflows.

---

## 1. 27-Route RBAC Matrix & Role Permissions

| # | Route / Module | Endpoint | ADMIN | MANAGER | CASHIER | USER |
|---|---|---|:---:|:---:|:---:|:---:|
| 1 | Auth / Profile | `GET /api/auth/me` | ✅ 200 | ✅ 200 | ✅ 200 | ✅ 200 |
| 2 | Sales (Browse) | `GET /api/sales` | ✅ 200 | ✅ 200 | ✅ 200 | 🚫 403 |
| 3 | Sales (Create POS) | `POST /api/sales` | ✅ 200 | ✅ 200 | ✅ 200 | 🚫 403 |
| 4 | Sales (Return) | `POST /api/sales/:id/return` | ✅ 200 | ✅ 200 | ✅ 200 | 🚫 403 |
| 5 | Catalog (Browse) | `GET /api/products` | ✅ 200 | ✅ 200 | ✅ 200 | ✅ 200 |
| 6 | Catalog (Create/Edit) | `POST /api/products` | ✅ 200 | ✅ 200 | 🚫 403 | 🚫 403 |
| 7 | Cash Register (Browse) | `GET /api/register/current` | ✅ 200 | ✅ 200 | ✅ 200 | 🚫 403 |
| 8 | Cash Register (Open) | `POST /api/register/open` | ✅ 200 | ✅ 200 | ✅ 200 | 🚫 403 |
| 9 | Cash Register (Movements) | `POST /api/register/movement` | ✅ 200 | ✅ 200 | ✅ 200 | 🚫 403 |
| 10 | Cash Register (Close) | `POST /api/register/close` | ✅ 200 | ✅ 200 | ✅ 200 | 🚫 403 |
| 11 | Purchases (Browse) | `GET /api/purchases` | ✅ 200 | ✅ 200 | 🚫 403 | 🚫 403 |
| 12 | Purchases (Create PO) | `POST /api/purchases` | ✅ 200 | ✅ 200 | 🚫 403 | 🚫 403 |
| 13 | Purchases (Return) | `POST /api/purchases/:id/return` | ✅ 200 | ✅ 200 | 🚫 403 | 🚫 403 |
| 14 | Inventory Transfers | `POST /api/inventory/transfers` | ✅ 200 | ✅ 200 | 🚫 403 | 🚫 403 |
| 15 | Inventory Adjustments | `POST /api/inventory/adjustments` | ✅ 200 | ✅ 200 | 🚫 403 | 🚫 403 |
| 16 | Expenses (Browse/Create) | `GET, POST /api/expenses` | ✅ 200 | ✅ 200 | 🚫 403 | 🚫 403 |
| 17 | Accounting Ledgers | `GET /api/accounting/accounts` | ✅ 200 | ✅ 200 | 🚫 403 | 🚫 403 |
| 18 | Accounting Mutations | `POST /api/accounting/accounts` | ✅ 200 | ✅ 200 | 🚫 403 | 🚫 403 |
| 19 | Commission Agents | `GET, POST /api/commission-agents` | ✅ 200 | ✅ 200 | 🚫 403 | 🚫 403 |
| 20 | Device Fleet | `GET, POST /api/devices` | ✅ 200 | ✅ 200 | 🚫 403 | 🚫 403 |
| 21 | Locations (Browse) | `GET /api/locations` | ✅ 200 | ✅ 200 | ✅ 200 | ✅ 200 |
| 22 | Locations (Mutations) | `POST, PUT /api/locations` | ✅ 200 | 🚫 403 | 🚫 403 | 🚫 403 |
| 23 | User Permissions Overrides | `POST /api/users/:id/permissions`| ✅ 200 | 🚫 403 | 🚫 403 | 🚫 403 |
| 24 | Invoices & Documents | `GET /api/invoices` | ✅ 200 | ✅ 200 | ✅ 200 | 🚫 403 |
| 25 | Consolidated Invoices | `POST /api/invoices/consolidated` | ✅ 200 | ✅ 200 | 🚫 403 | 🚫 403 |
| 26 | Contacts (Customers/Suppliers) | `GET, POST /api/contacts` | ✅ 200 | ✅ 200 | ✅ 200 | ✅ 200 |
| 27 | Reports (P&L, Tax, Dashboard) | `GET /api/reports/pl` | ✅ 200 | ✅ 200 | 🚫 403 | 🚫 403 |

---

## 2. Multi-Tenant Cross-Attack Isolation Matrix

Tests in `backend/tests/integration/tenant-isolation.test.ts` provision two independent temporary companies (Tenant A and Tenant B) and assert that Tenant A cannot access or mutate Tenant B's domain entities:

| Domain Entity | Cross-Tenant Attack Vector | Expected Result | Verified Status |
|---|---|:---:|:---:|
| **Contacts** | Tenant A reads Tenant B contact by ID (`GET /api/contacts/:id`) | 🚫 404 | ✅ Verified |
| **Contacts** | Tenant A modifies Tenant B contact (`PUT /api/contacts/:id`) | 🚫 404 | ✅ Verified |
| **Contacts** | Tenant A views Tenant B contact ledger (`GET /api/contacts/:id/ledger`) | 🚫 404 | ✅ Verified |
| **Contacts** | Tenant A posts settlement to Tenant B contact (`POST /api/contacts/:id/settle`) | 🚫 404 | ✅ Verified |
| **Products** | Tenant A product list (`GET /api/products`) | Excludes Tenant B items | ✅ Verified |
| **Products** | Tenant A modifies Tenant B product (`PUT /api/products/:id`) | 🚫 404 | ✅ Verified |
| **Products** | Tenant A attempts POS sale checkout with Tenant B product | 🚫 400 | ✅ Verified |
| **Products** | Tenant A attempts purchase receiving with Tenant B product | 🚫 404 | ✅ Verified |
| **Expenses** | Tenant A expense list (`GET /api/expenses`) | Excludes Tenant B expenses | ✅ Verified |
| **Expenses** | Tenant A modifies Tenant B expense (`PUT /api/expenses/:id`) | 🚫 404 | ✅ Verified |
| **Expenses** | Tenant A creates expense referencing Tenant B location | 🚫 400 | ✅ Verified |
| **Ledgers** | Tenant A views Tenant B ledger transactions (`GET /api/accounting/accounts/:id/transactions`) | 🚫 404 | ✅ Verified |
| **Ledgers** | Tenant A posts cash transaction to Tenant B account | 🚫 404 | ✅ Verified |
| **Invoices** | Tenant A downloads Tenant B receipt PDF (`GET /api/receipts/:id/pdf`) | 🚫 404 | ✅ Verified |
| **Invoices** | Tenant A downloads Tenant B invoice PDF (`GET /api/invoices/:id/pdf`) | 🚫 404 | ✅ Verified |
| **Invoices** | Tenant A creates consolidated invoice referencing Tenant B customer | 🚫 404 | ✅ Verified |
| **Devices** | Tenant A revokes Tenant B device (`DELETE /api/devices/:id`) | 🚫 404 | ✅ Verified |
| **Locations** | Tenant A updates Tenant B store location (`PUT /api/locations/:id`) | 🚫 404 | ✅ Verified |
| **Permissions** | Tenant A writes permission overrides for Tenant B user | 🚫 404 | ✅ Verified |

---

## 3. Moroccan Fiscal Compliance Test Matrix

| Fiscal Rule | Description | Test File | Verified Status |
|---|---|---|:---:|
| **ICE Enforcement** | Rejects consolidated invoice generation if customer lacks Moroccan 15-digit ICE identifier (`400 Bad Request`). | `fiscal-compliance.test.ts` | ✅ Verified |
| **TVA Rate Accuracy** | Multi-rate basket TVA calculations (20%, 14%, 10%, 7%, 0%) with line-level discounts and order-level discount rates. | `fiscal-compliance.test.ts` | ✅ Verified |
| **Unaccented Statuses** | Strict adherence to unaccented status labels: `'Payee'`, `'Retour'`, `'Devis'`, `'Suspendue'`, `'Credit'`, `'Brouillon'`. | `fiscal-compliance.test.ts` | ✅ Verified |
| **PDF Generation** | Dynamic PDF receipt and invoice rendering with `application/pdf` Content-Type and Moroccan header metadata. | `fiscal-compliance.test.ts` | ✅ Verified |

---

## 4. End-to-End Transactional Business Flows

| Flow | File | Key Steps Verified |
|---|---|---|
| **Flow 1: POS Sale Lifecycle** | `pos-sale-lifecycle.test.ts` | Open register (500 MAD) $\rightarrow$ Cash movements (IN 100, OUT 50) $\rightarrow$ Split sale (140 Cash + 100 Card) $\rightarrow$ Atomic stock decrement $\rightarrow$ Cash ledger posting $\rightarrow$ Close register $\rightarrow$ Z-Report with 'Juste' status $\rightarrow$ PDF receipt $\rightarrow$ P&L / Tax integrity. |
| **Flow 2: Purchase & Inventory** | `purchase-inventory.test.ts` | Draft PO $\rightarrow$ Partial receiving $\rightarrow$ Full receiving $\rightarrow$ Supplier AP balance update $\rightarrow$ Supplier settlement $\rightarrow$ Manual stock adjustment $\rightarrow$ Inter-warehouse stock transfer. |
| **Flow 3: Returns & Credit Notes** | `return-credit-note.test.ts` | Multi-line sale $\rightarrow$ Partial return of selected line items $\rightarrow$ Stock restock $\rightarrow$ Cash refund credit posting $\rightarrow$ Remainder full return $\rightarrow$ Credit sale return with balance reduction $\rightarrow$ Supplier defective return. |
| **Flow 4: Multi-Currency & FX** | `multicurrency-flow.test.ts` | Foreign EUR Purchase $\rightarrow$ Foreign USD Sale $\rightarrow$ Historical FX rate snapshot immutability upon subsequent rate updates $\rightarrow$ Base MAD accounting consistency. |
