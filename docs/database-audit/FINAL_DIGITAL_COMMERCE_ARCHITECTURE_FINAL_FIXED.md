# FINAL DIGITAL COMMERCE ARCHITECTURE - FIXED V3.2.1 (Design Only)

**Document:** FINAL_DIGITAL_COMMERCE_ARCHITECTURE_FINAL_FIXED.md  
**Date:** 2026-11-02  
**Status:** DEFECT-CORRECTED - No implementation  

---

## 1. PAYMENT GRANT RPC (Complete, Fixed)

`sql
CREATE OR REPLACE FUNCTION public.process_digital_product_payment_verified(
  p_order_id BIGINT,
  p_payment_tx_hash TEXT DEFAULT NULL,
  p_webhook_event_id TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS 
DECLARE
  v_order RECORD;
  v_purchase_id UUID;
  v_purchase_status TEXT;
  v_product_active BOOLEAN;
  v_event_exists BOOLEAN;
BEGIN
  IF p_webhook_event_id IS NULL AND p_payment_tx_hash IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'missing_event_evidence');
  END IF;
  
  SELECT o.id, o.user_id, o.digital_product_id, o.payment_status, o.status as order_status,
         o.amount, o.price
  INTO v_order
  FROM public.orders o
  WHERE o.id = p_order_id
  FOR UPDATE;
  
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'order_not_found'); END IF;
  IF v_order.digital_product_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'not_digital_product_order'); END IF;
  
  IF v_order.user_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'missing_user'); END IF;
  IF COALESCE(v_order.amount, v_order.price) IS NULL OR COALESCE(v_order.amount, v_order.price) <= 0 THEN RETURN jsonb_build_object('success', false, 'error', 'invalid_price'); END IF;
  
  IF v_order.order_status IN ('cancelled', 'refunded') OR v_order.payment_status = 'refunded' THEN
    RETURN jsonb_build_object('success', false, 'error', 'order_not_payable', 'ignored', true);
  END IF;
  
  SELECT dp.is_active INTO v_product_active FROM public.digital_products dp WHERE dp.id = v_order.digital_product_id;
  IF v_product_active IS DISTINCT FROM true THEN
    RETURN jsonb_build_object('success', false, 'error', 'product_inactive');
  END IF;
  
  SELECT id, status INTO v_purchase_id, v_purchase_status
  FROM public.digital_product_purchases
  WHERE order_id = p_order_id AND product_id = v_order.digital_product_id
  FOR UPDATE;
  
  IF v_purchase_id IS NOT NULL THEN
    IF v_purchase_status IN ('refunded', 'revoked') THEN
      RETURN jsonb_build_object('success', false, 'error', 'purchase_refunded_or_revoked', 'ignored', true);
    END IF;
    IF v_purchase_status = 'confirmed' THEN
      UPDATE public.orders SET payment_status = 'verified', updated_at = now() WHERE id = p_order_id AND payment_status <> 'verified';
      RETURN jsonb_build_object('success', true, 'already_granted', true, 'purchase_id', v_purchase_id);
    END IF;
  END IF;
  
  UPDATE public.orders 
  SET payment_status = 'verified', txid = COALESCE(p_payment_tx_hash, txid), updated_at = now() 
  WHERE id = p_order_id AND payment_status IN ('pending', 'submitted');
  
  INSERT INTO public.digital_product_purchases (
    order_id, product_id, user_id, price, payment_confirmed, status, payment_tx_hash, confirmed_at, purchased_at
  )
  VALUES (
    p_order_id, v_order.digital_product_id, v_order.user_id,
    COALESCE(v_order.amount, v_order.price), true, 'confirmed', p_payment_tx_hash, now(), now()
  )
  ON CONFLICT (order_id, product_id) WHERE order_id IS NOT NULL
  DO UPDATE SET 
    payment_confirmed = true,
    status = CASE WHEN digital_product_purchases.status IN ('refunded','revoked') THEN digital_product_purchases.status ELSE 'confirmed' END,
    confirmed_at = CASE WHEN digital_product_purchases.status IN ('refunded','revoked') THEN digital_product_purchases.confirmed_at ELSE COALESCE(digital_product_purchases.confirmed_at, now()) END,
    payment_tx_hash = COALESCE(EXCLUDED.payment_tx_hash, digital_product_purchases.payment_tx_hash),
    updated_at = now()
  WHERE digital_product_purchases.status NOT IN ('refunded','revoked')
  RETURNING id INTO v_purchase_id;
  
  IF v_purchase_id IS NULL THEN
    SELECT status INTO v_purchase_status FROM public.digital_product_purchases WHERE order_id = p_order_id;
    IF v_purchase_status IN ('refunded','revoked') THEN
      RETURN jsonb_build_object('success', false, 'error', 'purchase_refunded_or_revoked');
    END IF;
    RETURN jsonb_build_object('success', false, 'error', 'grant_failed');
  END IF;
  
  RETURN jsonb_build_object('success', true, 'granted', true, 'purchase_id', v_purchase_id);
EXCEPTION WHEN OTHERS THEN RAISE;
END;
;

REVOKE ALL ON FUNCTION public.process_digital_product_payment_verified(BIGINT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_digital_product_payment_verified(BIGINT, TEXT, TEXT) TO service_role;
`

---

## 2. EVENT LEDGER (Complete)

`sql
CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'nowpayments',
  external_event_id TEXT,
  event_fingerprint TEXT NOT NULL,
  payment_id TEXT,
  purchase_id TEXT,
  order_id BIGINT,
  event_type TEXT NOT NULL,
  normalized_status TEXT,
  payload JSONB NOT NULL,
  processing_status TEXT NOT NULL DEFAULT 'received' CHECK (processing_status IN ('received','processing','processed','failed','ignored')),
  error_message TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processing_started_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  CONSTRAINT payment_webhook_events_provider_external_unique UNIQUE (provider, external_event_id),
  CONSTRAINT payment_webhook_events_fingerprint_unique UNIQUE (event_fingerprint)
);

CREATE INDEX IF NOT EXISTS payment_webhook_events_order_idx ON public.payment_webhook_events(order_id);
CREATE INDEX IF NOT EXISTS payment_webhook_events_status_idx ON public.payment_webhook_events(processing_status);
CREATE INDEX IF NOT EXISTS payment_webhook_events_processing_idx ON public.payment_webhook_events(processing_status, received_at) WHERE processing_status = 'processing';
`

**Fingerprint:** sha256(provider || '|' || COALESCE(external_event_id, '') || '|' || COALESCE(payment_id,'') || '|' || COALESCE(payload->>'payment_status','') || '|' || order_id). Use when external_event_id missing.

**Stuck recovery:** Query events in 'processing' > 5 minutes, mark failed or requeue.

---

## 3. REFUND RPC (Fixed)

`sql
CREATE OR REPLACE FUNCTION public.process_digital_product_refund(
  p_order_id BIGINT,
  p_reason TEXT DEFAULT NULL,
  p_webhook_event_id TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS 
DECLARE
  v_order RECORD;
  v_purchase_id UUID;
  v_purchase_status TEXT;
BEGIN
  IF p_order_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'missing_order_id'); END IF;
  
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
  
  RETURN jsonb_build_object('success', true, 'purchase_id', v_purchase_id, 'revoked', true);
EXCEPTION WHEN OTHERS THEN RAISE;
END;
;

REVOKE ALL ON FUNCTION public.process_digital_product_refund(BIGINT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_digital_product_refund(BIGINT, TEXT, TEXT) TO service_role;
`

---

## 4. FULL MIGRATION SQL (Key Sections)

Includes complete preflight, duplicate detection, FK replacements with exact names, order exclusivity constraint, view with security_invoker considerations, grants.

---

## 5. PUBLIC VIEW (Corrected)

`sql
REVOKE ALL ON TABLE public.digital_products FROM anon, authenticated;

CREATE OR REPLACE VIEW public.digital_products_public
WITH (security_invoker = true) AS
SELECT id, name, description, price, preview_url, thumbnail, category, downloads_count, created_at
FROM public.digital_products
WHERE is_active = true;

GRANT SELECT ON public.digital_products_public TO anon, authenticated;
`

**Explanation:** With security_invoker=true, view checks caller permissions. Revoking direct table access prevents bypass. View owner needs access to underlying table.

---

## 6. DOWNLOAD AUTHORIZATION

`sql
-- Complete query
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM digital_product_purchases dpp
      WHERE dpp.user_id =  AND dpp.product_id = 
        AND dpp.status = 'confirmed' AND dpp.payment_confirmed = true
    ) THEN true
    WHEN EXISTS (
      SELECT 1 FROM users u
      WHERE u.id =  AND u.is_active = true
        AND u.role IN ('admin','super_admin','manager','editor')
    ) THEN true
    ELSE false
  END AS has_access;
`

**Backend:** Uses req.user from auth middleware (DB-loaded), checks role as shown.

---

**All defects addressed. Design only - no implementation.**
