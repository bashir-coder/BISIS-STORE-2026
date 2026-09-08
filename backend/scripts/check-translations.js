const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '../..')
const source = JSON.parse(fs.readFileSync(path.join(root, 'database/seeds/translations.json'), 'utf8'))
const keys = source.map((item) => item.key)
const duplicates = keys.filter((key, index) => keys.indexOf(key) !== index)
const missingLanguages = source.filter((item) => !item.key || !item.ar || !item.en || !item.tr)
const fallbackText = fs.readFileSync(path.join(root, 'frontend/src/i18n-fallback.ts'), 'utf8')
const counts = { ar: (fallbackText.match(/"[^"]+":/g) || []).length }
if (duplicates.length || missingLanguages.length || !fallbackText.includes('client.home.title')) {
  console.error(JSON.stringify({ duplicates, missingLanguages: missingLanguages.map((item) => item.key), fallback_contains_client_home: fallbackText.includes('client.home.title') }, null, 2))
  process.exit(1)
}
console.log(JSON.stringify({ source_keys: source.length, duplicate_keys: duplicates.length, incomplete_rows: missingLanguages.length, fallback_contains_client_home: true }, null, 2))
