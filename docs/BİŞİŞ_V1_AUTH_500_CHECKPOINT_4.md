Browser checkpoint — 2026-08-24

Live PostgreSQL definition of `public.handle_supabase_auth_user()` returned one row:

`CREATE OR REPLACE FUNCTION public.handle_supabase_auth_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$ ...`

Observed body behavior:

- Reads provider from `NEW.raw_app_meta_data ->> 'provider'`, fallback `NEW.app_metadata ->> 'provider'`.
- Normalizes provider to `google` or `email`.
- Inserts into `public.users` with `id=NEW.id`, `email=NEW.email`, name/full_name from raw user metadata or email, avatar from avatar_url/picture, `auth_provider=v_provider`, `role='client'`, `is_verified=(NEW.email_confirmed_at IS NOT NULL)`, `is_active=true`.
- Guard: `WHERE NOT EXISTS (SELECT 1 FROM public.users WHERE id = NEW.id OR email = NEW.email)`.
- Returns `NEW`.

No writes were performed.
