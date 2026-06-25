const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  page.on('response', async res => {
    if (res.url().includes('/api/')) {
      console.log('API RESPONSE:', res.url(), res.status());
    }
  });

  await page.goto('http://127.0.0.1:5403/');
  
  // Wait for email input
  await page.waitForSelector('input[type="text"]');
  await page.type('input[type="text"]', 'admin');
  await page.type('input[type="password"]', 'admin123');
  
  await page.click('button[type="submit"]');
  
  await new Promise(r => setTimeout(r, 4000));
  
  await browser.close();
})();
