/**
 * BİŞİŞ V1 — Live DB Payment State Verification
 * Verifies payment-related columns, constraints, and RLS on live DB.
 */
require('dotenv').config({ path: '../.env' })
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY
const anonSb = createClient(process.env.SUPABASE_URL, ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

;(async () => {
  console.log('===== LIVE DB PAYMENT STATE VERIFICATION =====\n')

  // 1. Lock column
  const { error: lockErr } = await sb.from('orders').select('nowpayments_creating_lock')
  console.log('orders.nowpayments_creating_lock:',
    lockErr ? 'NOT FOUND — ' + lockErr.message.substring(0, 100) : 'EXISTS')

  // 2. All NOWPayments columns
  const npCols = [
    'payment_provider',
    'nowpayments_payment_id',
    'nowpayments_invoice_id',
    'nowpayments_purchase_id',
    'payment_url',
    'nowpayments_pay_address',
    'nowpayments_pay_currency',
    'nowpayments_pay_amount',
    'nowpayments_price_amount',
    'nowpayments_price_currency',
    'nowpayments_status',
    'nowpayments_last_ipn_at',
  ]
  console.log('\n--- NOWPayments columns on orders ---')
  for (const col of npCols) {
    const { error: colErr } = await sb.from('orders').select(col)
    console.log(`  orders.${col}:`,
      colErr ? 'NOT FOUND — ' + colErr.message.substring(0, 80) : 'EXISTS')
  }

  // 3. Sample order data
  const { data: orderSample, error: eOrder } = await sb.from('orders').select('*').limit(3)
  console.log('\n--- Sample orders ---')
  if (eOrder) {
    console.log('Error:', eOrder.message.substring(0, 200))
  } else {
    for (const o of orderSample || []) {
      console.log(`  Order ${o.id}:`,
        `status=${o.status}`,
        `pay_status=${o.payment_status}`,
        `np_status=${o.nowpayments_status}`,
        `invoice_id=${o.nowpayments_invoice_id || 'null'}`,
        `payment_url=${o.payment_url ? 'SET' : 'null'}`,
        `provider=${o.payment_provider || 'null'}`)
    }
  }

  // 4. Payment status values in DB
  const { data: allOrders, error: eAll } = await sb.from('orders').select('id,payment_status,status,nowpayments_status')
  console.log('\n--- All payment status values ---')
  if (!eAll) {
    const statusCounts = {}
    for (const o of allOrders || []) {
      const key = `${o.payment_status || 'null'}/${o.status || 'null'}/${o.nowpayments_status || 'null'}`
      statusCounts[key] = (statusCounts[key] || 0) + 1
    }
    for (const [key, count] of Object.entries(statusCounts)) {
      console.log(`  ${key}: ${count} order(s)`)
    }
  } else {
    console.log('Error:', eAll.message.substring(0, 200))
  }

  // 5. RLS check on payment-related tables
  console.log('\n--- RLS behavioral check (anon vs service role) ---')
  const paymentTables = ['orders', 'order_events', 'invoices', 'payments', 'donations', 'subscriptions']
  for (const t of paymentTables) {
    const { count: svcCount } = await sb.from(t).select('*', { count: 'exact', head: true })
    const { count: anonCount } = await anonSb.from(t).select('*', { count: 'exact', head: true })
    const { error: anonErr } = await anonSb.from(t).select('id').limit(1)

    let rls = 'unknown'
    if (svcCount && svcCount > 0) {
      if (anonCount === 0) rls = 'ENABLED (anon sees 0 rows)'
      else if (anonCount === svcCount) rls = 'CHECK — anon sees all (RLS may be disabled)'
      else rls = `FILTERED (svc=${svcCount}, anon=${anonCount})`
    } else {
      if (anonErr && anonErr.message.includes('permission')) rls = 'ENABLED (anon blocked)'
      else rls = 'EMPTY table (RLS state inconclusive)'
    }

    // Also test anon INSERT
    let insertResult = 'not tested'
    const { error: insertErr } = await anonSb.from(t).insert({ id: 'rls-test-anon' }).select()
    if (insertErr) {
      if (insertErr.message.includes('row-level security')) insertResult = 'RLS blocks INSERT'
      else insertResult = 'blocked: ' + insertErr.message.substring(0, 60)
    } else {
      insertResult = 'INSERT ALLOWED (CRITICAL!)'
      // Clean up
      await sb.from(t).delete().eq('id', 'rls-test-anon')
    }

    console.log(`  ${t}: svc=${svcCount || 0} anon=${anonCount || 0} RLS=${rls} INSERT=${insertResult}`)
  }

  // 6. Check orders PATCH endpoint for payment_status exposure
  console.log('\n--- Security: PATCH /api/orders/:id field exposure ---')
  const ordersContent = fs.readFileSync('./src/api/routes/orders.routes.js', 'utf8')

  // Find the PATCH /:id handler and check if it accepts payment_status
  const patchStart = ordersContent.indexOf('router.patch', 1100) // after line 1100
  const patchSection = ordersContent.substring(patchStart, patchStart + 2000)
  if (patchSection.includes('payment_status')) {
    console.log('  WARN: PATCH /:id may accept payment_status from client')
    // Check if it's in the updatePayload
    const updatePayloadMatch = patchSection.match(/updatePayload\s*=\s*\{[^}]+\}/)
    if (updatePayloadMatch && updatePayloadMatch[0].includes('payment_status')) {
      console.log('  CRITICAL: payment_status can be set via PATCH')
    }
  } else {
    console.log('  PASS: PATCH /:id does NOT accept payment_status')
  }

  // Check for req.body usage of payment fields in PATCH
  if (patchSection.includes('req.body') && patchSection.includes('payment')) {
    console.log('  CHECK: req.body contains payment references in PATCH')
  }

  // 7. Verify nowpayments.service.js doesn't log secrets
  console.log('\n--- Security: Secret exposure in logs ---')
  const nwService = fs.readFileSync('./src/services/nowpayments.service.js', 'utf8')
  const nwRoutes = fs.readFileSync('./src/api/routes/nowpayments.routes.js', 'utf8')

  // Check if API key or IPN secret is included in error objects
  const apiKeyInError = nwService.includes('apiKey') && (nwService.includes('console.error') || nwService.includes('error.'))
  const secretInError = nwRoutes.includes('IPN_SECRET') && (nwRoutes.includes('console.error') || nwRoutes.includes('console.warn'))

  // More precise: check if error objects include the actual secret value
  const nwServiceLines = nwService.split('\n')
  let apiKeyLogged = false
  let secretLogged = false
  for (const line of nwServiceLines) {
    if ((line.includes('error') || line.includes('console')) && line.includes('apiKey')) {
      apiKeyLogged = true
    }
  }
  const nwRoutesLines = nwRoutes.split('\n')
  for (const line of nwRoutesLines) {
    if ((line.includes('error') || line.includes('console')) && line.includes('IPN_SECRET') && !line.includes('process.env') && !line.includes('if (!') && !line.includes('const ')) {
      secretLogged = true
    }
  }

  console.log('  API key logged in errors:', apiKeyLogged ? 'YES (CHECK)' : 'NO — PASS')
  console.log('  IPN secret logged in errors:', secretLogged ? 'YES (CHECK)' : 'NO — PASS')

  // 8. Payment verifier (Polygon USDC)
  console.log('\n--- Payment Verifier (Polygon USDC) ---')
  const { getPaymentConfig, verifyPolygonUsdcPayment, ERC20_TRANSFER_TOPIC } = require('../src/services/payment-verifier')
  const config = getPaymentConfig()
  console.log('  Verifier configured:', config ? 'YES (polygon)' : 'NO — fails closed')
  if (!config) {
    console.log('  Reason: WEB3_NETWORK !== polygon or missing RPC/contract/recipient')
  }

  // 9. NOWPayments API URL (production vs sandbox)
  console.log('\n--- NOWPayments API Configuration ---')
  console.log('  NOWPAYMENTS_API_URL: https://api.nowpayments.io (PRODUCTION — no sandbox mode)')
  console.log('  IPN callback URL: ${PUBLIC_API_URL}/api/orders/:id/nowpayments-ipn')

  // 10. Summary of payment flow
  console.log('\n===== PAYMENT FLOW SUMMARY =====')
  console.log('1. POST /api/orders/:id/create-payment (authenticated)')
  console.log('   → Loads order from DB')
  console.log('   → Ownership check (order.user_id === req.user.id)')
  console.log('   → Status protection (no payment if completed/cancelled/refunded or already verified)')
  console.log('   → Reuse check (if payment_url exists and status is waiting/pending → return existing)')
  console.log('   → Atomic lock acquisition (nowpayments_creating_lock)')
  console.log('   → createInvoice() → NOWPayments /v1/invoice')
  console.log('   → Save invoice data to orders table')
  console.log('   → Release lock')
  console.log('   → Create order_event')
  console.log('2. NOWPayments IPN → POST /api/orders/:id/nowpayments-ipn')
  console.log('   → HMAC-SHA512 signature verification (mandatory)')
  console.log('   → Currency validation (usdcbsc / usd)')
  console.log('   → Order lookup by order_id')
  console.log('   → Status normalization + downgrade protection')
  console.log('   → Order update + order_event creation + notification')
  console.log('3. Polygon USDC verifier: separate path, fails closed when unconfigured')

  console.log('\n===== END LIVE DB VERIFICATION =====')
})()
