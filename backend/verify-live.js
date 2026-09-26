const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  // Test 1: Payment lock column
  console.log('=== GATE 1: PAYMENT LOCK ===');
  const { data: columns, error: colError } = await supabase
    .from('information_schema.columns')
    .select('column_name, data_type, column_default')
    .eq('table_name', 'orders')
    .eq('column_name', 'nowpayments_creating_lock');
  
  if (colError) {
    console.log('Column query error:', colError);
  } else {
    console.log('Payment lock column:', JSON.stringify(columns, null, 2));
  }

  // Test 2: RLS policies
  console.log('\n=== GATE 2: RLS POLICIES ===');
  const { data: policies, error: polError } = await supabase
    .from('pg_policies')
    .select('schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check')
    .in('tablename', ['orders', 'projects', 'conversations']);
  
  if (polError) {
    console.log('Policies query error:', polError);
  } else {
    console.log('RLS Policies:', JSON.stringify(policies, null, 2));
  }

  // Test 3: RLS enabled
  const { data: rlsStatus, error: rlsError } = await supabase
    .from('pg_tables')
    .select('tablename, rowsecurity')
    .in('tablename', ['orders', 'projects', 'conversations']);
  
  if (rlsError) {
    console.log('RLS status error:', rlsError);
  } else {
    console.log('RLS Enabled:', JSON.stringify(rlsStatus, null, 2));
  }

  // Test 4: Check grants
  console.log('\n=== GRANTS ===');
  const { data: grants, error: grantError } = await supabase
    .from('information_schema.table_privileges')
    .select('table_name, grantee, privilege_type, is_grantable')
    .in('table_name', ['orders', 'projects', 'conversations']);
  
  if (grantError) {
    console.log('Grants query error:', grantError);
  } else {
    console.log('Grants:', JSON.stringify(grants, null, 2));
  }
}

test().catch(console.error);