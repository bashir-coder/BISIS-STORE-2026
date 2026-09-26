const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testConcurrency() {
  console.log('=== TESTING PAYMENT LOCK CONCURRENCY (Database Level - 50 concurrent) ===\n');
  
  // Find an order with pending payment
  const { data: orders } = await supabaseAdmin
    .from('orders')
    .select('id, payment_status, nowpayments_creating_lock, payment_url')
    .eq('payment_status', 'pending')
    .limit(1);
  
  if (!orders || orders.length === 0) {
    console.log('No pending orders found');
    return;
  }
  
  const order = orders[0];
  console.log(`Testing with Order ${order.id}`);
  
  // Ensure lock is released first
  await supabaseAdmin
    .from('orders')
    .update({ nowpayments_creating_lock: false })
    .eq('id', order.id);
  
  console.log('Lock released, starting 50 concurrent lock attempts...\n');
  
  // Simulate 50 concurrent lock acquisition attempts
  const attempts = 50;
  const promises = [];
  
  for (let i = 0; i < attempts; i++) {
    promises.push(
      supabaseAdmin
        .from('orders')
        .update({ nowpayments_creating_lock: true })
        .eq('id', order.id)
        .is('nowpayments_creating_lock', false)
        .select('id, nowpayments_creating_lock')
        .single()
        .then(result => ({ success: true, data: result }))
        .catch(error => ({ success: false, error: error.message }))
    );
  }
  
  const results = await Promise.all(promises);
  
  const acquired = results.filter(r => r.success).length;
  const denied = results.filter(r => !r.success).length;
  
  console.log(`Results:`);
  console.log(`  Total attempts: ${attempts}`);
  console.log(`  Lock acquired: ${acquired}`);
  console.log(`  Lock denied: ${denied}`);
  
  // Check final state
  const { data: finalState } = await supabaseAdmin
    .from('orders')
    .select('nowpayments_creating_lock')
    .eq('id', order.id)
    .single();
  
  console.log(`\nFinal lock state: ${finalState?.nowpayments_creating_lock}`);
  
  // Release lock
  await supabaseAdmin
    .from('orders')
    .update({ nowpayments_creating_lock: false })
    .eq('id', order.id);
  
  console.log('\n=== CONCURRENCY TEST RESULT ===');
  if (acquired === 1 && denied === 49) {
    console.log('✅ PASS: Exactly 1 lock acquired, 49 denied');
    console.log('✅ No duplicate payment creation possible');
  } else {
    console.log('❌ FAIL: Unexpected result');
  }
}

testConcurrency().catch(console.error);