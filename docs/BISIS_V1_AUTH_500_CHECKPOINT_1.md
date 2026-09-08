Browser checkpoint — 2026-08-24

The read-only query targeting non-internal triggers on `auth.users` is visible in SQL Editor:

`SELECT t.tgname, trigger_state, pg_get_triggerdef(t.oid), function_name FROM pg_trigger ... WHERE c.oid = 'auth.users'::regclass AND NOT t.tgisinternal ORDER BY t.tgname;`

The result panel still shows the previous 4-row `public.users` RLS policy result. The auth.users trigger query has not been independently executed yet. No writes were performed.
