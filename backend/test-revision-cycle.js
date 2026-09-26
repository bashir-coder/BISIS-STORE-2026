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
  const { data: adminAuth } = await supabase.auth.signInWithPassword({
    email: 'admin@bisis.local',
    password: 'AdminPass123!'
  });
  const adminToken = adminAuth.session.access_token;
  const adminHeaders = { Authorization: 'Bearer ' + adminToken };
  
  const { data: clientAuth } = await supabase.auth.signInWithPassword({
    email: 'e2etest@bisis.com',
    password: 'TestPass123!'
  });
  const clientToken = clientAuth.session.access_token;
  const clientHeaders = { Authorization: 'Bearer ' + clientToken };
  
  console.log('=== FULL REVISION CYCLE TEST (5 revisions) ===\n');
  
  // Create order
  const orderRes = await axios.post(API + '/orders', {
    full_name: 'Revision Test User',
    email: 'e2etest@bisis.com',
    service_id: 46,
    amount: 149
  }, { headers: clientHeaders });
  const orderId = orderRes.data.id;
  console.log('Order created:', orderId);
  
  // Create payment
  const paymentRes = await axios.post(API + '/orders/' + orderId + '/create-payment', {}, { headers: clientHeaders });
  console.log('Payment created:', paymentRes.data.invoice_id);
  
  // Verify via IPN
  const ipnPayload = {
    payment_id: 999998,
    payment_status: 'finished',
    pay_address: '0x1234567890abcdef',
    price_amount: 149,
    price_currency: 'usd',
    pay_amount: 149,
    pay_currency: 'usdcbsc',
    order_id: String(orderId),
    order_description: 'The 30-Minute Session',
    purchase_id: 'purchase_999998',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  const ipnSig = createSignature(ipnPayload);
  await axios.post(API + '/orders/' + orderId + '/nowpayments-ipn', ipnPayload, { headers: { 'x-nowpayments-sig': ipnSig } });
  console.log('Payment verified');
  
  // Initialize project
  const initRes = await axios.post(API + '/service-delivery/orders/' + orderId + '/initialize', {
    template_id: 61
  }, { headers: adminHeaders });
  const projectId = initRes.data.data.project.id;
  console.log('Project initialized:', projectId);
  
  // Prepare and send initial delivery
  await axios.post(API + '/service-delivery/projects/' + projectId + '/delivery/prepare', {
    notes: 'Initial delivery'
  }, { headers: adminHeaders });
  await axios.post(API + '/service-delivery/projects/' + projectId + '/delivery/send', {}, { headers: adminHeaders });
  console.log('Initial delivery sent');
  
  // Test 5 full revision cycles
  for (let i = 1; i <= 5; i++) {
    console.log(`\n--- Revision Cycle ${i} ---`);
    
    // Client requests revision
    try {
      const rev = await axios.post(API + '/service-delivery/projects/' + projectId + '/delivery/revision', {
        reason: 'Revision ' + i + ' - needs changes'
      }, { headers: clientHeaders });
      console.log(`Revision ${i} requested: status=${rev.data.status}, revision_count=${rev.data.revision_count}`);
    } catch (e) {
      console.log(`Revision ${i} FAILED: ${e.response?.data?.message || e.message}`);
      break;
    }
    
    // Admin prepares again
    try {
      await axios.post(API + '/service-delivery/projects/' + projectId + '/delivery/prepare', {
        notes: 'Revised delivery ' + i
      }, { headers: adminHeaders });
      console.log('Re-prepared');
    } catch (e) {
      console.log(`Re-prepare ${i} FAILED: ${e.response?.data?.message || e.message}`);
      break;
    }
    
    // Admin sends again
    try {
      await axios.post(API + '/service-delivery/projects/' + projectId + '/delivery/send', {}, { headers: adminHeaders });
      console.log('Re-sent');
    } catch (e) {
      console.log(`Re-send ${i} FAILED: ${e.response?.data?.message || e.message}`);
      break;
    }
  }
  
  // Try 6th revision (should be blocked)
  console.log('\n--- Attempting 6th revision (should be BLOCKED) ---');
  try {
    const rev6 = await axios.post(API + '/service-delivery/projects/' + projectId + '/delivery/revision', {
      reason: 'Revision 6 - should be blocked'
    }, { headers: clientHeaders });
    console.log('Revision 6: ALLOWED (UNEXPECTED!)', rev6.data);
  } catch (e) {
    console.log('Revision 6: BLOCKED (EXPECTED)', e.response?.data?.message || e.message);
  }
  
  // Check final delivery state
  const final = await axios.get(API + '/service-delivery/projects/' + projectId + '/client-view', { headers: clientHeaders });
  console.log('\nFinal delivery:', final.data.delivery);
}

run().catch(e => console.log('Error:', e.response?.data?.message || e.message));