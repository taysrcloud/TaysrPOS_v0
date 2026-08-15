const fs = require('fs');
let css = fs.readFileSync('c:/xampp/htdocs/TaysrSuite/apps/TaysrPOS_v0/frontend/src/styles.css', 'utf8');

// Replace the @media (max-width: 820px) sidebar styles
const mobileSidebarStyles = `
@media (max-width: 820px) {
  .app-shell { height: 100vh; flex-direction: column; overflow: hidden; }
  .sidebar { width: 100%; min-height: 60px; flex-basis: auto; flex-direction: row; align-items: center; padding: 0; border-right: none; border-bottom: 1px solid var(--line); z-index: 50; }
  .brand-block { display: none; } /* hide logo on mobile */
  nav { display: flex; flex-direction: row; overflow-x: auto; overflow-y: hidden; padding: 8px 12px; gap: 8px; }
  nav button { min-height: 36px; padding: 0 12px; white-space: nowrap; flex-shrink: 0; }
  .sidebar > div { display: none; } /* Hide the inline warehouse switcher on mobile for now to save space */
  .sidebar-footer { display: none; }
  main { flex: 1; padding: 12px; overflow-y: auto; }
  main.pos-main { padding: 8px; }
  main::before { inset: 0; }
  .topbar { align-items: flex-start; flex-direction: column; min-height: auto; padding: 12px; }
  h1 { font-size: 18px; }
  .metric-grid, .stats-panel, .primary-fields, .form-grid, .payment-actions { grid-template-columns: 1fr; }
  .table-head, .data-head { display: none; }
  .table-row, .data-row { grid-template-columns: 1fr; gap: 8px; }
  .product-picker, .cart-panel { min-height: 0; }
}
`;

// we find @media (max-width: 820px) { ... } up to the closing brace that is at the root level.
// A safe way is to replace the specific chunk we know.
css = css.replace(/@media \(max-width: 820px\) \{[\s\S]*?\.product-picker, \.cart-panel \{ min-height: 0; \}\s*\}/, mobileSidebarStyles.trim());

fs.writeFileSync('c:/xampp/htdocs/TaysrSuite/apps/TaysrPOS_v0/frontend/src/styles.css', css, 'utf8');
console.log('Updated mobile responsive CSS');
