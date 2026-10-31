-- SDACK V1 — Production security hardening
-- Additive/non-destructive hardening only. Do not modify historical migrations.
-- Safe to run after migrations 001–009.

-- public.table_name is not part of the SDACK V1 runtime contract. If it exists
-- in an environment, fail closed without deleting any rows or the table itself.
DO $$
BEGIN
  IF to_regclass('public.table_name') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.table_name ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON TABLE public.table_name FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.table_name TO service_role';
  END IF;
END
$$;

-- RLS policies call the execution helpers as authenticated users. Keep that
-- privilege, but remove direct anonymous RPC access.
REVOKE ALL ON FUNCTION public.execution_role() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.execution_is_staff() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.execution_can_access_project(BIGINT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.execution_client_can_access_project(BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.execution_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.execution_is_staff() TO authenticated;
GRANT EXECUTE ON FUNCTION public.execution_can_access_project(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.execution_client_can_access_project(BIGINT) TO authenticated;

-- Auth provisioning is trigger-only; payment verification is server-only.
REVOKE ALL ON FUNCTION public.handle_supabase_auth_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.verify_payment_and_order(UUID, TEXT, TEXT, TEXT, NUMERIC, INTEGER, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_payment_and_order(UUID, TEXT, TEXT, TEXT, NUMERIC, INTEGER, TEXT, TEXT, TEXT) TO service_role;

-- Ensure functions exist before hardening their search_path.
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_services_by_persona(persona_id_input integer)
RETURNS SETOF services
LANGUAGE sql
SET search_path TO 'public'
AS $function$
    SELECT s.*
    FROM services s
    WHERE s.persona_ids @> jsonb_build_array(persona_id_input)
    OR s.id IN (
        SELECT DISTINCT
          CASE
            WHEN orders.service ~ '^[0-9]{1,19}$' THEN
              CASE
                WHEN orders.service::numeric <= 9223372036854775807
                  THEN orders.service::bigint
              END
          END
        FROM orders
        WHERE orders.service IS NOT NULL
          AND orders.user_id IN (
              SELECT id FROM users
              WHERE persona_id::text = persona_id_input::text
          )
    );
$function$;

-- Remove mutable search_path warnings for existing non-definer functions.
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
ALTER FUNCTION public.get_services_by_persona(integer) SET search_path = public;

NOTIFY pgrst, 'reload schema';
