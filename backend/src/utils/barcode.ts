// Code 128-B barcode generator for thermal sticker printing (pure JS, zero dependencies)

const CODE128_PATTERNS: Record<number, string> = {
  0: '212222', 1: '222122', 2: '222221', 3: '121223', 4: '121322', 5: '131222',
  6: '122213', 7: '122312', 8: '132212', 9: '221213', 10: '221312', 11: '231212',
  12: '112232', 13: '122132', 14: '122231', 15: '113222', 16: '123122', 17: '123221',
  18: '223211', 19: '221132', 20: '221231', 21: '213212', 22: '223112', 23: '312131',
  24: '311222', 25: '321122', 26: '321221', 27: '312212', 28: '322112', 29: '322211',
  30: '212123', 31: '212321', 32: '232121', 33: '111323', 34: '131123', 35: '131321',
  36: '112313', 37: '132113', 38: '132311', 39: '211313', 40: '231113', 41: '231311',
  42: '112133', 43: '112331', 44: '132131', 45: '113123', 46: '113321', 47: '133121',
  48: '313121', 49: '211331', 50: '231131', 51: '213113', 52: '213311', 53: '213131',
  54: '311123', 55: '311321', 56: '331121', 57: '312113', 58: '312311', 59: '332111',
  60: '314111', 61: '221411', 62: '431111', 63: '111224', 64: '111422', 65: '121124',
  66: '121421', 67: '141122', 68: '141221', 69: '112214', 70: '112412', 71: '122114',
  72: '122411', 73: '142112', 74: '142211', 75: '241211', 76: '221114', 77: '413111',
  78: '241112', 79: '134111', 80: '111242', 81: '121142', 82: '121241', 83: '114212',
  84: '124112', 85: '124211', 86: '411212', 87: '421112', 88: '421211', 89: '212141',
  90: '214121', 91: '412121', 92: '111143', 93: '111341', 94: '113141', 95: '114113',
  96: '114311', 97: '411113', 98: '411311', 99: '113114', 100: '114131', 101: '311141',
  102: '411131', 103: '211412', 104: '211214', 105: '211232', 106: '2331112' // Stop code
};

export function generateCode128SVG(text: string, height: number = 40): string {
  const clean = text.trim();
  if (!clean) return '';

  const codes: number[] = [104]; // Start Code B
  for (let i = 0; i < clean.length; i++) {
    const charCode = clean.charCodeAt(i);
    const codeVal = charCode - 32;
    if (codeVal >= 0 && codeVal <= 95) {
      codes.push(codeVal);
    }
  }

  // Calculate checksum
  let checksum = codes[0];
  for (let i = 1; i < codes.length; i++) {
    checksum += codes[i] * i;
  }
  codes.push(checksum % 103);
  codes.push(106); // Stop code

  // Convert codes to bar pattern string
  let barsPattern = '';
  for (const c of codes) {
    barsPattern += CODE128_PATTERNS[c] || '';
  }

  // Draw SVG
  let currentX = 10;
  let svgPaths = '';
  for (let i = 0; i < barsPattern.length; i++) {
    const width = parseInt(barsPattern[i], 10);
    if (i % 2 === 0) {
      // Bar (black)
      svgPaths += `<rect x="${currentX}" y="0" width="${width * 1.5}" height="${height}" fill="#000000" />`;
    }
    currentX += width * 1.5;
  }

  const totalWidth = currentX + 10;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${height + 15}" width="100%" height="${height + 15}">
    ${svgPaths}
    <text x="${totalWidth / 2}" y="${height + 12}" font-family="monospace" font-size="10" text-anchor="middle" fill="#000000">${clean}</text>
  </svg>`;
}
