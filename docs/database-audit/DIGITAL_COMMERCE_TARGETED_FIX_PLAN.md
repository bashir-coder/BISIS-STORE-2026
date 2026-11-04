# DIGITAL COMMERCE TARGETED FIX PLAN

**Document:** DIGITAL_COMMERCE_TARGETED_FIX_PLAN.md  
**Date:** 2026-11-04  
**Based on:** DIGITAL_COMMERCE_FINAL_EVIDENCE_PACKAGE.md  
**Status:** PLAN ONLY - No implementation  

---

## EXECUTIVE SUMMARY

Smallest safe fixes to close confirmed blockers. Focus on connecting payment verification to purchase creation, handling refunds, and ensuring proper authorization.

---

## P0 — REQUIRED BEFORE ANY STAGING TEST

### P0-1: Purchase Grant on Payment Verification
**Files to modify:**
- ackend/src/api/routes/nowpayments.routes.js - Add grant logic after order verification
- ackend/src/services/digital-product-grant.service.js (CREATE) - Centralized grant logic

**Current behavior:** Webhook updates order.payment_status but doesn't create digital_product_purchases  
**Required behavior:** On verified payment for digital product order, create/update purchase with payment_confirmed=true  
**Approach:**
1. After order update when paymentStatus === 'verified', check if order has digital_product_id
2. Call grant service with idempotency (check existing purchase)
3. Use transaction or ensure atomicity
4. Validate order.user_id, digital_product_id match

**Dependencies:** Need digital_product_id on orders (exists in schema per discovery)  
**Security risks:** Must verify order ownership, prevent duplicate grants  
**Tests:** Verified payment creates purchase, duplicate webhook idempotent  
**Affects:** New purchases only

### P0-2: Add digital_product_id support to orders
**Files to modify:**
- ackend/src/api/routes/orders.routes.js - Accept digital_product_id, validate
- Migration may be needed if column doesn't exist

**Current behavior:** Orders only take package_id or service_id  
**Required behavior:** Accept digital_product_id for digital product purchases  
**Approach:** Extend order creation logic similar to package/service  
**Dependencies:** Column exists? Need to verify  
**Tests:** Create digital product order

---

## P1 — REQUIRED BEFORE PRODUCTION

### P1-1: Refund Revocation
**Files to modify:**
- ackend/src/api/routes/nowpayments.routes.js - On refunded status, revoke purchase

**Approach:** Update digital_product_purchases to payment_confirmed=false or status='refunded' where order_id matches  
**Tests:** Refund blocks download, delayed webhook can't restore

### P1-2: Enable RLS on digital_products
**Migration needed:** Add RLS policies  
**Files:** Migration file  
**Approach:** Enable RLS, add policies for public read (active only) and staff manage

---

## P2 — HARDENING

### P2-1: Durable event idempotency
Enhance webhook deduplication  
### P2-2: Add grant RPC for atomicity
Create database function

---

## IMPLEMENTATION SEQUENCE

1. Add digital_product_id support to orders
2. Create grant service
3. Update webhook to grant purchases
4. Update webhook to handle refunds
5. Test end-to-end
6. Add RLS to digital_products

## DECISIONS REQUIRING HUMAN APPROVAL

- Should refunds revoke access permanently or allow appeal?
- Use UNIQUE(order_id, product_id) or different strategy?
- RLS on digital_products approach?
- Migration strategy for existing data?

**No implementation performed.**
