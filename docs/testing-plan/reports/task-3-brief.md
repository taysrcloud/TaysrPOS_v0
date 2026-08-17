# Task 3 Brief: Complete 27-Route RBAC & Tenant Isolation Matrix

## Task Overview
Implement comprehensive integration tests in `TaysrPOS_v1/backend/tests/integration/`:
1. `rbac-matrix.test.ts`:
   - Matrix testing across the 4 roles (`ADMIN`, `MANAGER`, `CASHIER`, `USER`) across the 27 routes.
   - Assert Cashier can access POS sales and catalog, but is blocked (403) from accounting, commission agents, and device fleet management.
   - Assert Manager has elevated operational permissions.
   - Assert Admin has full access.
2. `tenant-isolation.test.ts`:
   - Multi-tenant cross-tenant attack tests: verify Tenant A token attempting to read, modify, or delete Tenant B's contacts, products, expenses, invoices, etc. is rejected with 404 / 403.
3. `fiscal-compliance.test.ts`:
   - Moroccan ICE verification for consolidated invoices (Facturation Groupée).
   - TVA calculations and unaccented status labels ('Payee', 'Final').

## Deliverables
- `TaysrPOS_v1/backend/tests/integration/rbac-matrix.test.ts`
- `TaysrPOS_v1/backend/tests/integration/tenant-isolation.test.ts`
- `TaysrPOS_v1/backend/tests/integration/fiscal-compliance.test.ts`

## Verification
- Run `npm run test:api --workspace backend`.
- Ensure all integration assertion suites pass clean.

## Report File
Write execution details to `TaysrPOS_v1/.superpowers/sdd/2026-08-17-full-app-testing-plan/task-3-report.md`.
