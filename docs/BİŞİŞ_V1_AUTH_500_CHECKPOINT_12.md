Browser checkpoint — 2026-08-24

Read-only trigger dependency query returned one row:

- trigger: `on_auth_user_created`
- enabled code: `O` (enabled)
- definition: `CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_supabase_auth_user()`
- trigger function: `handle_supabase_auth_user()`
- `security_definer`: true
- function_config: not shown in the extracted row
- no additional pg_depend row was shown by the left join

No writes were performed.
