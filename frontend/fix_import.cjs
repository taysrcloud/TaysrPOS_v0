const fs = require('fs');
let content = fs.readFileSync('c:/xampp/htdocs/TaysrSuite/apps/TaysrPOS_v0/frontend/src/main.tsx', 'utf8');
content = content.replace(/import \{([^\}]+)\} from 'lucide-react';/, function(match, p1) {
    if (!p1.includes('ChevronDown')) {
        return "import {" + p1 + ", ChevronDown} from 'lucide-react';";
    }
    return match;
});
fs.writeFileSync('c:/xampp/htdocs/TaysrSuite/apps/TaysrPOS_v0/frontend/src/main.tsx', content, 'utf8');
console.log('Added ChevronDown import');
