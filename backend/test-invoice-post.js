const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
require('dotenv').config({ path: '../.env' });

const API = 'http://localhost:5000/api';
const supabase = createClient(process.env.SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const IPN_SECRET = process.env.NOWPAYMENTS_IPN_SECRET_KEY;

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (value !== null && typeof value === 'object') {
    return Object.keys(value).sort().reduce((sorted, key) => {
      sorted[key] = sortObject(value[key]);
      return sorted;
    }, {});
  }
  return value;
}

function createSignature(payload) {
  const sortedPayload = sortObject(payload);
  const payloadString = JSON.stringify(sortedPayload);
  return crypto.createHmac('sha512', IPN_SECRET).update(payloadString).digest('hex');
}

async function run() {
  // Admin login
  const { data: adminAuth } = await supabase.auth.signInWithPassword({
    email: 'admin@bisis.local',
    password: 'AdminPass123!'
  });
  const adminToken = adminAuth.session.access_token;
  const adminHeaders = { Authorization: 'Bearer ' + adminToken };
  
  console.log('=== PHASE 2: INVOICE POST REGRESSION TEST ===\n');
  
  // Step 1: Create an order
  console.log('1. Creating order...');
  const orderRes = await axios.post(API + '/orders', {
    full_name: 'Invoice Test User',
    email: 'e2etest@bisis.com',
    service_id: 46,
    amount: 149
  }, { headers: adminHeaders });
  const orderId = orderRes.data.id;
  console.log('   Order created:', orderId);
  
  // Step 2: Test POST /api/invoices (admin only endpoint)
  console.log('\n2. Testing POST /api/invoices...');
  try {
    const invoiceRes = await axios.post(API + '/invoices', {
      order_id: orderId
    }, { headers: adminHeaders });
    console.log('   ✅ Invoice created:', invoiceRes.data);
    console.log('   Status:', invoiceRes.data.status);
    console.log('   Invoice number:', invoiceRes.data.invoice_number);
    console.log('   Order ID:', invoiceRes.data.order_id);
    console.log('   Amount:', invoiceRes.data.amount);
    console.log('   Tax:', invoiceRes.data.tax);
    console.log('   Total:', invoiceRes.data.total);
  } catch (e) {
    console.log('   ❌ FAILED:', e.response?.data?.message || e.message);
    console.log('   Status:', e.response?.status);
    console.log('   Data:', e.response?.data);
  }
  
  // Step 3: Test duplicate protection
  console.log('\n3. Testing duplicate invoice protection...');
  try {
    await axios.post(API + '/invoices', { order_id: orderId }, { headers: adminHeaders });
    console.log('   ❌ UNEXPECTED: Duplicate allowed');
  } catch (e) {
    console.log('   ✅ Blocked:', e.response?.data?.message || e.message);
  }
  
  // Step 4: Test GET invoice
  console.log('\n4. Testing GET /api/invoices/order/:orderId...');
  try {
    const getRes = await axios.get(API + '/invoices/order/' + orderId, { headers: adminHeaders });
    console.log('   ✅ Invoice retrieved:', getRes.data);
  } catch (e) {
    console.log('   ❌ FAILED:', e.response?.data?.message || e.message);
  }
  
  // Step 5: Test PATCH invoice status
  console.log('\n5. Testing PATCH /api/invoices/:id (status transitions)...');
  try {
    // First get the invoice ID
    const getRes = await axios.get(API + '/invoices/order/' + orderId, { headers: adminHeaders });
    const invoiceId = getRes.data.id;
    
    // Test void
    const voidRes = await axios.patch(API + '/invoices/' + invoiceId, { status: 'void' }, { headers: adminHeaders });
    console.log('   ✅ void:', voidRes.data.status);
    
    // Test refunded
    const refundRes = await axios.patch(API + '/invoices/' + invoiceId, { status: 'refunded' }, { headers: adminHeaders });
    console.log('   ✅ refunded:', refundRes.data.status);
    
    // Test issued (back)
    const issuedRes = await axios.patch(API + '/invoices/' + invoiceId, { status: 'issued' }, { headers: adminHeaders });
    console.log('   ✅ issued:', issuedRes.data.status);
    
    // Test invalid status
    try {
      await axios.patch(API + '/invoices/' + invoiceId, { status: 'cancelled' }, { headers: adminHeaders });
      console.log('   ❌ UNEXPECTED: Invalid status allowed');
    } catch (e) {
      console.log('   ✅ Invalid status blocked:', e.response?.data?.message || e.message);
    }
  } catch (e) {
    console.log('   ❌ FAILED:', e.response?.data?.message || e.message);
  }
  
  // Step 6: Test client access (should work for own order)
  console.log('\n6. Testing client access to own invoice...');
  const { data: clientAuth } = await supabase.auth.signInWithPassword({
    email: 'e2etest@bisis.com',
    password: 'TestPass123!'
  });
  const clientHeaders = { Authorization: 'Bearer ' + clientAuth.session.access_token };
  try {
    const clientGet = await axios.get(API + '/invoices/order/' + orderId, { headers: clientHeaders });
    console.log('   ✅ Client can access own invoice:', clientGet.data.invoice_number);
  } catch (e) {
    console.log('   ❌ FAILED:', e.response?.data?.message || e.message);
  }
  
  console.log('\n=== PHASE 2 COMPLETE ===');
}

run().catch(e => console.log('Error:', e.response?.data?.message || e.message));