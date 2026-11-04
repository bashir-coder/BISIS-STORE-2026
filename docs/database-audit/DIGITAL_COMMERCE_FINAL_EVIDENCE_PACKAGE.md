# DIGITAL COMMERCE FINAL EVIDENCE PACKAGE

**Document:** DIGITAL_COMMERCE_FINAL_EVIDENCE_PACKAGE.md  
**Date:** 2026-11-04  
**Scope:** Evidence-based inspection of existing implementation  
**Mode:** READ-ONLY

---

## 1. EXECUTIVE VERDICT

**VERDICT: NOT READY — TARGETED FIXES REQUIRED**

**Summary:** The digital product payment infrastructure is partially implemented (NOWPayments, orders, download route), but the critical purchase-granting logic is **NOT IMPLEMENTED**. The webhook updates order status but does not create/update digital_product_purchases records. No grant RPC functions exist in the codebase. This is a confirmed functional blocker.

---

## 2. ACTUAL PAYMENT FLOW (Evidence)

**Traced flow as implemented:**
1. Customer creates order via POST /api/orders (orders.routes.js:540-680) - creates order with status='new', payment_status='pending'
2. Customer initiates payment via POST /api/orders/:id/create-payment (orders.routes.js:682-1300) - creates NOWPayments invoice, stores payment details
3. NOWPayments sends IPN webhook to POST / (nowpayments.routes.js) - verifies signature, validates amount/currency, updates order payment_status
4. Customer attempts download via GET /api/products/:id/download (digital-products.routes.js:220-275) - checks for confirmed purchase in digital_product_purchases OR staff role

**MISSING:** Step between 3 and 4 - no code creates/updates digital_product_purchases on payment verification.

---

## 3. NOWPAYMENTS WEBHOOK (Evidence)

**File:** ackend/src/api/routes/nowpayments.routes.js
- **Signature verification:** Lines ~150-250 - HMAC-SHA512 with timing-safe comparison using NOWPAYMENTS_IPN_SECRET_KEY
- **Order association:** Line ~240+ normalizes order_id, looks up order by id
- **Amount/currency validation:** Lines ~350-400 validate amounts match and currencies
- **Status normalization:** Lines ~200-250 map NOWPayments statuses to internal states
- **Duplicate handling:** Lines ~550-640 check order_events within 5 minutes by payment_id/purchase_id
- **Event persistence:** Creates order_events entries
- **Transaction boundaries:** None visible - sequential updates, no explicit transactions
- **Error handling:** Returns appropriate status codes, logs errors
- **Granting:** **NONE** - no reference to digital_product_purchases

**Severity:** CRITICAL - No purchase grant on payment verification

---

## 4. PAYMENT GRANT RPC (Evidence)

**Search:** No results for process_digital_product_payment_verified, grant_digital_product_access in SQL or JS files.  
**Status:** **NOT IMPLEMENTED**  
**Severity:** CRITICAL

---

## 5. EVENT LEDGER (Evidence)

**Table:** order_events exists (referenced in code).  
**Deduplication:** Time-window based (5 minutes) by payment_id/purchase_id - not durable unique constraint on external event ID.  
**Status:** Partial implementation, insufficient for exactly-once guarantees  
**Severity:** HIGH

---

## 6. REFUND AND REVOCATION (Evidence)

**Webhook handles refunds:** nowpayments.routes.js updates order status to 'refunded', creates notification  
**Purchase revocation:** **NOT IMPLEMENTED** - no updates to digital_product_purchases  
**Delayed webhook:** No protection preventing re-grant after refund  
**Severity:** CRITICAL

---

## 7. PUBLIC CATALOG SECURITY (Evidence)

**File:** ackend/src/api/routes/digital-products.routes.js
- GET / lists products with explicit field selection (line ~68-82): only public fields, no file_url/storage_key
- GET /:id same - filters fields
- Tests verify no private fields leaked
- **RLS on digital_products:** Migration 019 says \"Does NOT enable RLS on digital_products here\" - **NOT ENABLED**
- **View:** No digital_products_public view found
- **Storage key/file_url:** Present in DB (added by migrations) but not exposed by public endpoints

**Status:** Public endpoint is safe due to field filtering, but RLS not enabled (defense in depth missing)  
**Severity:** MEDIUM

---

## 8. DOWNLOAD AUTHORIZATION (Evidence)

**File:** ackend/src/api/routes/digital-products.routes.js:220-275**
- Auth required via authenticate middleware
- Checks staff role: ['admin', 'super_admin', 'manager', 'editor'] (line ~224)
- Checks purchase: queries digital_product_purchases for confirmed purchase (lines ~228-235)
- Gets signed URL from Supabase Storage with 60s expiry
- **User identification:** Uses req.user.id from authenticated session - not caller-supplied
- **Revoked/refunded:** If purchase exists but not confirmed or status different, access denied (only checks payment_confirmed)
- **Legacy purchases:** Would work if payment_confirmed true
- **Bucket privacy:** Assumed private, not verified from migrations

**Status:** Authorization logic exists but purchase records never created  
**Severity:** CRITICAL (non-functional due to missing grants)

---

## 9. DATABASE MIGRATION CONSISTENCY (Evidence)

**Migration 019:** Creates digital_product_purchases with issues (ON DELETE CASCADE contradicts comment, UNIQUE(product_id,user_id))
**Migration 020:** In migrations_local/ not canonical - status unknown
**Grant RPC:** Not in any migration
**Event ledger:** order_events exists but no enhanced ledger table
**RLS:** digital_products not enabled, digital_product_purchases has RLS enabled per migration

**Status:** Migrations incomplete for full flow  
**Severity:** HIGH

---

## 10. TEST EVIDENCE

**Tests exist:** backend/tests/digital-products-file-delivery.test.js, backend/tests/digital-products-security.test.js  
**Tests executed:** Not run in this session  
**Coverage:** Public catalog security only - no tests for purchase flow, webhooks, grants, downloads with purchases  
**Missing:** All payment/purchase/download flow tests  
**Severity:** HIGH

---

## 11. CONFIRMED BLOCKERS

1. **CRITICAL:** No purchase grant logic - webhooks don't create digital_product_purchases
2. **CRITICAL:** No grant RPC function exists
3. **CRITICAL:** Downloads will fail for paid customers (no purchase records)
4. **HIGH:** No durable event idempotency
5. **HIGH:** Refunds don't revoke access
6. **HIGH:** No RLS on digital_products table

---

## 12. REMAINING UNKNOWNS

- Whether purchases created elsewhere (not found)
- Storage bucket policies
- Migration 020 application status
- Full webhook flow integration

---

## FINAL RECOMMENDATION

**VERDICT: NOT READY — TARGETED FIXES REQUIRED**

The flow is architecturally designed but **not implemented**. Must implement:
1. Purchase grant logic in webhook (or RPC)
2. Create grant RPC function
3. Handle refunds to revoke access
4. Add RLS to digital_products
5. Create durable event ledger
6. Add comprehensive tests
7. Reconcile migrations

No implementation performed in this audit.
