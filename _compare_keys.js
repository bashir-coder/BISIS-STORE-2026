const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'frontend', 'src');

function walk(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) files.push(full);
  }
  return files;
}

const allKeys = new Set();
const noisePatterns = [
  /^\.\/pages\/|^[a-z-]+\/$/,
  /^\/api\
  /^2d$/, /^@$/, /^div$/, /^code$/, /^type$/, /^key, value$/, /^token_hash$/,
  /^html2canvas$/, /^jspdf$/, /^<br \/>$/, /^\n$/,
  /\.jsx$/, /\.ar$/, /\.en$/, /\.tr$/,
];

const regex = /t\(['"__PROTECT_0__]+)['"__PROTECT_1__([^__PROTECT_2__\)/g;

const files = walk(srcDir);
const missing = [];
const present = [];
const noise = [];

// Read i18n-fallback.ts
const fallbackContent = fs.readFileSync(path.join(srcDir, __PROTECT_10__), __PROTECT_11__);

for (const file of files) {
  const content = fs.readFileSync(file, __PROTECT_12__);
  let m;
  // Simple string keys
  const re = new RegExp(regex.source, __PROTECT_13__);
  while ((m = re.exec(content)) !== null) {
    const key = m[1];
    // Check if it__PROTECT_14__$__PROTECT_15__.__PROTECT_16__/__PROTECT_17__g__PROTECT_18__template-literal__PROTECT_19__.__PROTECT_20__-__PROTECT_21_____PROTECT_22__too short, no separator__PROTECT_23__Real keys total:__PROTECT_24__Noise entries:__PROTECT_25__"' + k + '"')) {
    found.push(k);
  } else {
    missingKeys.push(k);
  }
}

console.log('\n=== MISSING from i18n-fallback.ts (' + missingKeys.length + ') ===');
missingKeys.forEach(k => console.log('  ' + k));
console.log('\n=== FOUND in i18n-fallback.ts (' + found.length + ') ===');
found.forEach(k => console.log('  ' + k));
