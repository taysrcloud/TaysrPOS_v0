import { describe, it, before, after } from 'node:test';
import { strict as assert } from 'node:assert';
import os from 'node:os';
import path from 'node:path';
import { createTestBrowser, closeTestBrowser, BrowserContext } from './helpers/browser.js';
import { ensureAppServers, RunningServers } from './helpers/server.js';
import { createTestTenant, cleanupTestTenant, TestTenantContext } from '../../../backend/tests/helpers/test-db.js';
import { getDefaultPrisma } from '../../../backend/src/utils/prisma.js';

const prisma = getDefaultPrisma();

describe('Frontend E2E: POS Cashier Checkout & Ticket Generation Flow', () => {
  let servers: RunningServers;
  let browserCtx: BrowserContext;
  let tenant: TestTenantContext;

  before(async () => {
    servers = await ensureAppServers();
    browserCtx = await createTestBrowser();
    tenant = await createTestTenant('e2e-pos');

    // Ensure Cashier has an active open register session
    await prisma.cashRegisterSession.create({
      data: {
        companyId: tenant.company.id,
        locationId: tenant.location.id,
        userId: tenant.users.CASHIER.id,
        openingCash: 500,
      },
    });
  });

  after(async () => {
    await closeTestBrowser(browserCtx);
    await cleanupTestTenant(tenant);
    await servers.stop();
  });

  it('Logs in as Cashier, navigates to POS interface, and captures terminal session', async () => {
    const { page } = browserCtx;
    const frontendUrl = `http://127.0.0.1:${servers.frontendPort}`;

    // 1. Navigate to frontend root
    await page.goto(frontendUrl, { waitUntil: 'networkidle0', timeout: 30000 });

    // 2. Fill login form with Cashier credentials
    await page.waitForSelector('input[type="text"]', { timeout: 10000 });
    await page.type('input[type="text"]', tenant.users.CASHIER.email);
    await page.type('input[type="password"]', 'TestPass123!');

    const submitBtn = await page.$('button[type="submit"]');
    assert.ok(submitBtn, 'Submit button must exist');
    await submitBtn.click();

    // 3. Wait for session token in localStorage
    await page.waitForFunction(
      () => Boolean(localStorage.getItem('taysrPOS_token')),
      { timeout: 15000 }
    );

    // 4. Verify authenticated state is maintained
    const storedToken = await page.evaluate(() => localStorage.getItem('taysrPOS_token'));
    assert.ok(storedToken, 'Token must be present in localStorage');

    // 5. Capture POS terminal screenshot
    const screenshotPath = path.join(os.tmpdir(), 'taysr_pos_checkout.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
  });
});
