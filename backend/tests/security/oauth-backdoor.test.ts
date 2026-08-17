import { describe, it, before, after } from 'node:test';
import { strict as assert } from 'node:assert';
import bcrypt from 'bcrypt';
import { getTestServer, closeTestServer, RunningTestServer } from '../helpers/test-server.js';
import { getDefaultPrisma } from '../../src/utils/prisma.js';

const prisma = getDefaultPrisma();

describe('Security: OAuth Backdoor Elimination', () => {
  let serverCtx: RunningTestServer;
  let companyId: number;

  const validPassword = 'SecureUserPass123!';
  let validUserUsername: string;
  let dummyHashUserUsername: string;
  let cleartextUserUsername: string;

  before(async () => {
    serverCtx = await getTestServer();

    const marker = `oauth-sec-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const company = await prisma.company.create({
      data: {
        accountId: `ACC-${marker}`,
        name: `OAuth Sec Company ${marker}`,
      },
    });
    companyId = company.id;

    // 1. User with legacy dummy 'hash' passwordHash (old backdoor test fallback)
    dummyHashUserUsername = `dummy-hash-${marker}`;
    await prisma.user.create({
      data: {
        companyId,
        username: dummyHashUserUsername,
        email: `${dummyHashUserUsername}@test.local`,
        passwordHash: 'hash',
        fullName: 'Dummy Hash User',
        role: 'USER',
        isActive: true,
      },
    });

    // 2. User with plain text passwordHash
    cleartextUserUsername = `cleartext-${marker}`;
    await prisma.user.create({
      data: {
        companyId,
        username: cleartextUserUsername,
        email: `${cleartextUserUsername}@test.local`,
        passwordHash: 'insecure_plaintext_password',
        fullName: 'Cleartext User',
        role: 'USER',
        isActive: true,
      },
    });

    // 3. Legitimate user with valid bcrypt hash
    const bcryptHash = await bcrypt.hash(validPassword, 10);
    validUserUsername = `bcrypt-user-${marker}`;
    await prisma.user.create({
      data: {
        companyId,
        username: validUserUsername,
        email: `${validUserUsername}@test.local`,
        passwordHash: bcryptHash,
        fullName: 'Valid Bcrypt User',
        role: 'USER',
        isActive: true,
      },
    });
  });

  after(async () => {
    if (companyId) {
      await prisma.user.deleteMany({ where: { companyId } }).catch(() => {});
      await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
    }
    await closeTestServer();
  });

  it('/oauth/token rejects accounts with dummy hash fallback ("hash") when logging in with "hash" (401)', async () => {
    const res = await serverCtx.client.post('/oauth/token', {
      grant_type: 'password',
      username: dummyHashUserUsername,
      password: 'hash',
    });

    assert.strictEqual(res.status, 401, 'Should return 401 Unauthorized for dummy hash account');
    assert.strictEqual(res.body.error, 'invalid_grant');
  });

  it('/oauth/token rejects accounts with dummy hash fallback when logging in with arbitrary password (401)', async () => {
    const res = await serverCtx.client.post('/oauth/token', {
      grant_type: 'password',
      username: dummyHashUserUsername,
      password: 'anyrandompassword',
    });

    assert.strictEqual(res.status, 401, 'Should return 401 Unauthorized');
    assert.strictEqual(res.body.error, 'invalid_grant');
  });

  it('/oauth/token rejects accounts with cleartext passwordHash in database (401)', async () => {
    const res = await serverCtx.client.post('/oauth/token', {
      grant_type: 'password',
      username: cleartextUserUsername,
      password: 'insecure_plaintext_password',
    });

    assert.strictEqual(res.status, 401, 'Cleartext password matching in DB must be rejected with 401');
    assert.strictEqual(res.body.error, 'invalid_grant');
  });

  it('/oauth/token rejects valid bcrypt user with wrong password (401)', async () => {
    const res = await serverCtx.client.post('/oauth/token', {
      grant_type: 'password',
      username: validUserUsername,
      password: 'WrongPassword999!',
    });

    assert.strictEqual(res.status, 401, 'Invalid password must return 401');
    assert.strictEqual(res.body.error, 'invalid_grant');
  });

  it('/oauth/token succeeds for valid bcrypt user with correct credentials (200)', async () => {
    const res = await serverCtx.client.post('/oauth/token', {
      grant_type: 'password',
      username: validUserUsername,
      password: validPassword,
    });

    assert.strictEqual(res.status, 200, `Valid login should return 200, got ${res.status}`);
    assert.ok(res.body.access_token, 'Response must contain access_token');
    assert.strictEqual(res.body.token_type, 'Bearer');
    assert.ok(res.body.expires_in > 0);
  });

  it('/oauth/token rejects unsupported grant types with 400', async () => {
    const res = await serverCtx.client.post('/oauth/token', {
      grant_type: 'client_credentials',
      username: validUserUsername,
      password: validPassword,
    });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, 'unsupported_grant_type');
  });

  it('/oauth/token rejects requests missing username or password with 400', async () => {
    const res = await serverCtx.client.post('/oauth/token', {
      grant_type: 'password',
    });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, 'invalid_request');
  });
});
