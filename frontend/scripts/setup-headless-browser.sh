#!/data/data/com.termux/files/usr/bin/bash
# Sets up headless-browser visual verification on Termux/Android (aarch64).
#
# Puppeteer's own postinstall tries to download a bundled Chromium build that
# does not exist for this platform ("platform not supported") - the same
# category of failure already solved for Prisma's schema-engine and bcrypt's
# native addon (see TRACE.md 2026-08-12 "Local Postgres unblocked"). The fix
# here is different: Termux's x11-repo ships a real, native aarch64 Chromium
# package that runs genuinely headless (--headless --no-sandbox) with NO X
# server, X11 forwarding, or termux-x11 app required - the "x11" in the repo
# name refers to what the package CAN link against for a windowed UI, not
# what headless mode needs at runtime. This script:
#   1. Enables Termux's x11-repo (adds the package source, not a display server).
#   2. Installs the `chromium` package (aarch64-native).
#   3. Installs `puppeteer` in frontend/ with its own download skipped, then
#      points it at the Termux-installed chromium-browser binary instead.
#   4. Verifies with a real launch + screenshot against example.com.
#
# Safe to re-run: each step checks whether it already applies before acting.
set -euo pipefail

cd "$(dirname "$0")/.."   # frontend/

echo "==> Enabling x11-repo (package source only, no display server)..."
if ! pkg list-installed 2>/dev/null | grep -q "^x11-repo/"; then
  pkg install -y x11-repo
else
  echo "    already enabled."
fi

echo "==> Installing chromium (aarch64-native)..."
if ! command -v chromium-browser >/dev/null 2>&1; then
  pkg install -y chromium
else
  echo "    already installed: $(chromium-browser --version)"
fi

CHROMIUM_BIN="$(command -v chromium-browser)"

echo "==> Installing puppeteer (skipping its own Chromium download)..."
if [ ! -d node_modules/puppeteer ]; then
  PUPPETEER_SKIP_DOWNLOAD=true npm install puppeteer --no-save
else
  echo "    already installed."
fi

echo "==> Verifying: launch + screenshot smoke test..."
CHROMIUM_BIN="$CHROMIUM_BIN" node --input-type=module -e "
import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({
  executablePath: process.env.CHROMIUM_BIN,
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
});
const page = await browser.newPage();
await page.goto('https://example.com', { waitUntil: 'networkidle0' });
const title = await page.title();
await browser.close();
if (title !== 'Example Domain') throw new Error('Unexpected title: ' + title);
console.log('OK - headless Chromium + Puppeteer working.');
"

echo ""
echo "Done. Chromium binary: $CHROMIUM_BIN"
echo "Use scripts/screenshot.mjs for one-off screenshots, or import"
echo "puppeteer directly with { executablePath: '$CHROMIUM_BIN', args: ['--no-sandbox'] }"
echo "in any script needing full page interaction (click, type, wait for selector)."
