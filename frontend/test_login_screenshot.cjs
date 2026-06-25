const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

  await page.goto('http://127.0.0.1:5403/');
  
  // Wait for login
  await page.waitForSelector('input[type="text"]');
  await page.type('input[type="text"]', 'admin');
  await page.type('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');
  
  // Wait 4 seconds for UI to load
  await new Promise(r => setTimeout(r, 4000));
  
  // Take screenshot
  await page.screenshot({ path: 'test_login_result.png' });
  
  await browser.close();
})();
