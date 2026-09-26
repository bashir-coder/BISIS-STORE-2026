const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });
require('dotenv').config({ path: '../frontend/.env' });

const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const supabaseAnon = createClient(process.env.SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function test() {
  console.log('=== TESTING RLS ISOLATION ===\n');
  
  // First, get existing users to understand the data
  console.log('--- Checking existing users ---');
  const { data: users, error: usersError } = await supabaseAdmin.auth.admin.listUsers();
  if (usersError) {
    console.log('Users list error:', usersError);
  } else {
    console.log(`Found ${users.users.length} users`);
    users.users.slice(0, 5).forEach(u => {
      console.log(`  - ${u.id} | ${u.email} | confirmed: ${!!u.email_confirmed_at}`);
    });
  }

  // Get some orders to understand ownership
  console.log('\n--- Checking orders ownership ---');
  const { data: orders, error: ordersError } = await supabaseAdmin
    .from('orders')
    .select('id, user_id, payment_status, workspace_id')
    .limit(10);
  
  if (ordersError) {
    console.log('Orders error:', ordersError);
  } else {
    console.log(`Found ${orders?.length} orders`);
    orders?.forEach(o => {
      console.log(`  - Order ${o.id} | user: ${o.user_id} | status: ${o.payment_status} | workspace: ${o.workspace_id}`);
    });
  }

  // Get projects
  console.log('\n--- Checking projects ---');
  const { data: projects, error: projectsError } = await supabaseAdmin
    .from('projects')
    .select('id, workspace_id, created_by')
    .limit(10);
  
  if (projectsError) {
    console.log('Projects error:', projectsError);
  } else {
    console.log(`Found ${projects?.length} projects`);
    projects?.forEach(p => {
      console.log(`  - Project ${p.id} | workspace: ${p.workspace_id} | created_by: ${p.created_by}`);
    });
  }

  // Get conversations
  console.log('\n--- Checking conversations ---');
  const { data: conversations, error: convError } = await supabaseAdmin
    .from('conversations')
    .select('id, user_id, workspace_id, order_id, project_id')
    .limit(10);
  
  if (convError) {
    console.log('Conversations error:', convError);
  } else {
    console.log(`Found ${conversations?.length} conversations`);
    conversations?.forEach(c => {
      console.log(`  - Conv ${c.id} | user: ${c.user_id} | workspace: ${c.workspace_id} | order: ${c.order_id} | project: ${c.project_id}`);
    });
  }

  // Find two distinct users with orders for isolation testing
  if (orders && orders.length >= 2) {
    const userA = orders[0].user_id;
    const userB = orders[1].user_id;
    
    if (userA !== userB) {
      console.log(`\n--- Testing RLS isolation: User A (${userA}) vs User B (${userB}) ---`);
      
      // Create client for User A
      // We need to sign in as these users. Let's check if they have passwords or we need to use magic links
      // For now, let's test with service role bypassing RLS and then test with anon key + auth
    }
  }
}

test().catch(console.error);