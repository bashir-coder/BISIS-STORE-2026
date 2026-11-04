-- Local-only migration for digital products delivery flow
-- Adds storage_key and indexes if needed
ALTER TABLE public.digital_products ADD COLUMN IF NOT EXISTS storage_key TEXT;
ALTER TABLE public.digital_products ADD COLUMN IF NOT EXISTS file_mime_type TEXT;
ALTER TABLE public.digital_products ADD COLUMN IF NOT EXISTS file_size BIGINT;
CREATE INDEX IF NOT EXISTS idx_dpp_user_product_confirmed ON public.digital_product_purchases(user_id, product_id, payment_confirmed);
