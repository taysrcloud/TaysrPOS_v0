# TaysrPOS_v1 Security Hardening & Vulnerability Remediation

This document details the security vulnerabilities identified and remediated during the implementation of the comprehensive testing suite.

---

## 1. Vulnerability Summary & Fix Verification

| # | Vulnerability | Severity | Affected File | Remediation | Verification Test |
|---|---|---|---|---|---|
| **SEC-01** | Legacy OAuth Dummy `'hash'` Backdoor | **CRITICAL** | `src/routes/oauth.routes.ts` | Removed fallback condition `password === user.passwordHash \|\| user.passwordHash === 'hash'`. Forced strict `bcrypt.compare` for all accounts. | `tests/security/oauth-backdoor.test.ts` |
| **SEC-02** | Unauthenticated Tenant Provisioning | **HIGH** | `src/routes/platform.routes.ts` | Enforced mandatory `X-Platform-Secret` validation against `PLATFORM_PROVISIONING_SECRET`. | `tests/security/auth-hardening.test.ts` |
| **SEC-03** | Plaintext User Password Storage on Provisioning | **HIGH** | `src/routes/platform.routes.ts` | Integrated `bcrypt.hash(password, 10)` before persisting tenant administrator password. | `tests/security/auth-hardening.test.ts` |
| **SEC-04** | Client JWT Payload Leaking Internal Database Connection Strings | **HIGH** | `src/routes/auth.routes.ts` & `src/middleware/auth.ts` | Removed `databaseUrl` from JWT signing payload. Tenant database lookup is resolved server-side from `accountId` via membership metadata. | `tests/security/jwt-hygiene.test.ts` |

---

## 2. Detailed Remediation Evidence

### SEC-01: OAuth Backdoor & Plaintext Fallback Elimination
- **Before:** If a database record had `passwordHash === 'hash'` or matched the plaintext password directly, authentication succeeded without bcrypt validation.
- **After:**
  ```typescript
  // oauth.routes.ts
  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    return res.status(401).json({ error: 'invalid_grant', error_description: 'Identifiant ou mot de passe incorrect' });
  }
  ```
- **Test Evidence:**
  - `tests/security/oauth-backdoor.test.ts` asserts that logging in with dummy hash `'hash'` returns `401 Unauthorized` (`invalid_grant`), and cleartext database records cannot authenticate.

### SEC-02: Tenant Provisioning Secret Enforcement
- **Before:** `POST /api/platform/provision-tenant` was open to public unauthenticated access if the provisioning secret check was bypassed.
- **After:**
  ```typescript
  // platform.routes.ts
  const secretHeader = req.header('X-Platform-Secret');
  if (!PLATFORM_PROVISIONING_SECRET || secretHeader !== PLATFORM_PROVISIONING_SECRET) {
    return res.status(403).json({ message: 'Forbidden: Invalid platform secret' });
  }
  ```
- **Test Evidence:**
  - Requests without `X-Platform-Secret` return `403 Forbidden`.
  - Requests with invalid `X-Platform-Secret` return `403 Forbidden`.

### SEC-03: Provisioning Password Hashing
- **Before:** `platform.routes.ts` saved `data.password` directly to `passwordHash`.
- **After:**
  ```typescript
  // platform.routes.ts
  const passwordHash = await bcrypt.hash(data.password, 10);
  ```
- **Test Evidence:**
  - Database assertions verify that the saved `passwordHash` string starts with `$2b$10$` and matches `bcrypt.compare`.

### SEC-04: JWT Hygiene & Sensitive Data Leakage
- **Before:** `auth.routes.ts` signed `databaseUrl: targetMembership.databaseUrl` into the JWT payload delivered to the client browser `localStorage`.
- **After:**
  ```typescript
  // auth.routes.ts
  const token = jwt.sign(
    { 
      userId: tenantUser.id, 
      username: tenantUser.username, 
      companyId: tenantUser.companyId, 
      role: tenantUser.role,
      accountId: targetAccountId,
      platformUserId: platformUserId,
    },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
  ```
- **Test Evidence:**
  - `tests/security/jwt-hygiene.test.ts` and `frontend/tests/e2e/auth-session.e2e.ts` inspect the base64-decoded token payload in `localStorage` and assert `databaseUrl === undefined`.
