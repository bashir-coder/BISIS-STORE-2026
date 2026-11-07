-- Remove digital products system
-- Drops: orders.digital_product_id column, digital_product_purchases table,
-- digital_products table, and associated RLS policies/indexes.
-- Donations table is intentionally preserved.

BEGIN;

-- ============================================================
-- 1. Drop RLS policies on tables being removed
-- ============================================================

DROP POLICY IF EXISTS "Users can view own digital product purchases" ON public.digital_product_purchases;
DROP POLICY IF EXISTS "Staff can manage digital product purchases" ON public.digital_product_purchases;

DROP POLICY IF EXISTS "Anyone can view active digital products" ON public.digital_products;

-- ============================================================
-- 2. Drop indexes on digital_product_purchases
-- ============================================================

DROP INDEX IF EXISTS idx_dpp_user_id;
DROP INDEX IF EXISTS idx_dpp_product_id;
DROP INDEX IF EXISTS idx_dpp_order_id;
DROP INDEX IF EXISTS idx_dpp_confirmed;
DROP INDEX IF EXISTS digital_product_purchases_order_product_unique;

-- ============================================================
-- 3. Drop digital_product_id column from orders
-- ============================================================

ALTER TABLE public.orders DROP COLUMN IF EXISTS digital_product_id;

-- ============================================================
-- 4. Drop tables (order matters: purchases references products)
-- ============================================================

DROP TABLE IF EXISTS public.digital_product_purchases;
DROP TABLE IF EXISTS public.digital_products;

COMMIT;
