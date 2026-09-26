const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Try pg_constraint
const sql = `
    SELECT conname, pg_get_constraintdef(oid) as def
    FROM pg_constraint
    WHERE conname = 'invoices_status_check';
`;

supabase
  .rpc('exec_sql', { sql })
  .then(r => console.log('PG_CONSTRAINT:', JSON.stringify(r, null, 2)))
  .catch(e => console.log('PG_CONSTRAINT error:', e.message));

// Get all invoices with details
supabase
  .from('invoices')
  .select('*')
  .then(r => console.log('ALL INVOICES:', JSON.stringify(r.data, null, 2)));