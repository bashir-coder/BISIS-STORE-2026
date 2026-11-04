# DIGITAL COMMERCE TARGETED FIX PLAN V2 (Corrected)

**Document:** DIGITAL_COMMERCE_TARGETED_FIX_PLAN_V2.md  
**Date:** 2026-11-04  
**Based on:** Evidence package + migration inspection  
**Status:** PLAN ONLY - No implementation  

---

## 1. PURCHASE UNIQUENESS (Evidence)

**Migration 019:** UNIQUE (product_id, user_id) on digital_product_purchases  
**Proposed designs:** UNIQUE(order_id, product_id) WHERE order_id IS NOT NULL

**Consequences:**
- Current UNIQUE(product_id,user_id) prevents repurchase after refund
- UNIQUE(order_id,product_id) allows repurchase (different order) - correct for business model
- Need to handle legacy rows with NULL order_id
- **Action:** Do NOT change schema now; fix application logic to work with constraints or migrate carefully

**Fact:** Cannot change constraints without migration and handling existing data.

---

## 2. ORDERS DIGITAL_PRODUCT_ID (Evidence)

**Checked migrations:** Not found in canonical migrations 001-019. Not in the files reviewed.  
**COMMERCE_DATABASE_ARCHITECTURE_DISCOVERY.md** proposed adding it but it's not implemented.  
**Status:** UNVERIFIED/NOT IMPLEMENTED in canonical migrations  
**Action:** Must verify actual DB state; don't assume exists

---

## 3. P0 — MINIMUM SAFE STAGING IMPLEMENTATION

### P0-1: Durable Event Idempotency (MUST BE P0)
**Files:** ackend/src/api/routes/nowpayments.routes.js  
**Need:** Event table with unique external event ID, processing states  
**Cannot rely on time windows alone**

### P0-2: Atomic Purchase Grant via RPC
**Files to create:** database/migrations/*_digital_product_grant_rpc.sql or modify deployment  
**Reason:** Check-then-insert not safe for concurrency. Need DB-level atomicity.  
**Move to P0** per requirements.

### P0-3: Grant on Verified Payment (only after P0-1, P0-2)
**Files:** ackend/src/api/routes/nowpayments.routes.js, service

---

## 4. P1 — BEFORE PRODUCTION

- Refund revocation with trusted evidence
- RLS/view strategy (not blanket public access)
- Enhanced authorization

---

## 5. EXACT FILES AFFECTED

**Modify:**
- ackend/src/api/routes/nowpayments.routes.js - webhook handling
- ackend/src/api/routes/digital-products.routes.js - download auth (if needed)
- ackend/src/api/routes/orders.routes.js - digital product orders

**Create:**
- ackend/src/services/digital-product-grant.service.js
- Migration for RPC and event ledger

---

## UNRESOLVED DECISIONS REQUIRING HUMAN APPROVAL

1. Allow repurchase after refund? (affects uniqueness strategy)
2. Use RPC or application-level transactions?
3. Add digital_product_id to orders or different approach?
4. Public view vs direct table access strategy

**No implementation performed.**
