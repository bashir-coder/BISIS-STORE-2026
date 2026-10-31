# PROD-GATE-06 — Operator Execution Guide & Result Template

## Purpose

This guide accompanies `PROD_GATE_06_OPERATOR_SQL_PACK.sql`. It tells an authorized
Supabase database operator how to run the read-only SQL pack safely, stage by
stage, and how to record results for analysis.

---

## Safety Constraints (read before executing)

1. **Read-only only.** Every query in the pack is a `SELECT` against catalog
   views (`information_schema`, `pg_class`, `pg_proc`, `pg_policy`, `pg_trigger`,
   `pg_index`, `storage.buckets`). No `INSERT`, `UPDATE`, `DELETE`, `CREATE`,
   `ALTER`, `DROP`, `TRUNCATE`, or `GRANT`/`REVOKE`.
2. **Do not invoke `exec_sql`.** Queries 3.1–3.3 inspect the function's catalog
   entry only. They do not call it, even with a harmless argument.
3. **Do not print or request credentials.** Use your own authorized read-only
   database role. Do not capture `SUPABASE_SERVICE_ROLE_KEY`, connection strings,
   or passwords in results.
4. **Run one stage at a time.** Later stages assume objects verified in earlier
   stages. If a prerequisite query returns zero rows, skip dependent queries.
5. **Do not modify repository files, migrations, schema, or data.**

---

## Execution Stages

Run the SQL pack in the numbered order below. Stop at the first stage that
returns an error or an unexpected zero-row result, and record what happened.

| Stage | Queries | What it establishes |
|-------|---------|---------------------|
| 1 | 1.1 – 1.3 | Which schemas exist (`public`, `storage`) |
| 2 | 2.1 – 2.3 | Whether `_SDACK_migrations` tracker exists, its schema, and recorded filenames |
| 3 | 3.1 – 3.3 | Whether `public.exec_sql` exists, its security mode, and execute privileges |
| 4 | 4.1 – 4.3 | RLS enabled/forced flags, table grants, and RLS policies on migration-sensitive tables |
| 5 | 5.1 – 5.5 | `orders.nowpayments_creating_lock`, NOWPayments columns, constraints, indexes, triggers |
| 6 | 6.1 – 6.2 | Whether `bisis_claim_task` exists and its execute privileges |
| 7 | 7.1 – 7.2 | Whether `storage` schema and `storage.buckets` exist, and bucket metadata |
| 8 | 8.1 – 8.2 | Canonical migration inventory and duplicate-prefix reference |

**Conditional rules:**
- Stage 2 queries 2.2 and 2.3 only run if 2.1 returns at least one row.
- Stage 3 queries 3.2 and 3.3 only run if 3.1 returns at least one row.
- Stage 7 query 7.2 only runs if 7.1 returns at least one row.
- Stage 6 query 6.2 only runs if 6.1 returns at least one row.

---

## Result Template

Copy the sections below into your response. Fill in observed values. Mark
"NOT OBSERVED" if a query returned zero rows or you lacked permission.

### Stage 1 — Schema existence

| Query | Result |
|-------|--------|
| 1.1 All non-system schemas | |
| 1.2 `public` schema present? (Y/N) | |
| 1.3 `storage` schema present? (Y/N) | |

### Stage 2 — Migration tracker `_SDACK_migrations`

| Query | Result |
|-------|--------|
| 2.1 Tracker table exists? (Y/N) | |
| 2.2 Tracker columns (name / type / nullable / default / position) | |
| 2.3 Recorded filenames (id / filename / applied_at) | |

### Stage 3 — `exec_sql` function

| Query | Result |
|-------|--------|
| 3.1 `exec_sql` exists? (Y/N) | |
| 3.1 Details (schema / name / args / return / language / secdef / search_path / owner / explicit_acl) | |
| 3.2 Effective EXECUTE by role (PUBLIC / anon / authenticated / service_role) | |
| 3.3 Explicit ACL entries (grantee / privilege / grantable) | |

### Stage 4 — RLS and table grants

| Query | Result |
|-------|--------|
| 4.1 RLS on sensitive tables (table / rls_enabled / rls_forced / owner) | |
| 4.2 Table grants (table / role / privilege) | |
| 4.3 RLS policies (table / policy_name / command / using_condition / with_check_condition) | |

### Stage 5 — Migration-sensitive columns, constraints, triggers

| Query | Result |
|-------|--------|
| 5.1 `orders.nowpayments_creating_lock` (name / type / nullable / default / position) | |
| 5.2 NOWPayments columns on `orders` (name / type / nullable / default / position) | |
| 5.3 Constraints on `orders` (name / type / definition) | |
| 5.4 NOWPayments indexes on `orders` (index_name / definition) | |
| 5.5 Triggers (name / table / enabled / definition) | |

### Stage 6 — `bisis_claim_task` function

| Query | Result |
|-------|--------|
| 6.1 `bisis_claim_task` exists? (Y/N) | |
| 6.1 Details (schema / name / args / return / language / secdef / search_path / owner / explicit_acl) | |
| 6.2 Effective EXECUTE by role | |

### Stage 7 — Storage buckets

| Query | Result |
|-------|--------|
| 7.1 `storage.buckets` exists? (Y/N) | |
| 7.2 Buckets (id / name / is_public / file_size_limit / allowed_mime_types) | |

### Stage 8 — Migration inventory reference

| Query | Result |
|-------|--------|
| 8.1 Canonical inventory (all 16 rows) | |
| 8.2 Duplicate prefixes (prefix / file_count / files) | |

---

## Migration Reconciliation Matrix (to complete after running)

| Migration file | Live history record (from 2.3) | Evidence of effects present (from 5.x) | Confidence | Discrepancy / next check |
|---|---|---|---|---|
| `001_launch_contract.sql` | | | | |
| `002_v1_runtime_reconciliation.sql` | | | | |
| `003_services_metadata_reconciliation.sql` | | | | |
| `004_public_catalog_rls_reconciliation.sql` | | | | |
| `005_execution_engine.sql` | | | | |
| `005_execution_engine_policies.sql` | EXCLUDED | N/A | N/A | Confirm not applied |
| `006_service_delivery_engine.sql` | | | | |
| `007_execution_client_isolation_hotfix.sql` | | | | |
| `008_project_aware_tickets.sql` | | | | |
| `009_tickets_policy_isolation_hotfix.sql` | | | | |
| `010_production_security_hardening.sql` | | | | |
| `011_performance_foreign_key_indexes.sql` | | | | |
| `012_official_v1_catalog.sql` | | | | |
| `013_nowpayments_integration.sql` | | | | |
| `014_rls_corrective_and_payment_lock.sql` | | | | |
| `015_rls_recursion_fix.sql` | | | | |

---

## Evidence SQL Alone Cannot Establish

The following require evidence outside the SQL pack:

1. **Verified backup restoration** — SQL cannot prove a backup exists or that a restore
   has been successfully tested. Requires backup logs, restore-test records, or
   infrastructure evidence.
2. **Deployment provenance** — SQL cannot link the live database state to a specific
   commit, tag, or artifact. Requires deployment records, CI/CD logs, or release notes.
3. **Application-level behavior** — SQL cannot confirm the backend correctly uses RLS,
   handles payment callbacks idempotently, or enforces authorization at the route level.
   Requires integration tests against a staging environment.
4. **Live `exec_sql` runtime behavior** — Catalog inspection confirms existence and
   privileges only; it cannot confirm what the function does when invoked (and invocation
   is prohibited by this task's constraints).
5. **Row-level data correctness** — Catalog queries confirm schema/policy/grant structure,
   not whether table contents are correct or consistent.

---

## Final Confirmation

No repository files, database objects, or data were changed by this task. The SQL pack
is ready for manual execution by an authorized operator.

**Status: `OPERATOR SQL PACK READY — NO EXECUTION`**
