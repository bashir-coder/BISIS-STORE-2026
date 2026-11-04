# DIGITAL COMMERCE P0 SQL CORRECTION (Blocker Fixes)

**Document:** DIGITAL_COMMERCE_P0_SQL_CORRECTION.md  
**Date:** 2026-11-04  
**Status:** CORRECTIONS ONLY - Not executable until verified  

---

## A. EVENT LEDGER (Corrected)

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
  CONSTRAINT payment_webhook_events_provider_external_unique UNIQUE (provider, external_event_id) DEFERRABLE INITIALLY IMMEDIATE,
  CONSTRAINT payment_webhook_events_fingerprint_unique UNIQUE (event_fingerprint)
);

CREATE INDEX IF NOT EXISTS payment_webhook_events_order_idx ON public.payment_webhook_events(order_id);
CREATE INDEX IF NOT EXISTS payment_webhook_events_status_idx ON public.payment_webhook_events(processing_status);
CREATE INDEX IF NOT EXISTS payment_webhook_events_processing_stale_idx ON public.payment_webhook_events(processing_started_at) WHERE processing_status = 'processing';
`

**Recovery:** Cron/job to reset events stuck in 'processing' > 5 min to 'failed' for retry.

---

## B. GRANT RPC (Corrected - Not Fully Executable)

`sql
CREATE OR REPLACE FUNCTION public.grant_digital_product_purchase(
  p_order_id BIGINT,
  p_webhook_event_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS 
DECLARE
  v_event RECORD;
  v_order RECORD;
  v_purchase RECORD;
  v_purchase_id UUID;
  v_product_is_active BOOLEAN;
  v_rows_updated INT;
BEGIN
  -- Claim event
  SELECT * INTO v_event FROM public.payment_webhook_events WHERE id = p_webhook_event_id AND processing_status = 'received' FOR UPDATE SKIP LOCKED;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','event_unavailable'); END IF;
  
  -- Validate event
  IF v_event.provider != 'nowpayments' OR v_event.order_id != p_order_id OR v_event.normalized_status != 'finished' THEN
    UPDATE public.payment_webhook_events SET processing_status='failed', error_message='event_validation_failed', processed_at=now() WHERE id=p_webhook_event_id;
    RETURN jsonb_build_object('success',false,'error','event_validation_failed');
  END IF;
  
  UPDATE public.payment_webhook_events SET processing_status='processing', processing_started_at=now() WHERE id=p_webhook_event_id;
  
  -- Lock order
  SELECT o.id, o.user_id, o.digital_product_id, o.payment_status, o.status as order_status, o.amount, o.price
  INTO v_order FROM public.orders o WHERE o.id = p_order_id FOR UPDATE;
  
  IF NOT FOUND OR v_order.user_id IS NULL OR v_order.digital_product_id IS NULL THEN
    UPDATE public.payment_webhook_events SET processing_status='failed', error_message='invalid_order', processed_at=now() WHERE id=p_webhook_event_id;
    RETURN jsonb_build_object('success',false,'error','invalid_order');
  END IF;
  
  -- Validate product
  SELECT dp.is_active INTO v_product_is_active FROM public.digital_products dp WHERE dp.id = v_order.digital_product_id;
  IF v_product_is_active IS DISTINCT FROM true THEN
    UPDATE public.payment_webhook_events SET processing_status='failed', error_message='product_inactive', processed_at=now() WHERE id=p_webhook_event_id;
    RETURN jsonb_build_object('success',false,'error','product_inactive');
  END IF;
  
  -- Check terminal states
  IF v_order.order_status IN ('cancelled','refunded') OR v_order.payment_status = 'refunded' THEN
    UPDATE public.payment_webhook_events SET processing_status='ignored', processed_at=now() WHERE id=p_webhook_event_id;
    RETURN jsonb_build_object('success',false,'error','terminal_state','ignored',true);
  END IF;
  
  -- Check existing purchase
  SELECT * INTO v_purchase FROM public.digital_product_purchases WHERE order_id = p_order_id AND product_id = v_order.digital_product_id FOR UPDATE;
  IF v_purchase.id IS NOT NULL THEN
    IF v_purchase.status IN ('refunded','revoked') THEN
      UPDATE public.payment_webhook_events SET processing_status='ignored', processed_at=now() WHERE id=p_webhook_event_id;
      RETURN jsonb_build_object('success',false,'error','purchase_terminal','ignored',true);
    END IF;
    IF v_purchase.status = 'confirmed' THEN
      UPDATE public.payment_webhook_events SET processing_status='ignored', processed_at=now() WHERE id=p_webhook_event_id;
      RETURN jsonb_build_object('success',true,'already_granted',true,'purchase_id',v_purchase.id);
    END IF;
  END IF;
  
  -- Update order
  UPDATE public.orders SET payment_status='verified', updated_at=now() WHERE id=p_order_id AND payment_status IN ('pending','submitted');
  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  IF v_rows_updated = 0 THEN
    UPDATE public.payment_webhook_events SET processing_status='failed', error_message='order_transition_failed', processed_at=now() WHERE id=p_webhook_event_id;
    RETURN jsonb_build_object('success',false,'error','order_transition_failed');
  END IF;
  
  -- Insert purchase - NEEDS CONSTRAINT
  INSERT INTO public.digital_product_purchases (order_id, product_id, user_id, price, payment_confirmed, status, confirmed_at, purchased_at)
  VALUES (p_order_id, v_order.digital_product_id, v_order.user_id, COALESCE(v_order.amount,v_order.price), true, 'confirmed', now(), now())
  ON CONFLICT (order_id, product_id) WHERE order_id IS NOT NULL  -- REQUIRES UNIQUE INDEX
  DO UPDATE SET status='confirmed', payment_confirmed=true, confirmed_at=COALESCE(digital_product_purchases.confirmed_at,now()), updated_at=now()
  WHERE digital_product_purchases.status NOT IN ('refunded','revoked')
  RETURNING id INTO v_purchase_id;
  
  IF v_purchase_id IS NULL THEN
    UPDATE public.payment_webhook_events SET processing_status='failed', error_message='grant_conflict', processed_at=now() WHERE id=p_webhook_event_id;
    RETURN jsonb_build_object('success',false,'error','grant_conflict');
  END IF;
  
  UPDATE public.payment_webhook_events SET processing_status='processed', processed_at=now() WHERE id=p_webhook_event_id;
  RETURN jsonb_build_object('success',true,'granted',true,'purchase_id',v_purchase_id);
EXCEPTION WHEN OTHERS THEN
  BEGIN UPDATE public.payment_webhook_events SET processing_status='failed', error_message=left(SQLERRM,500), processed_at=now() WHERE id=p_webhook_event_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  RAISE;
END;
;

REVOKE ALL ON FUNCTION public.grant_digital_product_purchase(BIGINT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_digital_product_purchase(BIGINT, UUID) TO service_role;
`

---

## C. REQUIRED CONSTRAINTS

`sql
-- Drop problematic unique
ALTER TABLE public.digital_product_purchases DROP CONSTRAINT IF EXISTS digital_product_purchases_product_id_user_id_key;

-- Add order-based unique
CREATE UNIQUE INDEX IF NOT EXISTS digital_product_purchases_order_product_unique ON public.digital_product_purchases(order_id, product_id) WHERE order_id IS NOT NULL;

-- Event ledger indexes as above
`

---

## UNVERIFIED FACTS

- Whether digital_product_id exists on orders
- Whether columns match exactly
- NOWPayments payload field names
- Storage bucket policies

**NOT EXECUTABLE until verified.** No implementation performed.
