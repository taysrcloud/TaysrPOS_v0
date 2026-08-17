# Taysr Core API Contract (v1)

This document formalizes the public REST API surface of **Taysr Core** available for consumption by client applications, integrations, and vertical solutions (such as Taysr Optic).

---

## 1. Authentication & Headers

All requests to Taysr Core API endpoints must supply:

```http
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

---

## 2. API Endpoint Specification

### Catalog & Products
| Method | Path | Required Role | Description |
|---|---|---|---|
| `GET` | `/api/products` | `USER`, `CASHIER`, `MANAGER`, `ADMIN` | Search & list products, variations, prices, and stock levels. |
| `POST` | `/api/products` | `MANAGER`, `ADMIN` | Create a new catalog product with initial stock & tax rate. |
| `PUT` | `/api/products/:id` | `MANAGER`, `ADMIN` | Update an existing product. |
| `DELETE` | `/api/products/:id` | `ADMIN` | Deactivate/remove a product. |

### Sales & Point of Sale
| Method | Path | Required Role | Description |
|---|---|---|---|
| `GET` | `/api/sales` | `CASHIER`, `MANAGER`, `ADMIN` | List company sales with date, customer, cashier, and status filters. |
| `POST` | `/api/sales` | `CASHIER`, `MANAGER`, `ADMIN` | Create a sale transaction, decrement stock atomically, post payment, and post cash ledger entry. |
| `GET` | `/api/sales/:id` | `CASHIER`, `MANAGER`, `ADMIN` | Fetch complete sale details with line items and payments. |
| `POST` | `/api/sales/:id/return` | `CASHIER`, `MANAGER`, `ADMIN` | Process partial or full return, restock items, and post refund credit. |

### Cash Register Operations
| Method | Path | Required Role | Description |
|---|---|---|---|
| `GET` | `/api/register/current` | `CASHIER`, `MANAGER`, `ADMIN` | Check active register session for current user/location. |
| `POST` | `/api/register/open` | `CASHIER`, `MANAGER`, `ADMIN` | Open a cash register shift with opening cash float. |
| `POST` | `/api/register/movement` | `CASHIER`, `MANAGER`, `ADMIN` | Record cash in or cash out movement in the drawer. |
| `POST` | `/api/register/close` | `CASHIER`, `MANAGER`, `ADMIN` | Close register session with counted drawer cash and produce Z-Report. |

### Inventory & Stock Movements
| Method | Path | Required Role | Description |
|---|---|---|---|
| `GET` | `/api/inventory/stocks` | `CASHIER`, `MANAGER`, `ADMIN` | View real-time stock balances across warehouses. |
| `POST` | `/api/inventory/transfers` | `MANAGER`, `ADMIN` | Inter-warehouse stock transfer. |
| `POST` | `/api/inventory/adjustments` | `MANAGER`, `ADMIN` | Manual inventory reconciliation / stock adjustment. |

### Procurement & Purchasing
| Method | Path | Required Role | Description |
|---|---|---|---|
| `GET` | `/api/purchases` | `MANAGER`, `ADMIN` | List purchase orders with supplier and status filters. |
| `POST` | `/api/purchases` | `MANAGER`, `ADMIN` | Create purchase order with items, foreign currency, and receiving status. |
| `POST` | `/api/purchases/:id/return` | `MANAGER`, `ADMIN` | Process supplier return and deduct supplier balance. |

### Contacts (Customers & Suppliers)
| Method | Path | Required Role | Description |
|---|---|---|---|
| `GET` | `/api/contacts` | `USER`, `CASHIER`, `MANAGER`, `ADMIN` | Search & list customers and suppliers. |
| `POST` | `/api/contacts` | `USER`, `CASHIER`, `MANAGER`, `ADMIN` | Create a contact with ICE, IF, phone, and credit limit. |
| `GET` | `/api/contacts/:id/ledger` | `MANAGER`, `ADMIN` | Get customer or supplier balance and statement history. |
| `POST` | `/api/contacts/:id/settle` | `MANAGER`, `ADMIN` | Post balance payment / settlement against contact. |

### Invoicing & Moroccan Fiscal Documents
| Method | Path | Required Role | Description |
|---|---|---|---|
| `GET` | `/api/invoices` | `CASHIER`, `MANAGER`, `ADMIN` | List fiscal invoices. |
| `POST` | `/api/invoices/consolidated` | `MANAGER`, `ADMIN` | Generate Moroccan consolidated invoice (*facturation groupée*) for ICE-validated customer. |
| `GET` | `/api/receipts/:id/pdf` | `CASHIER`, `MANAGER`, `ADMIN` | Generate and download thermal POS receipt PDF. |
| `GET` | `/api/invoices/:id/pdf` | `CASHIER`, `MANAGER`, `ADMIN` | Generate and download legal fiscal invoice PDF. |

### Accounting & Ledgers
| Method | Path | Required Role | Description |
|---|---|---|---|
| `GET` | `/api/accounting/accounts` | `MANAGER`, `ADMIN` | List chart of accounts and current balances. |
| `GET` | `/api/accounting/accounts/:id/transactions` | `MANAGER`, `ADMIN` | View journal entries and transaction ledger for an account. |
| `POST` | `/api/accounting/accounts/:id/post` | `ADMIN` | Post manual debit/credit transaction. |

### Reports
| Method | Path | Required Role | Description |
|---|---|---|---|
| `GET` | `/api/reports/pl` | `MANAGER`, `ADMIN` | Profit and Loss summary based on sales, purchase costs, and expenses. |
| `GET` | `/api/reports/tax` | `MANAGER`, `ADMIN` | Moroccan TVA tax collected and deductible breakdown. |
