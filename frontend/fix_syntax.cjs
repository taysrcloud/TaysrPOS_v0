const fs = require('fs');
let content = fs.readFileSync('c:/xampp/htdocs/TaysrSuite/apps/TaysrPOS_v0/frontend/src/main.tsx', 'utf8');

const targetStr = `        ) : null}
      <div className="receipt-lines"`;

const replaceStr = `        ) : null}
      </div>
      <div className="receipt-lines"`;

if (content.includes(targetStr)) {
  content = content.replace(targetStr, replaceStr);
  fs.writeFileSync('c:/xampp/htdocs/TaysrSuite/apps/TaysrPOS_v0/frontend/src/main.tsx', content, 'utf8');
  console.log('Fixed missing div in main.tsx');
} else {
  console.error('Target string not found in main.tsx');
}
