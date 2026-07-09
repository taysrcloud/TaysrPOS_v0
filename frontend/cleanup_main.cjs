const fs = require('fs');

let mainContent = fs.readFileSync('c:/xampp/htdocs/TaysrSuite/apps/TaysrPOS_v0/frontend/src/main.tsx', 'utf8');

// 1. Remove renderExpenses block
const startExp = mainContent.indexOf('  const renderExpenses = () => {');
const endExp = mainContent.indexOf('    const [selectedTickets, setSelectedTickets] = useState<number[]>([]);');

if (startExp !== -1 && endExp !== -1 && endExp > startExp) {
    mainContent = mainContent.slice(0, startExp) + mainContent.slice(endExp);
    console.log('Removed renderExpenses definition.');
}

// 2. Remove duplicated logic
// It starts with '    const [selectedTickets, setSelectedTickets] = useState<number[]>([]);'
// And ends at '    const renderFactures = () => {'
const logicBlockStart = mainContent.indexOf('    const [selectedTickets, setSelectedTickets] = useState<number[]>([]);');
const renderFacturesIdx = mainContent.indexOf('    const renderFactures = () => {');

// The logic block is from logicBlockStart to renderFacturesIdx.
// If it's duplicated, there are two of them back to back!
// Let's find the middle point where the second one starts.
if (logicBlockStart !== -1 && renderFacturesIdx !== -1) {
    let between = mainContent.slice(logicBlockStart, renderFacturesIdx);
    // Find the second occurrence of selectedTickets
    const secondStart = between.indexOf('    const [selectedTickets, setSelectedTickets]', 10);
    if (secondStart !== -1) {
        // Cut out the duplicate
        mainContent = mainContent.slice(0, logicBlockStart) + between.slice(0, secondStart) + mainContent.slice(renderFacturesIdx);
        console.log('Removed duplicated logic block.');
    } else {
        console.log('No duplicated logic block found.');
    }
}

fs.writeFileSync('c:/xampp/htdocs/TaysrSuite/apps/TaysrPOS_v0/frontend/src/main.tsx', mainContent, 'utf8');

