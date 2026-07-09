const fs = require('fs');
let mainTsx = fs.readFileSync('c:/xampp/htdocs/TaysrSuite/apps/TaysrPOS_v0/frontend/src/main.tsx', 'utf8');
let stylesCss = fs.readFileSync('c:/xampp/htdocs/TaysrSuite/apps/TaysrPOS_v0/frontend/src/styles.css', 'utf8');

// 1. Fix session check to allow resuming
const sessionCheckTarget = `if (todayStr === sessionDateStr) {`;
const sessionCheckReplacement = `if (true) { // Allow resuming any open session regardless of date`;
mainTsx = mainTsx.replace(sessionCheckTarget, sessionCheckReplacement);

// 2. Add mobileMenuOpen state
if (!mainTsx.includes('mobileMenuOpen')) {
  mainTsx = mainTsx.replace(
    `const [isFullscreen, setIsFullscreen] = useState(false);`,
    `const [isFullscreen, setIsFullscreen] = useState(false);\n  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);`
  );

  // 3. Update sidebar to include mobileMenuOpen class and backdrop
  mainTsx = mainTsx.replace(
    `<aside className="sidebar">`,
    `{mobileMenuOpen && <div className="sidebar-backdrop" onClick={() => setMobileMenuOpen(false)}></div>}\n      <aside className={\`sidebar \${mobileMenuOpen ? 'mobile-open' : ''}\`}>`
  );

  // 4. Add Hamburger button. Let's add it to the brand block, or a floating button.
  // The easiest way to add a universal hamburger button is to add a floating button on mobile if the menu is closed.
  mainTsx = mainTsx.replace(
    `{(!isFullscreen || page !== 'POS') && (`,
    `{!mobileMenuOpen && (!isFullscreen || page !== 'POS') && (\n        <button className="mobile-menu-trigger" onClick={() => setMobileMenuOpen(true)}>\n          <Menu size={24} />\n        </button>\n      )}\n      {(!isFullscreen || page !== 'POS') && (`
  );
  
  // also add Menu to imports
  if (!mainTsx.includes('Menu,')) {
    mainTsx = mainTsx.replace(`ChevronDown} from 'lucide-react';`, `ChevronDown, Menu} from 'lucide-react';`);
  }
}

// 5. Update CSS for mobile menu
const mobileMenuCss = `
@media (max-width: 820px) {
  .app-shell { height: 100vh; flex-direction: column; overflow: hidden; }
  
  .sidebar {
    position: fixed;
    top: 0;
    left: -300px;
    width: 280px;
    height: 100vh;
    flex-direction: column;
    align-items: stretch;
    padding: 0;
    border-right: 1px solid var(--line);
    background: #fff;
    z-index: 1000;
    transition: left 0.3s ease;
    overflow-y: auto;
  }
  .sidebar.mobile-open {
    left: 0;
  }
  .brand-block { display: flex; } 
  nav { display: grid; flex-direction: column; overflow-y: auto; overflow-x: hidden; padding: 12px; gap: 8px; flex: 1; }
  nav button { min-height: 44px; padding: 0 16px; white-space: normal; flex-shrink: 0; display: flex; }
  nav button span { display: inline; }
  .sidebar > div { display: block; }
  .sidebar-footer { display: block; }

  .sidebar-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.4);
    backdrop-filter: blur(2px);
    z-index: 999;
  }

  .mobile-menu-trigger {
    display: flex;
    position: fixed;
    top: 16px;
    left: 16px;
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: #fff;
    border: 1px solid var(--line);
    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    align-items: center;
    justify-content: center;
    z-index: 900;
    color: #475569;
    cursor: pointer;
  }

  main { flex: 1; padding: 16px; padding-top: 72px; overflow-y: auto; }
  main.pos-main { padding: 8px; padding-top: 72px; }
  .topbar { align-items: flex-start; flex-direction: column; min-height: auto; padding: 12px; margin-top: 12px; display: none; }
  h1 { font-size: 18px; }
  .metric-grid, .stats-panel, .primary-fields, .form-grid, .payment-actions { grid-template-columns: 1fr; }
  .table-head, .data-head { display: none; }
  .table-row, .data-row { grid-template-columns: 1fr; gap: 8px; }
  .product-picker, .cart-panel { min-height: 0; }
}
@media (min-width: 821px) {
  .sidebar-backdrop, .mobile-menu-trigger { display: none !important; }
}
`;

stylesCss = stylesCss.replace(/@media \(max-width: 820px\) \{[\s\S]*?\.product-picker, \.cart-panel \{ min-height: 0; \}\s*\}/, mobileMenuCss.trim());

fs.writeFileSync('c:/xampp/htdocs/TaysrSuite/apps/TaysrPOS_v0/frontend/src/main.tsx', mainTsx, 'utf8');
fs.writeFileSync('c:/xampp/htdocs/TaysrSuite/apps/TaysrPOS_v0/frontend/src/styles.css', stylesCss, 'utf8');

console.log('Done refactoring');
