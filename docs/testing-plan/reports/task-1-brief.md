# Task 1 Brief: Test Infrastructure & Helper Scaffolding

## Task Overview
Build the foundational testing helpers in `TaysrPOS_v1/backend/tests/helpers/`:
1. `test-db.ts`: deterministic tenant creator `createTestTenant(suffix)` and foreign-key-aware cleanup helper `cleanupTestTenant(tenant)`.
2. `test-client.ts`: typed API request client with Bearer auth support and JSON parsing.
3. Update `TaysrPOS_v1/backend/package.json` to include test scripts (`test`, `test:unit`, `test:security`, `test:api`, `test:flows`).
4. Update `TaysrPOS_v1/backend/tsconfig.json` to include `"tests/**/*.ts"`.

## Deliverables
- `TaysrPOS_v1/backend/tests/helpers/test-db.ts`
- `TaysrPOS_v1/backend/tests/helpers/test-client.ts`
- `TaysrPOS_v1/backend/package.json`
- `TaysrPOS_v1/backend/tsconfig.json`

## Verification
- Run `npm run typecheck --workspace backend` and ensure 0 type errors.
- Ensure `test-db.ts` and `test-client.ts` can be imported cleanly.

## Report File
Write full execution details to `TaysrPOS_v1/.superpowers/sdd/2026-08-17-full-app-testing-plan/task-1-report.md`.
