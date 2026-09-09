Browser checkpoint — 2026-08-24

Read-only column comparison returned 15 rows.

`auth.users` contains: `id uuid NOT NULL`, `role character varying`, `email character varying`, `email_confirmed_at timestamptz`, `raw_app_meta_data jsonb`, and `raw_user_meta_data jsonb`.

No `auth.users.app_metadata` column was returned.

`public.users` contains: `id uuid NOT NULL default gen_random_uuid()`, `email text NOT NULL`, `full_name text NOT NULL`, `avatar text NULL`, `role text NULL default 'visitor'`, `auth_provider text NULL default 'email'`, `is_verified boolean NULL default false`, `is_active boolean NULL default true`, and `name text NULL`.

This is direct metadata evidence that the live function references `NEW.app_metadata`, while the live auth.users table exposes `raw_app_meta_data` and not `app_metadata`. No writes were performed.
