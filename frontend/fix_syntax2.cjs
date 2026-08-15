const fs = require('fs');
let content = fs.readFileSync('c:/xampp/htdocs/TaysrSuite/apps/TaysrPOS_v0/frontend/src/main.tsx', 'utf8');

const targetStr = ') : null}\n      <div className="receipt-lines"';
const replaceStr = ') : null}\n      </div>\n      <div className="receipt-lines"';

if (content.includes(targetStr)) {
  content = content.replace(targetStr, replaceStr);
  fs.writeFileSync('c:/xampp/htdocs/TaysrSuite/apps/TaysrPOS_v0/frontend/src/main.tsx', content, 'utf8');
  console.log('Fixed syntax error in main.tsx (1)');
} else {
  const targetStr2 = ') : null}\r\n      <div className="receipt-lines"';
  const replaceStr2 = ') : null}\r\n      </div>\r\n      <div className="receipt-lines"';
  if (content.includes(targetStr2)) {
    content = content.replace(targetStr2, replaceStr2);
    fs.writeFileSync('c:/xampp/htdocs/TaysrSuite/apps/TaysrPOS_v0/frontend/src/main.tsx', content, 'utf8');
    console.log('Fixed syntax error in main.tsx (2)');
  } else {
    console.error('Target string not found in main.tsx');
  }
}
