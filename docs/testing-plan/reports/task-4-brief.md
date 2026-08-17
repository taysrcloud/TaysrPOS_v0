# Task 4 Brief: Core Transactional End-to-End Business Flow Suite

## Task Overview
Implement the end-to-end transactional lifecycle flows in `TaysrPOS_v1/backend/tests/flows/`:
1. `pos-sale-lifecycle.test.ts`:
   - Open Register session with starting cash balance $\rightarrow$ Add movement $\rightarrow$ Create multi-tender split sale (CASH + CARD) $\rightarrow$ Verify stock decrement in warehouse $\rightarrow$ Verify cash ledger posting $\rightarrow$ Close session with drawer count $\rightarrow$ Verify Z-report totals.
2. `purchase-inventory.test.ts`:
   - Create Purchase Order from Supplier $\rightarrow$ Verify stock increment in warehouse $\rightarrow$ Verify accounts payable / cash expense ledger impact.
3. `return-credit-note.test.ts`:
   - Perform full return and partial return on existing sale $\rightarrow$ Verify stock restock/increment $\rightarrow$ Verify credit note generation and negative ledger entry.
4. `multicurrency-flow.test.ts`:
   - Create foreign currency purchase & sale with exchange rate snapshots $\rightarrow$ Verify MAD total consistency.

## Deliverables
- `TaysrPOS_v1/backend/tests/flows/pos-sale-lifecycle.test.ts`
- `TaysrPOS_v1/backend/tests/flows/purchase-inventory.test.ts`
- `TaysrPOS_v1/backend/tests/flows/return-credit-note.test.ts`
- `TaysrPOS_v1/backend/tests/flows/multicurrency-flow.test.ts`

## Verification
- Run `npm run test:flows --workspace backend`.
- Ensure all business flow assertion suites pass.

## Report File
Write execution details to `TaysrPOS_v1/.superpowers/sdd/2026-08-17-full-app-testing-plan/task-4-report.md`.
