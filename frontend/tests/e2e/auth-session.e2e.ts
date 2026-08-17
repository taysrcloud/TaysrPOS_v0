import { describe, it, before, after } from 'node:test';
import { strict as assert } from 'node:assert';
import os from 'node:os';
import path from 'node:path';
import { createTestBrowser, closeTestBrowser, BrowserContext } from './helpers/browser.js';
import { ensureAppServers, RunningServers } from './helpers/server.js';
import { createTestTenant, cleanupTestTenant, TestTenantContext } from '../../../backend/tests/helpers/test-db.js';

describe('Frontend E2E: Authentication & Session Hygiene', () => {
  let servers: RunningServers;
  let browserCtx: BrowserContext;
  let tenant: TestTenantContext;

  before(async () => {
    servers = await ensureAppServers();
    browserCtx = await createTestBrowser();
    tenant = await createTestTenant('e2e-auth');
  });

  after(async () => {
    await closeTestBrowser(browserCtx);
    await cleanupTestTenant(tenant);
    await servers.stop();
  });

  it('Performs login via UI form, verifies session in localStorage, and checks JWT hygiene', async () => {
    const { page } = browserCtx;
    const frontendUrl = `http://127.0.0.1:${servers.frontendPort}`;

    // 1. Navigate to frontend root
    await page.goto(frontendUrl, { waitUntil: 'networkidle0', timeout: 30000 });

    // Verify login form is present
    await page.waitForSelector('input[type="text"]', { timeout: 10000 });
    await page.waitForSelector('input[type="password"]', { timeout: 10000 });

    // 2. Fill login credentials for test ADMIN user
    await page.type('input[type="text"]', tenant.users.ADMIN.email);
    await page.type('input[type="password"]', 'TestPass123!');

    // 3. Submit login form
    const submitBtn = await page.$('button[type="submit"]');
    assert.ok(submitBtn, 'Login submit button must exist');
    await submitBtn.click();

    // 4. Wait for authentication state transition
    await page.waitForFunction(
      () => Boolean(localStorage.getItem('taysrPOS_token')),
      { timeout: 15000 }
    );

    // 5. Verify localStorage session hygiene
    const token = await page.evaluate(() => localStorage.getItem('taysrPOS_token'));
    assert.ok(token, 'Auth token must be stored in localStorage');

    const storedUserRaw = await page.evaluate(() => localStorage.getItem('taysrPOS_user'));
    assert.ok(storedUserRaw, 'User profile must be stored in localStorage');
    const storedUser = JSON.parse(storedUserRaw as string);
    assert.strictEqual(storedUser.username, tenant.users.ADMIN.username);

    // Verify JWT hygiene (NO databaseUrl claim)
    const tokenParts = token.split('.');
    assert.strictEqual(tokenParts.length, 3, 'Token must be a valid 3-part JWT');
    const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString('utf8'));
    assert.strictEqual(payload.databaseUrl, undefined, 'JWT payload in browser MUST NOT contain databaseUrl');
    assert.strictEqual(payload.role, 'ADMIN');

    // 6. Capture screenshot
    const screenshotPath = path.join(os.tmpdir(), 'taysr_auth_session.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
  });
});
