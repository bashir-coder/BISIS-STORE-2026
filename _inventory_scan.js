const fs = require('fs');
const path = require('path');

// =====================================================
// COMPREHENSIVE TRANSLATABLE TEXT INVENTORY SCANNER
// =====================================================

const i18nContent = fs.readFileSync('frontend/src/i18n-fallback.ts', 'utf8');

// Build set of all keys in i18n-fallback.ts
const fileKeys = new Set();
const keyRegex = /"([^"]+)":\s+(?:"|true|false|null|\[|\d)/g;
let m;
while ((m = keyRegex.exec(i18nContent)) !== null) {
  fileKeys.add(m[1]);
}
// Remove artifacts
['ar', 'en', 'tr', 'common'].forEach(k => fileKeys.delete(k));

// Build map of key -> {ar, en, tr} values
const keyValues = {};
const langStart = {};
langStart['ar'] = i18nContent.indexOf('"ar": {');
langStart['en'] = i18nContent.indexOf('"en": {');
langStart['tr'] = i18nContent.indexOf('"tr": {');
const sorted = Object.entries(langStart).sort((a, b) => a[1] - b[1]);

sorted.forEach(([lang, start], i) => {
  const end = i + 1 < sorted.length ? sorted[i + 1][1] : i18nContent.length;
  const sectionText = i18nContent.substring(start, end);
  const re = /"([^"]+)":\s+"([^"]*)"/g;
  let m;
  while ((m = re.exec(sectionText)) !== null) {
    const key = m[1];
    const val = m[2];
    if (['ar', 'en', 'tr', 'common'].includes(key)) continue;
    if (!keyValues[key]) keyValues[key] = {};
    keyValues[key][lang] = val;
  }
});

// Walk frontend source
function walkDir(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) results = results.concat(walkDir(filePath));
    else if (path.extname(file) === '.tsx' || path.extname(file) === '.ts') results.push(filePath);
  }
  return results;
}

const frontendFiles = walkDir('frontend/src');

// Detection patterns for hardcoded text
const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const latinRegex = /[a-zA-Z]/;
const turkishChars = 'çğıİöşüÇĞİÖŞÜ';

function detectLanguage(str) {
  if (arabicRegex.test(str)) return 'AR';
  if (/[İığçöşü]/.test(str)) return 'TR';
  if (/\b(the|and|to|of|in|for|a|is|with|you|your|this|that|we|are)\b/i.test(str)) return 'EN';
  if (latinRegex.test(str)) return 'EN';
  return null;
}

const inventory = [];

frontendFiles.forEach(filePath => {
  const code = fs.readFileSync(filePath, 'utf8');
  const relPath = path.relative('frontend/src', filePath).replace(/\\/g, '/');
  
  // Skip files that are pure type definitions or configs
  if (relPath.includes('lib/supabase') || relPath.includes('i18n.ts') || relPath.includes('i18n-fallback.ts')) return;
  
  let lineNum = 0;
  const lines = code.split('\n');
  
  lines.forEach((line, idx) => {
    lineNum = idx + 1;
    
    // Skip comments
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
    
    // 1. String literals in JS/TS (single or double quotes, not template literals)
    const stringRegexes = [
      /'([^']*)'/g,
      /"([^"]*)"/g,
    ];
    
    stringRegexes.forEach(regex => {
      let match;
      while ((match = regex.exec(line)) !== null) {
        const text = match[1];
        if (text.length < 2) return; // skip single chars and empty
        
        const lang = detectLanguage(text);
        if (lang) {
          // Check if this is a key reference (t('key.subkey'))
          const isTKey = code.substring(Math.max(0, match.index - 10), match.index).includes('t(');
          const isAlreadyI18n = [...fileKeys].some(k => k === text);
          
          if (!isAlreadyI18n && !text.includes('http') && !text.includes('src=') && 
              !text.includes('className=') && !text.includes('data-') &&
              !text.includes('@') && !text.includes('/') && !text.includes('BİŞIŞ') &&
              !text.includes('BISHISH') && !text.includes('svg') && !text.includes('jsx') &&
              !text.includes('import') && !text.includes('export') &&
              !text.includes('require') && !text.includes('process') &&
              !text.match(/^[\d\s\-_.]+$/) && !text.match(/^[A-Z][a-z]+$/)) {
            
            if (!isTKey && text.length > 3) {
              inventory.push({
                file: relPath,
                line: lineNum,
                text: text,
                lang: lang,
                type: isTKey ? 't_key' : (code.substring(Math.max(0, match.index - 30), match.index).includes('placeholder') ? 'placeholder' : 'hardcoded'),
                context: code.substring(Math.max(0, match.index - 50), Math.min(code.length, match.index + text.length + 50)).replace(/\n/g, ' ').trim()
              });
            }
          }
        }
      }
    });
    
    // 2. JSX text content (text between > and < that isn't code)
    // Simple heuristic: find text between closing > and opening <
    const jsxTextRegex = />\s*([a-zA-Z\u0600-\u06FF\u0750-\u077FçğıİöşüÇĞİÖŞÜ\s.,!?:'\u201C\u201D\u2018\u2019-]+)\s*</g;
    let jsxMatch;
    while ((jsxMatch = jsxTextRegex.exec(line)) !== null) {
      const text = jsxMatch[1].trim();
      if (text.length < 2) continue;
      if (text.includes('{') || text.includes('}')) continue;
      
      const lang = detectLanguage(text);
      if (lang) {
        inventory.push({
          file: relPath,
          line: lineNum,
          text: text,
          lang: lang,
          type: 'jsx_text',
          context: line.trim().substring(0, 100)
        });
      }
    }
  });
});

// Deduplicate
const uniqueTexts = new Map();
inventory.forEach(item => {
  const key = item.text + '|' + item.lang + '|' + item.file;
  if (!uniqueTexts.has(key)) uniqueTexts.set(key, item);
});

const unique = [...uniqueTexts.values()];

// Group by file
const byFile = {};
unique.forEach(item => {
  if (!byFile[item.file]) byFile[item.file] = [];
  byFile[item.file].push(item);
});

console.log('=== TOTAL HARDCODED TRANSLATABLE TEXT ===');
console.log('Unique entries:', unique.length);

// Group by language
const byLang = { AR: 0, EN: 0, TR: 0 };
unique.forEach(item => { byLang[item.lang] = (byLang[item.lang] || 0) + 1; });
console.log('By language - AR:', byLang.AR, 'EN:', byLang.EN, 'TR:', byLang.TR);

// Group by file
console.log('\n=== BY FILE ===');
const sortedFiles = Object.entries(byFile).sort((a, b) => b[1].length - a[1].length);
sortedFiles.forEach(([file, items]) => {
  const langs = {};
  items.forEach(i => { langs[i.lang] = (langs[i.lang] || 0) + 1; });
  console.log(file + ': ' + items.length + ' (' + JSON.stringify(langs) + ')');
});

// Show unique hardcoded texts (not t() keys)
const hardcodedOnly = unique.filter(i => i.type !== 't_key');
console.log('\n=== HARDCODED TEXT (non-t-key) ===');
console.log('Count:', hardcodedOnly.length);

// Deduplicate by text+lang
const uniqueByText = new Map();
hardcodedOnly.forEach(item => {
  const key = item.text + '|' + item.lang;
  if (!uniqueByText.has(key)) uniqueByText.set(key, { ...item, files: [item.file] });
  else {
    const existing = uniqueByText.get(key);
    if (!existing.files.includes(item.file)) existing.files.push(item.file);
  }
});

console.log('Unique texts:', uniqueByText.size);
uniqueByText.forEach(item => {
  console.log('  [' + item.lang + '] "' + item.text.substring(0, 80) + '" -> ' + item.files.join(', '));
});

// Save full inventory to JSON
const output = {
  summary: {
    total: unique.length,
    hardcodedOnly: hardcodedOnly.length,
    uniqueTexts: uniqueByText.size,
    byLang: byLang,
    byFile: Object.fromEntries(sortedFiles.map(([f, items]) => [f, items.length])),
    fileKeys: fileKeys.size,
    codeKeys: new Set([...fileKeys].filter(k => true)).size // placeholder
  },
  items: unique.map(i => ({ file: i.file, line: i.line, text: i.text, lang: i.lang, type: i.type, context: i.context }))
};

fs.writeFileSync('_inventory.json', JSON.stringify(output, null, 2));
console.log('\nFull inventory saved to _inventory.json');
