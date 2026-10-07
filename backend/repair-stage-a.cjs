// Stage A: prove the 3 corrupt entries + fetch canonical integrity from npm registry.
// Never prints the corrupted value or any secret. Reports only structural facts.
const fs = require('fs')

const LOCK = 'backend/package-lock.json'
const parsed = JSON.parse(fs.readFileSync(LOCK, 'utf8'))

const TARGETS = [
  { path: 'node_modules/formidable', version: '3.5.4', name: 'formidable' },
  { path: 'node_modules/parse-json', version: '5.2.0', name: 'parse-json' },
  { path: 'node_modules/string_decoder', version: '1.1.1', name: 'string_decoder' },
]

const out = { baseline: { lockfile_version: parsed.lockfileVersion, packages_entries: Object.keys(parsed.packages || {}).length }, targets: [] }

function isValidBase64(s) {
  return /^[A-Za-z0-9+/]+={0,2}$/.test(s)
}

for (const t of TARGETS) {
  const meta = (parsed.packages || {})[t.path]
  const entry = {
    package: t.name,
    requested_version: t.version,
    lockfile_path: t.path,
    integrity_field_exists: Boolean(meta && typeof meta.integrity === 'string'),
    lockfile_version_matches: meta && meta.version === t.version,
    resolved_url: meta && meta.resolved,
  }
  if (typeof meta?.integrity === 'string') {
    const integrity = meta.integrity
    const payload = integrity.includes('-') ? integrity.slice(integrity.indexOf('-') + 1) : ''
    entry.integrity_algo = integrity.split('-')[0]
    entry.integrity_ascii_only = /^[\x00-\x7F]*$/.test(integrity)
    entry.integrity_valid_base64 = isValidBase64(payload)
    entry.integrity_non_ascii_count = [...integrity].filter(c => c.charCodeAt(0) > 127).length
    entry.integrity_non_ascii_codepoints = [...new Set([...integrity].filter(c => c.charCodeAt(0) > 127).map(c => 'U+' + c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')))]
    entry.corrupt = !entry.integrity_ascii_only || !entry.integrity_valid_base64
  }
  out.targets.push(entry)
}

// Fetch canonical integrity from npm registry for the EXACT versions
async function fetchCanonical(name, version) {
  const url = `https://registry.npmjs.org/${encodeURIComponent(name)}/${encodeURIComponent(version)}`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) return { http: res.status, error: 'registry fetch failed' }
  const body = await res.json()
  const integrity = body?.dist?.integrity
  const tarball = body?.dist?.tarball
  return {
    http: res.ok,
    canonical_version: body?.version,
    canonical_integrity_present: typeof integrity === 'string',
    canonical_integrity_algo: typeof integrity === 'string' ? integrity.split('-')[0] : null,
    canonical_integrity_ascii_only: typeof integrity === 'string' ? /^[\x00-\x7F]*$/.test(integrity) : false,
    canonical_integrity_valid_base64: typeof integrity === 'string' ? isValidBase64(integrity.includes('-') ? integrity.slice(integrity.indexOf('-') + 1) : '') : false,
    canonical_tarball: tarball,
  }
}

out.canonical = {}
async function main() {
  for (const t of TARGETS) {
    out.canonical[`${t.name}@${t.version}`] = await fetchCanonical(t.name, t.version)
  }
  console.log(JSON.stringify(out, null, 2))
}
main().catch(e => { console.error('SCRIPT_ERROR', e); process.exit(1) })
