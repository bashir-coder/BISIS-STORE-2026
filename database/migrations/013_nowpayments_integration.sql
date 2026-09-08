-- ============================================================
-- BİŞIŞ V1
-- Migration 012: NOWPayments Integration
-- ============================================================
--
-- Purpose:
-- Add the fields required to persist NOWPayments payment/invoice
-- information directly on orders.
--
-- Manual customer-entered TXID is NOT restored.
-- The TXID may still be populated automatically from NOWPayments
-- IPN (payin_hash).
--
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Provider
-- ============================================================

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS payment_provider TEXT;

-- ============================================================
-- 2. NOWPayments identifiers
-- ============================================================

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS nowpayments_payment_id TEXT;

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS nowpayments_invoice_id TEXT;

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS nowpayments_purchase_id TEXT;

-- ============================================================
-- 3. Payment destination / checkout information
-- ============================================================

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS payment_url TEXT;

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS nowpayments_pay_address TEXT;

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS nowpayments_pay_currency TEXT;

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS nowpayments_pay_amount NUMERIC(20, 8);

-- ============================================================
-- 4. Original invoice/payment pricing
-- ============================================================

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS nowpayments_price_amount NUMERIC(12, 2);

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS nowpayments_price_currency TEXT;

-- ============================================================
-- 5. Provider status / synchronization
-- ============================================================

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS nowpayments_status TEXT;

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS nowpayments_last_ipn_at TIMESTAMPTZ;

-- ============================================================
-- 6. Constraints
-- ============================================================

ALTER TABLE public.orders
DROP CONSTRAINT IF EXISTS orders_payment_provider_check;

ALTER TABLE public.orders
ADD CONSTRAINT orders_payment_provider_check
CHECK (
  payment_provider IS NULL
  OR payment_provider IN ('nowpayments')
);

ALTER TABLE public.orders
DROP CONSTRAINT IF EXISTS orders_nowpayments_price_currency_check;

ALTER TABLE public.orders
ADD CONSTRAINT orders_nowpayments_price_currency_check
CHECK (
  nowpayments_price_currency IS NULL
  OR LOWER(nowpayments_price_currency) = 'usd'
);

ALTER TABLE public.orders
DROP CONSTRAINT IF EXISTS orders_nowpayments_pay_currency_check;

ALTER TABLE public.orders
ADD CONSTRAINT orders_nowpayments_pay_currency_check
CHECK (
  nowpayments_pay_currency IS NULL
  OR LOWER(nowpayments_pay_currency) = 'usdcbsc'
);

-- ============================================================
-- 7. Indexes
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS
  orders_nowpayments_payment_id_unique_idx
ON public.orders (nowpayments_payment_id)
WHERE nowpayments_payment_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS
  orders_nowpayments_invoice_id_unique_idx
ON public.orders (nowpayments_invoice_id)
WHERE nowpayments_invoice_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS
  orders_payment_provider_idx
ON public.orders (payment_provider);

CREATE INDEX IF NOT EXISTS
  orders_nowpayments_status_idx
ON public.orders (nowpayments_status);

CREATE INDEX IF NOT EXISTS
  orders_nowpayments_last_ipn_at_idx
ON public.orders (nowpayments_last_ipn_at);

-- ============================================================
-- 8. Existing NOWPayments orders
-- ============================================================

UPDATE public.orders
SET payment_provider = 'nowpayments'
WHERE payment_provider IS NULL
  AND payment_status IN (
    'pending',
    'submitted',
    'verified',
    'failed',
    'refunded'
  )
  AND network = 'bsc'
  AND currency = 'USDC';

-- ============================================================
-- 9. Documentation
-- ============================================================

COMMENT ON COLUMN public.orders.payment_provider IS
  'Payment provider used for this order. BİŞIŞ V1 uses NOWPayments.';

COMMENT ON COLUMN public.orders.nowpayments_payment_id IS
  'NOWPayments payment identifier.';

COMMENT ON COLUMN public.orders.nowpayments_invoice_id IS
  'NOWPayments invoice identifier.';

COMMENT ON COLUMN public.orders.nowpayments_purchase_id IS
  'NOWPayments purchase identifier.';

COMMENT ON COLUMN public.orders.payment_url IS
  'Customer checkout URL returned by NOWPayments.';

COMMENT ON COLUMN public.orders.nowpayments_pay_address IS
  'Payment address assigned by NOWPayments.';

COMMENT ON COLUMN public.orders.nowpayments_pay_currency IS
  'NOWPayments payment currency identifier, expected to be usdcbsc.';

COMMENT ON COLUMN public.orders.nowpayments_pay_amount IS
  'Amount requested by NOWPayments in the payment currency.';

COMMENT ON COLUMN public.orders.nowpayments_price_amount IS
  'Original order amount sent to NOWPayments.';

COMMENT ON COLUMN public.orders.nowpayments_price_currency IS
  'Original pricing currency sent to NOWPayments, expected to be usd.';

COMMENT ON COLUMN public.orders.nowpayments_status IS
  'Latest raw payment status received from NOWPayments.';

COMMENT ON COLUMN public.orders.nowpayments_last_ipn_at IS
  'Timestamp of the latest accepted NOWPayments IPN.';

-- ============================================================
-- Finish
-- ============================================================

COMMIT;