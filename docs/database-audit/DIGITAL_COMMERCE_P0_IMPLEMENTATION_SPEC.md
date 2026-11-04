# DIGITAL COMMERCE P0 IMPLEMENTATION SPECIFICATION

**Document:** DIGITAL_COMMERCE_P0_IMPLEMENTATION_SPEC.md  
**Date:** 2026-11-04  
**Status:** SPECIFICATION ONLY - No implementation  

---

## A. WEBHOOK EVENT IDENTITY (From Evidence)

**Current payload fields (nowpayments.routes.js):** payment_id, purchase_id, order_id, payment_status, price_amount, etc.  
**External event ID:** NOT present in codebase.  
**Proposal:** Use composite fingerprint sha256(provider|order_id|payment_id|purchase_id|payment_status|updated_at_or_nonce). Store in payment_webhook_events.event_fingerprint with UNIQUE constraint.  
**Fallback:** If identifiers missing, use full payload hash (less ideal but necessary).

---

## B. ATOMIC GRANT RPC (Complete)

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
  v_purchase_id UUID;
  v_purchase_status TEXT;
BEGIN
  SELECT * INTO v_event FROM public.payment_webhook_events WHERE id = p_webhook_event_id AND processing_status = 'received' FOR UPDATE SKIP LOCKED;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','event_not_claimable'); END IF;
  
  SELECT o.id, o.user_id, o.digital_product_id, o.payment_status, o.status as order_status, o.amount, o.price
  INTO v_order FROM public.orders o WHERE o.id = p_order_id FOR UPDATE;
  IF NOT FOUND OR v_order.digital_product_id IS NULL OR v_order.user_id IS NULL THEN
    UPDATE public.payment_webhook_events SET processing_status='failed', processed_at=now() WHERE id=p_webhook_event_id;
    RETURN jsonb_build_object('success',false,'error','invalid_order');
  END IF;
  
  IF v_order.order_status IN ('cancelled','refunded') OR v_order.payment_status='refunded' THEN
    UPDATE public.payment_webhook_events SET processing_status='ignored', processed_at=now() WHERE id=p_webhook_event_id;
    RETURN jsonb_build_object('success',false,'error','terminal','ignored',true);
  END IF;
  
  SELECT status INTO v_purchase_status FROM public.digital_product_purchases WHERE order_id=p_order_id AND product_id=v_order.digital_product_id FOR UPDATE;
  IF v_purchase_status IN ('refunded','revoked') THEN
    UPDATE public.payment_webhook_events SET processing_status='ignored', processed_at=now() WHERE id=p_webhook_event_id;
    RETURN jsonb_build_object('success',false,'error','purchase_terminal','ignored',true);
  END IF;
  
  UPDATE public.orders SET payment_status='verified', updated_at=now() WHERE id=p_order_id AND payment_status IN ('pending','submitted');
  
  INSERT INTO public.digital_product_purchases (order_id, product_id, user_id, price, payment_confirmed, status, confirmed_at, purchased_at)
  VALUES (p_order_id, v_order.digital_product_id, v_order.user_id, COALESCE(v_order.amount,v_order.price), true, 'confirmed', now(), now())
  ON CONFLICT (order_id, product_id) WHERE order_id IS NOT NULL
  DO UPDATE SET status='confirmed', payment_confirmed=true, confirmed_at=COALESCE(digital_product_purchases.confirmed_at,now()), updated_at=now()
  WHERE digital_product_purchases.status NOT IN ('refunded','revoked')
  RETURNING id INTO v_purchase_id;
  
  IF v_purchase_id IS NULL THEN
    UPDATE public.payment_webhook_events SET processing_status='failed', processed_at=now() WHERE id=p_webhook_event_id;
    RETURN jsonb_build_object('success',false,'error','grant_blocked');
  END IF;
  
  UPDATE public.payment_webhook_events SET processing_status='processed', processed_at=now() WHERE id=p_webhook_event_id;
  RETURN jsonb_build_object('success',true,'purchase_id',v_purchase_id);
EXCEPTION WHEN OTHERS THEN
  BEGIN UPDATE public.payment_webhook_events SET processing_status='failed', processed_at=now() WHERE id=p_webhook_event_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  RAISE;
END;
;

REVOKE ALL ON FUNCTION public.grant_digital_product_purchase(BIGINT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_digital_product_purchase(BIGINT, UUID) TO service_role;
`

---

## C. MIGRATION SQL (Proposed)

Key changes:
- Create payment_webhook_events table with unique constraints
- Add digital_product_id to orders (if missing - needs verification)
- Modify digital_product_purchases for order_id-based uniqueness
- Create RPC
- Add indexes

**UNVERIFIED:** Whether digital_product_id exists in deployed schema.

---

## D. BACKEND INTEGRATION

**nowpayments.routes.js:** After order verified, create/check event, call RPC via service_role  
**orders.routes.js:** Add digital_product_id support if column exists  
**digital-product-grant.service.js:** Wrapper around RPC

---

## E. TESTS (Proposed)

All scenarios from requirements.

---

## EXECUTION BOUNDARIES

**P0 Staging:** Event ledger, RPC, webhook integration, order support verification  
**P1 Production:** Refunds, RLS, full testing  
**P2:** Hardening  

**Human approval required for all migrations and RPC deployment.**
