const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });
require('dotenv').config({ path: '../frontend/.env' });

const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const supabaseAnon = createClient(process.env.SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function testRLS() {
  console.log('=== TESTING RLS ISOLATION ===\n');


  const { data: orders } = await supabaseAdmin
    .from('orders')
    .select('id, user_id, payment_status')
    .limit(10);

  if (!orders || orders.length < 2) {
    console.log('Need at least 2 orders from different users');
    return;
  }


  let userA = null, userB = null, orderA = null, orderB = null;
  for (const o of orders) {
    if (!userA) {
      userA = o.user_id;
      orderA = o.id;
    } else if (o.user_id !== userA && !userB) {
      userB = o.user_id;
      orderB = o.id;
      break;
    }
  }

  if (!userB) {
    console.log('Could not find orders from two different users');
    return;
  }

  console.log(`User A: ${userA} (Order ${orderA})`);
  console.log(`User B: ${userB} (Order ${orderB})`);


  console.log('\n--- Service Role (bypasses RLS) ---');
  const { data: allOrders } = await supabaseAdmin
    .from('orders')
    .select('id, user_id')
    .in('id', [orderA, orderB]);
  console.log(`Service role sees ${allOrders?.length} orders`);


  console.log('\n--- Anon Key (no auth) ---');
  const { data: anonOrders, error: anonErr } = await supabaseAnon
    .from('orders')
    .select('id, user_id')
    .in('id', [orderA, orderB]);
  console.log(`Anon sees ${anonOrders?.length} orders`);
  if (anonErr) console.log('  Error:', anonErr.message);







  console.log('\n--- Testing RLS with auth.uid() simulation ---');


}

testRLS().catch(console.error);
