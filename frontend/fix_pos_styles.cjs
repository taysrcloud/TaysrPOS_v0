const fs = require('fs');

// ============ Fix main.tsx ============
let mainTsx = fs.readFileSync('c:/xampp/htdocs/TaysrSuite/apps/TaysrPOS_v0/frontend/src/main.tsx', 'utf8');

// 1. Add Menu to lucide-react import
if (!mainTsx.includes("Menu,") && !mainTsx.includes("Menu\r\n") && !mainTsx.includes("Menu\n}")) {
  mainTsx = mainTsx.replace(
    /  Mail\r?\n\} from 'lucide-react';/,
    `  Mail,\n  Menu\n} from 'lucide-react';`
  );
  console.log('Added Menu import');
} else {
  console.log('Menu import already present');
}

// 2. Ensure mobileMenuOpen state exists
if (!mainTsx.includes('mobileMenuOpen')) {
  mainTsx = mainTsx.replace(
    /const \[isFullscreen, setIsFullscreen\] = useState\(false\);/,
    `const [isFullscreen, setIsFullscreen] = useState(false);\n  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);`
  );
  console.log('Added mobileMenuOpen state');
} else {
  console.log('mobileMenuOpen state already present');
}

// 3. Fix the sidebar to include mobile-open class, hamburger trigger, and backdrop
// Current: {(!isFullscreen || page !== 'POS') && (  <aside className="sidebar">
// Target:
//   {!mobileMenuOpen && (!isFullscreen || page !== 'POS') && (
//     <button className="mobile-menu-trigger" ...>
//   )}
//   {(!isFullscreen || page !== 'POS') && (
//   <>
//     {mobileMenuOpen && <div className="sidebar-backdrop" .../>}
//     <aside className={`sidebar${mobileMenuOpen ? ' mobile-open' : ''}`}>

if (!mainTsx.includes('mobile-menu-trigger')) {
  // Replace the opening
  mainTsx = mainTsx.replace(
    /\{!\(\!isFullscreen \|\| page !== 'POS'\) && \(\r?\n\s*<aside className="sidebar">/,
    'NEVER_MATCH'  // fallback, actual regex below
  );

  // More precise replacement
  const sidebarOpenRegex = /(\{)\((!isFullscreen \|\| page !== 'POS')\) && \(\r?\n\s*<aside className="sidebar">/;
  
  // Actually let's do a simpler string find/replace
  const oldSidebarOpen = `{(!isFullscreen || page !== 'POS') && (\n      <aside className="sidebar">`;
  const oldSidebarOpenCR = `{(!isFullscreen || page !== 'POS') && (\r\n      <aside className="sidebar">`;
  
  const newSidebarOpen = `{!mobileMenuOpen && (!isFullscreen || page !== 'POS') && (
        <button className="mobile-menu-trigger" onClick={() => setMobileMenuOpen(true)}>
          <Menu size={24} />
        </button>
      )}
      {(!isFullscreen || page !== 'POS') && (
      <>
      {mobileMenuOpen && <div className="sidebar-backdrop" onClick={() => setMobileMenuOpen(false)} />}
      <aside className={\`sidebar\${mobileMenuOpen ? ' mobile-open' : ''}\`}>`;

  if (mainTsx.includes(oldSidebarOpenCR)) {
    mainTsx = mainTsx.replace(oldSidebarOpenCR, newSidebarOpen);
    console.log('Replaced sidebar open (CRLF)');
  } else if (mainTsx.includes(oldSidebarOpen)) {
    mainTsx = mainTsx.replace(oldSidebarOpen, newSidebarOpen);
    console.log('Replaced sidebar open (LF)');
  } else {
    console.log('WARNING: Could not find sidebar open pattern');
    // Show what's around the sidebar
    const idx = mainTsx.indexOf('<aside className="sidebar">');
    if (idx !== -1) {
      console.log('Found <aside className="sidebar"> at index', idx);
      console.log('Context:', JSON.stringify(mainTsx.substring(idx - 80, idx + 50)));
    }
  }

  // Replace the closing: </aside>\n      )}
  const oldSidebarClose = `</aside>\r\n      )}`;
  const oldSidebarCloseLF = `</aside>\n      )}`;
  const newSidebarClose = `</aside>\n      </>\n      )}`;

  if (mainTsx.includes(oldSidebarClose)) {
    mainTsx = mainTsx.replace(oldSidebarClose, newSidebarClose);
    console.log('Replaced sidebar close (CRLF)');
  } else if (mainTsx.includes(oldSidebarCloseLF)) {
    mainTsx = mainTsx.replace(oldSidebarCloseLF, newSidebarClose);
    console.log('Replaced sidebar close (LF)');
  } else {
    console.log('WARNING: Could not find sidebar close pattern');
  }
} else {
  console.log('Mobile menu trigger already present');
}

// 4. Auto-close drawer on nav click (already done if multi_replace worked)
if (!mainTsx.includes('setMobileMenuOpen(false)')) {
  mainTsx = mainTsx.replace(
    /onClick=\{?\(\) => setPage\(label as any\)\}>/g,
    `onClick={() => { setPage(label as any); setMobileMenuOpen(false); }}>`
  );
  console.log('Added auto-close on nav');
} else {
  console.log('Nav auto-close already present');
}

fs.writeFileSync('c:/xampp/htdocs/TaysrSuite/apps/TaysrPOS_v0/frontend/src/main.tsx', mainTsx, 'utf8');
console.log('main.tsx updated');

// ============ Fix styles.css ============
let stylesCss = fs.readFileSync('c:/xampp/htdocs/TaysrSuite/apps/TaysrPOS_v0/frontend/src/styles.css', 'utf8');

// 5. Remove duplicate @media (min-width: 821px) block
const dupRegex = /@media \(min-width: 821px\) \{\s*\.sidebar-backdrop, \.mobile-menu-trigger \{ display: none !important; \}\s*\}\s*@media \(min-width: 821px\) \{\s*\.sidebar-backdrop, \.mobile-menu-trigger \{ display: none !important; \}\s*\}/g;
stylesCss = stylesCss.replace(dupRegex, `@media (min-width: 821px) {\n  .sidebar-backdrop, .mobile-menu-trigger { display: none !important; }\n}`);
console.log('Removed duplicate media query');

// 6. Add missing workflow-card CSS
if (!stylesCss.includes('.workflow-card')) {
  // Find the workflow strip line and add after it
  const insertionPoint = stylesCss.indexOf('.wf-divider');
  const insertAfterLine = stylesCss.indexOf('\n', stylesCss.indexOf('.wf-divider {'));
  
  const workflowCardCss = `

/* Workflow cards — info cards inside pos-workflow-strip */
.workflow-card { flex: 1 1 200px; min-width: 180px; display: flex; flex-direction: column; gap: 3px; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 10px; background: #fff; overflow: hidden; }
.workflow-card-highlight { border-color: #c4b5fd; background: linear-gradient(135deg, #faf5ff, #ffffff); }
.workflow-label { color: #6366f1; font-size: 9px; font-weight: 850; text-transform: uppercase; letter-spacing: .08em; }
.workflow-card strong { color: #1e293b; font-size: 11.5px; font-weight: 800; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.workflow-card small { color: #64748b; font-size: 10px; font-weight: 600; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.workflow-actions { display: flex; gap: 5px; flex-wrap: wrap; margin-top: 4px; }
.workflow-actions .ghost-action { height: 26px; padding: 0 8px; font-size: 10px; font-weight: 750; border-radius: 8px; }
.workflow-actions .primary-action { height: 26px; padding: 0 10px; font-size: 10px; font-weight: 750; border-radius: 8px; }
`;

  // Insert after .wf-divider line
  if (insertAfterLine !== -1) {
    const nextNewline = stylesCss.indexOf('\n', insertAfterLine + 1);
    stylesCss = stylesCss.substring(0, nextNewline) + workflowCardCss + stylesCss.substring(nextNewline);
    console.log('Added workflow-card CSS');
  } else {
    // Fallback: append before POS Grid section
    stylesCss = stylesCss.replace('/* POS Grid */', workflowCardCss + '\n/* POS Grid */');
    console.log('Added workflow-card CSS (fallback)');
  }
} else {
  console.log('workflow-card CSS already present');
}

// 7. Make workflow strip scroll horizontally and hide on smaller screens
// Update the pos-workflow-strip to handle overflow better
if (!stylesCss.includes('.pos-workflow-strip { display: flex; align-items: stretch;')) {
  stylesCss = stylesCss.replace(
    '.pos-workflow-strip { display: flex; align-items: center; gap: 6px; padding: 5px 10px; border: 1px solid var(--line); border-radius: 12px; background: rgba(255,255,255,.97); box-shadow: 0 3px 10px rgba(15,23,42,.04); overflow-x: auto; flex-shrink: 0; min-height: 38px; }',
    '.pos-workflow-strip { display: flex; align-items: stretch; gap: 6px; padding: 5px 10px; border: 1px solid var(--line); border-radius: 12px; background: rgba(255,255,255,.97); box-shadow: 0 3px 10px rgba(15,23,42,.04); overflow-x: auto; flex-shrink: 0; min-height: 42px; }'
  );
  console.log('Updated pos-workflow-strip alignment');
}

// 8. Add responsive hiding of workflow strip details on small screens
if (!stylesCss.includes('.workflow-card small { display: none;')) {
  // Add to the existing 1180px media query
  const mq1180End = stylesCss.indexOf('}', stylesCss.indexOf('@media (max-width: 1180px) {'));
  // Actually, let's add a dedicated media query
  const posGridMediaIdx = stylesCss.indexOf('@media (max-width: 1180px) {\r\n  .pos-search-row');
  if (posGridMediaIdx === -1) {
    // Try LF version
    const posGridMediaIdxLF = stylesCss.indexOf('@media (max-width: 1180px) {\n  .pos-search-row');
  }
  
  // Add after the 820px POS media query block
  const pos820End = stylesCss.indexOf('}', stylesCss.indexOf('.pos-footer-actions button.pay-btn { margin-left: 0;'));
  if (pos820End !== -1) {
    const nextNewline = stylesCss.indexOf('\n', pos820End);
    const responsiveWorkflow = `\n@media (max-width: 1180px) {\n  .workflow-card small { display: none; }\n  .workflow-actions { display: none; }\n  .workflow-card { min-width: 120px; flex: 1 1 120px; }\n}\n@media (max-width: 820px) {\n  .pos-workflow-strip { display: none; }\n}\n`;
    stylesCss = stylesCss.substring(0, nextNewline + 1) + responsiveWorkflow + stylesCss.substring(nextNewline + 1);
    console.log('Added responsive workflow media queries');
  }
}

fs.writeFileSync('c:/xampp/htdocs/TaysrSuite/apps/TaysrPOS_v0/frontend/src/styles.css', stylesCss, 'utf8');
console.log('styles.css updated');
console.log('All fixes applied!');
