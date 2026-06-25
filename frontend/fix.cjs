const fs = require('fs');
let content = fs.readFileSync('src/main.tsx', 'utf8');
content = content.replace(/role: 'Admin'/g, "role: 'ADMIN'")
  .replace(/role: 'Manager'/g, "role: 'MANAGER'")
  .replace(/role: 'Cashier'/g, "role: 'CASHIER'")
  .replace(/=== 'Admin'/g, "=== 'ADMIN'")
  .replace(/=== 'Manager'/g, "=== 'MANAGER'")
  .replace(/=== 'Cashier'/g, "=== 'CASHIER'")
  .replace(/!== 'Admin'/g, "!== 'ADMIN'")
  .replace(/!== 'Manager'/g, "!== 'MANAGER'")
  .replace(/!== 'Cashier'/g, "!== 'CASHIER'")
  .replace(/'Admin' \| 'Manager' \| 'Cashier'/g, "'ADMIN' | 'MANAGER' | 'CASHIER'");
fs.writeFileSync('src/main.tsx', content);
