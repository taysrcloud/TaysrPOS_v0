# TaysrPOS v0

Clean TypeScript/React/Postgres rebuild of TaysrPOS.

This folder is intentionally separate from `apps/TaysrPOS`, which remains the legacy UltimatePOS/Laravel reference app.

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
TAYSRPOS_DATABASE_URL="postgresql://admin:adminpassword@localhost:5432/gestoptical?schema=taysrpos_v0"
PORT=4500
```

## Product Scope

See [docs/BLUEPRINT.md](docs/BLUEPRINT.md) and [docs/PRODUCT_DECISIONS.md](docs/PRODUCT_DECISIONS.md).

The first v0 scope includes:

- Retail POS checkout
- Restaurant tables and kitchen orders
- Products and inventory
- Customers and suppliers
- Cash register sessions
- Sales, payments, returns
- Moroccan company identifiers and MAD defaults

