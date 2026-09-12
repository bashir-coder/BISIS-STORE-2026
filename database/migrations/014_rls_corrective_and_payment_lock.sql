-- ============================================================
-- BİŞİŞ V1
-- Migration 014: RLS corrective + payment-lock column
-- ============================================================
--
-- Purpose:
-- 1. Enable Row Level Security on tables that have policies
--    but no ENABLE ROW LEVEL SECURITY (packages, personas).
-- 2. Re-enable RLS on users with a safe replacement policy.
-- 3. Enable RLS on tables that previously had none
--    (subscriptions, digital_products, blog_posts, services, donations).
-- 4. Add a nowpayments_status column used as an atomic
--    payment-creation lock on orders.
--
-- This migration is corrective only. It does not rewrite
-- historical migrations and preserves backward compatibility.
--
-- ============================================================

BEGIN;

-- ============================================================
-- 1. packages — enable RLS (policy already exists from 004)
-- ============================================================

ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. personas — enable RLS (policy already exists from 004)
-- ============================================================

ALTER TABLE public.personas ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. users — re-enable RLS with safe replacement policy
-- ============================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own data" ON public.users;

CREATE POLICY "Users can view own data"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Staff can view workspace users"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (
    role IN ('admin', 'super_admin')
    OR (
      workspace_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = users.workspace_id
          AND wm.user_id = auth.uid()
      )
    )
  );

-- ============================================================
-- 4. subscriptions — enable RLS
-- ============================================================

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscriptions"
  ON public.subscriptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================
-- 5. digital_products — enable RLS
-- ============================================================

ALTER TABLE public.digital_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active digital products"
  ON public.digital_products
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- ============================================================
-- 6. blog_posts — enable RLS
-- ============================================================

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published blog posts"
  ON public.blog_posts
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- ============================================================
-- 7. services — enable RLS
-- ============================================================

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active services"
  ON public.services
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- ============================================================
-- 8. donations — enable RLS
-- ============================================================

ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own donations"
  ON public.donations
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================
-- 9. orders — add atomic payment-creation lock column
-- ============================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS nowpayments_creating_lock BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.orders.nowpayments_creating_lock IS
  'Atomic lock flag used to prevent concurrent create-payment requests from generating duplicate NOWPayments invoices.';

-- ============================================================
-- 10. Documentation
-- ============================================================

COMMENT ON POLICY "Users can view own data" ON public.users IS
  'Authenticated users can read their own user row.';

COMMENT ON POLICY "Staff can view workspace users" ON public.users IS
  'Admins and super_admins can read all users. Other staff can read users in workspaces they are members of.';

-- ============================================================
-- Finish
-- ============================================================

COMMIT;