# FINAL DIGITAL COMMERCE ARCHITECTURE V2 (Design Only, Corrected)

**Document:** FINAL_DIGITAL_COMMERCE_ARCHITECTURE_V2.md  
**Date:** 2026-11-02  
**Status:** DESIGN BLUEPRINT - No implementation  
**Supersedes:** FINAL_DIGITAL_COMMERCE_ARCHITECTURE.md  

---

## 1. CONFIRMED FACTS VS ASSUMPTIONS

### CONFIRMED FACTS (from evidence)
- **Orders.service is TEXT** - No FK exists. Migration 001:120 creates as TEXT, orders.routes.js:414 stores name. **EVIDENCE:** COMMERCE_DATABASE_ARCHITECTURE_DISCOVERY.md:47
- **Orders single-item enforced** - orders.routes.js:282-290 checks mutually exclusive package_id/service_id
- **package_id is FK** - References packages(id)
- **No order_items table** - Searched all migrations and code, none found
- **Payment flow exists** - NOWPayments webhook with HMAC verification at backend/src/api/routes/nowpayments.routes.js
- **Download requires purchase** - digital-products.routes.js:220-275 checks digital_product_purchases.payment_confirmed
- **Purchase table exists** - Migration 019 creates it with issues
- **Migration 020 in migrations_local/** - Not in canonical migrations/

### UNRESOLVED ASSUMPTIONS (marked)
- **ASSUMPTION:** All orders fit package OR service OR digital_product pattern
- **ASSUMPTION:** Legacy orders have valid data
- **ASSUMPTION:** Migration 020 state unknown in environments
- **ASSUMPTION:** Storage bucket policies exist/configured

---

## 2. CORRECTED ER DIAGRAM

`
users(id) ──┬──< orders(user_id) ON DELETE CASCADE
            │     ├──> packages(id) [package_id, nullable]
            │     ├──> digital_products(id) [digital_product_id, nullable, ON DELETE RESTRICT]
            │     └── service TEXT (no FK)
            │
            └──< digital_product_purchases(user_id) ON DELETE RESTRICT

orders(id) ──< digital_product_purchases(order_id) ON DELETE RESTRICT [nullable for legacy]

digital_products(id) ──< digital_product_purchases(product_id) ON DELETE RESTRICT
digital_products(id) ──< orders(digital_product_id) ON DELETE RESTRICT
`

**Changes from V1:** All FKs to history-preserving objects use RESTRICT, service confirmed as TEXT with no FK.

---

## 3. SAFE CONSTRAINT ROLLOUT STRATEGY

### Phase 1: Discovery (Preflight)
`sql
-- Read-only checks
SELECT COUNT(*) FROM orders WHERE package_id IS NOT NULL AND service IS NOT NULL;
SELECT COUNT(*) FROM orders WHERE package_id IS NOT NULL AND digital_product_id IS NOT NULL;
SELECT COUNT(*) FROM orders WHERE service IS NOT NULL AND digital_product_id IS NOT NULL;
SELECT COUNT(*) FROM orders WHERE package_id IS NULL AND (service IS NULL OR service = '') AND digital_product_id IS NULL;
`

### Phase 2: Add column without constraint
`sql
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS digital_product_id UUID;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_digital_product_id_fkey 
    FOREIGN KEY (digital_product_id) 
    REFERENCES public.digital_products(id) 
    ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS orders_digital_product_id_idx ON public.orders(digital_product_id);
`

### Phase 3: Add constraint only after validation
Only add CHECK constraint after confirming all existing rows valid. If invalid rows exist, fix or handle separately.

---

## 4. PURCHASE LEDGER - RECONCILIATION WITH MIGRATION 019

### Migration 019 schema (current)
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

### Issues to fix
1. ON DELETE CASCADE -> RESTRICT (preserve history)
2. UNIQUE(product_id,user_id) -> UNIQUE(order_id,product_id) WHERE order_id NOT NULL (allow repurchase, enforce per-order)
3. Add status field, backfill from payment_confirmed/confirmed_at
4. Make order_id RESTRICT

### Backfill SQL
`sql
-- Add columns
ALTER TABLE public.digital_product_purchases 
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Backfill status
UPDATE public.digital_product_purchases
SET status = CASE 
  WHEN payment_confirmed = true THEN 'confirmed'
  WHEN payment_confirmed = false AND confirmed_at IS NOT NULL THEN 'confirmed' -- shouldn't happen
  ELSE 'pending'
END,
confirmed_at = CASE WHEN payment_confirmed = true AND confirmed_at IS NULL THEN purchased_at ELSE confirmed_at END
WHERE status IS NULL;

-- Set default and constraint
ALTER TABLE public.digital_product_purchases ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE public.digital_product_purchases ALTER COLUMN status SET NOT NULL;
ALTER TABLE public.digital_product_purchases ADD CONSTRAINT digital_product_purchases_status_check CHECK (status IN ('pending','confirmed','refunded','revoked'));
`

---

## 5. ATOMIC RPC DESIGN

`sql
CREATE OR REPLACE FUNCTION public.process_digital_product_payment_verified(
  p_order_id BIGINT,
  p_payment_tx_hash TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS 
DECLARE
  v_order RECORD;
  v_purchase_id UUID;
BEGIN
  -- Lock and verify order
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_order.digital_product_id IS NULL THEN RAISE EXCEPTION 'Not a digital product order'; END IF;
  IF v_order.payment_status = 'verified' THEN 
    -- Idempotent - just ensure purchase exists
  ELSIF v_order.payment_status IN ('pending','submitted') THEN
    UPDATE orders SET payment_status = 'verified', txid = COALESCE(p_payment_tx_hash, txid), updated_at = now() WHERE id = p_order_id;
  ELSE
    RAISE EXCEPTION 'Invalid order status for grant';
  END IF;
  
  -- Grant access atomically
  INSERT INTO digital_product_purchases (order_id, product_id, user_id, price, payment_confirmed, status, payment_tx_hash, confirmed_at)
  VALUES (p_order_id, v_order.digital_product_id, v_order.user_id, COALESCE(v_order.amount, v_order.price), true, 'confirmed', p_payment_tx_hash, now())
  ON CONFLICT (order_id, product_id) WHERE order_id IS NOT NULL
  DO UPDATE SET payment_confirmed = true, status = 'confirmed', confirmed_at = COALESCE(digital_product_purchases.confirmed_at, now())
  RETURNING id INTO v_purchase_id;
  
  RETURN jsonb_build_object('success', true, 'purchase_id', v_purchase_id);
EXCEPTION
  WHEN OTHERS THEN
    RAISE; -- Rollback entire transaction
END;
;

REVOKE ALL ON FUNCTION public.process_digital_product_payment_verified FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_digital_product_payment_verified TO service_role;
`

**Called only by backend after HMAC/amount/currency validation.**

---

## 6. DOWNLOAD AUTHORIZATION QUERY

`sql
-- Authoritative query
SELECT EXISTS (
  SELECT 1 
  FROM digital_product_purchases dpp
  WHERE dpp.user_id = auth.uid()
    AND dpp.product_id = 
    AND dpp.status = 'confirmed'
    AND dpp.payment_confirmed = true
) 
OR EXISTS (
  SELECT 1 
  FROM users u 
  WHERE u.id = auth.uid() 
    AND u.role IN ('admin', 'super_admin', 'manager', 'editor')
    AND u.is_active = true
) AS has_access;
`

**Note:** Backend currently uses service_role (bypasses RLS) and checks in application code. This query is for reference/future RLS-based access.

---

## 7. RLS & GRANTS

### digital_products
- **Do NOT expose raw table to anon** - contains file_url, storage_key
- Use restricted view or backend-only access
- Enable RLS, staff can manage, public read only through filtered view/backend

### Grants
`sql
REVOKE ALL ON TABLE public.digital_products FROM anon;
GRANT SELECT ON public.digital_products_public TO anon, authenticated;
`

---

## 8. MIGRATION 020 STRATEGY

**Cannot assume state.** Options:
1. If not applied: Include columns/indexes in canonical migration
2. If applied: Skip via IF NOT EXISTS
3. Do not move/modify historical migrations

Include in new canonical migration:
`sql
ALTER TABLE public.digital_products ADD COLUMN IF NOT EXISTS file_mime_type TEXT;
ALTER TABLE public.digital_products ADD COLUMN IF NOT EXISTS file_size BIGINT;
CREATE INDEX IF NOT EXISTS idx_dpp_user_product_confirmed ON public.digital_product_purchases(user_id, product_id, payment_confirmed);
`

---

## 9. PREFLIGHT & TESTS

**Preflight queries** - all read-only as specified.  
**Tests:** atomicity, duplicate webhooks, multiple purchases same user/product, refund preserves other purchases, RLS column security, legacy data compatibility.

---

**This is design only. No implementation performed.**
