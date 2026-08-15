const fs = require('fs');

let expContent = fs.readFileSync('c:/xampp/htdocs/TaysrSuite/apps/TaysrPOS_v0/frontend/src/pages/Expenses.tsx', 'utf8');
const expEndIndex = expContent.indexOf('  };\n\n  \n    const [selectedTickets, setSelectedTickets] = useState<number[]>([]);');
// Note: it looks like `  };\n\n  \n    const [selectedTickets` in the view_file output.

const extraLogicStart = expContent.indexOf('    const [selectedTickets, setSelectedTickets] = useState<number[]>([]);');
if (extraLogicStart === -1) {
    console.error("Could not find extraLogicStart");
    process.exit(1);
}

const extraLogic = expContent.slice(extraLogicStart);
// Delete extra logic from Expenses.tsx
expContent = expContent.slice(0, extraLogicStart);
// Also close ExpensesPage correctly if it ends with `  };` -> change to `  );\n}`
expContent = expContent.replace(/  };\s*$/, '  );\n}\n');

fs.writeFileSync('c:/xampp/htdocs/TaysrSuite/apps/TaysrPOS_v0/frontend/src/pages/Expenses.tsx', expContent, 'utf8');

// Now inject extra logic back into main.tsx
let mainContent = fs.readFileSync('c:/xampp/htdocs/TaysrSuite/apps/TaysrPOS_v0/frontend/src/main.tsx', 'utf8');
const facturesIndex = mainContent.indexOf('    const renderFactures = () => {');

if (facturesIndex !== -1) {
    mainContent = mainContent.slice(0, facturesIndex) + '\n' + extraLogic + '\n' + mainContent.slice(facturesIndex);
    fs.writeFileSync('c:/xampp/htdocs/TaysrSuite/apps/TaysrPOS_v0/frontend/src/main.tsx', mainContent, 'utf8');
    console.log("Successfully restored logic to main.tsx and cleaned Expenses.tsx");
} else {
    console.error("Could not find renderFactures in main.tsx");
}
