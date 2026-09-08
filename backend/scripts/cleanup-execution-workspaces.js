const path = require('path')
const dotenv = require('dotenv')
const { createClient } = require('@supabase/supabase-js')

dotenv.config({ path: path.resolve(__dirname, '../../.env') })
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

async function run() {
  const { data: rows, error: readError } = await supabase.from('workspaces').select('id,name').like('name', '__EXECUTION_FIXTURE_%')
  if (readError) throw readError
  if (rows.length) {
    const ids = rows.map((row) => row.id)
    const { error: deleteError } = await supabase.from('workspaces').delete().in('id', ids)
    if (deleteError) throw deleteError
  }
  const { data: remaining, error: verifyError } = await supabase.from('workspaces').select('id').like('name', '__EXECUTION_FIXTURE_%')
  if (verifyError) throw verifyError
  if (remaining.length !== 0) throw new Error(`cleanup left ${remaining.length} fixture workspaces`)
  process.stdout.write(`CLEANED_EXECUTION_FIXTURE_WORKSPACES:${rows.length}\n`)
}

run().catch((error) => {
  process.stderr.write(`CLEANUP_FAILED:${JSON.stringify({ message: error.message, code: error.code, details: error.details })}\n`)
  process.exitCode = 1
})
