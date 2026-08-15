import fs from 'fs';
const file = 'C:/xampp/htdocs/TaysrSuite/apps/TaysrPOS_v0/frontend/src/main.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace fetch(`${apiBase}/path`) with apiFetch(`/path`)
content = content.replace(/fetch\(`\$\{apiBase\}([^`]*)`/g, "apiFetch(`$1`");

// Handle fetch(url) where url = new URL(..., apiBase)
// The apiFetch function prepends apiBase, so if we pass url.pathname + url.search, it works.
content = content.replace(/fetch\(url\)/g, "apiFetch(url.pathname + url.search)");

fs.writeFileSync(file, content);
console.log('Replaced fetches');
