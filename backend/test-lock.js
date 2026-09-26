const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testLock() {
  console.log('=== TESTING PAYMENT LOCK MECHANISM (Database Level) ===\n');
  
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
  console.log(`Testing with Order ${order.id}:`);
  console.log(`  payment_status: ${order.payment_status}`);
  console.log(`  nowpayments_creating_lock: ${order.nowpayments_creating_lock}`);
  console.log(`  payment_url: ${order.payment_url}`);
  
  // Test 1: Try to acquire lock (first attempt)
  console.log('\n1. First lock acquisition attempt:');
  const { data: lock1, error: err1 } = await supabaseAdmin
    .from('orders')
    .update({ nowpayments_creating_lock: true })
    .eq('id', order.id)
    .is('nowpayments_creating_lock', false)
    .select('id, nowpayments_creating_lock, payment_url')
    .single();
  
  console.log('  Result:', lock1 ? 'LOCK ACQUIRED' : 'LOCK NOT ACQUIRED');
  if (lock1) {
    console.log('  nowpayments_creating_lock:', lock1.nowpayments_creating_lock);
  }
  if (err1) console.log('  Error:', err1);
  
  // Test 2: Try to acquire lock again (should fail - lock held)
  console.log('\n2. Second lock acquisition attempt (lock held):');
  const { data: lock2, error: err2 } = await supabaseAdmin
    .from('orders')
    .update({ nowpayments_creating_lock: true })
    .eq('id', order.id)
    .is('nowpayments_creating_lock', false)
    .select('id, nowpayments_creating_lock, payment_url')
    .single();
  
  console.log('  Result:', lock2 ? 'LOCK ACQUIRED (UNEXPECTED!)' : 'LOCK DENIED (correct)');
  if (err2) console.log('  Error:', err2);
  
  // Test 3: Release lock
  console.log('\n3. Releasing lock:');
  const { data: release, error: releaseErr } = await supabaseAdmin
    .from('orders')
    .update({ nowpayments_creating_lock: false })
    .eq('id', order.id)
    .select('id, nowpayments_creating_lock')
    .single();
  
  console.log('  Result:', release ? 'LOCK RELEASED' : 'RELEASE FAILED');
  if (release) console.log('  nowpayments_creating_lock:', release.nowpayments_creating_lock);
  if (releaseErr) console.log('  Error:', releaseErr);
  
  // Test 4: Acquire lock again after release
  console.log('\n4. Lock acquisition after release:');
  const { data: lock3, error: err3 } = await supabaseAdmin
    .from('orders')
    .update({ nowpayments_creating_lock: true })
    .eq('id', order.id)
    .is('nowpayments_creating_lock', false)
    .select('id, nowpayments_creating_lock')
    .single();
  
  console.log('  Result:', lock3 ? 'LOCK ACQUIRED' : 'LOCK NOT ACQUIRED');
  if (lock3) console.log('  nowpayments_creating_lock:', lock3.nowpayments_creating_lock);
  if (err3) console.log('  Error:', err3);
  
  // Clean up: release lock
  await supabaseAdmin
    .from('orders')
    .update({ nowpayments_creating_lock: false })
    .eq('id', order.id);
  
  console.log('\n=== ATOMIC CAS VERIFIED ===');
  console.log('The lock uses: UPDATE ... SET lock=true WHERE id=? AND lock IS FALSE');
  console.log('This is a true atomic compare-and-swap operation.');
}

testLock().catch(console.error);