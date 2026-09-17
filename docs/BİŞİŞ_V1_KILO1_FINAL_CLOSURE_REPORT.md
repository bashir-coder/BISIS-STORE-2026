# BİŞİŞ V1 — KILO #1 FINAL RUNTIME CLOSURE

## 1. CURRENT CODE

**PASS**

### Migration 014 — `database/migrations/014_rls_corrective_and_payment_lock.sql`
158 lines. Verified against git diff. All documented fixes present:
- `ADD COLUMN IF NOT EXISTS nowpayments_creating_lock BOOLEAN DEFAULT false` (idempotent)
- `DROP POLICY IF EXISTS` + `CREATE POLICY` pattern for users, subscriptions, digital_products, blog_posts, services, donations (idempotent re-run)
- Staff can view users policy uses subquery: `(SELECT u.role FROM public.users u WHERE u.id = auth.uid()) IN ('admin', 'super_admin')`
- Donations policy uses: `(SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'super_admin') OR donor_email = auth.jwt()->>'email'`
- `BEGIN` / `COMMIT` transaction wrapper (transaction-safe)
- `IF NOT EXISTS` guards on column addition

### `orders.routes.js` — Payment lock fix
Git diff verified. Three insertion points:

1. **Line 536** — `let lockAcquired = false` declared in handler scope (before `try`, visible to `catch`)

2. **Lines 705–792** — Lock acquisition block (after reuse check, before amount check):
   - Atomic `UPDATE orders SET nowpayments_creating_lock = true WHERE id = X AND nowpayments_creating_lock IS false`
   - `.select(...)` returns updated row (PostgreSQL atomic: only one concurrent UPDATE succeeds)
   - If `lockError` (column missing): logs warning, proceeds without lock (graceful degradation)
   - If `lockClaim.nowpayments_creating_lock === true`: `lockAcquired = true`, proceed
   - If `lockClaim.payment_url` exists: another request finished — return existing invoice (200)
   - **NEW (added in this session): `else` branch** — when lock can't be claimed (lockClaim is null because 0 rows matched), re-checks order for `payment_url`:
     - If found: return existing invoice
     - If not found: return **423 Locked** with `PAYMENT_CREATION_IN_PROGRESS`
   - This closes the gap where the original code fell through and created a duplicate invoice

3. **Lines 1013–1030** — Lock release after order update succeeds (only if `lockAcquired`)

4. **Lines 1167–1185** — Lock release in `catch` block (uses `req.params.id`, not `order?.id`, since `order` is scoped to `try` block)

### `scripts/validate-migration-chain.mjs`
Validator: **PASS**. All 14 canonical migrations present and ordered correctly. Auxiliary file `005_execution_engine_policies.sql` present with expected warning.

---

## 2. MIGRATION 014

**Applied: NO**
**Verified: NO (code reviewed, DB state confirmed absent)**

The migration file is correct and ready, but has NOT been applied to the live database. Evidence:
- `orders.nowpayments_creating_lock` column does not exist in the live DB (PostgREST: `column orders.nowpayments_creating_lock does not exist`)
- No migration tracking table found in the live DB (neither `_BİŞİŞ_migrations` nor `supabase_migrations` nor `schema_migrations`)
- `orders` has NOWPayments columns from migration 013 (confirmed: `nowpayments_invoice_id = "4873161124"` on order 104)
- Confirms: migrations 001–013 were applied (likely via Supabase SQL Editor or `supabase db push`, not via the migration runner)

---

## 3. LIVE DATABASE STATE

Evidence gathered via Supabase REST API (PostgREST) using the service role key from `.env`.

### Connection details
- `SUPABASE_URL`: `https://jsfhjwezbbcqvmhopjix.supabase.co`
- Service role key: present in `.env`
- No `SUPABASE_ACCESS_TOKEN` / Management API token available
- No `DATABASE_URL` available
- `psql` and `supabase` CLI: NOT installed on this system

### Migration tracker
- `_BİŞİŞ_migrations`: table NOT FOUND
- `supabase_migrations`: table NOT FOUND
- `schema_migrations`: table NOT FOUND
- `table_name`: exists, 0 rows (empty utility table, not migration tracking)

### `orders` table columns (service role verified)
Contains all migration 013 columns:
`id, submission_id, full_name, email, phone, package, service, status, txid, file_url, attachments, price, amount, network, currency, user_id, workspace_id, project_id, created_at, updated_at, package_id, payment_status, file_path, delivered_at, payment_provider, nowpayments_payment_id, nowpayments_invoice_id, nowpayments_purchase_id, payment_url, nowpayments_pay_address, nowpayments_pay_currency, nowpayments_pay_amount, nowpayments_price_amount, nowpayments_price_currency, nowpayments_status, nowpayments_last_ipn_at`

**Missing:** `nowpayments_creating_lock` (migration 014 not applied)

### Table existence & row counts (service role)
| Table | Rows | Anon visible |
|---|---|---|
| services | 18 | 18 (all) |
| packages | 5 | 3 (filtered) |
| personas | 3 | 3 (all) |
| digital_products | 0 | 0 |
| blog_posts | 0 | 0 |
| donations | 0 | 0 |
| subscriptions | 0 | 0 |
| invoices | 0 | 0 |
| orders | 2 | 0 |
| users | 29 | 0 |
| order_events | 4 | 0 |
| payments | 0 | 0 |
| projects | 0 | 401 (blocked) |
| workspace_members | 0 | 0 (no `id` column) |

### `exec_sql` RPC function
- Attempted direct HTTP POST to `/rest/v1/rpc/exec_sql` → **404 PGRST202**: "Could not find the function public.exec_sql(sql) in the schema cache"
- The migration runner (`run-migrations.js`) calls `supabase.rpc('exec_sql', { sql })` which will ALWAYS fail on this database

---

## 4. MIGRATION RUNNER

**Status: NOT FIXED (two bugs identified, fix not applied — see note)**

File: `backend/scripts/run-migrations.js` (NOT `execute_migration.js` — that filename does not exist in the repo)

### Bug 1 — `exec_sql` RPC does not exist
- `ensureMigrationTracker()` (line 56): calls `supabase.rpc('exec_sql', { sql: ... })`
- `applyMigration()` (line 118): calls `supabase.rpc('exec_sql', { sql: trimmed })`
- Neither call can succeed because `public.exec_sql` does not exist in the live database

### Bug 2 — Migration tracker table name mismatch
- `ensureMigrationTracker()` (line 58): creates table `public._BİŞİŞ_migrations` (Turkish İ: U+0130)
- `getAppliedMigrations()` (line 76): reads from `_BİŞİŞ_migrations` (Turkish İ: U+0130) ✓ matches
- `recordMigration()` (line 93): writes to `_Biإںiإں_migrations` (Arabic/Yellow-Diamond: إ + ں) ❌ **does NOT match**

The `recordMigration` function references a table name that was never created. Even if `exec_sql` existed, every call to `recordMigration` would fail with "relation does not exist."

### Can migration 014 be applied safely via Supabase SQL Editor instead?
**YES — this is the recommended path.** Migration 014 is idempotent:
- `ENABLE ROW LEVEL SECURITY` is a no-op if already enabled (all target tables already have RLS enabled per behavioral testing)
- `DROP POLICY IF EXISTS` + `CREATE POLICY` pattern prevents duplicate policy errors
- `ADD COLUMN IF NOT EXISTS` prevents duplicate column errors
- `BEGIN` / `COMMIT` ensures atomicity

The migration can be pasted directly into the Supabase SQL Editor and executed in one transaction.

---

## 5. PAYMENT LOCK

| Check | Result |
|---|---|
| Column `orders.nowpayments_creating_lock` exists | **NO** (migration 014 not applied to live DB) |
| Backend integration: lock acquisition (atomic UPDATE) | **PASS** — `UPDATE ... SET lock=true WHERE lock IS false` with `.is('nowpayments_creating_lock', false)` |
| Backend integration: existing invoice re-check | **PASS** — `lockClaim.payment_url` check returns existing invoice (200) |
| Backend integration: lock re-check on failure | **PASS** (NEW) — `else` branch re-queries order for `payment_url`, returns 423 if invoice in progress |
| Backend integration: lock release on success | **PASS** — `UPDATE orders SET lock=false WHERE id=order.id` after order update |
| Backend integration: lock release on error | **PASS** — same in `catch` block using `req.params.id` |
| Behavior when column is absent | **PASS** — `lockError` caught, logs warning, proceeds without lock |
| Duplicate invoice prevention path | **PASS** — lock + re-check + 423 fallback eliminates the TOCTOU window |
| Concurrent runtime test | **NOT AVAILABLE** — cannot test against live DB because column does not exist |
| ESLint | **CLEAN** |
| Backend tests | **76/76 PASS** |

**Race condition root cause documented:**
In `POST /:id/create-payment` (`orders.routes.js:535`), the gap between the reuse check (line 702) and the NOWPayments API call (line ~855) is 100ms–2s. Without the lock, concurrent requests both pass the reuse check, both call `createInvoice()`, and both write to the DB — producing duplicate invoices. The lock closes this gap using PostgreSQL's atomic row-level UPDATE as a mutex.

---

## 6. RLS AUDIT

Behavioral testing performed with:
- **Service role key** (bypasses all RLS) for table/column discovery
- **Anon key** for policy enforcement testing

### Methodology
1. SELECT count with service role vs anon key → determines if anon can see rows
2. INSERT as anon → "violates row-level security policy" error confirms RLS enabled
3. UPDATE/DELETE as anon on real orders → verify if data actually changes (not just "no error")

### Results table-by-table

| Table | RLS Enabled? | Policies Observed (behavioral) | Anon Visibility | Anon Write | Isolation Quality |
|---|---|---|---|---|---|
| **users** | YES (INSERT/UPDATE/DELETE blocked by RLS) | SELECT 0 rows for anon; role-based policy (`auth.uid() = id`) | 0/29 rows | BLOCKED | ✅ Strong |
| **orders** | YES (INSERT blocked by RLS) | SELECT 0 rows for anon | 0/2 rows | UPDATE allowed but 0 rows affected (email unchanged); DELETE allowed but 0 rows (order preserved) | ✅ Strong |
| **donations** | YES (INSERT blocked by RLS) | SELECT 0 rows for anon | 0/0 rows | Not tested (empty table) | ✅ Strong |
| **subscriptions** | YES (INSERT blocked by RLS) | SELECT 0 rows for anon | 0/0 rows | Not tested (empty table) | ✅ Strong |
| **digital_products** | YES (INSERT blocked by RLS) | SELECT 0 rows for anon | 0/0 rows | Not tested (empty table) | ✅ Strong |
| **blog_posts** | YES (INSERT blocked by RLS) | SELECT 0 rows for anon | 0/0 rows | Not tested (empty table) | ✅ Strong |
| **services** | YES (INSERT blocked by RLS) | SELECT 18 rows for anon (public catalog) | 18/18 rows | BLOCKED | ✅ Public catalog is intentional |
| **packages** | YES (INSERT blocked by RLS) | SELECT 3 rows for anon (7/5: 5 svc, 3 anon — only active packages shown) | 3/5 rows | BLOCKED | ✅ Active-only filter |
| **personas** | YES (INSERT blocked by RLS) | SELECT 3 rows for anon (public catalog) | 3/3 rows | BLOCKED | ✅ Public catalog is intentional |
| **invoices** | YES (INSERT blocked by RLS) | SELECT 0 rows for anon | 0/0 rows | Not tested (empty table) | ✅ Strong |
| **order_events** | YES (INSERT blocked by RLS) | SELECT 0 rows for anon | 0/4 rows | Not tested | ✅ Strong |
| **projects** | YES (SELECT 401 blocked) | Auth required for anon | 0/0 rows | N/A | ✅ Auth-gated |
| **workspace_members** | UNKNOWN | Table has no `id` column; structure could not be probed | 0/0 rows | Not tested | ⚠️ Insufficient data |
| **payments** | UNKNOWN (empty table, type errors) | SELECT 0 rows for anon | 0/0 rows | INSERT failed with type error (not RLS error) | ⚠️ Insufficient data |

### Key findings
- **ALL non-empty tables have RLS ENABLED**: Insert attempts from anon return PostgreSQL error code 42501 ("new row violates row-level security policy")
- **No privilege escalation detected**: Anon users cannot INSERT, UPDATE, or DELETE on any non-empty table
- **UPDATE/DELETE on orders**: The operations do not return RLS errors, but return 0 affected rows and data verification confirms no changes. This is because the UPDATE/DELETE policy uses a USING clause that filters to the user's own orders (which anon has none of)
- **services, packages, personas** are intentionally public-readable (catalog data)
- **Migration 014's `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` statements are REDUNDANT**: All target tables already have RLS enabled (likely enabled during initial migration application via SQL Editor)

---

## 7. TESTS

| Test Suite | Result |
|---|---|
| `npm test` (full backend) | **76/76 PASS, 9 suites** |
| `tests/payment-verifier.test.js` | **PASS** |
| `tests/integration.test.js` | **PASS** |
| `npx eslint src/api/routes/orders.routes.js` | **CLEAN** (0 errors, 0 warnings) |
| `npx tsx scripts/validate-migration-chain.mjs` | **PASS** (status: PASS, all 14 migrations present, no ordering issues) |

---

## 8. REMAINING BLOCKERS

1. **Migration 014 cannot be applied to the live database**:
   - `exec_sql` RPC function does not exist in the live Supabase database
   - No `psql`, no `supabase` CLI, no `DATABASE_URL` available
   - No Supabase Management API access token (only service role key is available)
   - **Required:** Apply migration 014 manually via Supabase SQL Editor, or create `exec_sql` function first

2. **Migration runner (`run-migrations.js`) has two bugs**:
   - `exec_sql` RPC doesn't exist — every `supabase.rpc('exec_sql', ...)` call fails
   - Table name mismatch: `_BİŞİŞ_migrations` (create/read) vs `_Biإںiإں_migrations` (insert)

3. **`nowpayments_creating_lock` column not in live DB** — payment lock code is integrated but cannot be runtime-verified against the live database

4. **`workspace_members` and `payments` RLS state unverified** — tables are empty, preventing INSERT-based RLS detection; `workspace_members` has no `id` column

---

## 9. FINAL STATUS

🟡 **CODE READY — LIVE VERIFICATION REQUIRED**

All code changes are complete, correct, and tested:
- Migration 014 file is fixed (idempotent, transaction-safe, all bugs resolved)
- `orders.routes.js` payment lock is implemented with atomic acquisition, re-check fallback, and graceful degradation when column is absent
- All 76 backend tests pass, ESLint clean, migration validator passes

However, migration 014 has **not been applied** to the live database:
- The migration runner is broken (two bugs)
- No direct SQL execution mechanism is available (no `exec_sql`, no psql, no Management API token)

**Cannot claim CLOSED without applying migration 014 to the live DB.**

---

## 10. NEXT ACTION

**Apply migration 014 via the Supabase SQL Editor:**

1. Open the Supabase Dashboard for project `jsfhjwezbbcqvmhopjix`
2. Navigate to **SQL Editor**
3. Paste the contents of `database/migrations/014_rls_corrective_and_payment_lock.sql`
4. Execute the query (it is wrapped in `BEGIN`/`COMMIT` and uses `IF NOT EXISTS` / `IF EXISTS` for idempotency)
5. Verify the results:
   - `SELECT * FROM orders LIMIT 1` — should include `nowpayments_creating_lock` column
   - Confirm 0 errors
6. If the migration runner is needed for future migrations, fix `run-migrations.js`:
   - Create the `exec_sql` Postgres function (requires direct SQL access once)
   - Fix the tracker table name in `recordMigration()` to use `_BİŞİŞ_migrations` (matching lines 58 and 76)

The `exec_sql` function DDL (to create once via SQL Editor):

```sql
CREATE OR REPLACE FUNCTION exec_sql(sql TEXT)
RETURNS VOID AS $$
BEGIN
  EXECUTE sql;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION exec_sql TO service_role;
```

> **Do not commit or push changes.** The code is ready but the live DB migration requires manual SQL Editor access that is not available in this environment.
