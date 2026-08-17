import { describe, it, before, after } from 'node:test';
import { strict as assert } from 'node:assert';
import bcrypt from 'bcrypt';
import { getTestServer, closeTestServer, RunningTestServer } from '../helpers/test-server.js';
import { getDefaultPrisma } from '../../src/utils/prisma.js';

const prisma = getDefaultPrisma();

describe('Security: Auth Hardening (Provisioning & Password Hashing)', () => {
  let serverCtx: RunningTestServer;
  const createdCompanyIds: number[] = [];

  before(async () => {
    serverCtx = await getTestServer();
  });

  after(async () => {
    for (const companyId of createdCompanyIds) {
      await prisma.user.deleteMany({ where: { companyId } }).catch(() => {});
      await prisma.warehouse.deleteMany({ where: { companyId } }).catch(() => {});
      await prisma.location.deleteMany({ where: { companyId } }).catch(() => {});
      await prisma.contact.deleteMany({ where: { companyId } }).catch(() => {});
      await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
    }
    await closeTestServer();
  });

  it('POST /api/platform/provision-tenant rejects requests without X-Platform-Secret header (403)', async () => {
    const payload = {
      platform_account_id: `SEC-NOPASS-${Date.now()}`,
      name: 'Unauthorized Provision Test',
      email: `unauth-${Date.now()}@test.local`,
      password: 'SecretPassword123!',
    };

    const res = await serverCtx.client.post('/api/platform/provision-tenant', payload);
    assert.strictEqual(res.status, 403, 'Should reject provisioning without secret header with 403 Forbidden');
  });

  it('POST /api/platform/provision-tenant rejects requests with invalid X-Platform-Secret (403)', async () => {
    const payload = {
      platform_account_id: `SEC-BADPASS-${Date.now()}`,
      name: 'Invalid Secret Provision Test',
      email: `invalid-secret-${Date.now()}@test.local`,
      password: 'SecretPassword123!',
    };

    const res = await serverCtx.client.post(
      '/api/platform/provision-tenant',
      payload,
      undefined,
      { 'X-Platform-Secret': 'wrong-unauthorized-secret' }
    );
    assert.strictEqual(res.status, 403, 'Should reject provisioning with invalid secret header with 403 Forbidden');
  });

  it('POST /api/platform/provision-tenant hashes the user password using bcrypt and succeeds with valid credentials', async () => {
    const expectedSecret = process.env.TAYSRPOS_PROVISIONING_SECRET || 'secret';
    const marker = `sec-prov-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const rawPassword = 'ProvisionPassword123!';
    const accountId = `ACC-${marker}`;
    const username = `admin-${marker}`;
    const email = `${username}@taysr.test`;

    const payload = {
      platform_account_id: accountId,
      name: `Tenant ${marker}`,
      username,
      email,
      password: rawPassword,
      first_name: 'Super Admin',
      role: 'ADMIN',
    };

    const res = await serverCtx.client.post(
      '/api/platform/provision-tenant',
      payload,
      undefined,
      { 'X-Platform-Secret': expectedSecret }
    );

    assert.strictEqual(res.status, 200, `Provisioning should succeed with 200, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert.strictEqual(res.body.synced, true);
    assert.strictEqual(res.body.user.username, username);

    const companyId = res.body.company.id;
    createdCompanyIds.push(companyId);

    // Verify user record in database
    const savedUser = await prisma.user.findFirst({
      where: { companyId, username },
    });

    assert.ok(savedUser, 'Provisioned user should exist in the database');
    assert.notStrictEqual(savedUser.passwordHash, rawPassword, 'Password must NOT be stored in plaintext');
    assert.ok(
      savedUser.passwordHash.startsWith('$2'),
      `Password hash should start with $2 (bcrypt format), got: ${savedUser.passwordHash}`
    );

    // Assert bcrypt.compare succeeds with provisioned password
    const matchesCorrect = await bcrypt.compare(rawPassword, savedUser.passwordHash);
    assert.strictEqual(matchesCorrect, true, 'bcrypt.compare must return true for correct provisioned password');

    // Assert bcrypt.compare fails for wrong password
    const matchesWrong = await bcrypt.compare('WrongPassword456!', savedUser.passwordHash);
    assert.strictEqual(matchesWrong, false, 'bcrypt.compare must return false for incorrect password');
  });
});
