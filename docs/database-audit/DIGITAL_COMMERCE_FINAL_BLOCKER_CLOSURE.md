# DIGITAL COMMERCE FINAL BLOCKER CLOSURE (V3.2.3) - Design Only

**Document:** DIGITAL_COMMERCE_FINAL_BLOCKER_CLOSURE.md  
**Date:** 2026-11-02  
**Status:** FINAL CLOSURE - No implementation  

---

## 1. PAYMENT GRANT RPC (Final Hardened)

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
  v_event RECORD;
  v_purchase_id UUID;
  v_purchase_status TEXT;
  v_product_active BOOLEAN;
  v_rows_updated INT;
BEGIN
  IF p_webhook_event_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'missing_webhook_event_id');
  END IF;
  
  -- Claim event atomically
  SELECT * INTO v_event
  FROM public.payment_webhook_events
  WHERE id = p_webhook_event_id::uuid AND processing_status = 'received'
  FOR UPDATE SKIP LOCKED;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'event_unavailable_or_processed');
  END IF;
  
  -- Validate event against trusted data
  IF v_event.order_id != p_order_id OR v_event.provider != 'nowpayments' THEN
    UPDATE public.payment_webhook_events SET processing_status = 'failed', error_message = 'event_order_mismatch', processed_at = now() WHERE id = v_event.id;
    RETURN jsonb_build_object('success', false, 'error', 'event_validation_failed');
  END IF;
  
  IF COALESCE(v_event.normalized_status, '') != 'verified' THEN
    UPDATE public.payment_webhook_events SET processing_status = 'ignored', processed_at = now() WHERE id = v_event.id;
    RETURN jsonb_build_object('success', false, 'error', 'not_verified_status', 'ignored', true);
  END IF;
  
  UPDATE public.payment_webhook_events SET processing_status = 'processing', processing_started_at = now() WHERE id = v_event.id;
  
  SELECT o.id, o.user_id, o.digital_product_id, o.payment_status, o.status as order_status, o.amount, o.price
  INTO v_order FROM public.orders o WHERE o.id = p_order_id FOR UPDATE;
  
  IF NOT FOUND THEN
    UPDATE public.payment_webhook_events SET processing_status = 'failed', error_message = 'order_not_found', processed_at = now() WHERE id = v_event.id;
    RETURN jsonb_build_object('success', false, 'error', 'order_not_found');
  END IF;
  
  IF v_order.user_id IS NULL OR v_order.digital_product_id IS NULL THEN
    UPDATE public.payment_webhook_events SET processing_status = 'failed', error_message = 'invalid_order_linkage', processed_at = now() WHERE id = v_event.id;
    RETURN jsonb_build_object('success', false, 'error', 'invalid_order');
  END IF;
  
  IF COALESCE(v_order.amount, v_order.price) IS NULL OR COALESCE(v_order.amount, v_order.price) <= 0 THEN
    UPDATE public.payment_webhook_events SET processing_status = 'failed', error_message = 'invalid_price', processed_at = now() WHERE id = v_event.id;
    RETURN jsonb_build_object('success', false, 'error', 'invalid_price');
  END IF;
  
  IF v_order.order_status IN ('cancelled','refunded') OR v_order.payment_status = 'refunded' THEN
    UPDATE public.payment_webhook_events SET processing_status = 'ignored', processed_at = now() WHERE id = v_event.id;
    RETURN jsonb_build_object('success', false, 'error', 'terminal_order_state', 'ignored', true);
  END IF;
  
  SELECT dp.is_active INTO v_product_active FROM public.digital_products dp WHERE dp.id = v_order.digital_product_id;
  IF v_product_active IS DISTINCT FROM true THEN
    UPDATE public.payment_webhook_events SET processing_status = 'failed', error_message = 'product_inactive', processed_at = now() WHERE id = v_event.id;
    RETURN jsonb_build_object('success', false, 'error', 'product_inactive');
  END IF;
  
  IF v_order.payment_status NOT IN ('pending','submitted') THEN
    -- Check if already has purchase
    SELECT status INTO v_purchase_status FROM public.digital_product_purchases WHERE order_id = p_order_id AND product_id = v_order.digital_product_id;
    IF v_purchase_status = 'confirmed' THEN
      UPDATE public.payment_webhook_events SET processing_status = 'ignored', processed_at = now() WHERE id = v_event.id;
      RETURN jsonb_build_object('success', true, 'already_granted', true, 'ignored_duplicate', true);
    END IF;
    IF v_purchase_status IN ('refunded','revoked') THEN
      UPDATE public.payment_webhook_events SET processing_status = 'ignored', processed_at = now() WHERE id = v_event.id;
      RETURN jsonb_build_object('success', false, 'error', 'purchase_terminal', 'ignored', true);
    END IF;
    UPDATE public.payment_webhook_events SET processing_status = 'failed', error_message = 'unexpected_order_payment_status', processed_at = now() WHERE id = v_event.id;
    RETURN jsonb_build_object('success', false, 'error', 'unexpected_order_payment_status');
  END IF;
  
  UPDATE public.orders SET payment_status = 'verified', txid = COALESCE(p_payment_tx_hash, txid), updated_at = now() 
  WHERE id = p_order_id AND payment_status IN ('pending','submitted');
  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  
  IF v_rows_updated = 0 THEN
    UPDATE public.payment_webhook_events SET processing_status = 'failed', error_message = 'order_transition_failed', processed_at = now() WHERE id = v_event.id;
    RETURN jsonb_build_object('success', false, 'error', 'order_transition_failed');
  END IF;
  
  INSERT INTO public.digital_product_purchases (order_id, product_id, user_id, price, payment_confirmed, status, payment_tx_hash, confirmed_at, purchased_at)
  VALUES (p_order_id, v_order.digital_product_id, v_order.user_id, COALESCE(v_order.amount,v_order.price), true, 'confirmed', p_payment_tx_hash, now(), now())
  ON CONFLICT (order_id, product_id) WHERE order_id IS NOT NULL
  DO UPDATE SET payment_confirmed = true, status = CASE WHEN digital_product_purchases.status IN ('refunded','revoked') THEN digital_product_purchases.status ELSE 'confirmed' END,
    confirmed_at = CASE WHEN digital_product_purchases.status IN ('refunded','revoked') THEN digital_product_purchases.confirmed_at ELSE COALESCE(digital_product_purchases.confirmed_at, now()) END, updated_at = now()
  WHERE digital_product_purchases.status NOT IN ('refunded','revoked')
  RETURNING id INTO v_purchase_id;
  
  IF v_purchase_id IS NULL THEN
    UPDATE public.payment_webhook_events SET processing_status = 'failed', error_message = 'grant_blocked_by_terminal_status', processed_at = now() WHERE id = v_event.id;
    RETURN jsonb_build_object('success', false, 'error', 'grant_blocked');
  END IF;
  
  UPDATE public.payment_webhook_events SET processing_status = 'processed', processed_at = now() WHERE id = v_event.id;
  RETURN jsonb_build_object('success', true, 'granted', true, 'purchase_id', v_purchase_id);
EXCEPTION WHEN OTHERS THEN
  BEGIN UPDATE public.payment_webhook_events SET processing_status = 'failed', error_message = left(SQLERRM, 500), processed_at = now() WHERE id = p_webhook_event_id::uuid; EXCEPTION WHEN OTHERS THEN NULL; END;
  RAISE;
END;
;

REVOKE ALL ON FUNCTION public.process_digital_product_payment_verified(BIGINT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_digital_product_payment_verified(BIGINT, TEXT, TEXT) TO service_role;
`

---

**Note:** At-most-once processing with idempotent grants; exactly-once not guaranteed without distributed locks. Retry with recovery process for failed events.

All blockers addressed. No implementation performed.
