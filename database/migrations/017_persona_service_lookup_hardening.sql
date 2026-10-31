-- Add the UUID-based lookup matching users.persona_id and personas.id.
CREATE OR REPLACE FUNCTION public.get_services_by_persona(persona_id_input UUID)
RETURNS SETOF public.services
LANGUAGE SQL
STABLE
SET search_path = public
AS $function$
  SELECT s.*
  FROM public.services s
  WHERE s.is_active = true
    AND (
      s.persona_ids @> jsonb_build_array(persona_id_input::text)
      OR s.id IN (
        SELECT DISTINCT
          CASE
            WHEN o.service ~ '^[0-9]{1,19}$' THEN
              CASE
                WHEN o.service::numeric <= 9223372036854775807
                  THEN o.service::bigint
              END
          END
        FROM public.orders o
        WHERE o.user_id IN (
          SELECT u.id
          FROM public.users u
          WHERE u.persona_id = persona_id_input
        )
      )
    );
$function$;

ALTER FUNCTION public.get_services_by_persona(UUID)
  SET search_path = public;

REVOKE ALL ON FUNCTION public.get_services_by_persona(integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_services_by_persona(integer)
  TO authenticated;

REVOKE ALL ON FUNCTION public.get_services_by_persona(UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_services_by_persona(UUID)
  TO authenticated;
