```sql
-- Remove Personas system.
-- Idempotent cleanup. Intended for Staging.
-- No CASCADE.

-- Drop all known overloads of get_services_by_persona.
DROP FUNCTION IF EXISTS public.get_services_by_persona(integer);
DROP FUNCTION IF EXISTS public.get_services_by_persona(uuid);

-- Remove persona-related columns.
ALTER TABLE public.users
    DROP COLUMN IF EXISTS persona_id;

ALTER TABLE public.services
    DROP COLUMN IF EXISTS persona_ids;

ALTER TABLE public.packages
    DROP COLUMN IF EXISTS persona_ids;

-- Remove the Personas table without cascading dependencies.
DROP TABLE IF EXISTS public.personas RESTRICT;
```