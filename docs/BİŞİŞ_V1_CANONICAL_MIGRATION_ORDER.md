# BİŞIŞ V1 — Canonical Migration Order

**Scope:** BİŞIŞ V1 database release chain. This document does not alter migrations 001–007.

## Canonical order

| Order | File | Role | Production rule |
|---:|---|---|---|
| 001 | `database/migrations/001_launch_contract.sql` | Base tables, auth trigger, payment function, core RLS | Apply first on a clean database |
| 002 | `database/migrations/002_v1_runtime_reconciliation.sql` | Runtime schema reconciliation | Apply after 001 |
| 003 | `database/migrations/003_services_metadata_reconciliation.sql` | Services metadata reconciliation | Apply after 002 |
| 004 | `database/migrations/004_public_catalog_rls_reconciliation.sql` | Public catalog policies and legacy policy removal | Apply after 003 |
| 005 | `database/migrations/005_execution_engine.sql` | Execution/templates/projects/tasks/activity schema, policies, helpers | Apply after 004 |
| 006 | `database/migrations/006_service_delivery_engine.sql` | Service Delivery state, requirements, deliveries, policies | Apply after 005 |
| 007 | `database/migrations/007_execution_client_isolation_hotfix.sql` | Client ownership and staff/client policy correction | Apply after 006 |
| 008 | `database/migrations/008_project_aware_tickets.sql` | Project-aware ticket ownership and policies | Apply after 007 |
| 009 | `database/migrations/009_tickets_policy_isolation_hotfix.sql` | Removal of legacy broad ticket policies | Apply after 008 |
| 010 | `database/migrations/010_production_security_hardening.sql` | Non-destructive hardening for stray public table, RPC ACLs, and function search paths | Apply after 009 in environments where this release is approved |
| 011 | `database/migrations/011_performance_foreign_key_indexes.sql` | Additive covering indexes for foreign keys reported by Supabase Performance Advisor | Apply after 010; safe to rerun with `IF NOT EXISTS` |

## Explicit exclusion

`database/migrations/005_execution_engine_policies.sql` is **auxiliary SQL Editor/documentation material**, not a second migration. It must not be applied independently after `005_execution_engine.sql`; doing so can create migration drift and duplicate policy/function operations.

`database/legacy/schema.sql` is not part of the BİŞIŞ V1 chain and must not be merged into the release.

## Required reproducibility gate

A release owner must run the chain against a fresh disposable/staging Supabase project using the approved migration mechanism, then run schema metadata checks, Supabase security advisors, RLS allow/deny tests with anon/authenticated clients, and the application regression suite. A successful SQL Editor paste into an existing database is not sufficient evidence of clean reproducibility.

## 011 performance hardening scope

Migration 011 adds only covering indexes for foreign key columns identified by the Staging Performance Advisor. It does not change data, RLS semantics, payment behavior, or any historical migration. It is safe to rerun because every statement uses `IF NOT EXISTS`.

## 010 hardening scope

Migration 010 does not drop tables or rows. If `public.table_name` exists, it enables RLS, removes anon/authenticated table grants, and keeps service-role access. It removes direct anon execution from execution helpers, makes auth provisioning/payment verification server-only while preserving the authenticated execution required by current RLS policies, and sets `search_path=public` on the two flagged non-definer functions. Any production application of 010 must be followed by RLS, auth-trigger, service-role payment-path, and browser regression checks.
