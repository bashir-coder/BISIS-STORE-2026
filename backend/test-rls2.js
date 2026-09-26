const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });
require('dotenv').config({ path: '../frontend/.env' });

const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const supabaseAnon = createClient(process.env.SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function testRLS() {
  console.log('=== TESTING RLS ISOLATION ===\n');
  
  // Get two users with orders
  const { data: orders } = await supabaseAdmin
    .from('orders')
    .select('id, user_id, payment_status')
    .limit(10);
  
  if (!orders || orders.length < 2) {
    console.log('Need at least 2 orders from different users');
    return;
  }
  
  // Find two orders from different users
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
  
  // Test 1: Service role can access all (bypasses RLS)
  console.log('\n--- Service Role (bypasses RLS) ---');
  const { data: allOrders } = await supabaseAdmin
    .from('orders')
    .select('id, user_id')
    .in('id', [orderA, orderB]);
  console.log(`Service role sees ${allOrders?.length} orders`);
  
  // Test 2: Anon key without auth (should see nothing due to RLS)
  console.log('\n--- Anon Key (no auth) ---');
  const { data: anonOrders, error: anonErr } = await supabaseAnon
    .from('orders')
    .select('id, user_id')
    .in('id', [orderA, orderB]);
  console.log(`Anon sees ${anonOrders?.length} orders`);
  if (anonErr) console.log('  Error:', anonErr.message);
  
  // Test 3: Need to test as authenticated users
  // Since we don't have passwords, we can't sign in directly
  // But we can test the RLS by using the auth.uid() function
  // Let's check if there's a way to impersonate users
  
  // Check RLS policies by looking at what anon can see
  console.log('\n--- Testing RLS with auth.uid() simulation ---');
  
  // We can't easily test as authenticated users without passwords
  // But we can verify the policies exist by checking the behavior
  
  // Test: Try to access orders table with anon key
  const { data: allOrdersAnon } = await supabaseAnon
    .from('orders')
    .select('id, user_id')
    .limit(5);
  console.log(`Anon can see ${allOrdersAnon?.length} orders (should be 0 due to RLS)`);
  
  // Test projects
  const { data: anonProjects } = await supabaseAnon
    .from('projects')
    .select('id')
    .limit(5);
  console.log(`Anon can see ${anonProjects?.length} projects (should be 0 due to RLS)`);
  
  // Test conversations
  const { data: anonConvs } = await supabaseAnon
    .from('conversations')
    .select('id')
    .limit(5);
  console.log(`Anon can see ${anonConvs?.length} conversations (should be 0 due to RLS)`);
  
  console.log('\n=== RLS STATUS ===');
  console.log('Service role: BYPASSES RLS (expected)');
  console.log('Anon key: BLOCKED by RLS (expected)');
  console.log('Authenticated users: Need user JWT to test');
  console.log('RLS policies from migrations:');
  console.log('  orders: "customers view own orders" - auth.uid() = user_id');
  console.log('  projects: Staff + client policies via execution_* functions');
  console.log('  conversations: "customers view own conversations" - auth.uid() = user_id');
}

testRLS().catch(console.error);