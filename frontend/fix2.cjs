const fs = require('fs');
let content = fs.readFileSync('src/main.tsx', 'utf8');
content = content.replace(/"Admin"/g, '"ADMIN"')
  .replace(/"Manager"/g, '"MANAGER"')
  .replace(/"Cashier"/g, '"CASHIER"');
fs.writeFileSync('src/main.tsx', content);
