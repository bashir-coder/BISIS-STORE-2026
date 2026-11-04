# RLS SECURITY MATRIX (Updated with Evidence)

**Document:** RLS_SECURITY_MATRIX.md  
**Audit Date:** 2026-11-02  
**Status:** EVIDENCE VALIDATED (READ-ONLY)

---

## EXECUTIVE SUMMARY

Evidence-based validation of RLS policies. Key findings:
- Migration 015 fixed RLS recursion on users table by replacing self-referencing subquery with uth.jwt()->>'role'
- All SECURITY DEFINER functions have SET search_path = public and schema-qualified references
- Multiple permissive policies use OR semantics (intentional in most cases)
- RLS enabled without policies on table_name (fail-closed via service_role only) - needs verification for others

---

## USERS TABLE (Critical - Fixed)
**Source:** migrations/001, 014, 015

**RLS:** ENABLED (re-enabled in 014)

**Policies (as of migration 015):**
1. **\"Users can view own data\"** (014)
- Command: SELECT
- Roles: authenticated
- USING: uth.uid() = id
- Purpose: Users can read their own row
- Evidence: Migration 014 lines ~111-116

2. **\"Staff can view workspace users\"** (014, fixed in 015)
- Command: SELECT  
- Roles: authenticated
- USING: uth.jwt()->>'role' IN ('admin', 'super_admin') OR EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = users.workspace_id AND wm.user_id = auth.uid())
- Purpose: Admins/super_admins see all users; others see users in their workspaces
- Fix: Migration 015 replaced self-referencing subquery (SELECT u.role FROM public.users u WHERE u.id = auth.uid()) with uth.jwt()->>'role' to prevent infinite recursion
- Evidence: Migration 015 lines ~55-75

**Notes:** Policies are PERMISSIVE, combined with OR. No recursion issue after fix.

---

## EXECUTION ENGINE TABLES
**Source:** migrations/005, 005_execution_engine_policies.sql

**Functions (SECURITY DEFINER, search_path=public):**
- public.execution_role() - returns role from users where id=auth.uid() AND is_active=true
- public.execution_is_staff() - checks if role in ('admin','super_admin','manager','editor')
- public.execution_can_access_project(bigint) - super_admin OR workspace member
- public.execution_client_can_access_project(bigint) - mentioned in migration 010 grants (definition needs verification)

**Grants (migration 010):** Revoked from PUBLIC/anon, granted to authenticated

**Policies use these functions** - all schema-qualified calls.

---

## PUBLIC CATALOG (anon accessible)
**Source:** migrations/004, 014

- **packages:** ENABLED RLS (014), policy \"Anyone can view active packages\" (004) - anon,authenticated, USING is_active=true
- **services:** ENABLED RLS (014), policy \"Anyone can view active services\" (014) - anon,authenticated
- **digital_products:** ENABLED RLS (014), policy \"Anyone can view active digital products\" (014) - anon,authenticated  
- **blog_posts:** ENABLED RLS (014), policy \"Anyone can view published blog posts\" (014) - anon,authenticated, USING is_active=true
- **personas:** ENABLED RLS (014), policy \"Anyone can view personas\" (004) - anon,authenticated, USING true. **But migration 018 removes personas table in Staging - Prod may still have it.**

---

## TABLE_NAME (Special handling)
**Source:** migration 010
- RLS ENABLED
- ALL privileges REVOKED from PUBLIC, anon, authenticated
- GRANT SELECT,INSERT,UPDATE,DELETE to service_role only
- No policies created - service_role bypasses RLS. Fail-closed for non-service-role.

---

## KNOWN ISSUES REQUIRING DB VERIFICATION
- faqs, portfolio, bisis_ai_os_task_dedup - RLS enabled without policies per requirements
- execution_client_can_access_project() definition and grants
- All policies and grants in actual Prod/Staging environments
- Table grants (anon/authenticated/service_role) per table
- Whether migration 020 was applied

---

**Note:** This matrix is based on migration files. Actual state requires read-only DB inspection.
