const fs = require('fs');
let s = fs.readFileSync('apps/TaysrPOS_v0/frontend/src/main.tsx', 'utf8');

// Replace everything that is NOT standard ASCII, except some common French characters
const safeChars = new Set([
  'é', 'è', 'ê', 'ë',
  'à', 'â', 'ä',
  'î', 'ï',
  'ô', 'ö',
  'ù', 'û', 'ü',
  'ç', 'Ç',
  'É', 'È', 'Ê', 'Ë',
  'À', 'Â', 'Ä',
  'Î', 'Ï',
  'Ô', 'Ö',
  'Ù', 'Û', 'Ü'
]);

let result = '';
for (let i = 0; i < s.length; i++) {
  const code = s.charCodeAt(i);
  if (code <= 127 || safeChars.has(s[i])) {
    result += s[i];
  } else {
    // Replace with 'e' just to be safe so it doesn't break syntax
    result += 'e'; 
  }
}

fs.writeFileSync('apps/TaysrPOS_v0/frontend/src/main.tsx', result, 'utf8');
console.log('Fixed main.tsx');
