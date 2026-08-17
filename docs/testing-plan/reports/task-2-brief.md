# Task 2 Brief: Security & Hardening Verification Suite

## Task Overview
Implement the security hardening test suite in `TaysrPOS_v1/backend/tests/security/`:
1. `auth-hardening.test.ts`:
   - Assert `POST /api/platform/provision-tenant` rejects requests without valid `X-Platform-Secret` (403).
   - Assert `POST /api/platform/provision-tenant` hashes the user password using `bcrypt` (starts with `$2`), and rejects plaintext passwords.
   - Assert `bcrypt.compare` succeeds with the provisioned password.
2. `oauth-backdoor.test.ts`:
   - Assert `/oauth/token` rejects accounts whose passwordHash is not a valid bcrypt hash (e.g. `'hash'` or cleartext) and returns 401.
3. `jwt-hygiene.test.ts`:
   - Assert `POST /api/auth/login` token payload contains NO `databaseUrl` property.
   - Assert decoded JWT only contains non-sensitive claims (`userId`, `username`, `companyId`, `role`, `accountId`).

## Deliverables
- `TaysrPOS_v1/backend/tests/security/auth-hardening.test.ts`
- `TaysrPOS_v1/backend/tests/security/oauth-backdoor.test.ts`
- `TaysrPOS_v1/backend/tests/security/jwt-hygiene.test.ts`
- Fix any security bugs in `platform.routes.ts`, `oauth.routes.ts`, or `auth.routes.ts` if needed to make the security suite pass 100% clean.

## Verification
- Start backend API or run against local database.
- Run `npm run test:security --workspace backend`.
- Ensure all security assertion suites pass.

## Report File
Write execution details to `TaysrPOS_v1/.superpowers/sdd/2026-08-17-full-app-testing-plan/task-2-report.md`.
