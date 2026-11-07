-- Digital Products Storage Contract
-- Adds storage_key column to digital_products and a purchase ledger table.
-- Does NOT modify file_url (kept for backward compatibility with existing rows).
-- Does NOT enable RLS on digital_product_purchases here; RLS is enabled
--   inline so the table is usable immediately after this migration applies.
-- No CASCADE on purchases; digital_products rows are soft-deleted via is_active.

-- ============================================================
-- 1. storage_key + file metadata on digital_products
-- ============================================================
ALTER TABLE public.digital_products
    ADD COLUMN IF NOT EXISTS storage_key TEXT;

ALTER TABLE public.digital_products
    ADD COLUMN IF NOT EXISTS file_mime_type TEXT;

ALTER TABLE public.digital_products
    ADD COLUMN IF NOT EXISTS file_size BIGINT;

-- ============================================================
-- 2. Purchase ledger
-- ============================================================
CREATE TABLE IF NOT EXISTS public.digital_product_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.digital_products(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    order_id BIGINT REFERENCES public.orders(id) ON DELETE SET NULL,
    price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    payment_confirmed BOOLEAN NOT NULL DEFAULT false,
    payment_tx_hash TEXT,
    purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    confirmed_at TIMESTAMPTZ,
    UNIQUE (product_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_dpp_user_id ON public.digital_product_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_dpp_product_id ON public.digital_product_purchases(product_id);
CREATE INDEX IF NOT EXISTS idx_dpp_order_id ON public.digital_product_purchases(order_id);
CREATE INDEX IF NOT EXISTS idx_dpp_confirmed ON public.digital_product_purchases(payment_confirmed);

ALTER TABLE public.digital_product_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own digital product purchases" ON public.digital_product_purchases;
CREATE POLICY "Users can view own digital product purchases"
    ON public.digital_product_purchases
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Staff can manage digital product purchases" ON public.digital_product_purchases;
CREATE POLICY "Staff can manage digital product purchases"
    ON public.digital_product_purchases
    FOR ALL
    TO authenticated
    USING (
        (auth.jwt()->>'role') IN ('admin', 'super_admin', 'manager')
    );

GRANT SELECT, INSERT, UPDATE ON public.digital_product_purchases TO authenticated;

-- ============================================================
-- 4. Translations — public read access for anonymous users
-- ============================================================
-- The frontend (i18n) loads translations with the anon key, so anonymous
-- frontend users must be able to SELECT from public.translations.

ALTER TABLE public.translations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view translations" ON public.translations;
CREATE POLICY "Anyone can view translations"
    ON public.translations
    FOR SELECT
    TO anon, authenticated
    USING (true);

GRANT SELECT ON public.translations TO anon, authenticated;