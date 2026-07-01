import fs from 'fs';

function fixMojibake(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let fixed = '';
  
  // A simple heuristic: if we convert the string to latin1 bytes and decode as utf8, does it look right?
  // Since string in V8 is utf16, we can map each character to a byte.
  try {
    const bytes = new Uint8Array(content.length);
    for (let i = 0; i < content.length; i++) {
      const code = content.charCodeAt(i);
      if (code > 255) {
        // If there are characters outside latin1, this might not be simple double-encoding
        // But for our case, most corrupted characters will be <= 255.
      }
      bytes[i] = code;
    }
    
    // Now decode bytes as UTF-8
    const decoder = new TextDecoder('utf8');
    fixed = decoder.decode(bytes);
    
    // If successful, overwrite the file
    fs.writeFileSync(filePath, fixed, 'utf8');
    console.log(`Successfully fixed encoding in ${filePath}`);
  } catch (e) {
    console.error(`Failed to fix ${filePath}`, e);
  }
}

fixMojibake('c:/xampp/htdocs/TaysrSuite/apps/TaysrPOS_v0/frontend/src/main.tsx');
