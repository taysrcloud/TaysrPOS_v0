const fs = require('fs');
let content = fs.readFileSync('src/main.tsx', 'utf8');
content = content.replace(/\['Admin', 'Manager', 'Cashier']/g, "['ADMIN', 'MANAGER', 'CASHIER']");
fs.writeFileSync('src/main.tsx', content);
