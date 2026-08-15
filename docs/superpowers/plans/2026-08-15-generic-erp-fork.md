# Generic ERP Fork (TaysrPOS_v1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a clean generic ERP+POS product (`TaysrPOS_v1`) by forking `TaysrPOS_v0` and surgically removing all restaurant-specific logic — tables, kitchen display, waiter roles, menu items, modifiers, dine-in/takeaway channels — while keeping every retail ERP capability intact.

**Architecture:** Copy `TaysrPOS_v0/` to `TaysrPOS_v1/` at the same level. Systematically strip restaurant models from Prisma schema, delete restaurant-only files, clean restaurant conditionals from shared files, update all identifiers/ports/branding, then verify with typecheck + build.

**Tech Stack:** Node 22 / Express 5 / TypeScript 6 / Prisma 7 / PostgreSQL (backend) · React 19 / Vite 8 (frontend)

## Global Constraints

- Node >= 22, ES modules (`"type": "module"`) everywhere.
- Backend port: `4401` (avoids collision with v0's `4400`).
- Frontend dev port: `5401` (avoids collision with v0's `5400`).
- Docker DB name: `taysr_erp_v1` (separate from v0's `taysrpos_v0`).
- Package names: `@taysr/erp-v1-backend`, `@taysr/erp-v1-frontend`.
- All existing comments and docstrings unrelated to restaurant must be preserved.
- French UI strings stay French; just remove restaurant-specific labels.
- Do NOT delete the `requireModule` middleware pattern — it's reusable for future modules.

---

## File Structure

### Files to DELETE entirely (restaurant-only):
| File | Reason |
|------|--------|
| `backend/src/routes/restaurant.routes.ts` | All table/area/occupancy endpoints |
| `frontend/src/pages/KitchenPage.tsx` | Kitchen Display System page |
| `frontend/src/split-merge-modals.tsx` | Table merge/split modals |

### Files to CREATE:
| File | Purpose |
|------|---------|
| `TaysrPOS_v1/` (directory) | Entire fork root |

### Files to MODIFY (restaurant references removed):
| File | What changes |
|------|-------------|
| `backend/prisma/schema.prisma` | Remove restaurant enums, models, fields |
| `backend/src/index.ts` | Remove restaurant route import/mount, update health + modules |
| `backend/src/routes/settings.routes.ts` | Remove `restaurantEnabled` from GET/PUT |
| `backend/src/routes/product.routes.ts` | Remove `MENU_ITEM`/`INGREDIENT` type, `isKitchenItem` logic |
| `backend/src/routes/sale.routes.ts` | Remove `tableId`/`waiterId`/`kitchenStatus`/kitchen endpoint |
| `backend/src/routes/platform.routes.ts` | Remove `WAITER`/`KITCHEN` from role mapping |
| `backend/src/scripts/seed.ts` | Remove `restaurantEnabled` from seed data |
| `backend/scripts/tenant-isolation-smoke.ts` | Remove `restaurantEnabled` references |
| `frontend/src/main.tsx` | Remove restaurant conditionals, WAITER role, MENU_ITEM type, kitchen refs |
| `frontend/src/context/PosContext.tsx` | Remove kitchen/restaurant/table state |
| `package.json` (root) | Rename project |
| `backend/package.json` | Rename package |
| `frontend/package.json` | Rename, change port |
| `docker-compose.yml` | Rename service, change DB/ports/labels |
| `Dockerfile` | Update comments/service name |
| `backend/Dockerfile` | Update comments |
| `backend/docker-entrypoint.sh` | Update echo strings |
| `frontend/Dockerfile` | Update comments |
| `frontend/nginx.conf` | Same (no restaurant-specific proxy rules) |
| `scripts/deploy.sh` | Update echo strings/branding |
| `README.md` | Rewrite for generic ERP identity |
| `docs/BLUEPRINT.md` | Remove restaurant sections |
| `docs/PRODUCT_DECISIONS.md` | Remove restaurant references |

---

### Task 1: Copy Project & Rename Identifiers

**Files:**
- Create: `TaysrPOS_v1/` (full recursive copy of `TaysrPOS_v0/`)
- Modify: `TaysrPOS_v1/package.json`
- Modify: `TaysrPOS_v1/backend/package.json`
- Modify: `TaysrPOS_v1/frontend/package.json`
- Modify: `TaysrPOS_v1/README.md`

**Interfaces:**
- Consumes: nothing (first task)
- Produces: Complete project copy with updated identifiers, ready for surgery

- [ ] **Step 1: Copy the project**

```bash
cp -r TaysrPOS_v0 TaysrPOS_v1
cd TaysrPOS_v1
rm -rf node_modules backend/node_modules frontend/node_modules
rm -rf .git backend/src/generated
```

- [ ] **Step 2: Update root `package.json`**

Change name from `taysrpos-v0` to `taysr-erp-v1`. Keep all scripts identical.

```json
{
  "name": "taysr-erp-v1",
  "private": true,
  "version": "1.0.0",
  ...
}
```

- [ ] **Step 3: Update `backend/package.json`**

Change name from `@taysr/pos-v0-backend` to `@taysr/erp-v1-backend`.

```json
{
  "name": "@taysr/erp-v1-backend",
  "version": "1.0.0",
  ...
}
```

- [ ] **Step 4: Update `frontend/package.json`**

Change name from `@taysr/pos-v0-frontend` to `@taysr/erp-v1-frontend`. Change dev port from `5400` to `5401`.

```json
{
  "name": "@taysr/erp-v1-frontend",
  "version": "1.0.0",
  "scripts": {
    "dev": "vite --host 0.0.0.0 --port 5401 --configLoader native",
    ...
  }
}
```

- [ ] **Step 5: Rewrite `README.md`**

Replace the entire README content to reflect generic ERP identity. Remove all mentions of "restaurant", "kitchen orders", "tables". Keep the stack description, local scripts, environment, and testing sections but rewrite Product Scope to list only retail ERP features.

- [ ] **Step 6: Initialize git**

```bash
cd TaysrPOS_v1
git init
git add -A
git commit -m "fork: copy TaysrPOS_v0 as clean generic ERP base (TaysrPOS_v1)"
```

---

### Task 2: Clean Prisma Schema — Remove Restaurant Models & Enums

**Files:**
- Modify: `TaysrPOS_v1/backend/prisma/schema.prisma`

**Interfaces:**
- Consumes: copied project from Task 1
- Produces: Clean schema without restaurant models. All remaining models compile. Sale model keeps `channel` (as `RETAIL` only) but drops `tableId`, `waiterId`, `kitchenStatus`.

- [ ] **Step 1: Remove restaurant-only enums**

Delete these enum blocks entirely:
- `RestaurantOrderStatus` (lines 87–93)
- Remove `DINE_IN`, `TAKEAWAY`, `DELIVERY` from `SaleChannel` — keep only `RETAIL`
- Remove `KITCHEN`, `READY` from `SaleStatus` — keep `DRAFT`, `SUSPENDED`, `FINAL`, `CANCELLED`, `PARTIALLY_RETURNED`, `RETURNED`
- Remove `WAITER`, `KITCHEN` from `UserRole` — keep `ADMIN`, `MANAGER`, `CASHIER`, `USER`
- Remove `MENU_ITEM`, `INGREDIENT` from `ProductType` — keep `RETAIL`, `SERVICE`, `BUNDLE`

- [ ] **Step 2: Clean `Company` model**

Remove these fields from Company:
- `restaurantEnabled Boolean @default(false)` (line 114)
- `restaurantAreas RestaurantArea[]` (line 133)
- `restaurantTables RestaurantTable[]` (line 134)
- `modifierGroups ModifierGroup[]` (line 135)

- [ ] **Step 3: Clean `User` model**

Remove:
- `servedSales Sale[] @relation("SaleWaiter")` (line 171)

- [ ] **Step 4: Delete restaurant models entirely**

Remove these model blocks:
- `RestaurantArea` (lines 454–464)
- `RestaurantTable` (lines 466–479)
- `ModifierGroup` (lines 481–492)
- `ModifierOption` (lines 494–505)
- `SaleItemModifier` (lines 597–609 approx)

- [ ] **Step 5: Clean `Sale` model**

Remove these fields:
- `waiterId Int?` (line 513)
- `tableId Int?` (line 514)
- `waiter User? @relation("SaleWaiter", ...)` (line 555)
- `table RestaurantTable? @relation(...)` (line 556)

Simplify `channel` default — since only `RETAIL` remains, set `channel SaleChannel @default(RETAIL)` (keep the field for future extensibility).

- [ ] **Step 6: Clean `SaleItem` model**

Remove:
- `kitchenStatus RestaurantOrderStatus?` (line 589)
- `modifiers SaleItemModifier[]` (line 594)

- [ ] **Step 7: Verify schema syntax**

```bash
cd TaysrPOS_v1
# Just check Prisma can parse the schema (no DB needed)
npx prisma format --schema backend/prisma/schema.prisma
```

- [ ] **Step 8: Commit**

```bash
git add backend/prisma/schema.prisma
git commit -m "schema: remove restaurant models, enums, and fields from Prisma schema"
```

---

### Task 3: Clean Backend — Remove Restaurant Routes & References

**Files:**
- Delete: `TaysrPOS_v1/backend/src/routes/restaurant.routes.ts`
- Modify: `TaysrPOS_v1/backend/src/index.ts`
- Modify: `TaysrPOS_v1/backend/src/routes/settings.routes.ts`
- Modify: `TaysrPOS_v1/backend/src/routes/product.routes.ts`
- Modify: `TaysrPOS_v1/backend/src/routes/sale.routes.ts`
- Modify: `TaysrPOS_v1/backend/src/routes/platform.routes.ts`
- Modify: `TaysrPOS_v1/backend/src/scripts/seed.ts`
- Modify: `TaysrPOS_v1/backend/scripts/tenant-isolation-smoke.ts`

**Interfaces:**
- Consumes: clean schema from Task 2
- Produces: Backend that compiles with `npm run typecheck` — no restaurant imports, routes, or logic remain

- [ ] **Step 1: Delete restaurant routes file**

```bash
rm TaysrPOS_v1/backend/src/routes/restaurant.routes.ts
```

- [ ] **Step 2: Clean `backend/src/index.ts`**

Remove:
- Line 38: `import restaurantRoutes from './routes/restaurant.routes.js';`
- Line 68: `app.use('/api/restaurant', requireAuth, requireModule('RESTAURANT'), restaurantRoutes);`
- Update health endpoint (line 27): remove `'restaurant'` from modules array
- Update `/api/catalog/modules` (lines 96–111): remove `'restaurant'`, `'restaurant-floor'`, `'kitchen-orders'` from enabled/planned lists
- Update console.log (line 136): change `TaysrPOS v0 API` → `Taysr ERP v1 API`
- Update health service name (line 24): change `TaysrPOS v0 API` → `Taysr ERP v1 API`

- [ ] **Step 3: Clean `backend/src/routes/settings.routes.ts`**

In `GET /` handler (line 68–89):
- Remove line 81: `restaurantEnabled: hasModuleAccess(req, 'RESTAURANT') && company.restaurantEnabled,`
- Remove `hasModuleAccess` from the import if no longer used anywhere

In `PUT /` handler (line 91–122):
- Remove lines 94–96: the `restaurantEnabled` check + 403 response
- Remove line 111: `restaurantEnabled: typeof parsed.restaurantEnabled === 'boolean' ? parsed.restaurantEnabled : undefined,`

- [ ] **Step 4: Clean `backend/src/routes/product.routes.ts`**

- In the Zod schema (line 17): change `z.enum(['RETAIL', 'MENU_ITEM', 'INGREDIENT', 'SERVICE', 'BUNDLE'])` → `z.enum(['RETAIL', 'SERVICE', 'BUNDLE'])`
- Remove line 212: `restaurantItems: normalized.filter(product => product.type === 'MENU_ITEM').length,`
- Remove lines 278 and 426: `isKitchenItem: data.type === 'MENU_ITEM' ? data.isKitchenItem : false,`
- If `isKitchenItem` field exists on the Product model, remove it from both create and update handlers

- [ ] **Step 5: Clean `backend/src/routes/sale.routes.ts`**

- Remove `tableId` from Zod schema (line 21)
- Remove table validation block (lines 254–256): the `if (data.tableId) { ... restaurantTable.findFirst ... }` block
- Remove `tableId: data.tableId,` from sale creation data (line 376)
- Remove the `PATCH /:id/kitchen` endpoint (lines 609–626 approx): entire router handler
- Remove `tableId: originalSale.tableId,` from return/copy logic (line 660)
- Remove any `waiterId` references in create/update handlers

- [ ] **Step 6: Clean `backend/src/routes/platform.routes.ts`**

- Remove `if (role === 'WAITER') return UserRole.WAITER;` (line 20)
- Remove any `KITCHEN` role mapping if present

- [ ] **Step 7: Clean seed script**

In `backend/src/scripts/seed.ts`:
- Remove `restaurantEnabled: false` (or `true`) from tenant seed data

In `backend/scripts/tenant-isolation-smoke.ts`:
- Remove `restaurantEnabled: true` from test tenant creation (line 42)
- Remove `restaurantEnabled: true` from settings test body (line 517)

- [ ] **Step 8: Generate Prisma client and typecheck**

```bash
cd TaysrPOS_v1
npm install --workspace backend
npx prisma generate --schema backend/prisma/schema.prisma --workspace backend
npm run typecheck --workspace backend
```

Fix any remaining type errors surfaced by the typecheck.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "backend: remove all restaurant routes, models, and references"
```

---

### Task 4: Clean Frontend — Remove Restaurant UI & State

**Files:**
- Delete: `TaysrPOS_v1/frontend/src/pages/KitchenPage.tsx`
- Delete: `TaysrPOS_v1/frontend/src/split-merge-modals.tsx`
- Modify: `TaysrPOS_v1/frontend/src/main.tsx`
- Modify: `TaysrPOS_v1/frontend/src/context/PosContext.tsx`

**Interfaces:**
- Consumes: clean backend from Task 3
- Produces: Frontend that compiles with `npm run typecheck` and `npm run build` — no restaurant UI, state, or types remain

- [ ] **Step 1: Delete restaurant-only frontend files**

```bash
rm TaysrPOS_v1/frontend/src/pages/KitchenPage.tsx
rm TaysrPOS_v1/frontend/src/split-merge-modals.tsx
```

- [ ] **Step 2: Clean `frontend/src/context/PosContext.tsx`**

Remove these fields from the context type and provider:
- `kitchenFilter` state and `setKitchenFilter` setter
- `markKitchenReady` function
- `restaurantEnabled` state
- `selectedTable` state and `setSelectedTable` setter
- Any imports or references to kitchen/restaurant functionality

- [ ] **Step 3: Clean `frontend/src/main.tsx` — types**

- Line 71: Change `type ProductType = 'RETAIL' | 'MENU_ITEM' | 'INGREDIENT' | 'SERVICE' | 'BUNDLE'` → `type ProductType = 'RETAIL' | 'SERVICE' | 'BUNDLE'`
- Line 255: Change `export type UserRole = 'ADMIN' | 'MANAGER' | 'CASHIER' | 'WAITER'` → `export type UserRole = 'ADMIN' | 'MANAGER' | 'CASHIER'`
- Line 265: Remove `WAITER: ['Tables', 'Cuisine'],` from role permissions map
- Line 451: Remove `MENU_ITEM: 'Menu restaurant',` from product type labels

- [ ] **Step 4: Clean `frontend/src/main.tsx` — restaurant conditionals**

Remove or simplify these patterns (search for `restaurantEnabled`):
- Line 956: Product type filter — remove `'MENU_ITEM'` and `'INGREDIENT'` from the array; no longer conditional on `restaurantEnabled`
- Line 1326: `visibleProducts` filter — remove the `restaurantEnabled || product.type !== 'MENU_ITEM'` filter (all products are visible by default since MENU_ITEM no longer exists)
- Lines 1809–1810: Product form submit — remove the type fallback logic for MENU_ITEM/INGREDIENT and the `isKitchenItem` conditional
- Line 2190: Remove the `{restaurantEnabled && ...isKitchenItem checkbox...}` block

- [ ] **Step 5: Clean `frontend/src/main.tsx` — sidebar navigation**

Remove sidebar items conditionally shown for restaurant:
- Find the `restaurantEnabled &&` conditionals that gate "Tables" / "Cuisine" sidebar items and remove them entirely
- Remove the `'restaurant-tables'` and `'kitchen'` page cases from the page router/switch

- [ ] **Step 6: Remove KitchenPage import**

Remove any `import { KitchenPage } from './pages/KitchenPage'` and its usage in the page router.

Remove any `import { MergeTableModal, SplitTableModal } from './split-merge-modals'` and their usage.

- [ ] **Step 7: Clean settings UI**

If `SettingsPage.tsx` exists as an extracted component, remove the restaurant toggle section from it. If it's inline in `main.tsx`, find the restaurant enable/disable toggle and remove it.

- [ ] **Step 8: Typecheck and build frontend**

```bash
cd TaysrPOS_v1
npm install --workspace frontend
npm run typecheck --workspace frontend
npm run build --workspace frontend
```

Fix any remaining type errors.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "frontend: remove all restaurant UI, kitchen page, table modals, and restaurant state"
```

---

### Task 5: Update Docker & Deployment Infrastructure

**Files:**
- Modify: `TaysrPOS_v1/docker-compose.yml`
- Modify: `TaysrPOS_v1/Dockerfile`
- Modify: `TaysrPOS_v1/backend/Dockerfile`
- Modify: `TaysrPOS_v1/backend/docker-entrypoint.sh`
- Modify: `TaysrPOS_v1/frontend/Dockerfile`
- Modify: `TaysrPOS_v1/scripts/deploy.sh`

**Interfaces:**
- Consumes: clean backend + frontend from Tasks 3 & 4
- Produces: Docker infrastructure building and running under new identity/ports

- [ ] **Step 1: Update `docker-compose.yml`**

- Change project `name:` from `taysrpos` to `taysr-erp-v1`
- Change `POSTGRES_DB` default from `taysrpos_v0` to `taysr_erp_v1`
- Change `DATABASE_URL` to use `taysr_erp_v1`
- Change `TAYSRPOS_PROVISIONING_SECRET` env var name to `ERP_PROVISIONING_SECRET`
- Change Traefik host labels from `pos.taysr.com` to `erp.taysr.com` (or a configurable placeholder)
- Change network name from `taysrpos_network` to `taysr_erp_network`
- Change backend port from `4400` to `4401`
- Update healthcheck URLs to use port `4401`
- Change API backend service name from `api` to `api` (keep, but update comments)

- [ ] **Step 2: Update `Dockerfile` (root)**

- Update comments from "TaysrPOS v0" to "Taysr ERP v1"
- Change EXPOSE from `4400` to `4401`

- [ ] **Step 3: Update `backend/Dockerfile`**

- Update comments from "TaysrPOS v0" to "Taysr ERP v1"
- EXPOSE stays same (port is configured by env)

- [ ] **Step 4: Update `backend/docker-entrypoint.sh`**

- Change all echo strings from "TaysrPOS v0" to "Taysr ERP v1"

- [ ] **Step 5: Update `frontend/Dockerfile`**

- Update comments from "TaysrPOS v0" to "Taysr ERP v1"

- [ ] **Step 6: Update `scripts/deploy.sh`**

- Change all echo strings and banner from "TaysrPOS v0" to "Taysr ERP v1"
- Update Web Frontend URL to reflect new port/domain

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "infra: update Docker, deployment scripts, and ports for Taysr ERP v1 identity"
```

---

### Task 6: Update Documentation

**Files:**
- Modify: `TaysrPOS_v1/docs/BLUEPRINT.md`
- Modify: `TaysrPOS_v1/docs/PRODUCT_DECISIONS.md`
- Modify: `TaysrPOS_v1/docs/COOLIFY.md`

**Interfaces:**
- Consumes: clean project from Tasks 1–5
- Produces: Documentation that accurately reflects the generic ERP without restaurant references

- [ ] **Step 1: Update `docs/BLUEPRINT.md`**

- Remove the "Restaurant separation" section about `restaurantEnabled` toggle
- Remove `WAITER` and `KITCHEN` from Role Presets — keep `ADMIN`, `MANAGER`, `CASHIER`, `USER`
- Remove any mentions of Dining Areas, Tables, Kitchen Queue, Modifiers, Waiter Assignment
- Update the product title/direction to emphasize generic ERP + POS (no restaurant module)

- [ ] **Step 2: Update `docs/PRODUCT_DECISIONS.md`**

- Remove the optional restaurant settings section
- Remove any restaurant-specific decision guidelines

- [ ] **Step 3: Update `docs/COOLIFY.md`**

- Update service names and ports to match new docker-compose
- Update domain references from `pos.taysr.com` to `erp.taysr.com`
- Update database name references

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "docs: update all documentation for generic ERP identity, remove restaurant references"
```

---

### Task 7: Final Verification — Typecheck, Build, Smoke Test

**Files:**
- Test: All files in `TaysrPOS_v1/`

**Interfaces:**
- Consumes: complete clean project from Tasks 1–6
- Produces: Verified, building, type-safe generic ERP project

- [ ] **Step 1: Install dependencies**

```bash
cd TaysrPOS_v1
npm install
```

- [ ] **Step 2: Generate Prisma client**

```bash
npx prisma generate --schema backend/prisma/schema.prisma
```

- [ ] **Step 3: Run full typecheck**

```bash
npm run typecheck
```

Expected: 0 errors from both backend and frontend workspaces.

- [ ] **Step 4: Build frontend**

```bash
npm run build --workspace frontend
```

Expected: Vite build completes successfully, `frontend/dist/` produced.

- [ ] **Step 5: Grep for remaining restaurant references**

```bash
grep -rn --include='*.ts' --include='*.tsx' --include='*.prisma' -iE 'restaurant|WAITER|KITCHEN|MENU_ITEM|DINE_IN|TAKEAWAY|DELIVERY|RestaurantArea|RestaurantTable|ModifierGroup|ModifierOption|SaleItemModifier|kitchenStatus|tableId.*restaurant|waiterId' TaysrPOS_v1/ \
  | grep -v node_modules \
  | grep -v generated \
  | grep -v '.git/'
```

Expected: No matches outside of `node_modules/` and `generated/` directories. If any remain, fix them.

- [ ] **Step 6: Verify no dead imports**

```bash
grep -rn --include='*.ts' --include='*.tsx' \
  -E "from.*restaurant|from.*KitchenPage|from.*split-merge" \
  TaysrPOS_v1/ | grep -v node_modules
```

Expected: No matches.

- [ ] **Step 7: Final commit**

```bash
cd TaysrPOS_v1
git add -A
git commit -m "verified: clean generic ERP build — all typechecks pass, no restaurant references remain"
```

---

## Summary of Removals

### Prisma Schema Removals
| Element | Type | Lines |
|---------|------|-------|
| `RestaurantOrderStatus` | enum | 87–93 |
| `WAITER`, `KITCHEN` | enum values in `UserRole` | 14–15 |
| `MENU_ITEM`, `INGREDIENT` | enum values in `ProductType` | 27–28 |
| `DINE_IN`, `TAKEAWAY`, `DELIVERY` | enum values in `SaleChannel` | 48–50 |
| `KITCHEN`, `READY` | enum values in `SaleStatus` | 56–57 |
| `restaurantEnabled` | field on `Company` | 114 |
| `restaurantAreas`, `restaurantTables`, `modifierGroups` | relations on `Company` | 133–135 |
| `servedSales` (SaleWaiter) | relation on `User` | 171 |
| `RestaurantArea` | model | 454–464 |
| `RestaurantTable` | model | 466–479 |
| `ModifierGroup` | model | 481–492 |
| `ModifierOption` | model | 494–505 |
| `waiterId`, `tableId` | fields on `Sale` | 513–514 |
| `waiter`, `table` | relations on `Sale` | 555–556 |
| `kitchenStatus` | field on `SaleItem` | 589 |
| `modifiers` | relation on `SaleItem` | 594 |
| `SaleItemModifier` | model | 597–609 |

### Backend File Removals
| File | Action |
|------|--------|
| `routes/restaurant.routes.ts` | Delete entirely |
| `index.ts` | Remove import + mount + health/modules references |
| `routes/settings.routes.ts` | Remove `restaurantEnabled` from GET/PUT |
| `routes/product.routes.ts` | Remove `MENU_ITEM`/`INGREDIENT` type + `isKitchenItem` |
| `routes/sale.routes.ts` | Remove `tableId`/`waiterId`/kitchen endpoint |
| `routes/platform.routes.ts` | Remove `WAITER`/`KITCHEN` role mapping |
| `scripts/seed.ts` | Remove `restaurantEnabled` from seed |
| `scripts/tenant-isolation-smoke.ts` | Remove `restaurantEnabled` from test data |

### Frontend File Removals
| File | Action |
|------|--------|
| `pages/KitchenPage.tsx` | Delete entirely |
| `split-merge-modals.tsx` | Delete entirely |
| `main.tsx` | Remove WAITER/MENU_ITEM types, restaurant conditionals, sidebar items, page routes |
| `context/PosContext.tsx` | Remove kitchen/restaurant/table state |
