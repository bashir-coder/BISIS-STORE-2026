-- BISIS production schema evidence pack — READ ONLY
--
-- Run manually, one query at a time, using an authorized database role.
-- Prefer a dedicated read-only role with catalog access. Do not use the
-- service-role key as a substitute. This file contains SELECT-only catalog
-- queries and reads only migration metadata from the runner's tracking tables.
--
-- No query reads application rows, storage object rows, secrets, or customer
-- data. The bucket query returns bucket metadata only. Skip conditional
-- queries when their prerequisite object does not exist or is not accessible.
--
-- Catalog visibility and privilege checks are limited to the executing role's
-- visibility. An empty/inaccessible result is not evidence that an object,
-- grant, policy, or storage configuration is absent.

-- 1. Database identity, PostgreSQL version, and session context.
SELECT
  current_database() AS database_name,
  current_schema() AS schema_context,
  current_user AS effective_role,
  session_user AS login_role,
  current_setting('server_version') AS server_version,
  version() AS server_build;

-- 2. Presence checks for objects used by later conditional queries.
SELECT
  object_name,
  to_regclass(qualified_name) IS NOT NULL AS is_present
FROM (VALUES
  ('storage.buckets', 'storage.buckets'),
  ('storage.objects', 'storage.objects'),
  ('public._BİŞIŞ_migrations', 'public._BİŞIŞ_migrations'),
  ('public._bisis_migration_attempts', 'public._bisis_migration_attempts')
) AS targets(object_name, qualified_name)
ORDER BY object_name;

-- 3. Non-system schemas and effective access for the current role.
SELECT
  n.nspname AS schema_name,
  pg_get_userbyid(n.nspowner) AS owner,
  has_schema_privilege(current_user, n.oid, 'USAGE') AS current_role_has_usage,
  has_schema_privilege(current_user, n.oid, 'CREATE') AS current_role_has_create
FROM pg_namespace AS n
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
  AND n.nspname NOT LIKE 'pg_toast%'
ORDER BY n.nspname;

-- 4. Installed extension metadata; no extension code or configuration is read.
SELECT
  e.extname AS extension_name,
  e.extversion AS installed_version,
  n.nspname AS schema_name,
  pg_get_userbyid(e.extowner) AS owner
FROM pg_extension AS e
JOIN pg_namespace AS n ON n.oid = e.extnamespace
ORDER BY e.extname;

-- 5. Relations in application and Storage schemas, including RLS status.
SELECT
  n.nspname AS schema_name,
  c.relname AS relation_name,
  CASE c.relkind
    WHEN 'r' THEN 'table'
    WHEN 'p' THEN 'partitioned table'
    WHEN 'v' THEN 'view'
    WHEN 'm' THEN 'materialized view'
    WHEN 'f' THEN 'foreign table'
    WHEN 'S' THEN 'sequence'
    ELSE c.relkind::text
  END AS relation_type,
  pg_get_userbyid(c.relowner) AS owner,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced,
  c.relpersistence AS persistence,
  c.reloptions AS relation_options
FROM pg_class AS c
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname IN ('public', 'storage')
  AND c.relkind IN ('r', 'p', 'v', 'm', 'f', 'S')
ORDER BY n.nspname, c.relname;

-- 6. Column metadata only; no table rows are read.
SELECT
  c.table_schema,
  c.table_name,
  c.ordinal_position,
  c.column_name,
  c.data_type,
  c.udt_schema,
  c.udt_name,
  c.is_nullable,
  (c.column_default IS NOT NULL) AS has_default,
  c.is_identity,
  c.identity_generation,
  c.is_generated
FROM information_schema.columns AS c
WHERE c.table_schema IN ('public', 'storage')
ORDER BY c.table_schema, c.table_name, c.ordinal_position;

-- 7. Primary, unique, foreign-key, check, and exclusion constraints.
SELECT
  n.nspname AS schema_name,
  t.relname AS table_name,
  con.conname AS constraint_name,
  CASE con.contype
    WHEN 'p' THEN 'primary key'
    WHEN 'u' THEN 'unique'
    WHEN 'f' THEN 'foreign key'
    WHEN 'c' THEN 'check'
    WHEN 'x' THEN 'exclusion'
    ELSE con.contype::text
  END AS constraint_type,
  con.convalidated AS validated,
  con.condeferrable AS is_deferrable,
  con.condeferred AS is_initially_deferred,
  pg_get_constraintdef(con.oid, true) AS definition
FROM pg_constraint AS con
JOIN pg_class AS t ON t.oid = con.conrelid
JOIN pg_namespace AS n ON n.oid = t.relnamespace
WHERE n.nspname IN ('public', 'storage')
ORDER BY n.nspname, t.relname, con.conname;

-- 8. Index definitions and health flags, including indexes on foreign keys.
SELECT
  n.nspname AS schema_name,
  t.relname AS table_name,
  i.relname AS index_name,
  ix.indisprimary AS is_primary,
  ix.indisunique AS is_unique,
  ix.indisvalid AS is_valid,
  ix.indisready AS is_ready,
  ix.indnullsnotdistinct AS nulls_not_distinct,
  pg_get_indexdef(i.oid) AS definition
FROM pg_index AS ix
JOIN pg_class AS t ON t.oid = ix.indrelid
JOIN pg_class AS i ON i.oid = ix.indexrelid
JOIN pg_namespace AS n ON n.oid = t.relnamespace
WHERE n.nspname IN ('public', 'storage')
ORDER BY n.nspname, t.relname, i.relname;

-- 9. RLS policies and expressions. Role OID 0 denotes PUBLIC.
SELECT
  n.nspname AS schema_name,
  t.relname AS table_name,
  p.polname AS policy_name,
  CASE p.polcmd
    WHEN 'r' THEN 'SELECT'
    WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE'
    WHEN 'd' THEN 'DELETE'
    WHEN '*' THEN 'ALL'
    ELSE p.polcmd::text
  END AS command,
  ARRAY(
    SELECT CASE
      WHEN target.role_oid = 0 THEN 'PUBLIC'
      ELSE pg_get_userbyid(target.role_oid)
    END
    FROM unnest(p.polroles) AS target(role_oid)
  ) AS target_roles,
  p.polpermissive AS permissive,
  pg_get_expr(p.polqual, p.polrelid, true) AS using_expression,
  pg_get_expr(p.polwithcheck, p.polrelid, true) AS with_check_expression
FROM pg_policy AS p
JOIN pg_class AS t ON t.oid = p.polrelid
JOIN pg_namespace AS n ON n.oid = t.relnamespace
WHERE n.nspname IN ('public', 'storage')
ORDER BY n.nspname, t.relname, p.polname;

-- 10. Schema ACL entries, including explicit PUBLIC entries (grantee OID 0).
SELECT
  n.nspname AS schema_name,
  CASE WHEN acl.grantee = 0 THEN 'PUBLIC'
       ELSE pg_get_userbyid(acl.grantee)
  END AS grantee,
  pg_get_userbyid(acl.grantor) AS grantor,
  acl.privilege_type AS privilege,
  acl.is_grantable
FROM pg_namespace AS n
CROSS JOIN LATERAL aclexplode(
  COALESCE(n.nspacl, acldefault('n', n.nspowner))
) AS acl
WHERE n.nspname IN ('public', 'storage')
ORDER BY n.nspname, grantee, privilege;

-- 11. Table/view/sequence ACL entries. Effective role checks are separate
-- because RLS and ownership must be considered in addition to table grants.
SELECT
  n.nspname AS schema_name,
  c.relname AS object_name,
  CASE c.relkind WHEN 'S' THEN 'sequence' ELSE 'relation' END AS object_type,
  CASE WHEN acl.grantee = 0 THEN 'PUBLIC'
       ELSE pg_get_userbyid(acl.grantee)
  END AS grantee,
  pg_get_userbyid(acl.grantor) AS grantor,
  acl.privilege_type AS privilege,
  acl.is_grantable
FROM pg_class AS c
JOIN pg_namespace AS n ON n.oid = c.relnamespace
CROSS JOIN LATERAL aclexplode(
  COALESCE(
    c.relacl,
    CASE
      WHEN c.relkind = 'S' THEN acldefault('S', c.relowner)
      ELSE acldefault('r', c.relowner)
    END
  )
) AS acl
WHERE n.nspname IN ('public', 'storage')
  AND c.relkind IN ('r', 'p', 'v', 'm', 'f', 'S')
ORDER BY n.nspname, c.relname, grantee, privilege;

-- 12. Effective table privileges for conventional Supabase roles that exist.
-- These checks do not model row visibility; inspect RLS policies separately.
SELECT
  n.nspname AS schema_name,
  c.relname AS object_name,
  r.rolname AS role_name,
  pr.privilege_name,
  has_table_privilege(r.oid, c.oid, pr.privilege_name) AS effective
FROM pg_class AS c
JOIN pg_namespace AS n ON n.oid = c.relnamespace
CROSS JOIN pg_roles AS r
CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER'))
  AS pr(privilege_name)
WHERE n.nspname IN ('public', 'storage')
  AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
  AND r.rolname IN ('anon', 'authenticated', 'service_role')
ORDER BY n.nspname, c.relname, r.rolname, pr.privilege_name;

-- 13. Explicit column-level ACL entries. No column values are read.
SELECT
  n.nspname AS schema_name,
  c.relname AS table_name,
  a.attname AS column_name,
  CASE WHEN acl.grantee = 0 THEN 'PUBLIC'
       ELSE pg_get_userbyid(acl.grantee)
  END AS grantee,
  pg_get_userbyid(acl.grantor) AS grantor,
  acl.privilege_type AS privilege,
  acl.is_grantable
FROM pg_attribute AS a
JOIN pg_class AS c ON c.oid = a.attrelid
JOIN pg_namespace AS n ON n.oid = c.relnamespace
CROSS JOIN LATERAL aclexplode(a.attacl) AS acl
WHERE n.nspname IN ('public', 'storage')
  AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
  AND a.attnum > 0
  AND NOT a.attisdropped
  AND a.attacl IS NOT NULL
ORDER BY n.nspname, c.relname, a.attnum, grantee, privilege;

-- 14. Effective column privileges for conventional Supabase roles that exist.
SELECT
  n.nspname AS schema_name,
  c.relname AS table_name,
  a.attname AS column_name,
  r.rolname AS role_name,
  pr.privilege_name,
  has_column_privilege(
    r.oid,
    c.oid,
    a.attnum,
    pr.privilege_name
  ) AS effective
FROM pg_attribute AS a
JOIN pg_class AS c ON c.oid = a.attrelid
JOIN pg_namespace AS n ON n.oid = c.relnamespace
CROSS JOIN pg_roles AS r
CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('REFERENCES'))
  AS pr(privilege_name)
WHERE n.nspname IN ('public', 'storage')
  AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
  AND a.attnum > 0
  AND NOT a.attisdropped
  AND r.rolname IN ('anon', 'authenticated', 'service_role')
ORDER BY n.nspname, c.relname, a.attnum, r.rolname, pr.privilege_name;

-- 15. Sequence ACL entries are included in query 11. This query checks
-- effective sequence privileges for existing conventional Supabase roles.
SELECT
  n.nspname AS schema_name,
  s.relname AS sequence_name,
  r.rolname AS role_name,
  pr.privilege_name,
  has_sequence_privilege(r.oid, s.oid, pr.privilege_name) AS effective
FROM pg_class AS s
JOIN pg_namespace AS n ON n.oid = s.relnamespace
CROSS JOIN pg_roles AS r
CROSS JOIN (VALUES ('USAGE'), ('SELECT'), ('UPDATE')) AS pr(privilege_name)
WHERE n.nspname IN ('public', 'storage')
  AND s.relkind = 'S'
  AND r.rolname IN ('anon', 'authenticated', 'service_role')
ORDER BY n.nspname, s.relname, r.rolname, pr.privilege_name;

-- 16. Role attributes relevant to bypass-RLS and privileged audit interpretation.
-- This intentionally excludes password/authentication fields.
SELECT
  rolname AS role_name,
  rolsuper AS is_superuser,
  rolbypassrls AS bypasses_rls,
  rolcreaterole AS can_create_roles,
  rolcreatedb AS can_create_databases,
  rolreplication AS can_replicate,
  rolcanlogin AS can_login
FROM pg_roles
WHERE rolname IN ('anon', 'authenticated', 'service_role')
ORDER BY rolname;

-- 17. Function security metadata and effective execute rights.
-- Function bodies are deliberately omitted to avoid returning embedded literals.
SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS identity_arguments,
  pg_get_function_result(p.oid) AS result_type,
  p.prosecdef AS security_definer,
  pg_get_userbyid(p.proowner) AS owner,
  (
    SELECT config.setting
    FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS config(setting)
    WHERE config.setting LIKE 'search_path=%'
    LIMIT 1
  ) AS search_path_setting,
  r.rolname AS checked_role,
  has_function_privilege(r.oid, p.oid, 'EXECUTE') AS can_execute
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
CROSS JOIN pg_roles AS r
WHERE n.nspname IN ('public', 'storage')
  AND r.rolname IN ('anon', 'authenticated', 'service_role')
ORDER BY n.nspname, p.proname, identity_arguments, r.rolname;

-- 18. Function ACL entries, including PUBLIC. Compare with query 17's
-- effective role checks; inherited role membership can affect effective access.
SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS identity_arguments,
  p.prosecdef AS security_definer,
  pg_get_userbyid(p.proowner) AS owner,
  (
    SELECT config.setting
    FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS config(setting)
    WHERE config.setting LIKE 'search_path=%'
    LIMIT 1
  ) AS search_path_setting,
  CASE WHEN acl.grantee = 0 THEN 'PUBLIC'
       ELSE pg_get_userbyid(acl.grantee)
  END AS grantee,
  pg_get_userbyid(acl.grantor) AS grantor,
  acl.privilege_type AS privilege,
  acl.is_grantable
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
CROSS JOIN LATERAL aclexplode(
  COALESCE(p.proacl, acldefault('f', p.proowner))
) AS acl
WHERE n.nspname IN ('public', 'storage')
ORDER BY n.nspname, p.proname, identity_arguments, grantee;

-- 19. Non-internal triggers and their trigger function identities.
SELECT
  n.nspname AS schema_name,
  t.relname AS table_name,
  tr.tgname AS trigger_name,
  tr.tgenabled AS enabled_state,
  pg_get_triggerdef(tr.oid, true) AS trigger_definition,
  fn_ns.nspname AS function_schema,
  fn.proname AS function_name,
  pg_get_function_identity_arguments(fn.oid) AS function_arguments,
  fn.prosecdef AS function_is_security_definer,
  (
    SELECT config.setting
    FROM unnest(COALESCE(fn.proconfig, ARRAY[]::text[])) AS config(setting)
    WHERE config.setting LIKE 'search_path=%'
    LIMIT 1
  ) AS function_search_path
FROM pg_trigger AS tr
JOIN pg_class AS t ON t.oid = tr.tgrelid
JOIN pg_namespace AS n ON n.oid = t.relnamespace
JOIN pg_proc AS fn ON fn.oid = tr.tgfoid
JOIN pg_namespace AS fn_ns ON fn_ns.oid = fn.pronamespace
WHERE n.nspname IN ('public', 'storage')
  AND NOT tr.tgisinternal
ORDER BY n.nspname, t.relname, tr.tgname;

-- 20. Targeted presence check for known application relations and functions.
SELECT
  n.nspname AS schema_name,
  c.relname AS object_name,
  'relation' AS object_type
FROM pg_class AS c
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE (n.nspname = 'public' AND c.relname IN (
  'users', 'orders', 'payments', 'projects', 'workspace_members',
  'faqs', 'portfolio', 'translations', 'persona_content',
  'bisis_ai_os_task_dedup', 'table_name'
))
UNION ALL
SELECT
  n.nspname,
  p.proname,
  'function'
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
WHERE p.proname = 'bisis_claim_task'
ORDER BY schema_name, object_type, object_name;

-- 21. Storage bucket metadata only. Run only if storage.buckets exists and is
-- accessible. Do not query storage.objects rows or object names.
SELECT
  id,
  name,
  public AS is_public,
  file_size_limit,
  allowed_mime_types,
  created_at,
  updated_at
FROM storage.buckets
ORDER BY name;

-- 22. Migration tracker metadata. Run only if public._BİŞIŞ_migrations exists.
-- This contains migration bookkeeping, not application/customer records.
SELECT
  id,
  filename,
  applied_at
FROM public._BİŞIŞ_migrations
ORDER BY filename;

-- 23. Migration attempt journal metadata. Run only if
-- public._bisis_migration_attempts exists.
SELECT
  filename,
  status,
  statement_index,
  checksum,
  updated_at
FROM public._bisis_migration_attempts
ORDER BY filename;

-- 24. Tracker/journal consistency, including journal-only entries. Run only
-- if both tracking tables exist.
SELECT
  COALESCE(tracker.filename, attempt.filename) AS filename,
  tracker.applied_at,
  attempt.status AS journal_status,
  attempt.checksum,
  attempt.updated_at AS journal_updated_at,
  CASE
    WHEN tracker.filename IS NULL THEN 'JOURNAL_ONLY'
    WHEN attempt.filename IS NULL THEN 'TRACKER_ONLY — checksum unverifiable'
    WHEN attempt.status <> 'applied' THEN 'STATUS_MISMATCH'
    WHEN attempt.checksum IS NULL THEN 'APPLIED — checksum unverifiable'
    ELSE 'APPLIED — checksum recorded'
  END AS reconciliation_status
FROM public._BİŞIŞ_migrations AS tracker
FULL OUTER JOIN public._bisis_migration_attempts AS attempt
  ON attempt.filename = tracker.filename
ORDER BY COALESCE(tracker.filename, attempt.filename);

-- 25. Compare the live ledger to the local canonical migration filenames.
-- This constant list must be kept in sync with the repository canonical chain.
-- Run only if both tracking tables exist. It detects missing canonical ledger
-- rows, unknown tracker/journal names, and incomplete status/checksum records.
WITH canonical_migrations(filename) AS (
  VALUES
    ('001_launch_contract.sql'),
    ('002_v1_runtime_reconciliation.sql'),
    ('003_services_metadata_reconciliation.sql'),
    ('004_public_catalog_rls_reconciliation.sql'),
    ('005_execution_engine.sql'),
    ('006_service_delivery_engine.sql'),
    ('007_execution_client_isolation_hotfix.sql'),
    ('008_project_aware_tickets.sql'),
    ('009_tickets_policy_isolation_hotfix.sql'),
    ('010_production_security_hardening.sql'),
    ('011_performance_foreign_key_indexes.sql'),
    ('012_official_v1_catalog.sql'),
    ('013_nowpayments_integration.sql'),
    ('014_rls_corrective_and_payment_lock.sql'),
    ('015_rls_recursion_fix.sql'),
    ('016_blog_post_slug_contract.sql'),
    ('017_persona_service_lookup_hardening.sql'),
    ('018_remove_personas_system.sql'),
    ('019_users_staff_policy_authoritative_role.sql'),
    ('020_rls_initplan_and_public_content_read.sql')
),
live_names AS (
  SELECT filename FROM public._BİŞIŞ_migrations
  UNION
  SELECT filename FROM public._bisis_migration_attempts
)
SELECT
  COALESCE(canonical.filename, live_names.filename) AS filename,
  tracker.applied_at,
  attempt.status AS journal_status,
  attempt.statement_index,
  attempt.checksum,
  attempt.updated_at AS journal_updated_at,
  CASE
    WHEN canonical.filename IS NULL THEN 'NON_CANONICAL_LIVE_ENTRY'
    WHEN tracker.filename IS NULL THEN 'CANONICAL_NOT_RECORDED_APPLIED'
    WHEN attempt.filename IS NULL THEN 'TRACKER_ONLY — checksum unverifiable'
    WHEN attempt.status <> 'applied' THEN 'STATUS_MISMATCH'
    WHEN attempt.checksum IS NULL THEN 'APPLIED — checksum unverifiable'
    ELSE 'APPLIED — checksum recorded; compare checksum to local inventory'
  END AS reconciliation_status
FROM canonical_migrations AS canonical
FULL OUTER JOIN live_names
  ON live_names.filename = canonical.filename
LEFT JOIN public._BİŞIŞ_migrations AS tracker
  ON tracker.filename = COALESCE(canonical.filename, live_names.filename)
LEFT JOIN public._bisis_migration_attempts AS attempt
  ON attempt.filename = COALESCE(canonical.filename, live_names.filename)
ORDER BY COALESCE(canonical.filename, live_names.filename);
