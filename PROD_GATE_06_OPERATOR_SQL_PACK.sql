-- ============================================================================
-- PROD-GATE-06 — Authorized Operator SQL Pack (Read-Only)
-- BİŞIŞ V1 — Supabase / PostgreSQL Catalog Evidence Collection
--
-- PURPOSE: Collect read-only catalog evidence needed to reconcile the
--          repository migration inventory (database/migrations/001–015)
--          against the live Supabase database state.
--
-- CONSTRAINTS:
--   - Read-only queries only. No INSERT/UPDATE/DELETE/DDL.
--   - Do not invoke exec_sql or any RPC that executes arbitrary SQL.
--   - Do not create, replace, or test-write any function or object.
--   - Do not print or request credentials, secrets, or connection strings.
--   - Safe to run against production; assumes a read-only database role.
--   - Order matters: later stages assume objects verified in earlier stages.
--
-- USAGE: An authorized operator executes these queries manually, one stage
--        at a time, and records results in the result template below.
-- ============================================================================

-- ============================================================================
-- STAGE 1 — Catalog existence checks (safe first queries, no assumptions)
-- ============================================================================

-- 1.1 List all schemas in the database (confirms what is accessible)
-- Purpose: Establish which schemas exist, especially 'public' and 'storage'.
-- Required access: Ability to read information_schema.schemata (standard for any connected role).
-- Expected output: One row per schema with schema_name and owner.
-- Can prove: Which schemas are present in the live catalog.
-- Cannot prove: Whether objects within a schema are accessible to the caller.
-- Prerequisite: None.
SELECT
  schema_name,
  schema_owner
FROM information_schema.schemata
WHERE schema_name NOT IN ('pg_catalog', 'information_schema')
ORDER BY schema_name;

-- 1.2 Confirm the public schema exists and is accessible
-- Purpose: Confirm 'public' schema is present before querying public objects.
-- Required access: Same as 1.1.
-- Expected output: One row with schema_name = 'public'.
-- Can prove: 'public' schema exists.
-- Cannot prove: Table/function access within public.
-- Prerequisite: 1.1.
SELECT
  schema_name,
  schema_owner
FROM information_schema.schemata
WHERE schema_name = 'public';

-- 1.3 Confirm the storage schema exists (before querying storage.buckets)
-- Purpose: Confirm 'storage' schema exists before attempting bucket metadata.
-- Required access: Same as 1.1.
-- Expected output: One row if storage schema exists, zero rows if not.
-- Can prove: Whether Supabase Storage schema is present.
-- Cannot prove: Bucket contents or policies.
-- Prerequisite: 1.1.
SELECT
  schema_name,
  schema_owner
FROM information_schema.schemata
WHERE schema_name = 'storage';

-- ============================================================================
-- STAGE 2 — Migration-history tracker inspection (conditional on existence)
-- ============================================================================

-- 2.1 Check whether the tracker table exists (existence check only, no row read)
-- Purpose: Confirm _SDACK_migrations exists before attempting to read it.
-- Required access: ability to read information_schema.tables.
-- Expected output: One row (table exists) or zero rows (absent).
-- Can prove: Whether the runner's tracker table exists in the live catalog.
-- Cannot prove: Which migrations are recorded as applied.
-- Prerequisite: 1.2.
SELECT
  table_schema,
  table_name,
  table_type
FROM information_schema.tables
WHERE table_name = (
    SELECT relname
    FROM pg_class
    WHERE oid = to_regclass(U&'public._B\0130\015E\0130\015E_migrations')
  )
  AND table_schema = 'public';

-- 2.2 Inspect tracker table schema (column names, types, nullability)
-- Purpose: Confirm tracker table columns match runner expectations
--         (id SERIAL PK, filename TEXT UNIQUE, applied_at TIMESTAMPTZ).
-- Required access: ability to read information_schema.columns.
-- Expected output: One row per column.
-- Can prove: Whether tracker schema is compatible with runner.
-- Cannot prove: Row contents.
-- Prerequisite: 2.1 returned at least one row.
SELECT
  column_name,
  data_type,
  is_nullable,
  (column_default IS NOT NULL) AS has_default,
  ordinal_position
FROM information_schema.columns
WHERE table_name = (
    SELECT relname
    FROM pg_class
    WHERE oid = to_regclass(U&'public._B\0130\015E\0130\015E_migrations')
  )
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2.3 Read recorded migration filenames from tracker (only if 2.1 succeeded)
-- Purpose: List all filenames recorded as applied migrations.
-- Required access: SELECT on public._SDACK_migrations.
-- Expected output: One row per recorded migration filename.
-- Can prove: Which migration filenames the tracker believes are applied.
-- Cannot prove: Whether the migration's SQL actually took effect (only that it was recorded).
-- Prerequisite: 2.1 returned at least one row; caller has SELECT on the table.
SELECT
  id,
  filename,
  applied_at
FROM public._SDACK_migrations
ORDER BY filename;

-- ============================================================================
-- STAGE 3 — exec_sql function inspection (read-only catalog, no invocation)
-- ============================================================================

-- 3.1 Check whether public.exec_sql exists and report its identity
-- Purpose: Determine if the function the runner depends on exists.
-- Required access: ability to read pg_proc and pg_namespace.
-- Expected output: One row if exec_sql exists, zero rows if absent.
-- Can prove: Whether exec_sql exists in the live catalog.
-- Cannot prove: Runtime behavior (do not invoke the function).
-- Prerequisite: 1.2.
SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS argument_types,
  pg_get_function_result(p.oid) AS return_type,
  p.prolang::reglanguage AS language,
  p.prosecdef AS is_security_definer,
  p.proconfig AS search_path_config,
  pg_get_userbyid(p.proowner) AS owner,
  p.proacl AS explicit_acl
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'exec_sql';

-- 3.2 Effective execute privileges on exec_sql (if it exists)
-- PUBLIC is reported from the function ACL (including default ACLs), not as
-- a role name. Role checks use the role OID and function OID overload.
-- Prerequisite: 3.1 returned at least one row.
WITH target_functions AS (
  SELECT p.oid, p.proacl, p.proowner,
         pg_get_function_identity_arguments(p.oid) AS identity_arguments
  FROM pg_proc AS p
  JOIN pg_namespace AS n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'exec_sql'
)
SELECT
  'public.exec_sql(' || target.identity_arguments || ')' AS function_identity,
  roles.role_name,
  CASE
    WHEN roles.role_name = 'PUBLIC' THEN EXISTS (
      SELECT 1
      FROM aclexplode(
        COALESCE(target.proacl, acldefault('f', target.proowner))
      ) AS acl
      WHERE acl.grantee = 0
        AND acl.privilege_type = 'EXECUTE'
    )
    ELSE has_function_privilege(roles.role_oid, target.oid, 'EXECUTE')
  END AS can_execute
FROM target_functions AS target
CROSS JOIN (
  SELECT 'PUBLIC'::text AS role_name, NULL::oid AS role_oid
  UNION ALL
  SELECT rolname, oid FROM pg_roles
  WHERE rolname IN ('anon', 'authenticated', 'service_role')
) AS roles
ORDER BY function_identity, roles.role_name;

-- 3.3 Decode effective ACL entries for exec_sql, including defaults.
-- PUBLIC is identified by grantee OID 0; role OIDs are rendered as names.
SELECT
  'public.exec_sql(' || pg_get_function_identity_arguments(p.oid) || ')' AS function_identity,
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
WHERE n.nspname = 'public'
  AND p.proname = 'exec_sql'
ORDER BY function_identity, grantee, privilege;

-- ============================================================================
-- STAGE 4 — RLS status and table grants for migration-sensitive tables
-- ============================================================================

-- 4.1 RLS enabled/forced flags on migration-sensitive tables
-- Purpose: Confirm RLS state on tables touched by migrations 001–015.
-- Required access: ability to read pg_class and pg_namespace.
-- Expected output: One row per table.
-- Can prove: Whether RLS is enabled (relrowsecurity) and forced (relforcerowsecurity).
-- Cannot prove: Whether policies are correct or enforced at runtime.
-- Prerequisite: 1.2.
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced,
  pg_get_userbyid(c.relowner) AS table_owner
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN (
    'users','workspaces','workspace_members','orders','projects',
    'conversations','messages','tickets','order_files','payments',
    'invoices','subscriptions','digital_products','blog_posts',
    'services','donations','packages','personas',
    'project_templates','project_template_milestones','project_template_tasks',
    'project_milestones','project_tasks','project_activity',
    'project_requirements','project_deliveries'
  )
ORDER BY c.relname;

-- 4.2 Table-level grants for migration-sensitive tables
-- Purpose: Confirm which roles have table privileges (SELECT/INSERT/UPDATE/DELETE).
-- Required access: ability to read information_schema.table_privileges.
-- Expected output: One row per (table, grantee, privilege_type).
-- Can prove: Explicit table grants.
-- Cannot prove: Effective access when RLS policies intervene.
-- Prerequisite: 1.2.
SELECT
  table_name,
  grantee AS role_name,
  privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name IN (
    'users','workspaces','workspace_members','orders','projects',
    'conversations','messages','tickets','order_files','payments',
    'invoices','subscriptions','digital_products','blog_posts',
    'services','donations','packages','personas',
    'project_templates','project_template_milestones','project_template_tasks',
    'project_milestones','project_tasks','project_activity',
    'project_requirements','project_deliveries'
  )
ORDER BY table_name, grantee, privilege_type;

-- 4.3 RLS policies on migration-sensitive tables
-- Purpose: Inspect policy definitions for correctness and breadth.
-- Required access: ability to read pg_policy.
-- Expected output: One row per policy.
-- Can prove: Policy names, commands, and using/with-check conditions.
-- Cannot prove: Runtime enforcement behavior.
-- Prerequisite: 1.2.
SELECT
  polrelid::regclass AS table_name,
  polname AS policy_name,
  CASE polcmd
    WHEN 'r' THEN 'SELECT'
    WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE'
    WHEN 'd' THEN 'DELETE'
    WHEN '*' THEN 'ALL'
    ELSE polcmd::text
  END AS command,
  pg_get_expr(polqual, polrelid) AS using_condition,
  pg_get_expr(polwithcheck, polrelid) AS with_check_condition
FROM pg_policy
JOIN pg_class ON pg_class.oid = pg_policy.polrelid
JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
WHERE pg_namespace.nspname = 'public'
ORDER BY table_name, policy_name;

-- ============================================================================
-- STAGE 5 — Migration-sensitive columns, constraints, and triggers
-- ============================================================================

-- 5.1 orders table: nowpayments_creating_lock column definition
-- Purpose: Confirm migration 014's lock column exists with expected metadata.
-- Required access: ability to read information_schema.columns.
-- Expected output: One row if column exists, zero if absent.
-- Can prove: Column presence, type, nullability, and whether a default exists.
-- Cannot prove: Whether migration 014 was fully applied (only this column).
-- Prerequisite: 1.2.
SELECT
  column_name,
  data_type,
  is_nullable,
  (column_default IS NOT NULL) AS has_default,
  ordinal_position
FROM information_schema.columns
WHERE table_name = 'orders'
  AND column_name = 'nowpayments_creating_lock';

-- 5.2 orders table: NOWPayments provider columns
-- Purpose: Confirm migration 013's payment fields exist.
-- Required access: ability to read information_schema.columns.
-- Expected output: One row per matching column.
-- Can prove: Column presence for NOWPayments fields.
-- Cannot prove: Whether migration 013 backfill or constraints were applied.
-- Prerequisite: 1.2.
-- NOTE: The OR condition is grouped so it cannot escape the table filter.
SELECT
  column_name,
  data_type,
  is_nullable,
  (column_default IS NOT NULL) AS has_default,
  ordinal_position
FROM information_schema.columns
WHERE table_name = 'orders'
  AND (
    column_name LIKE 'nowpayments_%'
    OR column_name IN ('payment_url', 'payment_provider')
  )
ORDER BY column_name;

-- 5.3 Constraints on orders table (payment provider checks, unique indexes)
-- Purpose: Confirm migration 013's CHECK constraints and unique indexes exist.
-- Required access: ability to read pg_constraint and information_schema.
-- Expected output: One row per constraint on orders.
-- Can prove: Constraint presence and definition.
-- Cannot prove: Whether data satisfies constraints.
-- Prerequisite: 1.2.
SELECT
  conname AS constraint_name,
  contype AS constraint_type,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.orders'::regclass
ORDER BY conname;

-- 5.4 Unique indexes on orders (nowpayments_payment_id, nowpayments_invoice_id)
-- Purpose: Confirm migration 013's partial unique indexes exist.
-- Required access: ability to read pg_index and pg_class.
-- Expected output: One row per matching index.
-- Can prove: Index presence and partial predicate.
-- Cannot prove: Index effectiveness or uniqueness at runtime.
-- Prerequisite: 1.2.
SELECT
  i.indexrelid::regclass AS index_name,
  pg_get_indexdef(i.indexrelid) AS index_definition
FROM pg_index i
JOIN pg_class c ON c.oid = i.indrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'orders'
  AND pg_get_indexdef(i.indexrelid) LIKE '%nowpayments%'
ORDER BY i.indexrelid::regclass::text;

-- 5.5 Triggers on migration-sensitive tables
-- Purpose: Confirm triggers (e.g. handle_supabase_auth_user on auth.users,
--         updated_at_column) exist as expected by migrations 001/002.
-- Required access: ability to read pg_trigger.
-- Expected output: One row per trigger.
-- Can prove: Trigger presence, name, and owning table.
-- Cannot prove: Trigger runtime behavior.
-- Prerequisite: 1.2.
SELECT
  tgname AS trigger_name,
  tgrelid::regclass AS table_name,
  tgenabled AS trigger_enabled,
  pg_get_triggerdef(oid) AS trigger_definition
FROM pg_trigger
WHERE tgrelid::regclass::text LIKE 'public.%'
  AND NOT tgisinternal
ORDER BY table_name, trigger_name;

-- ============================================================================
-- STAGE 6 — bisis_claim_task function inspection (read-only catalog)
-- ============================================================================

-- 6.1 Check whether bisis_claim_task exists (any schema)
-- Purpose: Determine whether the deduplication function reported in prior audits exists.
-- Required access: ability to read pg_proc.
-- Expected output: Zero or more rows (function may not exist).
-- Can prove: Whether bisis_claim_task exists in the live catalog.
-- Cannot prove: Runtime behavior or invocation path.
-- Prerequisite: None (catalog-level).
SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS argument_types,
  pg_get_function_result(p.oid) AS return_type,
  p.prolang::reglanguage AS language,
  p.prosecdef AS is_security_definer,
  p.proconfig AS search_path_config,
  pg_get_userbyid(p.proowner) AS owner,
  p.proacl AS explicit_acl
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname ILIKE '%claim_task%';

-- 6.2 Effective execute privileges on bisis_claim_task (if it exists)
-- Purpose: Determine which roles can execute the claim function.
-- Required access: ability to use has_function_privilege.
-- Expected output: One row per role per matching function.
-- Can prove: Execute privilege by role.
-- Cannot prove: Runtime behavior.
-- Prerequisite: 6.1 returned at least one row.
WITH target_functions AS (
  SELECT p.oid, p.proacl, p.proowner, n.nspname, p.proname,
         pg_get_function_identity_arguments(p.oid) AS argument_types
  FROM pg_proc AS p
  JOIN pg_namespace AS n ON n.oid = p.pronamespace
  WHERE p.proname ILIKE '%claim_task%'
)
SELECT
  target.nspname AS schema_name,
  target.proname AS function_name,
  target.argument_types,
  roles.role_name,
  CASE
    WHEN roles.role_name = 'PUBLIC' THEN EXISTS (
      SELECT 1
      FROM aclexplode(
        COALESCE(target.proacl, acldefault('f', target.proowner))
      ) AS acl
      WHERE acl.grantee = 0
        AND acl.privilege_type = 'EXECUTE'
    )
    ELSE has_function_privilege(roles.role_oid, target.oid, 'EXECUTE')
  END AS can_execute
FROM target_functions AS target
CROSS JOIN (
  SELECT 'PUBLIC'::text AS role_name, NULL::oid AS role_oid
  UNION ALL
  SELECT rolname, oid FROM pg_roles
  WHERE rolname IN ('anon', 'authenticated', 'service_role')
) AS roles
ORDER BY target.nspname, target.proname, target.argument_types, roles.role_name;

-- ============================================================================
-- STAGE 7 — Storage schema and buckets (conditional on storage schema)
-- ============================================================================

-- 7.1 Confirm storage.buckets table/view exists (only if storage schema exists)
-- Purpose: Confirm Supabase Storage bucket metadata is queryable.
-- Required access: ability to read information_schema.tables in storage schema.
-- Expected output: One row if storage.buckets exists, zero if not.
-- Can prove: Whether the buckets catalog is present.
-- Cannot prove: Bucket contents or file-level policies.
-- Prerequisite: 1.3 returned at least one row.
SELECT
  table_schema,
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'storage'
  AND table_name = 'buckets';

-- 7.2 List storage buckets (only if storage.buckets exists)
-- Purpose: Inspect bucket visibility and limits.
-- Required access: SELECT on storage.buckets.
-- Expected output: One row per bucket.
-- Can prove: Bucket names, public/private status, size limits, MIME restrictions.
-- Cannot prove: Object-level policies or file contents.
-- Prerequisite: 7.1 returned at least one row.
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

-- ============================================================================
-- STAGE 8 — Migration reconciliation (compare live history vs repository files)
-- ============================================================================

-- 8.1 Canonical migration inventory (repository source of truth, read-only)
-- Purpose: Provide the reference list of canonical migrations for comparison.
-- Required access: None (this is a VALUES clause, no table access).
-- Expected output: 16 rows (15 canonical + 1 excluded alias).
-- Can prove: The intended migration sequence and exclusions.
-- Cannot prove: Live application state.
-- Prerequisite: None.
SELECT
  n AS execution_order,
  filename,
  CASE
    WHEN filename = '005_execution_engine_policies.sql' THEN 'EXCLUDED (header says do not run as second migration)'
    ELSE 'CANONICAL'
  END AS status,
  prefix
FROM (
  VALUES
    (1, '001_launch_contract.sql', '001'),
    (2, '002_v1_runtime_reconciliation.sql', '002'),
    (3, '003_services_metadata_reconciliation.sql', '003'),
    (4, '004_public_catalog_rls_reconciliation.sql', '004'),
    (5, '005_execution_engine.sql', '005'),
    (6, '005_execution_engine_policies.sql', '005'),
    (7, '006_service_delivery_engine.sql', '006'),
    (8, '007_execution_client_isolation_hotfix.sql', '007'),
    (9, '008_project_aware_tickets.sql', '008'),
    (10, '009_tickets_policy_isolation_hotfix.sql', '009'),
    (11, '010_production_security_hardening.sql', '010'),
    (12, '011_performance_foreign_key_indexes.sql', '011'),
    (13, '012_official_v1_catalog.sql', '012'),
    (14, '013_nowpayments_integration.sql', '013'),
    (15, '014_rls_corrective_and_payment_lock.sql', '014'),
    (16, '015_rls_recursion_fix.sql', '015')
) AS v(n, filename, prefix)
ORDER BY n;

-- 8.2 Duplicate prefix detection (repository inventory)
-- Purpose: Confirm the 005_ duplicate prefix is the only duplicate.
-- Required access: None (VALUES clause).
-- Expected output: Rows for any prefix appearing more than once.
-- Can prove: Duplicate numeric prefixes in the inventory.
-- Cannot prove: Live application impact.
-- Prerequisite: None.
SELECT
  prefix,
  count(*) AS file_count,
  string_agg(filename, ', ' ORDER BY filename) AS files
FROM (
  VALUES
    ('001','001_launch_contract.sql'),
    ('002','002_v1_runtime_reconciliation.sql'),
    ('003','003_services_metadata_reconciliation.sql'),
    ('004','004_public_catalog_rls_reconciliation.sql'),
    ('005','005_execution_engine.sql'),
    ('005','005_execution_engine_policies.sql'),
    ('006','006_service_delivery_engine.sql'),
    ('007','007_execution_client_isolation_hotfix.sql'),
    ('008','008_project_aware_tickets.sql'),
    ('009','009_tickets_policy_isolation_hotfix.sql'),
    ('010','010_production_security_hardening.sql'),
    ('011','011_performance_foreign_key_indexes.sql'),
    ('012','012_official_v1_catalog.sql'),
    ('013','013_nowpayments_integration.sql'),
    ('014','014_rls_corrective_and_payment_lock.sql'),
    ('015','015_rls_recursion_fix.sql')
) AS v(prefix, filename)
GROUP BY prefix
HAVING count(*) > 1
ORDER BY prefix;

-- ============================================================================
-- END OF SQL PACK
-- ============================================================================
