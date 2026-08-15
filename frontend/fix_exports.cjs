const fs = require('fs');
let mainTsx = fs.readFileSync('c:/xampp/htdocs/TaysrSuite/apps/TaysrPOS_v0/frontend/src/main.tsx', 'utf8');

const typesToExport = ['Contact', 'Product', 'CartLine', 'User', 'SaleRecord', 'DenominationCounts', 'PageKey'];
typesToExport.forEach(t => {
  mainTsx = mainTsx.replace(new RegExp(`^type ${t} =`, 'm'), `export type ${t} =`);
});

mainTsx = mainTsx.replace(/^const formatMoney =/m, `export const formatMoney =`);

fs.writeFileSync('c:/xampp/htdocs/TaysrSuite/apps/TaysrPOS_v0/frontend/src/main.tsx', mainTsx, 'utf8');
console.log('Added exports');
