# Task 5 Brief: Frontend Headless Browser Smoke Test Suite

## Task Overview
Implement headless browser end-to-end smoke tests in `TaysrPOS_v1/frontend/tests/e2e/`:
1. `auth-session.e2e.ts`:
   - Launch headless chromium, navigate to login page (`http://localhost:5401` or test server).
   - Enter credentials, click login, verify redirect to Dashboard or POS screen.
   - Verify `localStorage` auth token is set and contains valid JWT claims without sensitive leakage.
2. `pos-checkout.e2e.ts`:
   - Log in as Cashier.
   - Open Register session if prompted.
   - Add catalog item to cart.
   - Complete checkout with cash payment.
   - Verify ticket receipt modal or confirmation dialog displays.
   - Capture verification screenshots.
3. Update `TaysrPOS_v1/frontend/package.json` with `"test:e2e": "node --import tsx --test tests/e2e/**/*.e2e.ts"`.

## Deliverables
- `TaysrPOS_v1/frontend/tests/e2e/helpers/browser.ts`
- `TaysrPOS_v1/frontend/tests/e2e/auth-session.e2e.ts`
- `TaysrPOS_v1/frontend/tests/e2e/pos-checkout.e2e.ts`
- `TaysrPOS_v1/frontend/package.json`

## Verification
- Start test backend on port 4401 and Vite frontend on 5401.
- Run `npm run test:e2e --workspace frontend`.
- Ensure all browser assertions pass.

## Report File
Write execution details to `TaysrPOS_v1/.superpowers/sdd/2026-08-17-full-app-testing-plan/task-5-report.md`.
