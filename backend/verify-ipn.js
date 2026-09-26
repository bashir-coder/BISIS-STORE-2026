const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
require('dotenv').config({ path: '../.env' });

const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const IPN_SECRET = process.env.NOWPAYMENTS_IPN_SECRET_KEY;

console.log('=== GATE 3: NOWPAYMENTS IPN CONFIGURATION ===');
console.log('IPN Secret configured:', IPN_SECRET ? 'YES (non-empty)' : 'NO');
console.log('IPN Secret length:', IPN_SECRET?.length || 0);

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

function timingSafeEqualHex(expected, received) {
  const expectedBuf = Buffer.from(String(expected || ''), 'utf8');
  const receivedBuf = Buffer.from(String(received || ''), 'utf8');
  if (expectedBuf.length === 0 || receivedBuf.length === 0) return false;
  if (expectedBuf.length !== receivedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}

// Test IPN payload
const testPayload = {
  payment_id: 123456789,
  payment_status: 'finished',
  pay_address: '0x1234567890abcdef',
  price_amount: 100,
  price_currency: 'usd',
  pay_amount: 100,
  pay_currency: 'usdcbsc',
  order_id: '104',
  order_description: 'Test order',
  purchase_id: 'purchase_123',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

console.log('\n=== SIGNATURE TESTS ===');
const validSig = createSignature(testPayload);
console.log('Valid signature generated:', validSig.substring(0, 16) + '...');

// Test 1: Valid signature
console.log('\n1. Valid signature:');
console.log('  timingSafeEqual(valid, valid):', timingSafeEqualHex(validSig, validSig));

// Test 2: Invalid signature
console.log('\n2. Invalid signature:');
console.log('  timingSafeEqual(valid, invalid):', timingSafeEqualHex(validSig, 'invalidsignature'));

// Test 3: Modified payload with old signature
const modifiedPayload = { ...testPayload, pay_amount: 999 };
const modifiedSig = createSignature(modifiedPayload);
console.log('\n3. Modified payload with old signature:');
console.log('  timingSafeEqual(validSig, modifiedSig):', timingSafeEqualHex(validSig, modifiedSig));

// Test 4: Wrong currency
const wrongCurrencyPayload = { ...testPayload, pay_currency: 'btc' };
const wrongCurrencySig = createSignature(wrongCurrencyPayload);
console.log('\n4. Wrong currency (btc):');
console.log('  timingSafeEqual(validSig, wrongCurrencySig):', timingSafeEqualHex(validSig, wrongCurrencySig));

// Test 5: Wrong amount
const wrongAmountPayload = { ...testPayload, pay_amount: 50 };
const wrongAmountSig = createSignature(wrongAmountPayload);
console.log('\n5. Wrong amount (50 vs 100):');
console.log('  timingSafeEqual(validSig, wrongAmountSig):', timingSafeEqualHex(validSig, wrongAmountSig));

console.log('\n=== IPN ENDPOINT TEST (requires running backend) ===');
console.log('To test IPN endpoint, backend must be running.');
console.log('Run: npm run dev in backend directory');
console.log('Then POST to /api/orders/104/nowpayments-ipn with x-nowpayments-sig header');