const fs = require('fs');

function fixFile(filePath, replacements) {
  let content = fs.readFileSync(filePath, 'utf8');
  for (const [from, to] of replacements) {
    content = content.replace(new RegExp(from, 'g'), to);
  }
  fs.writeFileSync(filePath, content, 'utf8');
}

fixFile('c:/xampp/htdocs/TaysrSuite/apps/TaysrPOS_v0/frontend/src/pages/Expenses.tsx', [
  ['f =>', '(f: any) =>']
]);

fixFile('c:/xampp/htdocs/TaysrSuite/apps/TaysrPOS_v0/frontend/src/pages/Settings.tsx', [
  ['s =>', '(s: any) =>'],
  ['l =>', '(l: any) =>'],
  ['m =>', '(m: any) =>'],
  ['\\(loc, idx\\) =>', '(loc: any, idx: number) =>']
]);

console.log('Fixed implicit any parameters.');
