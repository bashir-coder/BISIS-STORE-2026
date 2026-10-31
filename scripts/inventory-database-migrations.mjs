#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const migrationDir = resolve(
  process.env.MIGRATION_DIR || join(repoRoot, 'database', 'migrations'),
)
const excluded = new Set(['005_execution_engine_policies.sql'])
const filenamePattern = /^(\d{3})_([a-z0-9][a-z0-9_-]*)\.sql$/

function uniqueMatches(sql, pattern, capture = 1) {
  return [...new Set([...sql.matchAll(pattern)].map((match) => match[capture]))]
    .filter(Boolean)
    .sort()
}

function scanCandidates(sql) {
  const identifier = '((?:"(?:[^"]|"")*"|[A-Za-z_][A-Za-z0-9_$]*)(?:\\s*\\.\\s*(?:"(?:[^"]|"")*"|[A-Za-z_][A-Za-z0-9_$]*))?)'
  const simpleIdentifier = '("(?:[^"]|"")*"|[A-Za-z_][A-Za-z0-9_$]*)'
  const createTable = `\\bCREATE\\s+(?:TEMP(?:ORARY)?\\s+)?TABLE(?:\\s+IF\\s+NOT\\s+EXISTS)?\\s+${identifier}`
  const alterTable = `\\bALTER\\s+TABLE(?:\\s+IF\\s+EXISTS)?(?:\\s+ONLY)?\\s+${identifier}`

  return {
    created_tables: uniqueMatches(sql, new RegExp(createTable, 'gi'), 1),
    altered_tables: uniqueMatches(sql, new RegExp(alterTable, 'gi'), 1),
    added_columns: uniqueMatches(
      sql,
      new RegExp(`\\bADD\\s+(?:COLUMN\\s+)?(?:IF\\s+NOT\\s+EXISTS\\s+)?${simpleIdentifier}`, 'gi'),
      1,
    ),
    altered_columns: uniqueMatches(
      sql,
      new RegExp(`\\bALTER\\s+COLUMN\\s+${simpleIdentifier}`, 'gi'),
      1,
    ),
    dropped_columns: uniqueMatches(
      sql,
      new RegExp(`\\bDROP\\s+COLUMN(?:\\s+IF\\s+EXISTS\\s+)?${simpleIdentifier}`, 'gi'),
      1,
    ),
    constraints: uniqueMatches(
      sql,
      new RegExp(`\\b(?:ADD\\s+)?CONSTRAINT\\s+${simpleIdentifier}`, 'gi'),
      1,
    ),
    indexes: uniqueMatches(
      sql,
      new RegExp(`\\bCREATE\\s+(?:UNIQUE\\s+)?INDEX(?:\\s+CONCURRENTLY)?(?:\\s+IF\\s+NOT\\s+EXISTS)?\\s+${simpleIdentifier}`, 'gi'),
      1,
    ),
    policies: uniqueMatches(
      sql,
      new RegExp(`\\b(?:CREATE|ALTER|DROP)\\s+POLICY\\s+(?:IF\\s+(?:NOT\\s+)?EXISTS\\s+)?${simpleIdentifier}`, 'gi'),
      1,
    ),
    functions: uniqueMatches(
      sql,
      new RegExp(`\\bCREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION\\s+${identifier}`, 'gi'),
      1,
    ),
    triggers: uniqueMatches(
      sql,
      new RegExp(`\\bCREATE\\s+(?:CONSTRAINT\\s+)?TRIGGER\\s+${simpleIdentifier}`, 'gi'),
      1,
    ),
    rls_operations: uniqueMatches(
      sql,
      /\b(?:ENABLE|FORCE|DISABLE)\s+ROW\s+LEVEL\s+SECURITY\b/gi,
      0,
    ),
    grant_revoke_keywords: uniqueMatches(sql, /\b(?:GRANT|REVOKE)\b/gi, 0),
    grant_revoke_target_candidates: uniqueMatches(
      sql,
      new RegExp(
        `\\b(?:GRANT|REVOKE)\\b[\\s\\S]*?\\bON\\s+(?:(?:ALL\\s+TABLES\\s+IN\\s+SCHEMA|TABLE|SCHEMA|FUNCTION|SEQUENCE)\\s+)?${identifier}`,
        'gi',
      ),
      1,
    ),
    storage_references: uniqueMatches(sql, /\bstorage\.[A-Za-z_][A-Za-z0-9_$]*/gi, 0),
  }
}

const sqlEntries = (await readdir(migrationDir, { withFileTypes: true }))
  .filter((entry) => entry.name.toLowerCase().endsWith('.sql'))
  .filter((entry) => !excluded.has(entry.name))
for (const entry of sqlEntries) {
  if (!entry.isFile()) throw new Error(`SQL path is not a regular file: ${entry.name}`)
}
const entries = sqlEntries.map((entry) => entry.name)

const ids = new Map()
for (const filename of entries) {
  const match = filename.match(filenamePattern)
  if (!match) throw new Error(`Unexpected SQL filename: ${filename}`)
  if (ids.has(match[1])) {
    throw new Error(`Duplicate migration ID ${match[1]}: ${ids.get(match[1])}, ${filename}`)
  }
  ids.set(match[1], filename)
}

entries.sort((left, right) => {
  const leftId = Number(left.match(filenamePattern)[1])
  const rightId = Number(right.match(filenamePattern)[1])
  return leftId - rightId || left.localeCompare(right)
})

const migrations = []
for (const [index, filename] of entries.entries()) {
  const content = await readFile(join(migrationDir, filename))
  const sql = content.toString('utf8')
  if (!Buffer.from(sql, 'utf8').equals(content)) {
    throw new Error(`${filename} is not valid UTF-8`)
  }

  migrations.push({
    order: index + 1,
    id: filename.match(filenamePattern)[1],
    filename,
    sha256: createHash('sha256').update(content).digest('hex'),
    bytes: content.length,
    candidate_objects: scanCandidates(sql),
    manual_review_required: /\bDO\s+\$|\bEXECUTE\b/i.test(sql),
  })
}

console.log(JSON.stringify({
  status: 'LOCAL_STATIC_INVENTORY_ONLY',
  migration_directory: migrationDir,
  excluded_files: [...excluded],
  parser_limit: 'Identifiers are lexical candidates from SQL text, not parsed DDL; comments, strings, and dynamic SQL can cause omissions or false positives. Manually review source before reconciliation.',
  migrations,
}, null, 2))
