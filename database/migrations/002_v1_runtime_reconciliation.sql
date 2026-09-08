-- BİŞIŞ V1 runtime reconciliation.
-- This migration is additive/idempotent and does not use database/legacy/schema.sql.

ALTER TABLE public.faqs
  ADD COLUMN IF NOT EXISTS order_index INTEGER NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.handle_supabase_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider TEXT;
BEGIN
  -- auth.users exposes raw_app_meta_data; app_metadata is not a live auth.users column.
  IF COALESCE(NEW.raw_app_meta_data ->> 'provider', '') = 'google' THEN
    v_provider := 'google';
  ELSE
    v_provider := 'email';
  END IF;

  INSERT INTO public.users (
    id, email, name, full_name, avatar, auth_provider, role, is_verified, is_active
  )
  SELECT
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', NEW.email),
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', NEW.email),
    COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', NEW.raw_user_meta_data ->> 'picture'),
    v_provider,
    'client',
    NEW.email_confirmed_at IS NOT NULL,
    true
  WHERE NOT EXISTS (
    SELECT 1 FROM public.users WHERE id = NEW.id OR email = NEW.email
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_supabase_auth_user();
