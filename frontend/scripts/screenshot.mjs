#!/usr/bin/env node
// Reusable visual-preview screenshot helper (Termux/aarch64 headless Chromium
// - see setup-headless-browser.sh for what makes this work on this platform).
//
// Usage:
//   node scripts/screenshot.mjs <url> <output.png> [--width=1280] [--height=900] [--full-page]
//
// Examples:
//   node scripts/screenshot.mjs http://127.0.0.1:5173 /tmp/login.png
//   node scripts/screenshot.mjs http://127.0.0.1:5173 /tmp/dashboard.png --full-page
//
// For scripted interaction (login, click through, wait for a selector) don't
// use this file - import puppeteer directly and reuse the launch() options
// below; this script only covers the common "load a URL and screenshot it" case.

import puppeteer from 'puppeteer';

const [, , url, outputPath, ...flags] = process.argv;

if (!url || !outputPath) {
  console.error('Usage: node scripts/screenshot.mjs <url> <output.png> [--width=1280] [--height=900] [--full-page]');
  process.exit(1);
}

const getFlag = (name, fallback) => {
  const match = flags.find(f => f.startsWith(`--${name}=`));
  return match ? Number(match.split('=')[1]) : fallback;
};
const fullPage = flags.includes('--full-page');

const CHROMIUM_BIN = process.env.CHROMIUM_BIN || `${process.env.PREFIX}/bin/chromium-browser`;

const browser = await puppeteer.launch({
  executablePath: CHROMIUM_BIN,
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: getFlag('width', 1280), height: getFlag('height', 900) });
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
  await page.screenshot({ path: outputPath, fullPage });
  console.log(`Saved ${outputPath} (${await page.title()})`);
} finally {
  await browser.close();
}
