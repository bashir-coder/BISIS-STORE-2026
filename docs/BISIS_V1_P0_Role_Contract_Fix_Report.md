# BİSIŞ V1 — P0 Role Contract Fix Report

> **Historical diagnostic snapshot — superseded.** The project identifier is intentionally omitted. Later staging verification confirmed the approved V1 role constraint and Auth provisioning; this report records the intermediate SQL Editor inconsistency only.

**Project:** Supabase staging project (identifier omitted)

**Scope:** P0 role constraint only. No code, table, data, Auth architecture, RLS policy, legacy schema, or migration file was changed.

## 1. Pre-execution verification

A read-only query targeted exactly `public.users.users_role_check` and returned one row:

```text
users_role_check
CHECK ((role = ANY (ARRAY['visitor'::text, 'user'::text, 'admin'::text, 'super_admin'::text])))
```

This confirmed that the selected constraint name and table were correct before modification.

## 2. SQL submitted

The only modification submitted was:

```sql
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check
  CHECK (role IN ('visitor', 'client', 'admin', 'super_admin', 'manager', 'editor'));
```

No other SQL was submitted in the modification step.

## 3. Execution result

Supabase SQL Editor displayed:

```text
Success. No rows returned
```

This message alone is not treated as proof that the new constraint exists.

## 4. Post-execution verification result

The immediately following read-only query targeted the same constraint:

```sql
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.users'::regclass
  AND conname = 'users_role_check';
```

Actual result:

```text
0 rows
Success. No rows returned
```

Therefore the required new constraint was **not verified**. The run stops here. I did not retry the SQL, submit a guessed alternative, create Customer A/B, or run any RLS/IDOR tests.

## 5. Status

| Item | Status |
|---|---|
| Correct old constraint identified | **PASS** |
| P0 SQL submitted | **PASS — editor reported success** |
| New `users_role_check` verified | **FAIL — 0 rows** |
| Customer A created | **NOT RUN** |
| Customer B created | **NOT RUN** |
| Auth/public.users UUID equality | **NOT RUN** |
| RLS/IDOR isolation tests | **NOT RUN** |
| Backend runtime tests | **NOT RUN** |
| Code or migration files modified | **NO** |

## 6. Error classification

**P0 — Constraint verification failure.** The post-execution database evidence does not show `users_role_check` at all. The exact cause is not asserted from this result alone; the likely possibilities include statement execution semantics in the SQL Editor or the second statement not persisting, but no repair was attempted because the instruction was to stop at a new failure and not guess.

The database is **not ready** to proceed to Auth user creation or RLS testing. The next required action is a separately approved, read-only diagnostic of all constraints on `public.users` and the SQL Editor statement execution behavior, followed by an explicitly approved minimal retry only after the cause is confirmed.
