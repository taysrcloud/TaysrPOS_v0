const fs = require('fs');
let content = fs.readFileSync('c:/xampp/htdocs/TaysrSuite/apps/TaysrPOS_v0/frontend/src/main.tsx', 'utf8');

const startIndex = content.indexOf('          const renderTables = () => {');
const endIndex = content.indexOf('  const renderRegisters = () => {');

if (startIndex !== -1 && endIndex !== -1) {
  content = content.slice(0, startIndex) + content.slice(endIndex);
  
  const importStatement = `import { RestaurantTablesPage } from './pages/RestaurantTables';\n`;
  // Add it after SettingsPage import
  const importsIndex = content.indexOf(`import { SettingsPage }`);
  if (importsIndex !== -1) {
    content = content.slice(0, importsIndex) + importStatement + content.slice(importsIndex);
  } else {
    // fallback
    const fallbackIndex = content.indexOf('import { InvoiceSettingsPanel');
    content = content.slice(0, fallbackIndex) + importStatement + content.slice(fallbackIndex);
  }
  
  const callReplacement = `<RestaurantTablesPage
      tableGroups={tableGroups} draftSales={draftSales} viewSelectedTable={viewSelectedTable}
      setViewSelectedTable={setViewSelectedTable} tableFilter={tableFilter} setTableFilter={setTableFilter}
      setStatus={setStatus} formatMoney={formatMoney} resumeSale={resumeSale}
      setSelectedTable={setSelectedTable} setPage={setPage}
    />`;
    
  content = content.replace(/return renderTables\(\);/g, `return (${callReplacement});`);
  
  fs.writeFileSync('c:/xampp/htdocs/TaysrSuite/apps/TaysrPOS_v0/frontend/src/main.tsx', content, 'utf8');
  console.log('Successfully extracted RestaurantTablesPage from main.tsx');
} else {
  console.error('Could not find renderTables or renderRegisters');
}
