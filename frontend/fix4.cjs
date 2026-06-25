const fs = require('fs');
let content = fs.readFileSync('src/main.tsx', 'utf8');
content = content.replace(
  /<img src=\{currentUser\.avatarUrl\} alt=\{currentUser\.name\} style=\{\{ width: '24px', height: '24px', borderRadius: '50%' \}\} \/>/g,
  "{currentUser.avatarUrl && <img src={currentUser.avatarUrl} alt={currentUser.fullName || currentUser.username} style={{ width: '24px', height: '24px', borderRadius: '50%' }} />}"
);
content = content.replace(
  /<strong>\{currentUser\.name\.split\(' '\)\[0\]\}<\/strong>/g,
  "<strong>{((currentUser.fullName || currentUser.username || '').split(' ')[0])}</strong>"
);
fs.writeFileSync('src/main.tsx', content);
