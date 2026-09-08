Browser checkpoint — 2026-08-24

Read-only query for `public.users` columns with `is_nullable = 'NO'` returned exactly three rows:

| column | type | default |
|---|---|---|
| id | uuid | gen_random_uuid() |
| email | text | NULL |
| full_name | text | NULL |

The live trigger supplies `id=NEW.id`, `email=NEW.email`, and a non-null `full_name` fallback to `NEW.email`, so the observed NOT NULL requirements are structurally covered. No writes were performed.
