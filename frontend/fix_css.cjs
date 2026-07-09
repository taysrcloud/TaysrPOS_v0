const fs = require('fs');

let css = fs.readFileSync('c:/xampp/htdocs/TaysrSuite/apps/TaysrPOS_v0/frontend/src/styles.css', 'utf8');

// Update brand block
css = css.replace(
  /\.brand-block \{ height: 100px; flex: 0 0 100px; display: flex; align-items: center; padding: 18px 28px; background: #fff; border-bottom: 1px solid var\(--line\); \}/,
  `.brand-block { height: 72px; flex: 0 0 72px; display: flex; align-items: center; padding: 12px 20px; background: #fff; border-bottom: 1px solid var(--line); }`
);

css = css.replace(
  /\.brand-line strong \{ color: #0f172a; font-size: 32px; font-weight: 900; letter-spacing: -0\.05em; margin-right: 2px; \}/,
  `.brand-line strong { color: #0f172a; font-size: 24px; font-weight: 900; letter-spacing: -0.05em; margin-right: 2px; }`
);

css = css.replace(
  /\.brand-line strong span \{ color: #9333ea; font-size: 38px; line-height: 0; \}/,
  `.brand-line strong span { color: #9333ea; font-size: 28px; line-height: 0; }`
);

css = css.replace(
  /\.brand-wordmark em \{ display: block; color: #334155; font-size: 15px; font-style: normal; font-weight: 800; letter-spacing: 0\.05em; text-transform: uppercase; \}/,
  `.brand-wordmark em { display: block; color: #334155; font-size: 11px; font-style: normal; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; }`
);

// Update sidebar nav scrolling
css = css.replace(
  /nav \{ display: flex; flex-direction: column; gap: 4px; padding: 0 16px; flex: 1; \}/,
  `nav { display: flex; flex-direction: column; gap: 4px; padding: 0 12px; flex: 1; overflow-y: auto; }`
);

// Settings nav styles
const settingsCss = `
.settings-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  background: rgba(255,255,255,0.8);
  backdrop-filter: blur(8px);
  padding: 8px;
  border-radius: 16px;
  box-shadow: 0 2px 6px rgba(15,23,42,0.04);
  border: 1px solid #e2e8f0;
  margin-bottom: 24px;
}
.settings-nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 12px;
  border: 1px solid transparent;
  background: transparent;
  color: #64748b;
  font-size: 13px;
  font-weight: 700;
  transition: all 0.2s ease;
  cursor: pointer;
}
.settings-nav-item:hover {
  background: #f8fafc;
  color: #334155;
}
.settings-nav-item.active {
  background: #2563eb;
  color: #fff;
  box-shadow: 0 6px 14px rgba(37,99,235,0.2);
}
`;
if (!css.includes('.settings-nav { display: flex; flex-wrap: wrap')) {
  css += '\n' + settingsCss;
}

fs.writeFileSync('c:/xampp/htdocs/TaysrSuite/apps/TaysrPOS_v0/frontend/src/styles.css', css, 'utf8');
console.log('CSS updated');
