const fs = require('fs');
let content = fs.readFileSync('c:/xampp/htdocs/TaysrSuite/apps/TaysrPOS_v0/frontend/src/main.tsx', 'utf8');

const targetStr = `setPaymentForm({ cash: String(sale.total), card: '0', credit: '0', storeCredit: '0' });`;
const replaceStr = `setPaymentForm({ cash: String(sale.total), card: '0', cheque: '0', virement: '0', mobile: '0', credit: '0', storeCredit: '0' });`;

if (content.includes(targetStr)) {
  content = content.replace(targetStr, replaceStr);
  fs.writeFileSync('c:/xampp/htdocs/TaysrSuite/apps/TaysrPOS_v0/frontend/src/main.tsx', content, 'utf8');
  console.log('Fixed setPaymentForm error.');
} else {
  console.error('Target setPaymentForm not found.');
}
