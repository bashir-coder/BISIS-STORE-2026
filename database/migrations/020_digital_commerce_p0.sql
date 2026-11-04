-- Create migration for digital commerce P0
-- Add event ledger, grant support, digital product purchases improvements
-- P0 Migration: Digital Commerce
BEGIN;

-- Create event ledger
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
  CONSTRAINT payment_webhook_events_fingerprint_unique UNIQUE (event_fingerprint)
);

CREATE INDEX IF NOT EXISTS payment_webhook_events_order_idx ON public.payment_webhook_events(order_id);
CREATE INDEX IF NOT EXISTS payment_webhook_events_status_idx ON public.payment_webhook_events(processing_status);

-- Add digital_product_id to orders if not exists
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS digital_product_id UUID;

-- Fix digital_product_purchases
ALTER TABLE public.digital_product_purchases ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE public.digital_product_purchases ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

UPDATE public.digital_product_purchases 
SET status = CASE WHEN payment_confirmed = true THEN 'confirmed' ELSE 'pending' END 
WHERE status IS NULL;

ALTER TABLE public.digital_product_purchases ALTER COLUMN status SET NOT NULL;

-- Add unique constraint for order-based purchases
CREATE UNIQUE INDEX IF NOT EXISTS digital_product_purchases_order_product_unique 
  ON public.digital_product_purchases(order_id, product_id) WHERE order_id IS NOT NULL;

COMMIT;
