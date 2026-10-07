const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const API = 'http://localhost:5000/api';
const supabase = createClient(process.env.SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

const ADMIN_EMAIL = process.env.BISIS_TEST_ADMIN_EMAIL || '';
const ADMIN_PASSWORD = process.env.BISIS_TEST_ADMIN_PASSWORD || '';
const CLIENT_EMAIL = process.env.BISIS_TEST_CLIENT_EMAIL || '';
const CLIENT_PASSWORD = process.env.BISIS_TEST_CLIENT_PASSWORD || '';

async function run() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD || !CLIENT_EMAIL || !CLIENT_PASSWORD) {
    throw new Error('Missing test credentials: set BISIS_TEST_ADMIN_EMAIL, BISIS_TEST_ADMIN_PASSWORD, BISIS_TEST_CLIENT_EMAIL and BISIS_TEST_CLIENT_PASSWORD in ../.env');
  }

  // Admin login
  const { data: adminAuth } = await supabase.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD
  });
  const adminToken = adminAuth.session.access_token;
  const adminHeaders = { Authorization: 'Bearer ' + adminToken };
  
  // Client login
  const { data: clientAuth } = await supabase.auth.signInWithPassword({
    email: CLIENT_EMAIL,
    password: CLIENT_PASSWORD
  });
  const clientToken = clientAuth.session.access_token;
  const clientHeaders = { Authorization: 'Bearer ' + clientToken };
  
  const projectId = 122;
  
  console.log('=== REVISION LIMIT TEST ===\n');
  
  // First, prepare and send delivery (if not already done)
  // Check current delivery status
  const { data: delivery } = await axios.get(API + '/service-delivery/projects/' + projectId + '/client-view', { headers: clientHeaders });
  console.log('Current delivery status:', delivery.data?.delivery?.status);
  
  // If delivery is completed, we need a new one for revision testing
  // Let's check if we can request revision on completed delivery
  if (delivery.data?.delivery?.status === 'completed') {
    console.log('\n--- Testing revision on completed delivery ---');
    try {
      const rev1 = await axios.post(API + '/service-delivery/projects/' + projectId + '/delivery/revision', {
        reason: 'Revision 1 - test'
      }, { headers: clientHeaders });
      console.log('Revision 1:', rev1.data.status, 'revision_count:', rev1.data.revision_count);
    } catch (e) {
      console.log('Revision 1 failed:', e.response?.data?.message || e.message);
    }
  }
  
  // Let's create a fresh project for revision testing
  // Create a new order with payment
  console.log('\n--- Creating new order for revision test ---');
  const orderRes = await axios.post(API + '/orders', {
    full_name: 'Revision Test User',
    email: CLIENT_EMAIL,
    service_id: 46,
    amount: 149
  }, { headers: clientHeaders });
  const orderId = orderRes.data.id;
  console.log('Order created:', orderId);
  
  // Create payment
  const paymentRes = await axios.post(API + '/orders/' + orderId + '/create-payment', {}, { headers: clientHeaders });
  console.log('Payment created:', paymentRes.data.invoice_id);
  
  // Simulate IPN to verify
  const crypto = require('crypto');
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
  
  const ipnPayload = {
    payment_id: 999999,
    payment_status: 'finished',
    pay_address: '0x1234567890abcdef',
    price_amount: 149,
    price_currency: 'usd',
    pay_amount: 149,
    pay_currency: 'usdcbsc',
    order_id: String(orderId),
    order_description: 'The 30-Minute Session',
    purchase_id: 'purchase_999999',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  const ipnSig = createSignature(ipnPayload);
  await axios.post(API + '/orders/' + orderId + '/nowpayments-ipn', ipnPayload, { headers: { 'x-nowpayments-sig': ipnSig } });
  console.log('Payment verified via IPN');
  
  // Initialize project
  const initRes = await axios.post(API + '/service-delivery/orders/' + orderId + '/initialize', {
    template_id: 61
  }, { headers: adminHeaders });
  const newProjectId = initRes.data.data.project.id;
  console.log('Project initialized:', newProjectId);
  
  // Prepare delivery
  await axios.post(API + '/service-delivery/projects/' + newProjectId + '/delivery/prepare', {
    notes: 'Delivery prepared'
  }, { headers: adminHeaders });
  
  // Send delivery
  await axios.post(API + '/service-delivery/projects/' + newProjectId + '/delivery/send', {}, { headers: adminHeaders });
  console.log('Delivery sent');
  
  // Now test revisions 1-6
  console.log('\n--- TESTING REVISIONS 1-6 ---');
  for (let i = 1; i <= 6; i++) {
    try {
      const rev = await axios.post(API + '/service-delivery/projects/' + newProjectId + '/delivery/revision', {
        reason: 'Revision ' + i + ' - test reason'
      }, { headers: clientHeaders });
      console.log(`Revision ${i}: ALLOWED - status: ${rev.data.status}, revision_count: ${rev.data.revision_count}`);
    } catch (e) {
      console.log(`Revision ${i}: BLOCKED - ${e.response?.data?.message || e.message}`);
    }
  }
  
  // Check final state
  const finalState = await axios.get(API + '/service-delivery/projects/' + newProjectId + '/client-view', { headers: clientHeaders });
  console.log('\nFinal delivery:', finalState.data.delivery);
}

run().catch(e => console.log('Error:', e.response?.data?.message || e.message));