# Design Document: Remove Hanout Integrations & Connector Features

**Date:** 2026-08-15  
**Target Codebase:** `TaysrPOS_v1`  
**Status:** Approved by User  

---

## 1. Executive Summary

This design specifies the complete removal of Hanout-specific integrations, legacy connector compatibility routes, and external batch sync logic from `TaysrPOS_v1`. The goal is to produce a clean, decoupled generic ERP codebase without legacy connector clutter.

---

## 2. Scope & Target Areas

### 2.1 Backend Route Removals
- **`backend/src/routes/connector.routes.ts`**: Delete completely (removes `/connector/api/business-details`, `/taxonomy`, `/product`, `/contactapi`, `/sell`, `/contactapi-payment`).
- **`backend/src/routes/sync.routes.ts`**: Delete completely (removes `/sync/batch` and `/sync/pull`).

### 2.2 Server Entry Point (`backend/src/index.ts`)
- Remove import and mount of `connectorRoutes` (`app.use('/connector/api', ...)`).
- Remove import and mount of `syncRoutes` (`app.use('/sync', ...)`).

### 2.3 Database Schema (`backend/prisma/schema.prisma`)
- Remove `externalId String? @unique` from `Sale` model.
- Regenerate Prisma Client via `prisma generate`.

### 2.4 Frontend (`frontend/src/main.tsx`)
- Update device activation modal label from `'Appareil Hanout Mobile'` to `'Terminal Mobile'`.

### 2.5 Documentation (`docs/`)
- Update `docs/BLUEPRINT.md` and `docs/PRODUCT_DECISIONS.md` to remove references to connector API compatibility and Hanout Express sync.

---

## 3. Verification Strategy

1. **Prisma Generation**: Run `prisma generate` and verify schema compiles.
2. **Typecheck**: Run `tsc --noEmit` across backend and frontend — must achieve **0 errors**.
3. **Grep Audit**: Search for `connector`, `hanout`, `externalId`, `sync/batch`, `sync/pull` across backend and frontend source files to guarantee 0 remaining matches.
