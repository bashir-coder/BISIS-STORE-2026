const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  // Check the actual constraint
  const { data, error } = await supabaseAdmin
    .from('information_schema.check_constraints')
    .select('constraint_name, check_clause')
    .eq('constraint_name', 'invoices_status_check');
  
  console.log('Check constraints:', data, error);
  
  // Also check pg_constraint
  const { data: constraints, error: err2 } = await supabaseAdmin
    .rpc('execute_sql', {
      query: "SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'invoices_status_check';"
    });
  console.log('pg_constraint:', constraints, err2);
}

test().catch(console.error);