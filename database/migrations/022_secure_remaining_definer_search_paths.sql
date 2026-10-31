-- Harden the remaining SECURITY DEFINER functions against search_path shadowing.
-- Their bodies use schema-qualified application objects; pg_catalog remains implicitly available.
ALTER FUNCTION public.handle_supabase_auth_user()
  SET search_path = '';

ALTER FUNCTION public.verify_payment_and_order(uuid, text, text, text, numeric, integer, text, text, text)
  SET search_path = '';
