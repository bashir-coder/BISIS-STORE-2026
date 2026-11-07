#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = String(
  process.env.SUPABASE_URL || '',
).trim()

const SUPABASE_SERVICE_ROLE_KEY = String(
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
).trim()

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required',
  )
  process.exit(1)
}

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
)

const migrationDir = String(
  process.env.MIGRATION_DIR ||
    path.resolve(__dirname, '..', 'database', 'migrations'),
).trim()

// Auxiliary SQL files are documentation/batching copies of a canonical
// migration and must never be discovered or executed as a separate migration.
// Canonical source of truth: 005_execution_engine.sql.
const AUXILIARY_FILES = new Set(['005_execution_engine_policies.sql'])

const migrationFileRe = /^\d{3}_.*\.sql$/

async function getAppliedMigrations() {
  const { data, error } = await supabase
    .from('_BİŞİŞ_migrations')
    .select('filename')
    .order('filename', { ascending: true })

  if (error) {
    // The migration tracker is created/maintained by the supported Supabase
    // CLI (or the SQL Editor). If it does not exist yet, treat every
    // migration as pending.
    console.warn(
      'Could not read migration tracker (ensure migrations have been applied '
        + 'via the supported Supabase CLI/SQL Editor):',
      error.message,
    )
    return new Set()
  }

  return new Set((data || []).map((row) => row.filename))
}

function discoverMigrations() {
  return fs.readdirSync(migrationDir)
    .filter((f) => migrationFileRe.test(f) && !AUXILIARY_FILES.has(f))
    .sort()
}

function splitSql(sql) {
  const statements = []
  let current = ''
  let inDollarBlock = false
  let dollarTag = ''

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i]

    if (!inDollarBlock && char === '$' && sql[i - 1] !== '$') {
      let j = i + 1
      while (j < sql.length && /[a-zA-Z0-9_]/.test(sql[j])) {
        j++
      }
      if (j < sql.length && sql[j] === '$') {
        dollarTag = sql.slice(i, j + 1)
        inDollarBlock = true
        current += sql.slice(i, j + 1)
        i = j
        continue
      }
    }

    if (inDollarBlock && char === '$') {
      let j = i + 1
      while (j < sql.length && /[a-zA-Z0-9_]/.test(sql[j])) {
        j++
      }
      if (j < sql.length && sql[j] === '$') {
        const closeTag = sql.slice(i, j + 1)
        if (closeTag === dollarTag) {
          inDollarBlock = false
          dollarTag = ''
        }
        current += sql.slice(i, j + 1)
        i = j
        continue
      }
    }

    current += char

    if (!inDollarBlock && char === ';') {
      statements.push(current)
      current = ''
    }
  }

  if (current.trim()) {
    statements.push(current)
  }

  return statements
}

async function main() {
  console.log('BİŞİŞ V1 Migration Planner')
  console.log(`Migration directory: ${migrationDir}`)

  const files = discoverMigrations()
  const applied = await getAppliedMigrations()
  const pending = files.filter((f) => !applied.has(f))

  // Surface any auxiliary file that is still present so operators know it is
  // intentionally excluded from execution.
  const auxiliaryPresent = fs.readdirSync(migrationDir).filter((f) =>
    AUXILIARY_FILES.has(f),
  )
  if (auxiliaryPresent.length) {
    console.warn(
      'Auxiliary SQL present (excluded from execution): '
        + auxiliaryPresent.join(', ')
        + '. Canonical source: 005_execution_engine.sql.',
    )
  }

  if (pending.length === 0) {
    console.log('No pending migrations.')
    return
  }

  console.log(`Pending migrations (${pending.length}):`)
  for (const filename of pending) {
    console.log(`  - ${filename}`)
    const sql = fs.readFileSync(path.join(migrationDir, filename), 'utf8')
    const statements = splitSql(sql)
    console.log(`     statements: ${statements.length}`)
  }

  console.log('')
  console.log('Execution method:')
  console.log(
    'Apply pending migrations through the supported Supabase path:',
  )
  console.log('  1. Supabase CLI:  supabase db push  (or supabase migration up)')
  console.log('  2. SQL Editor:    run each migration file as the service_role.')
  console.log('')
  console.log(
    'Do not create an unrestricted exec_sql RPC. This runner intentionally does '
      + 'not depend on exec_sql, which is neither a supported nor a safe '
      + 'execution path.',
  )

  process.exitCode = pending.length ? 1 : 0
}

main().catch((error) => {
  console.error('Migration planner failed:', error)
  process.exit(1)
})
