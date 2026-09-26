const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config({ path: '../.env' });

const IPN_SECRET = process.env.NOWPAYMENTS_IPN_SECRET_KEY;
const BASE_URL = 'http://localhost:5000';

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

async function testIPN() {
  console.log('=== TESTING IPN ENDPOINT ===\n');
  
  // Use existing order 104
  const orderId = 104;
  
  // Test 1: Valid signature
  console.log('1. Valid signature test:');
  const validPayload = {
    payment_id: 999001,
    payment_status: 'finished',
    pay_address: '0x1234567890abcdef',
    price_amount: 100,
    price_currency: 'usd',
    pay_amount: 100,
    pay_currency: 'usdcbsc',
    order_id: String(orderId),
    order_description: 'Test order',
    purchase_id: 'purchase_999001',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  const validSig = createSignature(validPayload);
  try {
    const response = await axios.post(`${BASE_URL}/api/orders/${orderId}/nowpayments-ipn`, validPayload, {
      headers: { 'x-nowpayments-sig': validSig }
    });
    console.log('  Status:', response.status);
    console.log('  Response:', JSON.stringify(response.data, null, 2));
  } catch (e) {
    console.log('  Error:', e.response?.data || e.message);
  }
  
  // Test 2: Invalid signature
  console.log('\n2. Invalid signature test:');
  try {
    const response = await axios.post(`${BASE_URL}/api/orders/${orderId}/nowpayments-ipn`, validPayload, {
      headers: { 'x-nowpayments-sig': 'invalidsignature' }
    });
    console.log('  Status:', response.status);
    console.log('  Response:', JSON.stringify(response.data, null, 2));
  } catch (e) {
    console.log('  Expected error:', e.response?.data || e.message);
  }
  
  // Test 3: Wrong currency
  console.log('\n3. Wrong currency (btc) test:');
  const wrongCurrencyPayload = { ...validPayload, pay_currency: 'btc' };
  const wrongCurrencySig = createSignature(wrongCurrencyPayload);
  try {
    const response = await axios.post(`${BASE_URL}/api/orders/${orderId}/nowpayments-ipn`, wrongCurrencyPayload, {
      headers: { 'x-nowpayments-sig': wrongCurrencySig }
    });
    console.log('  Status:', response.status);
    console.log('  Response:', JSON.stringify(response.data, null, 2));
  } catch (e) {
    console.log('  Expected error:', e.response?.data || e.message);
  }
  
  // Test 4: Wrong amount
  console.log('\n4. Wrong amount test:');
  const wrongAmountPayload = { ...validPayload, pay_amount: 50 };
  const wrongAmountSig = createSignature(wrongAmountPayload);
  try {
    const response = await axios.post(`${BASE_URL}/api/orders/${orderId}/nowpayments-ipn`, wrongAmountPayload, {
      headers: { 'x-nowpayments-sig': wrongAmountSig }
    });
    console.log('  Status:', response.status);
    console.log('  Response:', JSON.stringify(response.data, null, 2));
  } catch (e) {
    console.log('  Expected error:', e.response?.data || e.message);
  }
  
  // Test 5: Replay protection - send same IPN twice
  console.log('\n5. Replay protection test (sending same IPN twice):');
  const replayPayload = {
    payment_id: 999002,
    payment_status: 'finished',
    pay_address: '0x1234567890abcdef',
    price_amount: 200,
    price_currency: 'usd',
    pay_amount: 200,
    pay_currency: 'usdcbsc',
    order_id: String(orderId),
    order_description: 'Test order replay',
    purchase_id: 'purchase_999002',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  const replaySig = createSignature(replayPayload);
  
  // First request
  console.log('  First request:');
  try {
    const response = await axios.post(`${BASE_URL}/api/orders/${orderId}/nowpayments-ipn`, replayPayload, {
      headers: { 'x-nowpayments-sig': replaySig }
    });
    console.log('  Status:', response.status);
    console.log('  Response:', JSON.stringify(response.data, null, 2));
  } catch (e) {
    console.log('  Error:', e.response?.data || e.message);
  }
  
  // Second request (same payload)
  console.log('  Second request (replay):');
  try {
    const response = await axios.post(`${BASE_URL}/api/orders/${orderId}/nowpayments-ipn`, replayPayload, {
      headers: { 'x-nowpayments-sig': replaySig }
    });
    console.log('  Status:', response.status);
    console.log('  Response:', JSON.stringify(response.data, null, 2));
  } catch (e) {
    console.log('  Error:', e.response?.data || e.message);
  }
  
  // Third request (replay again)
  console.log('  Third request (replay again):');
  try {
    const response = await axios.post(`${BASE_URL}/api/orders/${orderId}/nowpayments-ipn`, replayPayload, {
      headers: { 'x-nowpayments-sig': replaySig }
    });
    console.log('  Status:', response.status);
    console.log('  Response:', JSON.stringify(response.data, null, 2));
  } catch (e) {
    console.log('  Error:', e.response?.data || e.message);
  }
  
  // Test 6: Downgrade protection - try to change verified to pending
  console.log('\n6. Downgrade protection test (verified -> pending):');
  const downgradePayload = {
    payment_id: 999003,
    payment_status: 'waiting', // This maps to 'pending'
    pay_address: '0x1234567890abcdef',
    price_amount: 300,
    price_currency: 'usd',
    pay_amount: 300,
    pay_currency: 'usdcbsc',
    order_id: String(orderId),
    order_description: 'Test order downgrade',
    purchase_id: 'purchase_999003',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  const downgradeSig = createSignature(downgradePayload);
  try {
    const response = await axios.post(`${BASE_URL}/api/orders/${orderId}/nowpayments-ipn`, downgradePayload, {
      headers: { 'x-nowpayments-sig': downgradeSig }
    });
    console.log('  Status:', response.status);
    console.log('  Response:', JSON.stringify(response.data, null, 2));
  } catch (e) {
    console.log('  Error:', e.response?.data || e.message);
  }
}

testIPN().catch(console.error);