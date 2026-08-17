# Taysr Core Domain Boundaries

This document formalizes the boundary separation between **Taysr Core** (commercial primitives) and **Vertical Solutions** (e.g. Taysr Optic).

---

## 1. Domain Ownership Matrix

```
┌────────────────────────────────────────────────────────┐
│                   Taysr Platform                       │
│    (Tenant Provisioning, Billing, Module Entitlements) │
└───────────────────────────┬────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
┌───────────────────────────┐ ┌───────────────────────────┐
│        Taysr Core         │ │        Taysr Optic        │
│  (Commercial Primitives)  │ │     (Vertical Domain)     │
├───────────────────────────┤ ├───────────────────────────┤
│ • Product Master & Stock  │ │ • Patient Records         │
│ • Purchases & Receiving   │ │ • Optical Prescriptions   │
│ • POS Sales & Tickets     │ │ • Lens Measurements       │
│ • Cash Register Sessions  │ │ • Lab Orders              │
│ • Invoices & ICE Fiscal   │ │ • Surfacing & Edging Jobs │
│ • Multi-Currency Ledger   │ │ • Quality Control & Fits  │
│ • Double-Entry Accounts   │ │ • Diagnostic Equipment    │
└───────────────────────────┘ └───────────────────────────┘
```

---

## 2. Detailed Entity Ownership

### Core-Owned Entities (Horizontal)
| Entity | Description |
|---|---|
| `Company` | Tenant company profile, legal details, ICE/IF/RC identifiers, base currency. |
| `User` & `UserPermission` | System users, role presets (`ADMIN`, `MANAGER`, `CASHIER`, `USER`), action overrides. |
| `Location` | Physical stores, retail outlets, branches. |
| `Warehouse` | Stock storage facilities, multi-warehouse stock allocations. |
| `Product`, `Category`, `Brand`, `Unit` | Standard catalog taxonomy and variations. |
| `ProductStock` & `StockMovement` | Real-time stock levels and auditable stock ledger. |
| `Contact` | Customers, suppliers, balances, credit limits, ICE identifiers. |
| `CustomerGroup` & `SellingPriceGroup` | Tiered pricing groups and customer segmentation. |
| `Sale`, `SaleItem`, `Payment` | Commercial sale orders, items, payment transactions, split payments. |
| `Purchase`, `PurchaseItem` | Supplier purchase orders, receiving status, AP tracking. |
| `CashRegisterSession` & `CashMovement` | Cash drawer shifts, drawer counts, variance tracking, Z-Reports. |
| `Invoice`, `InvoiceLine`, `ConsolidatedInvoice` | Fiscal invoices, Moroccan consolidated billing (*facturation groupée*). |
| `Account`, `AccountTransaction` | Double-entry chart of accounts, cash ledgers, journal entries. |
| `Currency` | Multi-currency definitions and exchange rate snapshots. |

---

### Vertical-Owned Entities (e.g. Taysr Optic)
| Entity | Owned In Vertical | Core Integration Point |
|---|---|---|
| `Patient` | Taysr Optic | Linked to Core `Contact` (Customer) via `contactId`. |
| `Prescription` | Taysr Optic | Prescribed Sphere, Cylinder, Axis, Add, PD, Pupillary Heights. |
| `OpticalOrder` | Taysr Optic | Commercial execution generates a Core `Sale`. |
| `LabOrder` & `JobCard` | Taysr Optic | Raw lens blank consumption posts a Core `StockMovement`. |
| `LensCatalog` (Matrix) | Taysr Optic | Mapped to Core `Product` master items. |
| `EquipmentIntegration` | Taysr Optic | Autorefractor / Phoropter / Lensmeter telemetry. |

---

## 3. Integration Rule for Verticals

1. **No Shared Database Cross-Access**: Vertical applications must not connect directly to the Taysr Core database or import Core Prisma models.
2. **REST API Communication**: Vertical applications consume Core via standard authenticated HTTP requests.
3. **Core Immutability**: Verticals cannot bypass Core business validation (e.g., negative stock checks, register session validity, ICE validation).
