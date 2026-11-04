# DIGITAL PRODUCTS PURCHASE & PAYMENT INVESTIGATION (Evidence-Based)

**Document:** DIGITAL_PRODUCTS_PURCHASE_PAYMENT_INVESTIGATION.md  
**Audit Date:** 2026-11-02  
**Scope:** Complete read-only investigation of purchase/payment flow  
**Method:** Code and migration analysis only - no DB queries executed

---

## 1. REPOSITORY FILES & EXACT REFERENCES

### Backend - Payments
- ackend/src/services/nowpayments.service.js (lines 1-246) - NOWPayments API client (createPayment, createInvoice, getPaymentStatus)
- ackend/src/api/routes/nowpayments.routes.js (lines 1-850+) - IPN webhook handler at POST /
- ackend/src/services/payment-verifier.js (lines 1-135) - Polygon USDC on-chain verification (separate flow)

### Backend - Orders
- ackend/src/api/routes/orders.routes.js (lines 1-1300+) - Order creation, payment creation via NOWPayments
- Uses service_role client (supabase from config)

### Backend - Digital Products
- ackend/src/api/routes/digital-products.routes.js (lines 1-275) - Catalog, upload, download
- ackend/tests/digital-products-*.test.js - Tests for public catalog security

### Migrations
- database/migrations/013_nowpayments_integration.sql - NOWPayments integration
- database/migrations/014_rls_corrective_and_payment_lock.sql - Adds nowpayments_creating_lock to orders
- database/migrations/019_digital_products_storage_contract.sql - Creates digital_product_purchases, adds storage_key
- database/migrations_local/020_digital_products_delivery_flow.sql - Adds file_mime_type, file_size, composite index

---

## 2. ACTUAL PURCHASE LIFECYCLE (EVIDENCE)

### Step 1: Customer initiates purchase
**Location:** ackend/src/api/routes/orders.routes.js:540-680
- POST / (orders) requires authentication
- Customer selects package_id OR service_id (not both)
- Validates package/service exists and is active and price > 0
- Blocks signature_subscription services (line ~655-665)
- Creates order via createOrder() with status='new', payment_status='pending', payment_provider='nowpayments'

### Step 2: Order record created
**Location:** orders.routes.js:455-537 (createOrder function)
- Inserts into orders with user_id, amount/price, package_id/service, payment_provider='nowpayments', submission_id (uuid)
- Creates order_events entry with event_type='order_created'

### Step 3: Payment request generated
**Location:** orders.routes.js:682-1150 (POST /:id/create-payment)
- Authenticates user, verifies ownership of order
- Blocks if order completed/cancelled/refunded or payment_status verified
- Uses atomic lock with 
owpayments_creating_lock (migration 014 added this)
- Calls createInvoice() from nowpayments.service.js
- Creates NOWPayments invoice with ipn_callback_url pointing to /api/orders/:id/nowpayments-ipn or separate endpoint
- Stores payment details in orders table (nowpayments_payment_id, invoice_id, purchase_id, payment_url, etc.)
- Creates order_events entry with event_type='payment.nowpayments.created'

### Step 4: Payment processed by provider
**External** - NOWPayments handles payment

### Step 5: Webhook/IPN confirmation
**Location:** ackend/src/api/routes/nowpayments.routes.js:150-850
- POST / (IPN endpoint) - verifies HMAC-SHA512 signature using NOWPAYMENTS_IPN_SECRET_KEY
- Validates payload, checks currency (usdcbsc for pay, usd for price)
- Finds order by order_id from payload
- Normalizes payment status (waiting->pending, confirming/confirmed/sending/partially_paid->submitted, finished->verified, failed/expired->failed, refunded->refunded)
- Validates amount matches order.amount/price
- Validates paid amount > 0 for submitted/verified
- Updates order if not already verified (uses .neq('payment_status','verified') to prevent downgrades except refunds)
- Creates order_events entries (deduplicates within 5 minutes by payment_id/purchase_id)
- Creates notifications for verified/failed/refunded

### Step 6: Order status updated
**Done in webhook** - updates orders.payment_status

### Step 7: Digital product purchase created/confirmed
**NOT FOUND IN CODEBASE** - No code creates or updates digital_product_purchases table. The download endpoint checks for confirmed purchases but nothing creates them.

### Step 8: Customer receives download authorization
**Location:** ackend/src/api/routes/digital-products.routes.js:220-275
- GET /:id/download requires auth
- Checks if staff OR has purchase with payment_confirmed=true
- Gets signed URL from Supabase Storage (60s expiry)

---

## 3. DATABASE RELATIONSHIPS (EVIDENCE)

### Migration 019 - digital_product_purchases
`sql
CREATE TABLE IF NOT EXISTS public.digital_product_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.digital_products(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    order_id BIGINT REFERENCES public.orders(id) ON DELETE SET NULL,
    price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    payment_confirmed BOOLEAN NOT NULL DEFAULT false,
    payment_tx_hash TEXT,
    purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    confirmed_at TIMESTAMPTZ,
    UNIQUE (product_id, user_id)
);
`
**Note on comment vs code:** Migration says \"No CASCADE on purchases; digital_products rows are soft-deleted via is_active.\" but FK shows ON DELETE CASCADE for both product_id and user_id. This is a **CONTRADICTION** in the migration. order_id uses SET NULL.

**UNIQUE(product_id, user_id):** Prevents multiple purchases of same product by same user. This would block repurchases after refunds/cancellations or if user wants to buy again. No mechanism to handle refunds or allow repurchase.

### Orders table
Referenced heavily, has nowpayments_* fields added by migrations 013/014. Has payment_status, status fields.

---

## 4. CONFIRMED FINDINGS vs ASSUMPTIONS

### CONFIRMED
1. **NOWPayments integration exists** - Service, routes, order flow all implemented
2. **Webhook signature verification** - HMAC-SHA512 with timing-safe comparison
3. **Amount validation** - Checks price matches order amount
4. **Idempotency for webhooks** - Checks recent order_events within 5 minutes
5. **Payment lock mechanism** - nowpayments_creating_lock prevents concurrent invoice creation
6. **Digital product download authorization** - Checks staff OR confirmed purchase
7. **Signed URLs** - 60s expiry for downloads
8. **Public catalog filters private fields** - Tests enforce no file_url/storage_key
9. **Storage upload for admins** - Uploads to Supabase Storage, updates product

### ASSUMPTIONS
1. **Purchases are created elsewhere** - Not found in codebase
2. **Payment confirmation triggers purchase creation** - No mechanism found
3. **Order payment_status 'verified' grants digital product access** - Download checks digital_product_purchases, not orders
4. **Storage bucket is private** - Assumed, not verified
5. **RLS on storage objects** - Not visible in migrations

---

## 5. SECURITY VULNERABILITIES & EVIDENCE

### CONFIRMED ISSUES
1. **Broken purchase flow** - digital_product_purchases table exists with RLS but nothing creates/updates rows. Customers who pay cannot download products. **EVIDENCE:** No INSERT/UPDATE on digital_product_purchases in backend/src
2. **UNIQUE(product_id, user_id) blocks repurchase** - After refund, cannot repurchase same product. **EVIDENCE:** Migration 019 line ~44
3. **ON DELETE CASCADE contradiction** - Migration says no CASCADE but code does CASCADE. Data loss risk if products/users deleted. **EVIDENCE:** Migration 019 lines ~32-33 vs comment line ~5
4. **No purchase creation on payment verification** - Webhook updates order status but doesn't create digital_product_purchases entry. **EVIDENCE:** nowpayments.routes.js doesn't reference digital_product_purchases
5. **RLS on digital_products not enabled** - Direct client access could read file_url/storage_key if using anon key. Backend uses service_role and filters, but defense in depth missing. **EVIDENCE:** Migration 019 comment line ~30

### POTENTIAL ISSUES
6. **Staff can download without purchase** - Any staff role can download any active product. May be intentional for support/testing.
7. **Webhook doesn't validate order is for digital product** - Could update any order type
8. **No mechanism to revoke access on refund** - If purchase exists, payment_confirmed would need to be set to false, but no code does this

---

## 6. MISSING FUNCTIONALITY

1. **Purchase record creation** - When order contains digital product, create digital_product_purchases on payment verification
2. **Link between orders and digital products** - Orders table doesn't show digital product reference. How to know which product was purchased?
3. **Refund handling** - Update payment_confirmed or delete purchase on refund
4. **Purchase verification endpoint** - Check if user owns product
5. **Idempotent purchase creation** - Handle webhook retries

---

## 7. CONFLICTS BETWEEN MIGRATIONS & APPLICATION CONTRACTS

1. **Migration 019 comment contradicts FKs** - Says \"No CASCADE on purchases\" but has ON DELETE CASCADE
2. **Migration 020 in migrations_local/** - Not in canonical path, may not be deployed
3. **Download requires digital_product_purchases but flow doesn't create them** - Application contract broken

---

## 8. RECOMMENDED FINAL ARCHITECTURE (EVIDENCE-BASED)

**NOT IMPLEMENTED - RECOMMENDATION ONLY**

### Option 1: Link orders to digital products
- Add digital_product_id to orders or create order_items
- On webhook verification (payment_status becomes verified), find digital product for order, create/update digital_product_purchases with payment_confirmed=true, set confirmed_at

### Option 2: Create purchase on order creation
- Create digital_product_purchases when order created for digital product, mark confirmed only on payment

**Need to understand:** Do orders currently support digital products? Check if orders can have digital_product_id or if identified by package/service.

---

## 9. REQUIRED SQL & BACKEND TESTS

### SQL Tests (Read-Only)
`sql
-- Check if digital_product_purchases has any rows
SELECT COUNT(*) FROM digital_product_purchases;

-- Check orders and their types
SELECT id, payment_status, service, package_id, created_at FROM orders ORDER BY created_at DESC LIMIT 20;

-- Check digital products
SELECT id, name, is_active, storage_key IS NOT NULL as has_storage_key, file_url IS NOT NULL as has_file_url FROM digital_products;
`

### Backend Tests Needed
1. Test purchase creation on payment verification
2. Test download with confirmed purchase
3. Test download denied without purchase
4. Test staff download bypass
5. Test webhook creates purchase record
6. Test refund revokes access
7. Test repurchase after refund (with UNIQUE constraint)

---

## EXECUTIVE SUMMARY

**Critical Finding:** The digital product purchase system is **INCOMPLETE**. While tables, RLS policies, download authorization logic, and payment infrastructure exist, there is **no code path to create or confirm digital_product_purchases records**. Payment webhooks update orders but never create purchase records, so customers who pay cannot download products. This is a **P0 functional break**.

**Unresolved Questions:**
1. How are digital products sold - through orders table or separate flow?
2. Is purchase creation handled by missing code/deployment?
3. Should UNIQUE(product_id,user_id) allow repurchases?
4. Should refunds revoke access?
5. Where should purchase creation logic live (webhook vs separate handler)?
6. Is Migration 020 actually applied?

**First Recommendation:** Find or implement purchase record creation on payment verification before any launch.
