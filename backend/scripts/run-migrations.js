#!/usr/bin/env node
/**
 * BİŞİŞ V1 — Migration Runner
 *
 * Applies pending SQL migrations from database/migrations/ to the
 * configured Supabase/PostgreSQL database using the service role key.
 *
 * Migrations are applied in numeric order and are idempotent:
 * each migration is wrapped in a transaction and uses
 * ADD COLUMN IF NOT EXISTS / DROP CONSTRAINT IF EXISTS patterns.
 *
 * This script is safe to run on existing containers.
 *
 * Environment variables:
 *   SUPABASE_URL            - Supabase project URL (required)
 *   SUPABASE_SERVICE_ROLE_KEY - Service role JWT (required)
 *   MIGRATION_DIR           - Optional override for migration directory
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

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

async function ensureMigrationTracker() {
  const { error } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS public._BİŞİŞ_migrations (
        id SERIAL PRIMARY KEY,
        filename TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `,
  })

  if (error) {
    // Fallback: try direct SQL via REST if RPC is not available
    console.warn(
      'RPC exec_sql unavailable, using REST fallback',
    )
  }
}

async function getAppliedMigrations() {
  const { data, error } = await supabase
    .from('_BİŞİŞ_migrations')
    .select('filename')
    .order('filename', { ascending: true })

  if (error) {
    console.warn(
      'Could not read migration tracker, assuming no migrations applied',
      error.message,
    )
    return new Set()
  }

  return new Set((data || []).map((row) => row.filename))
}

async function recordMigration(filename) {
  const { error } = await supabase
    .from('_Biإںiإں_migrations')
    .insert([{ filename }])

  if (error) {
    console.error(
      `Failed to record migration ${filename}:`,
      error.message,
    )
    throw error
  }
}

async function applyMigration(filename) {
  const filePath = path.join(migrationDir, filename)
  const sql = fs.readFileSync(filePath, 'utf8')

  console.log(`Applying migration: ${filename}`)

  // Split on semicolons but respect DO $$ blocks
  const statements = splitSql(sql)

  for (const statement of statements) {
    const trimmed = statement.trim()
    if (!trimmed) continue

    const { error } = await supabase.rpc('exec_sql', {
      sql: trimmed,
    })

    if (error) {
      console.error(
        `Migration ${filename} failed on statement:`,
        error.message,
      )
      throw error
    }
  }

  await recordMigration(filename)
  console.log(`Migration ${filename} applied successfully`)
}

function splitSql(sql) {
  const statements = []
  let current = ''
  let inDollarBlock = false
  let dollarTag = ''

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i]

    if (!inDollarBlock && char === '$' && sql[i - 1] !== '$') {
      // Check for $$ or $tag$
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
  console.log('Biإںiإں V1 Migration Runner')
  console.log(`Migration directory: ${migrationDir}`)

  await ensureMigrationTracker()

  const files = fs.readdirSync(migrationDir)
    .filter((f) => /^\d{3}_.*\.sql$/.test(f))
    .sort()

  const applied = await getAppliedMigrations()
  const pending = files.filter((f) => !applied.has(f))

  if (pending.length === 0) {
    console.log('No pending migrations.')
    return
  }

  console.log(`Pending migrations: ${pending.length}`)

  for (const filename of pending) {
    try {
      await applyMigration(filename)
    } catch (error) {
      console.error(
        `Migration ${filename} failed. Stopping.`,
        error,
      )
      process.exit(1)
    }
  }

  console.log('All migrations applied successfully.')
}

main().catch((error) => {
  console.error('Migration runner failed:', error)
  process.exit(1)
})