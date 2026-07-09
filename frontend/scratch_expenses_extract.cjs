const fs = require('fs');
let content = fs.readFileSync('c:/xampp/htdocs/TaysrSuite/apps/TaysrPOS_v0/frontend/src/main.tsx', 'utf8');

const startIndex = content.indexOf('  const renderExpenses = () => {');
const endIndex = content.indexOf('    const renderFactures = () => {');

if (startIndex !== -1 && endIndex !== -1) {
  let expContent = content.slice(startIndex, endIndex);
  fs.writeFileSync('c:/xampp/htdocs/TaysrSuite/apps/TaysrPOS_v0/frontend/src/pages/Expenses.tsx', expContent, 'utf8');
  console.log('Saved to Expenses.tsx');
} else {
  console.error('Could not find boundaries');
}
