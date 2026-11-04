# FINAL DIGITAL COMMERCE ARCHITECTURE V3 (Design Only, Security-Hardened)

**Document:** FINAL_DIGITAL_COMMERCE_ARCHITECTURE_V3.md  
**Date:** 2026-11-02  
**Status:** DESIGN BLUEPRINT - No implementation  
**Supersedes:** V2

---

## 1. WEBHOOK EVENT ORDERING & IDEMPOTENCY

### Event Precedence
**Rule:** refunded/revoked status is terminal and cannot be overridden by late 'verified' events
`sql
-- In RPC: check current status
SELECT status INTO v_current_status FROM digital_product_purchases WHERE order_id = p_order_id FOR UPDATE;
IF v_current_status IN ('refunded','revoked') THEN
  -- Log event but don't grant access
  RETURN jsonb_build_object('success', false, 'reason', 'purchase_refunded_or_revoked', 'ignored', true);
END IF;
`

### Event Idempotency
- Store processed webhook events in order_events (already exists)
- Deduplicate by payment_id/purchase_id within time window (already implemented)
- Use RPC with order-level locking

---

## 2. COMPLETE MIGRATION SQL (Coherent, Executable Order)

`sql
-- FINAL_DIGITAL_COMMERCE_MIGRATION_V3.sql (PROPOSED - DO NOT EXECUTE)

BEGIN;

-- PREFLIGHT
DO 
BEGIN
  -- Check for blocking issues
  IF EXISTS (SELECT 1 FROM orders WHERE package_id IS NOT NULL AND service IS NOT NULL AND service != '') THEN
    RAISE EXCEPTION 'Orders with both package_id and service exist - resolve manually';
  END IF;
END ;

-- 1. Add digital_product_id to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS digital_product_id UUID;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_digital_product_id_fkey;
ALTER TABLE public.orders ADD CONSTRAINT orders_digital_product_id_fkey 
  FOREIGN KEY (digital_product_id) REFERENCES public.digital_products(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS orders_digital_product_id_idx ON public.orders(digital_product_id);

-- 2. Rework digital_product_purchases
-- Drop old unique constraint
ALTER TABLE public.digital_product_purchases DROP CONSTRAINT IF EXISTS digital_product_purchases_product_id_user_id_key;

-- Replace FKs
ALTER TABLE public.digital_product_purchases DROP CONSTRAINT IF EXISTS digital_product_purchases_product_id_fkey;
ALTER TABLE public.digital_product_purchases DROP CONSTRAINT IF EXISTS digital_product_purchases_user_id_fkey;
ALTER TABLE public.digital_product_purchases DROP CONSTRAINT IF EXISTS digital_product_purchases_order_id_fkey;

ALTER TABLE public.digital_product_purchases 
  ADD CONSTRAINT digital_product_purchases_product_id_fkey 
    FOREIGN KEY (product_id) REFERENCES public.digital_products(id) ON DELETE RESTRICT;
ALTER TABLE public.digital_product_purchases 
  ADD CONSTRAINT digital_product_purchases_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE RESTRICT;
ALTER TABLE public.digital_product_purchases 
  ADD CONSTRAINT digital_product_purchases_order_id_fkey 
    FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE RESTRICT;

-- 3. Add columns and backfill
ALTER TABLE public.digital_product_purchases 
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Backfill - only confirm if payment_confirmed true AND no contradictions
UPDATE public.digital_product_purchases
SET 
  status = CASE 
    WHEN payment_confirmed = true AND (confirmed_at IS NOT NULL OR purchased_at IS NOT NULL) THEN 'confirmed'
    WHEN payment_confirmed = false THEN 'pending'
    ELSE 'pending' -- Don't guess for contradictory records
  END,
  confirmed_at = CASE 
    WHEN payment_confirmed = true AND confirmed_at IS NULL THEN purchased_at 
    ELSE confirmed_at 
  END,
  updated_at = now()
WHERE status IS NULL;

-- Enforce constraints
ALTER TABLE public.digital_product_purchases ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE public.digital_product_purchases ALTER COLUMN status SET NOT NULL;
ALTER TABLE public.digital_product_purchases DROP CONSTRAINT IF EXISTS digital_product_purchases_status_check;
ALTER TABLE public.digital_product_purchases ADD CONSTRAINT digital_product_purchases_status_check 
  CHECK (status IN ('pending','confirmed','refunded','revoked'));

-- Idempotency per order
DROP INDEX IF EXISTS digital_product_purchases_order_product_idx;
CREATE UNIQUE INDEX digital_product_purchases_order_product_idx 
  ON public.digital_product_purchases(order_id, product_id) 
  WHERE order_id IS NOT NULL;

-- Allow legacy rows without order_id
CREATE INDEX IF NOT EXISTS digital_product_purchases_user_product_idx 
  ON public.digital_product_purchases(user_id, product_id);

-- 4. Enable RLS on digital_products
ALTER TABLE public.digital_products ENABLE ROW LEVEL SECURITY;

-- 5. Create public view (no private fields)
DROP VIEW IF EXISTS public.digital_products_public;
CREATE VIEW public.digital_products_public AS
SELECT id, name, description, price, preview_url, thumbnail, category, downloads_count, created_at
FROM public.digital_products
WHERE is_active = true;

-- 6. Reconcile migration 020
ALTER TABLE public.digital_products ADD COLUMN IF NOT EXISTS file_mime_type TEXT;
ALTER TABLE public.digital_products ADD COLUMN IF NOT EXISTS file_size BIGINT;
CREATE INDEX IF NOT EXISTS idx_dpp_user_product_confirmed ON public.digital_product_purchases(user_id, product_id, payment_confirmed);

COMMIT;

-- ROLLBACK LIMITATIONS: Some changes hard to rollback, especially data migrations
`

---

## 3. ATOMIC REFUND RPC

`sql
CREATE OR REPLACE FUNCTION public.process_digital_product_refund(
  p_order_id BIGINT,
  p_reason TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS 
DECLARE
  v_order RECORD;
  v_purchase_id UUID;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  
  UPDATE orders SET payment_status = 'refunded', updated_at = now() WHERE id = p_order_id;
  
  UPDATE digital_product_purchases
  SET status = 'refunded', payment_confirmed = false, refunded_at = now(), updated_at = now()
  WHERE order_id = p_order_id AND status = 'confirmed'
  RETURNING id INTO v_purchase_id;
  
  -- Log refund event (application layer should do this)
  
  RETURN jsonb_build_object('success', true, 'purchase_id', v_purchase_id);
EXCEPTION WHEN OTHERS THEN RAISE;
END;
;

REVOKE ALL ON FUNCTION public.process_digital_product_refund FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_digital_product_refund TO service_role;
`

---

## 4. DOWNLOAD AUTHORIZATION QUERY (Complete)

`sql
-- Complete executable query
SELECT EXISTS (
  SELECT 1
  FROM digital_product_purchases dpp
  WHERE dpp.user_id =   -- user UUID
    AND dpp.product_id =   -- product UUID
    AND dpp.status = 'confirmed'
    AND dpp.payment_confirmed = true
)
OR EXISTS (
  SELECT 1
  FROM users u
  WHERE u.id = 
    AND u.is_active = true
    AND u.role IN ('admin', 'super_admin', 'manager', 'editor')
) AS has_access;
`

**Legacy purchases without order_id:** Covered by first EXISTS.  
**Staff:** Covered by second EXISTS using role from users table.

---

## 5. PUBLIC VIEW SECURITY

`sql
CREATE OR REPLACE VIEW public.digital_products_public
WITH (security_invoker = false) AS  -- view runs as owner
SELECT 
  id,
  name,
  description,
  price,
  preview_url,
  thumbnail,
  category,
  downloads_count,
  created_at
FROM public.digital_products
WHERE is_active = true;

ALTER VIEW public.digital_products_public OWNER TO postgres;
GRANT SELECT ON public.digital_products_public TO anon, authenticated;
REVOKE ALL ON public.digital_products_public FROM PUBLIC;
`

**Notes:** View does not expose file_url or storage_key. RLS on underlying table still applies if security_invoker=true, but better to control via view. Backend can also query base table with service_role.

---

## 6. DEPLOYMENT SEQUENCE

1. **Staging preflight** - Run all preflight queries
2. **Backup** - Full backup before migration
3. **Apply migration** - Run in transaction where possible
4. **Deploy backend** - RPC functions, webhook updates
5. **Test** - Run test matrix
6. **Production** - Only after staging success
7. **Monitor** - Webhook events, purchase grants

**Rollback:** Limited - cannot easily undo constraint changes and data migrations. Have recovery plan.

---

All changes are design-only. No implementation performed.
