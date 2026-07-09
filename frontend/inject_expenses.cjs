const fs = require('fs');
let content = fs.readFileSync('c:/xampp/htdocs/TaysrSuite/apps/TaysrPOS_v0/frontend/src/main.tsx', 'utf8');

const importStatement = `import { ExpensesPage } from './pages/Expenses';\n`;
const importsIndex = content.indexOf(`import { RestaurantTablesPage }`);
if (importsIndex !== -1) {
  content = content.slice(0, importsIndex) + importStatement + content.slice(importsIndex);
} else {
  // fallback
  const fallbackIndex = content.indexOf('import { InvoiceSettingsPanel');
  content = content.slice(0, fallbackIndex) + importStatement + content.slice(fallbackIndex);
}

const callReplacement = `<ExpensesPage
    expenseModalOpen={expenseModalOpen} setExpenseModalOpen={setExpenseModalOpen}
    expenseForm={expenseForm} setExpenseForm={setExpenseForm}
    currentLocationId={currentLocationId} apiFetch={apiFetch}
    expenses={expenses} setExpenses={setExpenses} setStatus={setStatus}
    formatMoney={formatMoney}
  />`;
  
content = content.replace(/return renderExpenses\(\);/g, `return (${callReplacement});`);

fs.writeFileSync('c:/xampp/htdocs/TaysrSuite/apps/TaysrPOS_v0/frontend/src/main.tsx', content, 'utf8');
console.log('Successfully injected ExpensesPage call into main.tsx');
