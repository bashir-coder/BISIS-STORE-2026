#!/usr/bin/env node

/**
 * DEPRECATED — intentionally disabled.
 *
 * This legacy runner used a custom public.exec_sql RPC and a
 * public."_BİŞIŞ_migrations" tracker. The inspected Staging project has neither
 * object, and its applied migration history is managed by Supabase.
 *
 * Do not use this script to apply SQL. Use the reviewed migration files with
 * the repository's approved Supabase CLI / migration workflow instead.
 * Never point an ad-hoc runner at Production.
 */

console.error(
  [
    'The legacy custom migration runner is disabled.',
    'It is incompatible with the current Supabase migration history.',
    'Use the approved Supabase migration workflow after reviewing the SQL.',
  ].join('\n'),
)
process.exitCode = 1
