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
  /^\/api\//,
  /^2d$/, /^@$/, /^div$/, /^code$/, /^type$/, /^key, value$/, /^token_hash$/,
  /^html2canvas$/, /^jspdf$/, /^<br \/>$/, /^\n$/,
  /\.jsx$/, /\.ar$/, /\.en$/, /\.tr$/,
];

const regex = /t\(['"`]([^'"`]+)['"`]\)/g;
const regexTemplate = /t\(`([^`]+)`\)/g;

const files = walk(srcDir);
const missing = [];
const present = [];
const noise = [];

// Read i18n-fallback.ts
const fallbackContent = fs.readFileSync(path.join(srcDir, 'i18n-fallback.ts'), 'utf8');

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  let m;
  // Simple string keys
  const re = new RegExp(regex.source, 'g');
  while ((m = re.exec(content)) !== null) {
    const key = m[1];
    // Check if it's a template literal or interpolation
    if (key.includes('$') || key.includes('.') === false && key.includes('/') ) {
      noise.push({ file: path.relative(srcDir, file), key });
      continue;
    }
    allKeys.add(key);
  }
  // Template literal keys
  const reT = new RegExp(regexTemplate.source, 'g');
  while ((m = reT.exec(content)) !== null) {
    const key = m[1];
    noise.push({ file: path.relative(srcDir, file), key, type: 'template-literal' });
  }
}

// Remove obvious noise - keys that are not dotted
const realKeys = new Set();
for (const k of allKeys) {
  if (k.includes('.') || k.includes('-') || k.includes('_')) {
    realKeys.add(k);
  } else if (k.length <= 3) {
    noise.push({ key: k, reason: 'too short, no separator' });
  } else {
    realKeys.add(k);
  }
}

console.log('Real keys total:', realKeys.size);
console.log('Noise entries:', noise.length);

const missingKeys = [];
const found = [];
for (const k of [...realKeys].sort()) {
  if (fallbackContent.includes('"' + k + '"')) {
    found.push(k);
  } else {
    missingKeys.push(k);
  }
}

console.log('\n=== MISSING from i18n-fallback.ts (' + missingKeys.length + ') ===');
missingKeys.forEach(k => console.log('  ' + k));
console.log('\n=== FOUND in i18n-fallback.ts (' + found.length + ') ===');
found.forEach(k => console.log('  ' + k));
