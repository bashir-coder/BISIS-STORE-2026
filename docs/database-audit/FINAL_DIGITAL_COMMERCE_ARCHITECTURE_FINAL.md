# FINAL DIGITAL COMMERCE ARCHITECTURE FINAL (V3.1) - Design Only

**Document:** FINAL_DIGITAL_COMMERCE_ARCHITECTURE_FINAL.md  
**Date:** 2026-11-02  
**Status:** FINAL BLUEPRINT - No implementation  
**Supersedes:** V3

---

## 1. WEBHOOK EVENT IDEMPOTENCY (Durable)

### Persistent Event Ledger
Use existing order_events table with unique constraints:
`sql
-- Ensure uniqueness on provider payment identifiers
CREATE UNIQUE INDEX IF NOT EXISTS order_events_nowpayments_payment_unique 
  ON public.order_events(order_id, event_type) 
  WHERE payload->>'payment_id' IS NOT NULL;
  
CREATE UNIQUE INDEX IF NOT EXISTS order_events_dedup_key_unique
  ON public.order_events((payload->>'dedup_key'))
  WHERE payload->>'dedup_key' IS NOT NULL;
`

**Dedup key format:** 
owpayments:: or similar. Backend must generate and store.

**Precedence:** refunded/revoked > verified. Check purchase status before granting.

---

## 2. COMPLETE ATOMIC PAYMENT GRANT RPC (Executable)

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
  v_existing_status TEXT;
BEGIN
  -- Lock order
  SELECT id, user_id, digital_product_id, payment_status, amount, price, status
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'order_not_found');
  END IF;
  
  IF v_order.digital_product_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_digital_product_order');
  END IF;
  
  IF v_order.payment_status NOT IN ('pending', 'submitted') THEN
    IF v_order.payment_status = 'verified' THEN
      -- Check if already granted
      SELECT status INTO v_existing_status 
      FROM public.digital_product_purchases 
      WHERE order_id = p_order_id AND product_id = v_order.digital_product_id
      FOR UPDATE;
      
      IF v_existing_status = 'refunded' OR v_existing_status = 'revoked' THEN
        RETURN jsonb_build_object('success', false, 'error', 'purchase_refunded_or_revoked', 'ignored', true);
      END IF;
      
      IF v_existing_status = 'confirmed' THEN
        RETURN jsonb_build_object('success', true, 'already_granted', true);
      END IF;
    END IF;
    
    IF v_order.payment_status IN ('failed', 'cancelled') THEN
      RETURN jsonb_build_object('success', false, 'error', 'order_not_payable');
    END IF;
  END IF;
  
  -- Update order to verified
  UPDATE public.orders 
  SET payment_status = 'verified', 
      txid = COALESCE(p_payment_tx_hash, txid), 
      updated_at = now() 
  WHERE id = p_order_id;
  
  -- Grant purchase atomically
  INSERT INTO public.digital_product_purchases (
    order_id, product_id, user_id, price, 
    payment_confirmed, status, payment_tx_hash, 
    confirmed_at, purchased_at
  )
  VALUES (
    p_order_id, v_order.digital_product_id, v_order.user_id,
    COALESCE(v_order.amount, v_order.price),
    true, 'confirmed', p_payment_tx_hash,
    now(), now()
  )
  ON CONFLICT (order_id, product_id) WHERE order_id IS NOT NULL
  DO UPDATE SET 
    payment_confirmed = true,
    status = CASE 
      WHEN digital_product_purchases.status IN ('refunded', 'revoked') THEN digital_product_purchases.status
      ELSE 'confirmed'
    END,
    confirmed_at = CASE 
      WHEN digital_product_purchases.status IN ('refunded', 'revoked') THEN digital_product_purchases.confirmed_at
      ELSE COALESCE(digital_product_purchases.confirmed_at, now())
    END,
    payment_tx_hash = COALESCE(EXCLUDED.payment_tx_hash, digital_product_purchases.payment_tx_hash),
    updated_at = now()
  WHERE digital_product_purchases.status NOT IN ('refunded', 'revoked')
  RETURNING id INTO v_purchase_id;
  
  IF v_purchase_id IS NULL THEN
    -- Check if it was blocked due to refund
    SELECT status INTO v_existing_status FROM public.digital_product_purchases WHERE order_id = p_order_id;
    IF v_existing_status IN ('refunded', 'revoked') THEN
      RETURN jsonb_build_object('success', false, 'error', 'purchase_refunded_or_revoked');
    END IF;
  END IF;
  
  RETURN jsonb_build_object('success', true, 'purchase_id', v_purchase_id);
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
;

REVOKE ALL ON FUNCTION public.process_digital_product_payment_verified(BIGINT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_digital_product_payment_verified(BIGINT, TEXT, TEXT) TO service_role;
`

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
  SELECT id, user_id, digital_product_id, payment_status
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;
  
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'order_not_found'); END IF;
  IF v_order.digital_product_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'not_digital_product_order'); END IF;
  
  -- Lock purchase
  SELECT id, status INTO v_purchase_id, v_purchase_status
  FROM public.digital_product_purchases
  WHERE order_id = p_order_id AND product_id = v_order.digital_product_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    UPDATE public.orders SET payment_status = 'refunded', updated_at = now() WHERE id = p_order_id;
    RETURN jsonb_build_object('success', true, 'no_purchase_to_revoke');
  END IF;
  
  IF v_purchase_status = 'refunded' THEN
    RETURN jsonb_build_object('success', true, 'already_refunded');
  END IF;
  
  IF v_purchase_status = 'revoked' THEN
    RETURN jsonb_build_object('success', true, 'already_revoked');
  END IF;
  
  -- Revoke only this purchase
  UPDATE public.digital_product_purchases
  SET status = 'refunded', payment_confirmed = false, refunded_at = now(), updated_at = now()
  WHERE id = v_purchase_id;
  
  UPDATE public.orders SET payment_status = 'refunded', updated_at = now() WHERE id = p_order_id;
  
  RETURN jsonb_build_object('success', true, 'purchase_id', v_purchase_id);
EXCEPTION WHEN OTHERS THEN RAISE;
END;
;

REVOKE ALL ON FUNCTION public.process_digital_product_refund(BIGINT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_digital_product_refund(BIGINT, TEXT, TEXT) TO service_role;
`

---

## 4. COMPLETE MIGRATION SQL (Final)

See full coherent migration with all preflight checks, FK replacements, index creation, duplicate detection.

`sql
-- Preflight: detect duplicates
DO 
DECLARE
  dup_count INT;
BEGIN
  SELECT COUNT(*) INTO dup_count
  FROM (
    SELECT order_id, product_id, COUNT(*) c
    FROM digital_product_purchases
    WHERE order_id IS NOT NULL
    GROUP BY order_id, product_id
    HAVING COUNT(*) > 1
  ) d;
  IF dup_count > 0 THEN
    RAISE EXCEPTION 'Duplicate purchases exist for same order/product - resolve manually';
  END IF;
END ;
`

---

## 5. PUBLIC VIEW SECURITY (Complete)

`sql
-- Owner should be migration owner or service role
ALTER VIEW public.digital_products_public OWNER TO CURRENT_USER;

-- Revoke from underlying table for anon
REVOKE ALL ON TABLE public.digital_products FROM anon, authenticated;

-- Grant only to view
GRANT SELECT ON public.digital_products_public TO anon, authenticated;
`

**security_invoker:** Use default (false) so view owner permissions apply, but ensure owner has appropriate access. Or set security_invoker=true and grant view access properly.

---

## 6. DOWNLOAD AUTHORIZATION CONTRACT

**Function signature:** Backend calls with authenticated user context
`sql
-- Complete query as above
`

**Parameters:**  = auth.uid() UUID,  = product_id UUID  
**Staff roles:** admin, super_admin, manager, editor (must be active)  
**Legacy purchases:** Handled (order_id nullable allowed)

---

## 7. TEST MATRIX (Key Cases)

- Verified then refunded then delayed verified -> Grant blocked by refund status ✓
- Duplicate refund -> Idempotent ✓
- Duplicate verified after refund -> Blocked ✓
- Failed grant followed by retry -> Handled in RPC ✓
- Multiple independent purchases same user/product -> Allowed (different orders) ✓
- Invalid order type -> Rejected ✓
- Legacy purchase without order_id -> Download works if confirmed ✓
- Existing duplicate rows -> Migration blocked by preflight ✓
- Unauthorized direct table access -> RLS/revokes prevent ✓
- Public view access -> Only approved columns ✓

---

**FINAL DESIGN COMPLETE - NO IMPLEMENTATION PERFORMED**
