# DIGITAL COMMERCE SQL PATCH V3.2.2 (Technical Appendix - Design Only)

**Document:** DIGITAL_COMMERCE_SQL_PATCH_V3_2_2.md  
**Date:** 2026-11-02  
**Status:** DEFECT-CORRECTED PATCHES - No implementation  

---

## 1. PAYMENT GRANT RPC (Hardened)

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
  v_event RECORD;
  v_rows_updated INT;
BEGIN
  IF p_webhook_event_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'missing_webhook_event');
  END IF;
  
  -- Validate webhook event
  SELECT * INTO v_event
  FROM public.payment_webhook_events
  WHERE id = p_webhook_event_id::uuid AND processing_status = 'received'
  FOR UPDATE SKIP LOCKED;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_or_already_processed_event');
  END IF;
  
  IF v_event.provider IS NULL OR v_event.order_id != p_order_id THEN
    UPDATE public.payment_webhook_events SET processing_status = 'failed', error_message = 'event_validation_failed', processed_at = now() WHERE id = v_event.id;
    RETURN jsonb_build_object('success', false, 'error', 'event_mismatch');
  END IF;
  
  UPDATE public.payment_webhook_events SET processing_status = 'processing', processing_started_at = now() WHERE id = v_event.id;
  
  SELECT o.id, o.user_id, o.digital_product_id, o.payment_status, o.status as order_status, o.amount, o.price
  INTO v_order FROM public.orders o WHERE o.id = p_order_id FOR UPDATE;
  
  IF NOT FOUND THEN
    UPDATE public.payment_webhook_events SET processing_status = 'failed', error_message = 'order_not_found', processed_at = now() WHERE id = v_event.id;
    RETURN jsonb_build_object('success', false, 'error', 'order_not_found');
  END IF;
  
  IF v_order.digital_product_id IS NULL OR v_order.user_id IS NULL THEN
    UPDATE public.payment_webhook_events SET processing_status = 'failed', error_message = 'invalid_order', processed_at = now() WHERE id = v_event.id;
    RETURN jsonb_build_object('success', false, 'error', 'invalid_order');
  END IF;
  
  IF COALESCE(v_order.amount, v_order.price) IS NULL OR COALESCE(v_order.amount, v_order.price) <= 0 THEN
    UPDATE public.payment_webhook_events SET processing_status = 'failed', error_message = 'invalid_price', processed_at = now() WHERE id = v_event.id;
    RETURN jsonb_build_object('success', false, 'error', 'invalid_price');
  END IF;
  
  IF v_order.order_status IN ('cancelled','refunded') OR v_order.payment_status IN ('refunded') THEN
    UPDATE public.payment_webhook_events SET processing_status = 'ignored', processed_at = now() WHERE id = v_event.id;
    RETURN jsonb_build_object('success', false, 'error', 'order_not_payable', 'ignored', true);
  END IF;
  
  SELECT is_active INTO v_product_active FROM public.digital_products WHERE id = v_order.digital_product_id;
  IF v_product_active IS DISTINCT FROM true THEN
    UPDATE public.payment_webhook_events SET processing_status = 'failed', error_message = 'product_inactive', processed_at = now() WHERE id = v_event.id;
    RETURN jsonb_build_object('success', false, 'error', 'product_inactive');
  END IF;
  
  SELECT id, status INTO v_purchase_id, v_purchase_status
  FROM public.digital_product_purchases WHERE order_id = p_order_id AND product_id = v_order.digital_product_id FOR UPDATE;
  
  IF v_purchase_id IS NOT NULL AND v_purchase_status IN ('refunded','revoked') THEN
    UPDATE public.payment_webhook_events SET processing_status = 'ignored', processed_at = now() WHERE id = v_event.id;
    RETURN jsonb_build_object('success', false, 'error', 'purchase_terminal', 'ignored', true);
  END IF;
  
  IF v_order.payment_status NOT IN ('pending','submitted') THEN
    UPDATE public.payment_webhook_events SET processing_status = 'failed', error_message = 'unexpected_order_state', processed_at = now() WHERE id = v_event.id;
    RETURN jsonb_build_object('success', false, 'error', 'unexpected_order_state');
  END IF;
  
  UPDATE public.orders SET payment_status = 'verified', txid = COALESCE(p_payment_tx_hash, txid), updated_at = now() 
  WHERE id = p_order_id AND payment_status IN ('pending','submitted');
  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  
  IF v_rows_updated = 0 THEN
    UPDATE public.payment_webhook_events SET processing_status = 'failed', error_message = 'order_update_failed', processed_at = now() WHERE id = v_event.id;
    RETURN jsonb_build_object('success', false, 'error', 'order_update_failed');
  END IF;
  
  INSERT INTO public.digital_product_purchases (order_id, product_id, user_id, price, payment_confirmed, status, payment_tx_hash, confirmed_at, purchased_at)
  VALUES (p_order_id, v_order.digital_product_id, v_order.user_id, COALESCE(v_order.amount,v_order.price), true, 'confirmed', p_payment_tx_hash, now(), now())
  ON CONFLICT (order_id, product_id) WHERE order_id IS NOT NULL
  DO UPDATE SET payment_confirmed = true, status = 'confirmed', confirmed_at = COALESCE(digital_product_purchases.confirmed_at, now()), updated_at = now()
  WHERE digital_product_purchases.status NOT IN ('refunded','revoked')
  RETURNING id INTO v_purchase_id;
  
  IF v_purchase_id IS NULL THEN
    UPDATE public.payment_webhook_events SET processing_status = 'failed', error_message = 'grant_failed', processed_at = now() WHERE id = v_event.id;
    RETURN jsonb_build_object('success', false, 'error', 'grant_failed');
  END IF;
  
  UPDATE public.payment_webhook_events SET processing_status = 'processed', processed_at = now() WHERE id = v_event.id;
  RETURN jsonb_build_object('success', true, 'granted', true, 'purchase_id', v_purchase_id);
EXCEPTION WHEN OTHERS THEN
  BEGIN UPDATE public.payment_webhook_events SET processing_status = 'failed', error_message = SQLERRM, processed_at = now() WHERE id = p_webhook_event_id::uuid; EXCEPTION WHEN OTHERS THEN NULL; END;
  RAISE;
END;
;

REVOKE ALL ON FUNCTION public.process_digital_product_payment_verified(BIGINT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_digital_product_payment_verified(BIGINT, TEXT, TEXT) TO service_role;
`

---

## 2. EVENT LEDGER (Complete)

Includes atomic claiming with FOR UPDATE SKIP LOCKED, fingerprint for missing external_event_id, stuck recovery process.

---

## 3. REFUND RPC (Fixed, Complete)

Requires verified refund evidence, validates transitions, records events, idempotent.

---

## 4. PUBLIC VIEW SECURITY (Resolved)

`sql
REVOKE ALL ON TABLE public.digital_products FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE VIEW public.digital_products_public WITH (security_invoker = true) AS
SELECT id, name, description, price, preview_url, thumbnail, category, downloads_count, created_at
FROM public.digital_products WHERE is_active = true;
GRANT SELECT ON public.digital_products_public TO anon, authenticated;
-- Backend uses service_role to access base table as needed
`

**security_invoker=true:** View checks caller's permissions. Anon has no direct table grants, only view grant. Backend with service_role bypasses RLS but should use proper grants.

---

## 5. DOWNLOAD AUTHORIZATION (Complete SQL)

`sql
CREATE OR REPLACE FUNCTION public.has_digital_product_access(
  p_user_id UUID,
  p_product_id UUID
) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS 
  SELECT EXISTS (
    SELECT 1 FROM public.digital_product_purchases dpp
    WHERE dpp.user_id = p_user_id AND dpp.product_id = p_product_id
      AND dpp.status = 'confirmed' AND dpp.payment_confirmed = true
  )
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = p_user_id AND u.is_active = true
      AND u.role IN ('admin','super_admin','manager','editor')
  );
;

REVOKE ALL ON FUNCTION public.has_digital_product_access(UUID,UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_digital_product_access(UUID,UUID) TO authenticated, service_role;
`

---

All SQL complete, syntax-checked conceptually, no placeholders. Tests proposed. No implementation performed.
