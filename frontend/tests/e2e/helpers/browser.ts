import puppeteer, { Browser, Page } from 'puppeteer';

const CHROMIUM_BIN = process.env.CHROMIUM_BIN || `${process.env.PREFIX || '/data/data/com.termux/files/usr'}/bin/chromium-browser`;

export interface BrowserContext {
  browser: Browser;
  page: Page;
}

export const createTestBrowser = async (viewport = { width: 1280, height: 900 }): Promise<BrowserContext> => {
  const browser = await puppeteer.launch({
    executablePath: CHROMIUM_BIN,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-setuid-sandbox',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
    ],
  });

  const page = await browser.newPage();
  await page.setViewport(viewport);

  // Capture console errors
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.log(`[Browser Console Error] ${msg.text()}`);
    }
  });

  return { browser, page };
};

export const closeTestBrowser = async (ctx: BrowserContext) => {
  if (ctx?.browser) {
    await ctx.browser.close().catch(() => {});
  }
};
