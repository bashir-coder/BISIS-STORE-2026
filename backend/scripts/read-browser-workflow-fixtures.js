const path = require('path')
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') })

const marker = '__BROWSER_WORKFLOW_%'
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
const checks = [
  ['users', 'full_name'],
  ['workspaces', 'name'],
  ['orders', 'full_name'],
  ['projects', 'name'],
  ['project_templates', 'name'],
]

async function run() {
  const result = {}
  for (const [table, column] of checks) {
    const response = await admin.from(table).select('id', { count: 'exact', head: true }).ilike(column, marker)
    result[table] = { count: response.count || 0, error: response.error?.message || null }
  }
  console.log(JSON.stringify({ marker: '[redacted-marker]', result }, null, 2))
}
run().catch((error) => { console.error(error.message); process.exitCode = 1 })
