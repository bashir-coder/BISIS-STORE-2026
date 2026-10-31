# BISIS Database Audit Readiness

## Status

- `LOCAL CHECKS PASS`
- `READ-ONLY AUDIT PACKS REVIEWED`
- `BLOCKED — SAFE CONNECTION REQUIRED`

Latest local verification: migration runner tests and migration-chain checks
passed; all 15 canonical migration files matched their generated SHA-256
inventory. No live database connection was made. This report contains
repository-local evidence and test results only; it does not certify or
reconcile production.

## Continuation check — 2026-10-18

- Rechecked the worktree and the audit SQL packs. Existing unrelated modified
  and untracked files remain in place; no migration file was changed. The only
  file changed in this continuation is this readiness report.
- The current process has no `SUPABASE_READ_ONLY_URL`, `DATABASE_URL`,
  `SUPABASE_DB_PASSWORD`, or `SUPABASE_ACCESS_TOKEN`. The root `.env` and
  `.env.example` contain variable names for `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_URL`, and
  `VITE_SUPABASE_ANON_KEY`; their values were not printed or used. Neither
  file lists a direct database URL/password or a read-only connection
  variable. The service-role key was not used because it is not evidence of a
  read-only role.
- `.mcp.json` is parseable but has an empty `mcpServers` object. Supabase MCP
  database query tools are not available in this session.
- `supabase` CLI, `psql`, and the Node `pg` driver are unavailable. Docker is
  installed, but its daemon is not reachable. `@supabase/supabase-js` is
  installed, but the available project/REST API credentials do not provide
  verified read-only catalog access and were not used for production queries.
- A fresh lexical scan found 25 statements in
  `PROD_READ_ONLY_SCHEMA_AUDIT.sql` and 23 in
  `PROD_GATE_06_OPERATOR_SQL_PACK.sql`; every statement starts with `SELECT`
  or `WITH`, with no write/DDL/privilege-changing command tokens outside
  comments and quoted text. This is a static check, not PostgreSQL parsing,
  proof of semantic read-only behavior, or execution.
- The two audit-pack migration inventories were compared to the current local
  directory: the schema pack's 15 canonical names matched all 15 executable
  files, and both operator-pack inventories matched all 16 SQL files,
  including the excluded helper.
- No production connection was attempted and no production SQL or migration
  was run.

## Scope and safety

- Reviewed the migration runner, its dedicated tests, package manifests,
  migration validator, local migration directory, legacy schema for comparison
  only, and the PROD-GATE-06 SQL pack and guide.
- Did not inspect or modify backend API or frontend code.
- Did not modify historical migrations or the existing PROD-GATE-06 operator
  guide.
- During the latest review, corrected the two local read-only SQL audit packs;
  no SQL was executed against any database.
- Did not run the migration runner, invoke `exec_sql`, execute the audit SQL
  against any database, or perform production reads or writes.
- Environment inspection reported only variable names/presence; no values were
  printed. A root `.env` includes Supabase project/API variable names but no
  dedicated database read-only URI/password variable. No Supabase CLI, `psql`,
  approved read-only database connection, or available Docker daemon was
  found.
- The Supabase changelog was checked. No current changelog item changes the
  SQL/catalog inspection workflow prepared here.

## Local migration inventory

`npm run migration:check` passed. It found 16 numbered SQL files: 15 canonical
migrations (`001` through `015`) and the excluded auxiliary
`005_execution_engine_policies.sql`. The runner and inventory tool exclude that
helper. There are no missing or unexpected numbered canonical files. The
historical `database/legacy/schema.sql` is not the execution source.
The README's manual migration list previously stopped at `011` although the
validated local canonical chain continues through `015`; its setup list now
includes `012`–`015`. This corrects documentation only and does not establish
that any of those files are applied in production.

`node scripts/inventory-database-migrations.mjs` produces deterministic JSON
with execution order, filename, SHA-256 over original file bytes, byte length,
and lexical candidates for tables, columns, constraints, indexes, policies,
functions, triggers, RLS operations, grant/revoke operations, and Storage
references. It marks files containing `DO` blocks or dynamic `EXECUTE` for
manual review. This is a locator, not a SQL parser or schema authority:
comments, inline constraints, formatting variations, and dynamic SQL can
produce false positives or omissions. The migration source and resulting
candidate inventory need human review before any reconciliation.

## Independent migration-runner review

### Local corrections made

In `backend/scripts/run-migrations.js`:

- Migration bytes are SHA-256 hashed without line-ending normalization.
  Those bytes are decoded as UTF-8; invalid UTF-8, NUL bytes, and UTF-8 BOM
  input are rejected. The file is re-read and re-hashed immediately before SQL
  is split and submitted.
- Lexically incomplete quotes or block comments are rejected during local
  preflight, before tracker/journal/lock RPCs. The splitter also skips empty
  and comment-only fragments and handles the observed quoted strings,
  identifiers, nested comments, and tagged/untagged dollar delimiters.
- Attempt transitions now require a matching `running` row and verify that an
  updated row was returned. A no-row update is not treated as successful.
- Applied tracker-only history, or applied history without a journal checksum,
  emits an explicit warning that file identity is unverifiable instead of
  silently implying that a checksum was checked.

The scanner is still not PostgreSQL's parser. Its behavior is covered by unit
tests for the listed lexical constructs, but PostgreSQL-specific parsing,
session string settings, SQL execution semantics, and every possible grammar
remain unverified. Do not add unsupported syntax on the assumption that a mock
test proves PostgreSQL equivalence.

### Remaining runner risks and limits

| Finding | Classification | Evidence / impact |
|---|---|---|
| Separate migration statements are separate `exec_sql` RPC calls; no transaction spans a whole migration or its tracker update. | CONFIRMED | The runner documents this in its header and `applyMigration`. Earlier statements can commit before a later failure. The journal blocks automatic replay but cannot undo partial effects. |
| The runner itself initializes tracker, attempt-journal, and lock tables with DDL and grants before acquiring its lock. | CONFIRMED | `ensureMigrationTracker`, `ensureAttemptTracker`, and `ensureRunnerLockTable` run before `acquireRunnerLock` in `main`. This happens before migration statements, but concurrent bootstrap calls and production permissions are not established. |
| The lock is a unique database row, owner-token filtered on release, with no expiry/recovery. | LOCAL CODE VERIFIED; LIVE BEHAVIOR UNVERIFIED | Unit mocks cover a competing insert and owner release. Real uniqueness, service-role grants, RLS interaction, and stale-lock handling require database verification. A stopped process can leave a lock requiring operator review. |
| Old tracker rows or journal entries without checksums cannot establish local file identity. | CONFIRMED LIMIT | The runner warns for applied tracker-only/no-checksum history. Existing tracker records are not rewritten. |
| Errors identify a migration and statement index but intentionally omit the SQL text and raw database error message. | LOCAL CODE VERIFIED | Prevents accidental SQL literal/customer-data disclosure; diagnosis may require reviewing database state and safe PostgreSQL error codes. |

The SQL preflight is lexical only. It is not evidence that a migration is
syntactically valid, authorized, safe to apply, or atomic.

## Existing and prepared read-only audit SQL

The existing [PROD-GATE-06 SQL pack](../../PROD_GATE_06_OPERATOR_SQL_PACK.sql)
contains no direct write statements or invoked RPCs in its current text, but it
does not cover the full metadata inventory required for schema reconciliation.
The latest local revision corrects its function privilege and ACL inspection:

- `PUBLIC` is checked as ACL grantee OID 0 (including default function ACLs),
  not passed to `has_function_privilege` as a role.
- `anon`, `authenticated`, and `service_role` use the role-OID/function-OID
  `has_function_privilege` overload.
- ACL entries are expanded with `aclexplode()` rather than treating an
  `aclitem` as a row type.

The [read-only schema audit pack](./PROD_READ_ONLY_SCHEMA_AUDIT.sql)
contains only `SELECT` catalog/introspection queries. It covers database
identity/version, schemas/extensions, public and Storage relation/column
metadata, constraints/index health, RLS flags and policies, schema/relation/
column/sequence/function ACL metadata, role bypass attributes, function
security metadata, triggers, known-object presence, bucket configuration, and
conditional migration tracker/journal metadata. Its latest revision adds
relation options (including view security options where present), full
tracker/journal reconciliation, and a canonical filename comparison for the
15 locally validated migrations. The canonical list is intentionally static
and must be updated when the repository migration chain changes. It
uses the same unquoted tracker identifier spelling as the runner. It reports
whether a column has a default rather than returning default expressions, and
only returns function `search_path` configuration rather than every function
setting. The older operator pack now resolves the tracker name with the same
PostgreSQL identifier escaping and also avoids returning column default
expressions. Neither pack returns function bodies, application rows, Storage
object rows/names, passwords, or customer data.

Run the audit pack manually one query at a time and skip the conditional
Storage/tracker queries if the relevant object is absent or inaccessible.
Catalog visibility is limited by the executing role. A missing result or
permission error is not proof that no object or policy exists. Function bodies,
backup restoration, deployment provenance, live runtime behavior, and row-level
data correctness require separately authorized evidence.

Both packs were text-reviewed for write/DDL/privilege-changing statements.
This is not PostgreSQL parsing or execution. An operator using an elevated SQL
Editor role must still review each query; SELECT-only does not make the role
itself read-only.

## Production reconciliation state

| Item | Result |
|---|---|
| Local migration inventory | 15 canonical runner files and one excluded helper; validator PASS. Latest SHA-256 comparison: 15/15 matched; zero mismatches. |
| Production migration ledger | UNVERIFIED; no approved read-only connection available and no query executed. |
| Production schema, relationships, constraints, indexes | UNVERIFIED. |
| Production RLS, ACLs, functions, triggers, Storage policies | UNVERIFIED. |
| Backup/restore, production logs, advisors, monitoring | UNVERIFIED; not locally provable from the reviewed files. |
| Migrations or production state changed | No. |
| Current connection path | BLOCKED; no read-only database credential, PostgreSQL client/driver, or configured Supabase MCP SQL server. The service-role key is explicitly excluded. |

No `MATCH`, `LOCAL_ONLY`, `PRODUCTION_ONLY`, or mismatch classification is
assigned to the live database without live evidence. The only verified
inventory result is local. A future comparison should use `MATCH`,
`LOCAL_ONLY`, `PRODUCTION_ONLY`, `DEFINITION_MISMATCH`,
`PERMISSION_OR_POLICY_MISMATCH`, `UNVERIFIABLE`, or
`REQUIRES_MANUAL_REVIEW` as appropriate.

## Validation performed

| Command | Result |
|---|---|
| `npm --prefix backend test -- tests/run-migrations.test.js` | Latest run: 1 suite passed; 34 tests passed, 0 failed, 0 skipped. These use mocked Supabase calls and do not prove PostgreSQL behavior. |
| Node syntax checks for `backend/scripts/run-migrations.js`, `backend/tests/run-migrations.test.js`, and `scripts/inventory-database-migrations.mjs` | Latest run PASS. |
| Focused ESLint for `backend/scripts/run-migrations.js` and `backend/tests/run-migrations.test.js` | Latest run PASS. |
| `npm run migration:check` | Latest run PASS; 15 canonical migrations, no missing/unexpected IDs, and one excluded helper reported. |
| `node scripts/inventory-database-migrations.mjs` plus `Get-FileHash -Algorithm SHA256` comparison | Latest run PASS; 15 canonical inventory entries matched 15 local files with zero SHA-256 mismatches. |
| Tracker identifier compatibility check | PASS; escaped identifier in the older SQL pack matches the runner's exact Unicode identifier spelling. |
| Current audit SQL lexical check | PASS; 25 and 23 statements respectively, all `SELECT`/`WITH`; not a PostgreSQL parser or execution test. |
| SQL-pack migration inventory comparison | PASS; 15/15 canonical names and 16/16 operator-pack file names match the local directory. |
| Audit-pack text scan and `git diff --check` | Latest run PASS; no leading write/DDL/privilege-changing statement was found and no whitespace errors were reported. This is not a SQL parser. |

A prior direct use of a PowerShell/.NET SHA-256 API unavailable in this
environment did not produce a comparison; the supported `Get-FileHash`
comparison above completed successfully.

An ESLint attempt that also included the new root-level `.mjs` inventory script
could not load the root ESLint configuration because
`@typescript-eslint/eslint-plugin` is not installed at the repository root.
The focused backend lint passed; the inventory script was syntax-checked but
not linted. No dependency was installed or changed.

No approved read-only connection variable was present in the process
environment, and the root `.env` does not list a database-only/read-only
connection variable. `supabase` and `psql` executables and the Node `pg` driver
were not available. A Docker executable was present, but its daemon could not
be reached. Therefore the SQL packs were not parsed or executed by PostgreSQL,
and actual grants, RLS, catalogs, or migration history were not validated.

## Changed files and preserved state

Updated in the latest audit pass:

- `database/audits/PROD_READ_ONLY_SCHEMA_AUDIT.sql` — catalog-only,
  SELECT-based production audit pack; improves tracker identifier compatibility,
  limits potentially sensitive default/configuration values, and adds
  relation/view metadata plus live/local migration reconciliation queries.
- `PROD_GATE_06_OPERATOR_SQL_PACK.sql` — corrects `PUBLIC` function privilege
  checks and `aclitem` decoding using catalog ACL expansion; resolves the
  runner's Unicode tracker identifier and avoids returning default expressions.
- `database/audits/BISIS_DATABASE_AUDIT_READINESS.md` — latest evidence,
  findings, and verification limits.

No historical migration, Frontend file, Backend API route/controller, or
operator guide was edited. The worktree contains unrelated modified and
untracked files; they were left untouched and were not staged or reverted.
Earlier local work already present before this audit includes the runner,
runner tests, README migration list, and static inventory tool described above;
those files were not changed during the latest audit pass.

In the 2026-10-18 continuation, no migration, SQL audit pack, application
source, or configuration file was changed. Only this report was updated to
record the current environment and the fresh static SQL scan.

## Next step

Obtain an explicitly authorized, genuinely read-only database connection or
have an authorized operator run the prepared SQL pack using a role whose
effective privileges have been verified. Return only scrubbed catalog and
migration-ledger results. Until then, the live database comparison is blocked;
do not run the migration runner or use a service-role credential for the audit.


## Follow-up hardening — 2026-10-31

Changes prepared on branch `db-hardening/2026-10-31`, based on
`2c5613cd39179d145736c7d0969ad9a1040fd889`:

- The migration runner now resolves the repository-root
  `database/migrations` directory (the previous default incorrectly pointed
  inside `backend/database`).
- The runner excludes the auxiliary
  `005_execution_engine_policies.sql` SQL pack from automatic execution.
- The runner now stops if it cannot initialize or read the migration tracker;
  it no longer treats a tracker read error as an empty migration history.
- Migration `018_remove_personas_system.sql` is gated to the known Staging
  project ref and requires `MIGRATION_ENV=staging`. It is skipped elsewhere.
- Added migration `019_users_staff_policy_authoritative_role.sql`. It replaces
  the users staff-read policy that trusted the top-level JWT `role` claim
  (normally the Postgres role, not the application's staff role) with the
  existing fixed-search-path `execution_role()` helper, which resolves the
  authoritative `public.users.role` without recursive RLS evaluation.
- Marked `database/legacy/schema.sql` as a deprecated historical snapshot;
  it contains a legacy password column and must not be used as a bootstrap.
- Extended the read-only schema audit's canonical migration list through 019.

## Verification limits for follow-up branch

The branch changes are committed to the remote feature branch, but no local
checkout or PostgreSQL runtime is available through this GitHub-only pass.
Therefore Node tests, migration-chain validation, SQL parsing, Supabase
advisors, and live Staging verification have NOT been run for these changes.
The previous report's earlier local PASS results apply only to the earlier
reviewed working tree and must not be interpreted as validation of this
follow-up branch. No database was modified by this work. Production remains
untouched. Review the diff and run the project's tests plus a Staging-only
migration dry-run/verification before merging.
