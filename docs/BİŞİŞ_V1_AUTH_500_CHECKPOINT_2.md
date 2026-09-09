Browser checkpoint — 2026-08-24

Independent read-only query on `auth.users` returned one non-internal trigger:

- `on_auth_user_created`
- state: `enabled`
- definition: `CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_supabase_auth_user()`
- function: `public.handle_supabase_auth_user`

No writes were performed.
