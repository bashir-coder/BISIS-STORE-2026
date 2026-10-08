const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
require('dotenv').config({ path: '../.env' });

const API = 'http://localhost:5000/api';
const supabase = createClient(process.env.SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const IPN_SECRET = process.env.NOWPAYMENTS_IPN_SECRET_KEY;

const ADMIN_EMAIL = process.env.BISIS_TEST_ADMIN_EMAIL || '';
const ADMIN_PASSWORD = process.env.BISIS_TEST_ADMIN_PASSWORD || '';
const CLIENT_EMAIL = process.env.BISIS_TEST_CLIENT_EMAIL || '';
const CLIENT_PASSWORD = process.env.BISIS_TEST_CLIENT_PASSWORD || '';

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
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD || !CLIENT_EMAIL || !CLIENT_PASSWORD) {
    throw new Error('Missing test credentials: set BISIS_TEST_ADMIN_EMAIL, BISIS_TEST_ADMIN_PASSWORD, BISIS_TEST_CLIENT_EMAIL and BISIS_TEST_CLIENT_PASSWORD in ../.env');
  }

  const { data: adminAuth } = await supabase.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD
  });
  const adminToken = adminAuth.session.access_token;
  const adminHeaders = { Authorization: 'Bearer ' + adminToken };
  
  const { data: clientAuth } = await supabase.auth.signInWithPassword({
    email: CLIENT_EMAIL,
    password: CLIENT_PASSWORD
  });
  const clientToken = clientAuth.session.access_token;
  const clientHeaders = { Authorization: 'Bearer ' + clientToken };
  
  console.log('=== TEST 6TH REVISION BLOCKING ===\n');
  
  // Use the project from previous test (124) which should have 5 revisions done
  const projectId = 124;
  
  // Check current state
  const state = await axios.get(API + '/service-delivery/projects/' + projectId + '/client-view', { headers: clientHeaders });
  console.log('Current delivery:', state.data.delivery);
  
  // Try 6th revision (should be blocked)
  console.log('\n--- Attempting 6th revision ---');
  try {
    const rev6 = await axios.post(API + '/service-delivery/projects/' + projectId + '/delivery/revision', {
      reason: 'Revision 6 - should be blocked'
    }, { headers: clientHeaders });
    console.log('Revision 6: ALLOWED (UNEXPECTED!)');
    console.log('Response:', rev6.data);
  } catch (e) {
    console.log('Revision 6: BLOCKED (EXPECTED)');
    console.log('Error:', e.response?.data?.message || e.message);
    console.log('Code:', e.response?.data?.code);
  }
}

run().catch(e => console.log('Error:', e.response?.data?.message || e.message));