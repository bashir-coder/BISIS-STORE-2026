require('dotenv').config({path: '../.env'})

const supabaseUrl = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = process.env.VITE_SUPABASE_ANON_KEY
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || ''

const { createClient } = require('@supabase/supabase-js')
const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

;(async () => {
  if (!TEST_USER_PASSWORD) {
    console.error('TEST_USER_PASSWORD is not configured. Set it in ../.env')
    return
  }

  console.log('===== POST-015 FIX VERIFICATION =====')
  console.log('Testing if RLS recursion is fixed...\n')

  // Create a real authenticated user to test with
  const testEmail = `postfix-verify-${Date.now()}@test.com`
  const { data: createData } = await adminClient.auth.admin.createUser({
    email: testEmail,
    password: TEST_USER_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: 'Postfix Verify', role: 'super_admin' },
    app_metadata: { role: 'super_admin' }
  })

  if (!createData?.user?.id) {
    console.log('FAIL: Could not create test user')
    return
  }

  const { data: signInData } = await adminClient.auth.signInWithPassword({
    email: testEmail,
    password: TEST_USER_PASSWORD
  })

  const token = signInData.session.access_token
  console.log('Test user created and authenticated:', createData.user.id)

  // Test 1: SELECT users (was RECURSION before fix)
  console.log('\n--- TEST 1: SELECT /users as authenticated ---')
  const res1 = await fetch(`${supabaseUrl}/rest/v1/users?select=id,email,role&limit=3`, {
    headers: {
      'apikey': anonKey,
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    }
  })
  const text1 = await res1.text()
  const hasRecursion1 = text1.includes('recursion')
  console.log(`Status: ${res1.status}`)
  console.log(`Recursion: ${hasRecursion1 ? 'YES - FIX FAILED' : 'NO - FIX WORKING'}`)
  console.log(`Response: ${text1.substring(0, 200)}`)

  // Test 2: SELECT orders (was RECURSION before fix)
  console.log('\n--- TEST 2: SELECT /orders as authenticated ---')
  const res2 = await fetch(`${supabaseUrl}/rest/v1/orders?select=id,user_id,status&limit=3`, {
    headers: {
      'apikey': anonKey,
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    }
  })
  const text2 = await res2.text()
  const hasRecursion2 = text2.includes('recursion')
  console.log(`Status: ${res2.status}`)
  console.log(`Recursion: ${hasRecursion2 ? 'YES - FIX FAILED' : 'NO - FIX WORKING'}`)
  console.log(`Response: ${text2.substring(0, 200)}`)

  // Test 3: SELECT invoices (was RECURSION before fix)
  console.log('\n--- TEST 3: SELECT /invoices as authenticated ---')
  const res3 = await fetch(`${supabaseUrl}/rest/v1/invoices?select=id,order_id&limit=3`, {
    headers: {
      'apikey': anonKey,
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    }
  })
  const text3 = await res3.text()
  const hasRecursion3 = text3.includes('recursion')
  console.log(`Status: ${res3.status}`)
  console.log(`Recursion: ${hasRecursion3 ? 'YES - FIX FAILED' : 'NO - FIX WORKING'}`)
  console.log(`Response: ${text3.substring(0, 200)}`)

  // Test 4: SELECT payments (was RECURSION before fix)
  console.log('\n--- TEST 4: SELECT /payments as authenticated ---')
  const res4 = await fetch(`${supabaseUrl}/rest/v1/payments?select=id,order_id&limit=3`, {
    headers: {
      'apikey': anonKey,
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    }
  })
  const text4 = await res4.text()
  const hasRecursion4 = text4.includes('recursion')
  console.log(`Status: ${res4.status}`)
  console.log(`Recursion: ${hasRecursion4 ? 'YES - FIX FAILED' : 'NO - FIX WORKING'}`)
  console.log(`Response: ${text4.substring(0, 200)}`)

  // Test 5: SELECT order_events (was RECURSION before fix)
  console.log('\n--- TEST 5: SELECT /order_events as authenticated ---')
  const res5 = await fetch(`${supabaseUrl}/rest/v1/order_events?select=id,order_id&limit=3`, {
    headers: {
      'apikey': anonKey,
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    }
  })
  const text5 = await res5.text()
  const hasRecursion5 = text5.includes('recursion')
  console.log(`Status: ${res5.status}`)
  console.log(`Recursion: ${hasRecursion5 ? 'YES - FIX FAILED' : 'NO - FIX WORKING'}`)
  console.log(`Response: ${text5.substring(0, 200)}`)

  // Test 6: DELETE orders as authenticated
  console.log('\n--- TEST 6: DELETE /orders as authenticated ---')
  const res6 = await fetch(`${supabaseUrl}/rest/v1/orders?id=eq.99999`, {
    method: 'DELETE',
    headers: {
      'apikey': anonKey,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    }
  })
  const text6 = await res6.text()
  const hasRecursion6 = text6.includes('recursion')
  console.log(`Status: ${res6.status}`)
  console.log(`Recursion: ${hasRecursion6 ? 'YES - FIX FAILED' : 'NO - FIX WORKING'}`)
  console.log(`Response: ${text6.substring(0, 200)}`)

  // Test 7: Verify super_admin can see all users (staff policy still works)
  console.log('\n--- TEST 7: Verify staff policy works (super_admin sees users) ---')
  const res7 = await fetch(`${supabaseUrl}/rest/v1/users?select=id,email,role&limit=5`, {
    headers: {
      'apikey': anonKey,
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    }
  })
  const data7 = await res7.text()
  console.log(`Status: ${res7.status}`)
  console.log(`Can see users: ${data7 !== '[]' ? 'YES' : 'NO (empty)'}`)
  console.log(`Response: ${data7.substring(0, 300)}`)

  // Test 8: IDOR - verify user can only see their own orders
  console.log('\n--- TEST 8: IDOR check (should see 0 or own orders only) ---')
  // The test user is new and has no orders, so should see empty or be blocked
  const res8 = await fetch(`${supabaseUrl}/rest/v1/orders?select=id,user_id&limit=5`, {
    headers: {
      'apikey': anonKey,
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    }
  })
  const data8 = await res8.text()
  console.log(`Status: ${res8.status}`)
  console.log(`Orders visible: ${data8}`)

  // Summary
  console.log('\n===== VERIFICATION SUMMARY =====')
  const allFixed = !hasRecursion1 && !hasRecursion2 && !hasRecursion3 && !hasRecursion4 && !hasRecursion5 && !hasRecursion6
  console.log(`Users table:     ${hasRecursion1 ? 'STILL RECURSES' : 'FIXED'}`)
  console.log(`Orders table:    ${hasRecursion2 ? 'STILL RECURSES' : 'FIXED'}`)
  console.log(`Invoices table:  ${hasRecursion3 ? 'STILL RECURSES' : 'FIXED'}`)
  console.log(`Payments table:  ${hasRecursion4 ? 'STILL RECURSES' : 'FIXED'}`)
  console.log(`Order events:    ${hasRecursion5 ? 'STILL RECURSES' : 'FIXED'}`)
  console.log(`Delete orders:   ${hasRecursion6 ? 'STILL RECURSES' : 'FIXED'}`)
  console.log(`Staff policy:    ${res7.status === 200 && data7 !== '[]' ? 'WORKING (can see users)' : 'NEEDS CHECK'}`)
  console.log('')
  console.log(allFixed ? '✅ ALL RECURSION ISSUES FIXED!' : '❌ SOME ISSUES REMAIN')

  // Clean up
  await adminClient.auth.admin.deleteUser(createData.user.id)
  console.log('\nTest user cleaned up')
})().catch(e => console.error('Fatal:', e.message))
