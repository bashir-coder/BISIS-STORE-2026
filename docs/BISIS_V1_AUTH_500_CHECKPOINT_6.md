Browser checkpoint — 2026-08-24

Read-only `pg_constraint` query on `public.users` returned 8 validated constraints:

| Name | Type | Definition |
|---|---|---|
| users_auth_provider_check | CHECK | auth_provider IN ('email','google') |
| users_role_check | CHECK | role IN ('visitor','client','admin','super_admin','manager','editor') |
| users_referred_by_fkey | FK | referred_by -> users(id), ON DELETE SET NULL |
| users_workspace_id_fkey | FK | workspace_id -> workspaces(id), ON DELETE SET NULL |
| users_pkey | PK | PRIMARY KEY (id) |
| users_email_key | UNIQUE | UNIQUE (email) |
| users_referral_code_key | UNIQUE | UNIQUE (referral_code) |
| users_verification_token_key | UNIQUE | UNIQUE (verification_token) |

The role constraint is present, validated, and includes `client`; it is not a current metadata blocker. No writes were performed.
