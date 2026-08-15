# Remove Hanout Integrations & Connector Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completely remove Hanout-specific integrations, legacy connector compatibility routes, and external batch sync logic from `TaysrPOS_v1` to maintain a clean, generic ERP codebase.

**Architecture:** Surgical deletion of `connector.routes.ts` (`/connector/api`) and `sync.routes.ts` (`/sync`), removal of their mounts in `backend/src/index.ts`, removal of `externalId` from `Sale` model in `schema.prisma`, updating frontend device label in `main.tsx`, and cleaning documentation.

**Tech Stack:** TypeScript, Node.js, Express, Prisma, React, PostgreSQL.

## Global Constraints

- Preserve all existing comments and docstrings unrelated to Hanout/connector features.
- All backend and frontend code must pass TypeScript typecheck cleanly with 0 errors.
- Working directory: `/data/data/com.termux/files/home/TaysrPOS/TaysrPOS_v1`

---

### Task 1: Remove Backend Connector & Sync Routes

**Files:**
- Delete: `backend/src/routes/connector.routes.ts`
- Delete: `backend/src/routes/sync.routes.ts`
- Modify: `backend/src/index.ts`
- Modify: `backend/src/routes/contact.routes.ts:218`

**Interfaces:**
- Consumes: Existing Express server entry point.
- Produces: Cleaned backend server routes without `/connector/api` or `/sync` endpoints.

- [ ] **Step 1: Delete connector.routes.ts and sync.routes.ts**

```bash
cd /data/data/com.termux/files/home/TaysrPOS/TaysrPOS_v1
rm -f backend/src/routes/connector.routes.ts backend/src/routes/sync.routes.ts
```

- [ ] **Step 2: Unmount connector and sync routes in backend/src/index.ts**

In `backend/src/index.ts`:
1. Remove `import connectorRoutes from './routes/connector.routes.js';`
2. Remove `import syncRoutes from './routes/sync.routes.js';`
3. Remove `app.use('/connector/api', connectorRoutes);`
4. Remove `app.use('/sync', syncRoutes);`

- [ ] **Step 3: Remove connector reference in backend/src/routes/contact.routes.ts**

Remove comment on line 218 referring to `contactapi-payment precedent in connector.routes.ts`.

- [ ] **Step 4: Run backend typecheck**

Run: `node node_modules/typescript/lib/tsc.js --noEmit -p backend/tsconfig.json`
Expected: PASS (or only errors related to schema if any).

- [ ] **Step 5: Commit Task 1**

```bash
git add backend/src/index.ts backend/src/routes/contact.routes.ts
git rm backend/src/routes/connector.routes.ts backend/src/routes/sync.routes.ts
git commit -m "backend: remove connector and sync routes and mounts"
```

---

### Task 2: Clean Database Schema & Regenerate Client

**Files:**
- Modify: `backend/prisma/schema.prisma:500-515`

**Interfaces:**
- Consumes: `schema.prisma`
- Produces: Updated Prisma Client without `externalId` on `Sale` model.

- [ ] **Step 1: Remove externalId field from Sale model in schema.prisma**

In `backend/prisma/schema.prisma` under `model Sale`:
Remove `externalId String? @unique` and its associated comment.

- [ ] **Step 2: Regenerate Prisma Client**

```bash
cd /data/data/com.termux/files/home/TaysrPOS/TaysrPOS_v1/backend
node ../node_modules/prisma/build/index.js generate --schema prisma/schema.prisma
```

- [ ] **Step 3: Run backend typecheck**

Run: `cd /data/data/com.termux/files/home/TaysrPOS/TaysrPOS_v1 && node node_modules/typescript/lib/tsc.js --noEmit -p backend/tsconfig.json`
Expected: PASS (0 errors)

- [ ] **Step 4: Commit Task 2**

```bash
git add backend/prisma/schema.prisma backend/src/generated/client
git commit -m "schema: remove externalId from Sale model"
```

---

### Task 3: Clean Frontend Device Settings & Documentation

**Files:**
- Modify: `frontend/src/main.tsx:3470`
- Modify: `docs/BLUEPRINT.md`
- Modify: `docs/PRODUCT_DECISIONS.md`

- [ ] **Step 1: Update default device label in frontend/src/main.tsx**

Change `'Appareil Hanout Mobile'` to `'Terminal Mobile'` on line 3470 of `frontend/src/main.tsx`.

- [ ] **Step 2: Clean documentation files**

Remove references to connector API, Hanout Express, and `/connector/api` from `docs/BLUEPRINT.md` and `docs/PRODUCT_DECISIONS.md`.

- [ ] **Step 3: Run frontend typecheck**

Run: `node node_modules/typescript/lib/tsc.js --noEmit -p frontend/tsconfig.json`
Expected: PASS (0 errors)

- [ ] **Step 4: Commit Task 3**

```bash
git add frontend/src/main.tsx docs/BLUEPRINT.md docs/PRODUCT_DECISIONS.md
git commit -m "frontend & docs: update device label and clean connector documentation"
```

---

### Task 4: Final Verification & Audit

- [ ] **Step 1: Run full typecheck across backend and frontend**

```bash
node node_modules/typescript/lib/tsc.js --noEmit -p backend/tsconfig.json && node node_modules/typescript/lib/tsc.js --noEmit -p frontend/tsconfig.json
```
Expected: `0 errors`

- [ ] **Step 2: Run grep audit search**

```bash
grep -rn -iE "connector\.routes|sync\.routes|externalId|hanout" backend/src frontend/src docs/ || echo "AUDIT CLEAN"
```
Expected: `AUDIT CLEAN`
