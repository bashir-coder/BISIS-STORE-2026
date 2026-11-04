# FINAL DIGITAL COMMERCE ARCHITECTURE (Design Only)

**Document:** FINAL_DIGITAL_COMMERCE_ARCHITECTURE.md  
**Date:** 2026-11-02  
**Status:** DESIGN BLUEPRINT - No implementation  
**Based on:** DIGITAL_PRODUCTS_DELIVERY_AUDIT.md, DIGITAL_PRODUCTS_PURCHASE_PAYMENT_INVESTIGATION.md, COMMERCE_DATABASE_ARCHITECTURE_DISCOVERY.md

---

## 1. EXECUTIVE SUMMARY

Approved architecture: **Option A - Add digital_product_id to public.orders**. Extend existing single-item order model to support digital products as a third order type alongside packages and services. No order_items table introduced in this phase.

**Critical fix required:** Payment webhook must create/update digital_product_purchases records on successful payment verification. Currently missing.

---

## 2. APPROVED ARCHITECTURE

Orders remain single-item with exactly one type:
- **Package order:** package_id set, service NULL, digital_product_id NULL
- **Service order:** service set, package_id NULL, digital_product_id NULL  
- **Digital product order:** digital_product_id set, package_id NULL, service NULL

All three mutually exclusive enforced by CHECK constraint.

---

## 3. ER DIAGRAM (Conceptual)

`
users (1)---< (many) orders
packages (1)---< (many) orders
services (1)---< (many) orders
digital_products (1)---< (many) orders
digital_products (1)---< (many) digital_product_purchases
users (1)---< (many) digital_product_purchases
orders (1)---< (many) digital_product_purchases (optional)
`

---

## 4. FINAL DATABASE SCHEMA

### 4.1 Modify public.orders
**Evidence:** orders.routes.js:282-290 enforces package_id XOR service_id

Add:
`sql
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS digital_product_id UUID REFERENCES public.digital_products(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS orders_digital_product_id_idx ON public.orders(digital_product_id);
`

Add CHECK constraint:
`sql
ALTER TABLE public.orders ADD CONSTRAINT orders_single_item_type_check CHECK (
  (package_id IS NOT NULL AND service IS NULL AND digital_product_id IS NULL) OR
  (package_id IS NULL AND service IS NOT NULL AND digital_product_id IS NULL) OR
  (package_id IS NULL AND service IS NULL AND digital_product_id IS NOT NULL)
);
`
**Note:** Need to handle existing rows that may have both package (TEXT) and package_id, or other combinations. Existing data validation required.

### 4.2 Redesign public.digital_product_purchases
**Evidence:** Migration 019 line 44 has UNIQUE(product_id, user_id). Line 32-33 has ON DELETE CASCADE contradicting comment line 5.

**Issues:**
- UNIQUE(product_id,user_id) prevents repurchase after refund
- ON DELETE CASCADE contradicts \"No CASCADE on purchases\" comment
- Need to allow repurchase if previous refunded/cancelled? Or track by order
- Need order-to-purchase idempotency

**Proposed schema:**
`sql
CREATE TABLE IF NOT EXISTS public.digital_product_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.digital_products(id) ON DELETE RESTRICT, -- Don't delete if purchases exist
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    order_id BIGINT REFERENCES public.orders(id) ON DELETE SET NULL,
    price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    payment_confirmed BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','refunded','revoked')),
    payment_tx_hash TEXT,
    purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    confirmed_at TIMESTAMPTZ,
    refunded_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    CONSTRAINT digital_product_purchases_order_product_key UNIQUE (order_id, product_id) -- Idempotent per order
);
`

**Changes:**
- Remove UNIQUE(product_id,user_id), add UNIQUE(order_id,product_id) for idempotency per order
- Change FKs to ON DELETE RESTRICT to preserve history
- Add status field separate from payment_confirmed
- Add refund/revoke tracking timestamps
- Allow same user to repurchase if different order

**Migration strategy:** Need to handle existing data carefully.

### 4.3 Enable RLS on digital_products
**Evidence:** Migration 019 line 30 says \"Does NOT enable RLS on digital_products here\"
`sql
ALTER TABLE public.digital_products ENABLE ROW LEVEL SECURITY;
-- Public can only see active products (fields filtered by app)
CREATE POLICY \"Anyone can view active digital products\" ON public.digital_products
  FOR SELECT TO anon, authenticated USING (is_active = true);
-- Staff can manage
CREATE POLICY \"Staff manage digital products\" ON public.digital_products
  FOR ALL TO authenticated
  USING (auth.jwt()->>'role' IN ('admin','super_admin','manager','editor'))
  WITH CHECK (auth.jwt()->>'role' IN ('admin','super_admin','manager','editor'));
`

### 4.4 digital_product_purchases RLS (already exists)
Keep existing policies, may need adjustment for new status field.

---

## 5. COMPLETE PROPOSED MIGRATION SQL (DO NOT EXECUTE)

`sql
-- PROPOSED MIGRATION - DO NOT EXECUTE
-- Canonical migration for digital commerce (add digital_product_id to orders, fix purchases)

BEGIN;

-- 1. Add digital_product_id to orders
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS digital_product_id UUID 
  REFERENCES public.digital_products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS orders_digital_product_id_idx ON public.orders(digital_product_id);

-- 2. Add exclusivity constraint (only if not exists)
DO 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_single_item_type_check'
  ) THEN
    ALTER TABLE public.orders ADD CONSTRAINT orders_single_item_type_check CHECK (
      (package_id IS NOT NULL AND service IS NULL AND digital_product_id IS NULL) OR
      (package_id IS NULL AND service IS NOT NULL AND digital_product_id IS NULL) OR
      (package_id IS NULL AND service IS NULL AND digital_product_id IS NOT NULL)
    );
  END IF;
END ;

-- 3. Fix digital_product_purchases schema
-- This is complex - need to handle existing data
-- Create new table or alter existing

-- For new deployments or careful migration:
ALTER TABLE public.digital_product_purchases 
  DROP CONSTRAINT IF EXISTS digital_product_purchases_product_id_user_id_key;

ALTER TABLE public.digital_product_purchases
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;

ALTER TABLE public.digital_product_purchases
  ADD CONSTRAINT digital_product_purchases_status_check 
    CHECK (status IN ('pending','confirmed','refunded','revoked'));

-- Add order_id uniqueness per order (if order_id exists)
CREATE UNIQUE INDEX IF NOT EXISTS digital_product_purchases_order_product_unique 
  ON public.digital_product_purchases(order_id, product_id) WHERE order_id IS NOT NULL;

-- 4. Enable RLS on digital_products
ALTER TABLE public.digital_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS \"Anyone can view active digital products\" ON public.digital_products;
CREATE POLICY \"Anyone can view active digital products\" 
  ON public.digital_products FOR SELECT TO anon, authenticated 
  USING (is_active = true);

DROP POLICY IF EXISTS \"Staff manage digital products\" ON public.digital_products;
CREATE POLICY \"Staff manage digital products\" 
  ON public.digital_products FOR ALL TO authenticated 
  USING (auth.jwt()->>'role' IN ('admin','super_admin','manager','editor'))
  WITH CHECK (auth.jwt()->>'role' IN ('admin','super_admin','manager','editor'));

-- 5. Reconcile migration 020 columns/index if needed
ALTER TABLE public.digital_products ADD COLUMN IF NOT EXISTS file_mime_type TEXT;
ALTER TABLE public.digital_products ADD COLUMN IF NOT EXISTS file_size BIGINT;
CREATE INDEX IF NOT EXISTS idx_dpp_user_product_confirmed 
  ON public.digital_product_purchases(user_id, product_id, payment_confirmed);

COMMIT;
`

**Migration 020 reconciliation:** Promote to canonical or include in this migration. File is in migrations_local/ not migrations/ - deployment process needs clarification.

---

## 6. BACKEND SERVICE CONTRACTS

### 6.1 New service: ackend/src/services/digital-product-grant.service.js
`js
// grantDigitalProductAccess({ orderId, productId, userId, price }) 
// - Verify order ownership and status
// - Check idempotency (order_id, product_id)
// - Create or update digital_product_purchases
// - Set payment_confirmed=true, status='confirmed', confirmed_at
// - Transactional
`

### 6.2 Modify ackend/src/api/routes/orders.routes.js
- Accept digital_product_id in POST /
- Validate digital product exists and is active
- Get price from digital_products table (server-side)
- Create order with digital_product_id
- Enforce exclusivity

### 6.3 Modify ackend/src/api/routes/nowpayments.routes.js
- After verifying payment and updating order to verified
- If order.digital_product_id exists, call grantDigitalProductAccess
- Handle idempotency for webhook retries
- On refund, update purchase status to 'refunded', set refunded_at

### 6.4 Files to modify/create
**Modify:**
- backend/src/api/routes/orders.routes.js
- backend/src/api/routes/nowpayments.routes.js
- backend/src/api/routes/digital-products.routes.js (maybe)

**Create:**
- backend/src/services/digital-product-grant.service.js

---

## 7. WEBHOOK INTEGRATION DESIGN

In nowpayments.routes.js, after successful order update when paymentStatus === 'verified':
`js
if (paymentStatus === 'verified' && order.digital_product_id) {
  try {
    await grantDigitalProductAccess({
      orderId: order.id,
      productId: order.digital_product_id,
      userId: order.user_id,
      price: order.amount || order.price
    })
  } catch (err) {
    console.error('Failed to grant digital product access:', err)
    // Don't fail webhook - log and alert
  }
}
`

On refund:
`js
if (paymentStatus === 'refunded' && order.digital_product_id) {
  await supabase.from('digital_product_purchases')
    .update({ status: 'refunded', refunded_at: nowIso, payment_confirmed: false })
    .eq('order_id', order.id)
    .eq('product_id', order.digital_product_id)
}
`

---

## 8. SECURITY & RLS DESIGN

- **digital_products:** Enable RLS, public can only SELECT active, staff can manage all. App filters fields (no file_url/storage_key in public queries) - must remain enforced.
- **digital_product_purchases:** Existing policies OK. Users see own, staff manage all.
- **Storage:** Bucket should be private. Use signed URLs only. Policies needed (not visible in migrations).
- **Webhooks:** HMAC verification required (already implemented).
- **Column privileges:** Don't grant direct access to file_url/storage_key to anon.

---

## 9. FRONTEND API CONTRACTS

**Public catalog:** GET /api/products (existing) - returns filtered fields
**Product details:** GET /api/products/:id
**Create order:** POST /api/orders { digital_product_id: "uuid" }
**Create payment:** POST /api/orders/:id/create-payment
**Download:** GET /api/products/:id/download (requires auth + purchase)
**Purchase history:** GET /api/me/purchases (needs to be added)

---

## 10. TEST MATRIX

Key tests needed:
- Digital product order creation with valid product
- Order exclusivity (cannot have package+digital_product)
- Webhook grants purchase on verified payment
- Duplicate webhook doesn't create duplicate purchases (idempotent)
- Download works with confirmed purchase
- Download denied without purchase
- Refund revokes access (sets status refunded)
- Staff can download without purchase
- Price manipulation prevented (server-side lookup)
- Inactive product cannot be purchased

---

## 11. DEPLOYMENT SEQUENCE

1. Apply database migration (add column, constraints, fix purchases, enable RLS)
2. Deploy backend changes (grant service, webhook updates, order routes)
3. Deploy frontend changes (if any)
4. Verify tests pass
5. Monitor webhooks

---

## 12. ROLLBACK STRATEGY

- Keep old migration files unchanged
- Migration is additive mostly (ADD COLUMN, ADD CONSTRAINT) - can be rolled back
- Purchase table changes need careful rollback
- Feature flag for digital product checkout

---

## REMAINING ARCHITECTURAL DECISIONS

1. **Refund policy:** Revoke access on refund? Recommended yes (set status='refunded')
2. **Repurchase:** Allow after refund? With new schema (no unique on product_id,user_id) yes if different order
3. **Storage bucket policies:** Need to verify/create
4. **Migration 020:** Promote to canonical migrations/ or supersede?
5. **Order status vs payment_status:** Clarify relationship

**All decisions cited with evidence from repository. No implementation performed.**
