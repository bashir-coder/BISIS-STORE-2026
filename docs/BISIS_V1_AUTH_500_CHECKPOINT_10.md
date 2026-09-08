Browser checkpoint — 2026-08-24

Read-only session context query returned:

| Field | Value |
|---|---|
| current_user | postgres |
| session_user | postgres |
| current_database | postgres |
| current_schema | public |
| auth.users relation | auth.users |
| public.users relation resolved by to_regclass | users (schema-qualified query used for public.users) |
| auth user count | 0 |
| public user count | 0 |

This confirms the authenticated SQL Editor session is querying the intended primary database and that no Auth or profile rows currently exist. No writes were performed.
