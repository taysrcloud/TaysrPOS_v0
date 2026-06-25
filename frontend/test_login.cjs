const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  page.on('requestfailed', request =>
    console.log('REQUEST FAILED:', request.url(), request.failure().errorText)
  );

  await page.goto('http://localhost:5403/');
  
  // Fill login form
  await page.waitForSelector('input[type="email"], input[type="text"]');
  await page.type('input[type="email"], input[type="text"]', 'admin');
  await page.type('input[type="password"]', 'admin123');
  
  await page.click('button[type="submit"]');
  
  // Wait a bit to see errors
  await new Promise(r => setTimeout(r, 3000));
  
  await browser.close();
})();
