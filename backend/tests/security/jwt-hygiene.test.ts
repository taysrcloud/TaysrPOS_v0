import { describe, it, before, after } from 'node:test';
import { strict as assert } from 'node:assert';
import jwt from 'jsonwebtoken';
import { getTestServer, closeTestServer, RunningTestServer } from '../helpers/test-server.js';
import { createTestTenant, cleanupTestTenant, TestTenantContext } from '../helpers/test-db.js';

describe('Security: JWT Hygiene & Sensitive Data Leakage Prevention', () => {
  let serverCtx: RunningTestServer;
  let tenant: TestTenantContext;

  before(async () => {
    serverCtx = await getTestServer();
    tenant = await createTestTenant('jwt-hygiene');
  });

  after(async () => {
    await cleanupTestTenant(tenant);
    await closeTestServer();
  });

  it('POST /api/auth/login returns a JWT token that contains NO databaseUrl property', async () => {
    const adminUser = tenant.users.ADMIN;
    
    const res = await serverCtx.client.post('/api/auth/login', {
      username: adminUser.username,
      password: 'TestPass123!',
    });

    assert.strictEqual(res.status, 200, `Login should succeed with 200, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert.ok(res.body.token, 'Response must contain JWT token');

    const token = res.body.token;
    const decoded = jwt.decode(token) as Record<string, any>;

    assert.ok(decoded, 'Token must be successfully decodable');
    
    // Critical security assertion: databaseUrl must NOT be leaked into JWT payload
    assert.strictEqual(
      'databaseUrl' in decoded,
      false,
      'JWT payload must NOT contain databaseUrl property'
    );
    assert.strictEqual(decoded.databaseUrl, undefined);
  });

  it('Decoded JWT payload contains only non-sensitive claims', async () => {
    const cashierUser = tenant.users.CASHIER;

    const res = await serverCtx.client.post('/api/auth/login', {
      username: cashierUser.username,
      password: 'TestPass123!',
    });

    assert.strictEqual(res.status, 200);
    const decoded = jwt.decode(res.body.token) as Record<string, any>;

    const allowedClaims = new Set([
      'userId',
      'username',
      'companyId',
      'role',
      'accountId',
      'platformUserId',
      'iat',
      'exp',
    ]);

    // Check every key present in JWT payload
    for (const key of Object.keys(decoded)) {
      assert.ok(
        allowedClaims.has(key),
        `Unexpected claim "${key}" found in JWT payload. Only non-sensitive claims are permitted.`
      );
    }

    // Verify claim types and values
    assert.strictEqual(typeof decoded.userId, 'number');
    assert.strictEqual(typeof decoded.username, 'string');
    assert.strictEqual(typeof decoded.companyId, 'number');
    assert.strictEqual(typeof decoded.role, 'string');
    assert.strictEqual(decoded.role, 'CASHIER');

    // Verify no credential fields exist
    assert.strictEqual(decoded.password, undefined);
    assert.strictEqual(decoded.passwordHash, undefined);
    assert.strictEqual(decoded.pin, undefined);
    assert.strictEqual(decoded.pinHash, undefined);
    assert.strictEqual(decoded.secret, undefined);
  });

  it('Protected routes (GET /api/auth/me) authenticate successfully with hygiene-compliant JWT', async () => {
    const adminUser = tenant.users.ADMIN;

    const loginRes = await serverCtx.client.post('/api/auth/login', {
      username: adminUser.username,
      password: 'TestPass123!',
    });

    assert.strictEqual(loginRes.status, 200);
    const token = loginRes.body.token;

    const meRes = await serverCtx.client.get('/api/auth/me', token);
    assert.strictEqual(meRes.status, 200, `Protected route should return 200, got ${meRes.status}`);
    assert.strictEqual(meRes.body.user.username, adminUser.username);
    assert.strictEqual(meRes.body.company.id, tenant.company.id);
  });
});
