const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  console.log('=== GATE 1: PAYMENT LOCK (via orders table) ===');
  
  // Try to select the lock column from orders
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, nowpayments_creating_lock')
    .limit(1);
  
  if (orderError) {
    console.log('Orders query error:', orderError);
    if (orderError.code === 'PGRST204' || orderError.message.includes('nowpayments_creating_lock')) {
      console.log('=> Column nowpayments_creating_lock likely does NOT exist');
    }
  } else {
    console.log('Orders sample with lock column:', JSON.stringify(order, null, 2));
    if (order && order.length > 0) {
      console.log('=> Column nowpayments_creating_lock EXISTS');
      console.log('=> Type check: value is', typeof order[0].nowpayments_creating_lock);
      console.log('=> Default check: value is', order[0].nowpayments_creating_lock);
    }
  }

  // Test 2: RLS enabled check via table query
  console.log('\n=== GATE 2: RLS via table access ===');
  
  // Check if we can query orders (should work with service_role)
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('id, user_id, workspace_id')
    .limit(3);
  
  if (ordersError) {
    console.log('Orders query error:', ordersError);
  } else {
    console.log('Orders accessible with service_role:', orders?.length, 'rows');
  }

  // Check projects
  const { data: projects, error: projectsError } = await supabase
    .from('projects')
    .select('id, workspace_id, created_by')
    .limit(3);
  
  if (projectsError) {
    console.log('Projects query error:', projectsError);
  } else {
    console.log('Projects accessible with service_role:', projects?.length, 'rows');
  }

  // Check conversations
  const { data: conversations, error: convError } = await supabase
    .from('conversations')
    .select('id, user_id, workspace_id, order_id, project_id')
    .limit(3);
  
  if (convError) {
    console.log('Conversations query error:', convError);
  } else {
    console.log('Conversations accessible with service_role:', conversations?.length, 'rows');
  }

  // Test 3: Try to get table info via RPC if available
  console.log('\n=== Attempting raw SQL via RPC ===');
  try {
    const { data: rpcResult, error: rpcError } = await supabase.rpc('execute_sql', {
      query: "SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name='orders' AND column_name='nowpayments_creating_lock';"
    });
    if (rpcError) {
      console.log('RPC execute_sql not available:', rpcError.message);
    } else {
      console.log('RPC result:', JSON.stringify(rpcResult, null, 2));
    }
  } catch (e) {
    console.log('RPC execute_sql not available:', e.message);
  }
}

test().catch(console.error);