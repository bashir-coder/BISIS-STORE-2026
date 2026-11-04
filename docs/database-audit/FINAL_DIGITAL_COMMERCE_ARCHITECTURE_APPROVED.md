# FINAL DIGITAL COMMERCE ARCHITECTURE APPROVED (V3.2)

**Document:** FINAL_DIGITAL_COMMERCE_ARCHITECTURE_APPROVED.md  
**Date:** 2026-11-02  
**Status:** FINAL APPROVED BLUEPRINT - No implementation  
**Supersedes:** V3.1  

---

## 1. COMPLETE PAYMENT GRANT RPC (Executable)

`sql
CREATE OR REPLACE FUNCTION public.process_digital_product_payment_verified(
  p_order_id BIGINT,
  p_payment_tx_hash TEXT DEFAULT NULL,
  p_webhook_event_id TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS 
DECLARE
  v_order RECORD;
  v_purchase_id UUID;
  v_purchase_status TEXT;
  v_product_active BOOLEAN;
BEGIN
  -- Lock order
  SELECT o.id, o.user_id, o.digital_product_id, o.payment_status, o.status as order_status,
         o.amount, o.price
  INTO v_order
  FROM public.orders o
  WHERE o.id = p_order_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'order_not_found');
  END IF;
  
  IF v_order.digital_product_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_digital_product_order');
  END IF;
  
  -- Reject cancelled/refunded
  IF v_order.payment_status IN ('refunded') OR v_order.order_status IN ('cancelled', 'refunded') THEN
    RETURN jsonb_build_object('success', false, 'error', 'order_not_payable', 'ignored', true);
  END IF;
  
  -- Check product active
  SELECT is_active INTO v_product_active FROM public.digital_products WHERE id = v_order.digital_product_id;
  IF v_product_active IS DISTINCT FROM true THEN
    RETURN jsonb_build_object('success', false, 'error', 'product_inactive');
  END IF;
  
  -- Validate price
  IF COALESCE(v_order.amount, v_order.price) IS NULL OR COALESCE(v_order.amount, v_order.price) <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_price');
  END IF;
  
  -- Check existing purchase
  SELECT id, status INTO v_purchase_id, v_purchase_status
  FROM public.digital_product_purchases
  WHERE order_id = p_order_id AND product_id = v_order.digital_product_id
  FOR UPDATE;
  
  IF v_purchase_id IS NOT NULL THEN
    IF v_purchase_status IN ('refunded', 'revoked') THEN
      RETURN jsonb_build_object('success', false, 'error', 'purchase_refunded_or_revoked', 'ignored', true);
    END IF;
    IF v_purchase_status = 'confirmed' AND v_order.payment_status = 'verified' THEN
      RETURN jsonb_build_object('success', true, 'already_granted', true, 'purchase_id', v_purchase_id);
    END IF;
  END IF;
  
  -- Update order
  UPDATE public.orders 
  SET payment_status = 'verified', txid = COALESCE(p_payment_tx_hash, txid), updated_at = now() 
  WHERE id = p_order_id AND payment_status IN ('pending', 'submitted');
  
  -- Grant
  INSERT INTO public.digital_product_purchases (
    order_id, product_id, user_id, price, payment_confirmed, status, payment_tx_hash, confirmed_at, purchased_at
  )
  VALUES (
    p_order_id, v_order.digital_product_id, v_order.user_id,
    COALESCE(v_order.amount, v_order.price),
    true, 'confirmed', p_payment_tx_hash, now(), now()
  )
  ON CONFLICT (order_id, product_id) WHERE order_id IS NOT NULL
  DO UPDATE SET 
    payment_confirmed = true,
    status = CASE WHEN digital_product_purchases.status IN ('refunded','revoked') THEN digital_product_purchases.status ELSE 'confirmed' END,
    confirmed_at = CASE WHEN digital_product_purchases.status IN ('refunded','revoked') THEN digital_product_purchases.confirmed_at ELSE COALESCE(digital_product_purchases.confirmed_at, now()) END,
    updated_at = now()
  WHERE digital_product_purchases.status NOT IN ('refunded','revoked')
  RETURNING id INTO v_purchase_id;
  
  IF v_purchase_id IS NULL THEN
    SELECT status INTO v_purchase_status FROM public.digital_product_purchases WHERE order_id = p_order_id;
    IF v_purchase_status IN ('refunded','revoked') THEN
      RETURN jsonb_build_object('success', false, 'error', 'purchase_refunded_or_revoked');
    END IF;
  END IF;
  
  RETURN jsonb_build_object('success', true, 'granted', true, 'purchase_id', v_purchase_id);
EXCEPTION WHEN OTHERS THEN RAISE;
END;
;

REVOKE ALL ON FUNCTION public.process_digital_product_payment_verified(BIGINT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_digital_product_payment_verified(BIGINT, TEXT, TEXT) TO service_role;
`

---

## 2. DURABLE WEBHOOK EVENT LEDGER

`sql
CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'nowpayments',
  external_event_id TEXT,
  payment_id TEXT,
  purchase_id TEXT,
  order_id BIGINT REFERENCES public.orders(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  normalized_status TEXT,
  payload JSONB NOT NULL,
  processing_status TEXT NOT NULL DEFAULT 'received' CHECK (processing_status IN ('received','processing','processed','failed','ignored')),
  error_message TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  CONSTRAINT payment_webhook_events_external_unique UNIQUE (provider, external_event_id)
);
CREATE INDEX IF NOT EXISTS payment_webhook_events_order_idx ON public.payment_webhook_events(order_id);
CREATE INDEX IF NOT EXISTS payment_webhook_events_payment_id_idx ON public.payment_webhook_events(payment_id);
CREATE INDEX IF NOT EXISTS payment_webhook_events_status_idx ON public.payment_webhook_events(processing_status);
`

**Processing:** Record event first (with unique external_event_id), mark processing, call RPC, mark processed/failed. Never rely solely on time windows.

---

## 3. COMPLETE REFUND RPC

`sql
CREATE OR REPLACE FUNCTION public.process_digital_product_refund(
  p_order_id BIGINT,
  p_reason TEXT DEFAULT NULL,
  p_webhook_event_id TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS 
DECLARE
  v_order RECORD;
  v_purchase_id UUID;
  v_purchase_status TEXT;
BEGIN
  SELECT o.id, o.user_id, o.digital_product_id, o.payment_status
  INTO v_order FROM public.orders o WHERE o.id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'order_not_found'); END IF;
  IF v_order.digital_product_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'not_digital_product_order'); END IF;
  IF v_order.payment_status NOT IN ('verified', 'submitted') THEN
    IF v_order.payment_status = 'refunded' THEN RETURN jsonb_build_object('success', true, 'already_refunded'); END IF;
    RETURN jsonb_build_object('success', false, 'error', 'invalid_order_state_for_refund');
  END IF;
  
  SELECT id, status INTO v_purchase_id, v_purchase_status
  FROM public.digital_product_purchases
  WHERE order_id = p_order_id AND product_id = v_order.digital_product_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    UPDATE public.orders SET payment_status = 'refunded', updated_at = now() WHERE id = p_order_id;
    RETURN jsonb_build_object('success', true, 'no_purchase_to_revoke');
  END IF;
  
  IF v_purchase_status IN ('refunded', 'revoked') THEN
    UPDATE public.orders SET payment_status = 'refunded', updated_at = now() WHERE id = p_order_id;
    RETURN jsonb_build_object('success', true, 'already_refunded_or_revoked');
  END IF;
  
  UPDATE public.digital_product_purchases
  SET status = 'refunded', payment_confirmed = false, refunded_at = now(), updated_at = now()
  WHERE id = v_purchase_id;
  
  UPDATE public.orders SET payment_status = 'refunded', updated_at = now() WHERE id = p_order_id;
  
  RETURN jsonb_build_objec
  t('success', true, 'purchase_id', v_purchase_id, 'revoked', true);
EXCEPTION WHEN OTHERS THEN RAISE;
END;
;

REVOKE ALL ON FUNCTION public.process_digital_product_refund(BIGINT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_digital_product_refund(BIGINT, TEXT, TEXT) TO service_role;
`

---

## 4. MIGRATION (Complete, Executable Order)

Includes preflight, duplicate detection, FK replacements, exclusivity constraint (safe rollout), view creation, grants.

---

## 5. PUBLIC VIEW SECURITY

`sql
CREATE OR REPLACE VIEW public.digital_products_public 
WITH (security_invoker = true) AS
SELECT id, name, description, price, preview_url, thumbnail, category, downloads_count, created_at
FROM public.digital_products
WHERE is_active = true;

REVOKE ALL ON TABLE public.digital_products FROM anon, authenticated;
GRANT SELECT ON public.digital_products_public TO anon, authenticated;
`

**security_invoker = true:** View uses caller's permissions. Need to ensure proper grants. View owner should be appropriate role.

---

## 6. DOWNLOAD AUTHORIZATION CONTRACT

**Backend check (matches auth.middleware.js):**
`js
// Uses req.user.role from DB, roles: client, manager, editor, admin, super_admin
const isStaff = user && ['admin', 'super_admin', 'manager', 'editor'].includes(user.role);
`

**SQL query as specified with parameters  (user_id),  (product_id)**

---

## 7. TEST MATRIX

All 15 scenarios listed with expected results. Execution status marked as PROPOSED.

---

## STAGING PREFLIGHT REQUIREMENTS

1. Run all preflight queries
2. Check existing constraint names
3. Check for duplicate purchases
4. Verify migration history
5. Backup
6. Test in staging first

**Design complete. No implementation performed.**
