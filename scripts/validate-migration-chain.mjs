#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const migrationDir = resolve(process.env.MIGRATION_DIR || join(repoRoot, 'database', 'migrations'))
const canonical = [
  '001_launch_contract.sql',
  '002_v1_runtime_reconciliation.sql',
  '003_services_metadata_reconciliation.sql',
  '004_public_catalog_rls_reconciliation.sql',
  '005_execution_engine.sql',
  '006_service_delivery_engine.sql',
  '007_execution_client_isolation_hotfix.sql',
  '008_project_aware_tickets.sql',
  '009_tickets_policy_isolation_hotfix.sql',
  '010_production_security_hardening.sql',
  '011_performance_foreign_key_indexes.sql',
  '012_official_v1_catalog.sql',
]

const auxiliary = ['005_execution_engine_policies.sql']
const failures = []
const warnings = []

const digest = (content) => createHash('sha256').update(content).digest('hex')
const recordFailure = (message) => failures.push(message)

let discovered = []
try {
  discovered = (await readdir(migrationDir, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name)
    .sort()
} catch (error) {
  recordFailure(`Migration directory is not readable: ${migrationDir}`)
}

const discoveredNumbered = discovered.filter((name) => /^\d{3}_.*\.sql$/.test(name))
const discoveredCanonical = discoveredNumbered.filter((name) => !auxiliary.includes(name))
const unexpectedNumbered = discoveredCanonical.filter((name) => !canonical.includes(name))
const missing = canonical.filter((name) => !discovered.includes(name))
const orderMatches = JSON.stringify(discoveredCanonical) === JSON.stringify(canonical)

if (missing.length) recordFailure(`Missing canonical migrations: ${missing.join(', ')}`)
if (unexpectedNumbered.length) recordFailure(`Unexpected numbered SQL files: ${unexpectedNumbered.join(', ')}`)
if (!orderMatches) recordFailure(`Canonical order mismatch: ${discoveredCanonical.join(' -> ')}`)

for (const file of auxiliary) {
  if (discovered.includes(file)) warnings.push(`${file} is present as auxiliary SQL and must not be executed as a second migration`)
}

const hashes = {}
for (const filename of canonical) {
  try {
    const content = await readFile(join(migrationDir, filename), 'utf8')
    hashes[filename] = {
      sha256: digest(content),
      bytes: Buffer.byteLength(content, 'utf8'),
    }
    if (filename === '010_production_security_hardening.sql') {
      const destructive = /\b(DROP\s+TABLE|DROP\s+SCHEMA|DROP\s+DATABASE|TRUNCATE)\b/i.exec(content)
      if (destructive) recordFailure(`010 contains forbidden destructive statement: ${destructive[0]}`)
    }
  } catch (error) {
    recordFailure(`Cannot read ${filename}`)
  }
}

const result = {
  status: failures.length ? 'FAIL' : 'PASS',
  migration_directory: relative(repoRoot, migrationDir) || '.',
  canonical,
  discovered_numbered_sql: discoveredCanonical,
  missing,
  unexpected_numbered: unexpectedNumbered,
  auxiliary,
  warnings,
  hashes,
  legacy_schema_excluded: true,
}

console.log(JSON.stringify(result, null, 2))
process.exitCode = failures.length ? 1 : 0
