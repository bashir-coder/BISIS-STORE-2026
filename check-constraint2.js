const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Try to get constraint via raw query using select from pg_constraint
const query = `SELECT conname, pg_get_constraintdef(oid) as definition FROM pg_constraint WHERE conrelid = 'public.invoices'::regclass AND contype = 'c';`;

// Use Supabase REST API directly
fetch(process.env.SUPABASE_URL + '/rest/v1/rpc/exec_sql', {
  method: 'POST',
  headers: {
    'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  },
  body: JSON.stringify({ sql: query })
}).then(r => r.json()).then(console.log).catch(console.error);