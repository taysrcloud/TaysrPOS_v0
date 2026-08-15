# Taysr ERP v1

Clean TypeScript/React/Postgres generic ERP & POS platform.

This codebase is a generic, modular ERP and POS system built as a clean TypeScript, React, and PostgreSQL architecture.

## Stack

- Backend: Express + TypeScript + Prisma
- Frontend: React + Vite + TypeScript
- Database: PostgreSQL

## Local Scripts

From this folder:

```powershell
npm run dev
npm run typecheck
```

Backend only:

```powershell
npm run dev --workspace backend
npm run typecheck --workspace backend
npm run prisma:generate --workspace backend
npm run prisma:push --workspace backend
```

Frontend only:

```powershell
npm run dev --workspace frontend
npm run build --workspace frontend
```

## Environment

The backend expects:

```env
DATABASE_URL="postgresql://admin:adminpassword@localhost:5432/gestoptical?schema=taysr_erp_v1"
PORT=4401
```

## Product Scope

See [docs/BLUEPRINT.md](docs/BLUEPRINT.md) and [docs/PRODUCT_DECISIONS.md](docs/PRODUCT_DECISIONS.md).

The ERP v1 core scope includes:

- Retail POS checkout and cash registers
- Products, catalog, and inventory management
- Customers, suppliers, and contacts
- Sales orders, payments, invoices, and returns
- Cash register sessions and financial tracking
- Moroccan business identifiers (ICE, IF, RC, CNSS) and MAD currency defaults
- Multi-tenant architecture with tenant isolation

## Testing

For automated testing guidance and suite-wide test standards, please refer to the shared testing guidelines in the documentation. The ERP frontend supports DOM inspection and headless browser verification for critical paths, while backend routes are designed for straightforward integration testing using TypeScript smoke test suites and HTTP assertions.
