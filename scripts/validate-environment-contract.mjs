#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const envPath = resolve(repoRoot, '.env.example')
const requiredKeys = [
  'NODE_ENV',
  'PORT',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ALLOWED_ORIGINS',
  'TRUST_PROXY_HOPS',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_API_URL',
  'VITE_ENABLE_GOOGLE_OAUTH',
  'VITE_GOOGLE_CLIENT_ID',
  'WEB3_NETWORK',
  'WEB3_RPC_URL',
  'USDC_CONTRACT_ADDRESS',
  'WEB3_RECIPIENT_ADDRESS',
  'WEB3_REQUIRED_CONFIRMATIONS',
  'AI_PROVIDER',
  'OPENAI_MODEL',
  'OPENAI_API_KEY',
  'LOG_LEVEL',
  'FRONTEND_URL',
]
const secretKeys = new Set(['SUPABASE_SERVICE_ROLE_KEY', 'OPENAI_API_KEY'])
const failures = []

let content = ''
try {
  content = await readFile(envPath, 'utf8')
} catch {
  failures.push('Missing .env.example')
}

const assignments = new Map()
for (const line of content.split(/\r?\n/)) {
  const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/)
  if (match) assignments.set(match[1], match[2])
}

for (const key of requiredKeys) {
  if (!assignments.has(key)) failures.push(`Missing key: ${key}`)
}
for (const key of secretKeys) {
  const value = assignments.get(key) || ''
  if (/^(sk-|eyJ|AIza|re_|rk_|xox[baprs]-|gh[pousr]_)/i.test(value)) {
    failures.push(`Secret-looking value found for ${key}`)
  }
}
if (!/^([0-5])$/.test(assignments.get('TRUST_PROXY_HOPS') || '')) failures.push('TRUST_PROXY_HOPS must be an integer between 0 and 5')
if (assignments.get('AI_PROVIDER') !== 'disabled') failures.push('AI_PROVIDER must remain disabled for V1 example')
if (assignments.get('VITE_ENABLE_GOOGLE_OAUTH') !== 'false') failures.push('VITE_ENABLE_GOOGLE_OAUTH must default to false')

const result = {
  status: failures.length ? 'FAIL' : 'PASS',
  file: '.env.example',
  required_key_count: requiredKeys.length,
  secret_keys_checked: [...secretKeys],
  failures,
  policy: {
    ai_default: 'disabled',
    google_oauth_default: false,
    real_secrets_in_example: false,
  },
}
console.log(JSON.stringify(result, null, 2))
process.exitCode = failures.length ? 1 : 0
