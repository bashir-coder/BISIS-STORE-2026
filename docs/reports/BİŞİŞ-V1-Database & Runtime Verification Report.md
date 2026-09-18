# BİŞIŞ V1 — Database & Runtime Verification Report

> **Historical failure snapshot — superseded.** This report records the original Auth role-constraint failure. Later staging verification corrected the approved V1 role constraint and provisioned disposable test users; consult the current readiness reports for the present state.

**Project:** Supabase staging project (identifier intentionally omitted from the public report)

**Execution date:** 2026-08-24

**Scope:** Launch Contract only. `database/legacy/schema.sql` was not used. No Legacy Migration or compatibility layer was added.

## 1. What was executed

The founder-confirmed Supabase project was opened in SQL Editor. The full contents of `database/migrations/001_launch_contract.sql` were loaded into the Monaco editor without truncation and executed after the founder’s explicit confirmation. Supabase returned:

> Success. No rows returned

The earlier truncated editor submission failed before execution and was not treated as a migration result. The second, complete submission is the one that returned success.

Before the migration, a limited public-data cleanup had returned HTTP 204 for each targeted public table. Auth Admin reported zero users before creating the new test users.

## 2. What was verified successfully

A read-only metadata query executed successfully after the migration and returned one verification row. It confirmed that all 23 expected public tables exist and that `relrowsecurity=true` for all 23 tables:

`users`, `workspaces`, `workspace_members`, `services`, `packages`, `projects`, `orders`, `payments`, `order_events`, `order_files`, `invoices`, `tickets`, `conversations`, `messages`, `notifications`, `subscriptions`, `digital_products`, `donations`, `blog_posts`, `portfolio`, `faqs`, `personas`, and `translations`.

The metadata query also returned actual indexes, foreign-key/check-constraint metadata, and policy metadata. The browser display truncated the larger JSON payload, so this report does not claim that every individual foreign key, index, policy, function, or trigger was independently confirmed by a complete readable result.

## 3. Failure point

Creation of the first test user through Supabase Auth Admin failed with:

```text
HTTP 500
{"code":500,"error_code":"unexpected_failure","msg":"Database error creating new user","error_id":"[redacted]"}
```

The failure occurred at `POST /auth/v1/admin/users`. The script stopped immediately. Customer A and Customer B were not created, and no Auth/public-user ID matching or RLS isolation test was run.

## 4. Confirmed cause from database evidence

The Launch Contract trigger `public.handle_supabase_auth_user()` inserts new profiles with `role = 'client'`.

The live database metadata, however, reports the existing constraint:

```text
users_role_check: CHECK (role IN ('visitor', 'user', 'admin', 'super_admin'))
```

`client` is not allowed by that live constraint. Therefore the trigger insert fails when Auth tries to create a user, which causes Supabase Auth user creation to return the observed database error.

This is not a guessed cause: it is the direct conflict between the trigger body in `001_launch_contract.sql`, the verified live constraint definition, and the exact failing operation.

## 5. What was not executed after the failure

The script did not retry user creation. Customer A/B were not created. No test fixtures were created. No RLS isolation test was run for workspaces, orders, conversations, invoices, notifications, files, or messages. Backend runtime tests against the new staging database were not run after the failure.

No additional SQL or code repair was applied after the failure, in accordance with the instruction to stop at the first error and not guess a fix.

## 6. Remaining programming errors

| Priority | Error | Evidence | Required next step |
|---|---|---|---|
| **P0** | Live `users_role_check` rejects the `client` role required by the Launch Contract Auth trigger. | Exact live constraint definition plus exact Auth Admin failure. | Decide whether to replace the live role constraint with the Launch Contract role set, then apply only the minimal approved SQL change before retrying Auth. |
| **P1** | Full individual verification of every FK, index, policy, function, and trigger is incomplete because the metadata result was truncated in the SQL Editor display. | Read-only query returned one row, but the larger JSON payload was truncated. | After resolving P0, run focused read-only verification queries with small result sets. |
| **P2** | Runtime and RLS isolation status is unknown because test users could not be created. | Test script stopped at first Auth creation failure. | After P0 and focused schema verification, create only Customer A/B and run the isolation suite. |

## 7. Contract decision

**Database Contract status: BLOCKED.**

The Launch Contract itself executed successfully, and the expected table surface exists with RLS enabled according to the read-only metadata result. However, the Auth trigger path is not operational because the live `users_role_check` conflicts with the trigger’s required `client` role. BİŞIŞ V1 is not ready to move to the next stage until this P0 database constraint conflict is explicitly approved and corrected, then Auth and RLS isolation are re-tested.

No legacy schema was used, no legacy users were restored, and no new feature was added.
