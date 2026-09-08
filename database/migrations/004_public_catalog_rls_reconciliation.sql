-- BİŞIŞ V1 public catalog and RLS reconciliation.
-- Admin writes remain protected by the backend service-role boundary.
-- This migration avoids recursive public.users policy lookups.

DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Admins can manage services" ON public.services;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'packages'
      AND policyname = 'Anyone can view active packages'
  ) THEN
    CREATE POLICY "Anyone can view active packages"
      ON public.packages
      FOR SELECT
      TO anon, authenticated
      USING (is_active = true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'personas'
      AND policyname = 'Anyone can view personas'
  ) THEN
    CREATE POLICY "Anyone can view personas"
      ON public.personas
      FOR SELECT
      TO anon, authenticated
      USING (true);
  END IF;
END
$$;
