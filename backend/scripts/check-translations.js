const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '../..')
const fallbackPath = path.join(root, 'frontend/src/i18n-fallback.ts')
const fallbackText = fs.readFileSync(fallbackPath, 'utf8')

// Parse the fallbackResources object from the TypeScript file
const eqIdx = fallbackText.indexOf('= {')
const objStart = eqIdx + 2
let depth = 0
let objEnd = objStart
for (let i = objStart; i < fallbackText.length; i++) {
  if (fallbackText[i] === '{') depth++
  if (fallbackText[i] === '}') {
    depth--
    if (depth === 0) { objEnd = i + 1; break }
  }
}
const resources = JSON.parse(fallbackText.slice(objStart, objEnd).replace(/,\s*([}\]])/g, '$1'))

// Collect all keys across languages
const allKeys = new Set([
  ...Object.keys(resources.ar?.common || {}),
  ...Object.keys(resources.en?.common || {}),
  ...Object.keys(resources.tr?.common || {}),
])

const keys = [...allKeys]
const duplicates = keys.filter((key, index) => keys.indexOf(key) !== index)

const missingLanguages = []
for (const key of keys) {
  if (!resources.ar?.common?.[key] || !resources.en?.common?.[key] || !resources.tr?.common?.[key]) {
    missingLanguages.push(key)
  }
}

const all3 = keys.length - missingLanguages.length
const incompleteSample = missingLanguages.slice(0, 10)

console.log(JSON.stringify({
  source_keys: keys.length,
  duplicate_keys: duplicates.length,
  all_3_languages: all3,
  incomplete_rows: missingLanguages.length,
  incomplete_sample: incompleteSample,
  fallback_contains_client_home: fallbackText.includes('client.home.title')
}, null, 2))

if (duplicates.length > 0) {
  console.error('ERROR: Duplicate keys found in fallback')
  process.exit(1)
}
