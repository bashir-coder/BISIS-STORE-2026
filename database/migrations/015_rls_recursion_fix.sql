-- ============================================================
-- BİŞİŞ V1
-- Migration 015: RLS infinite recursion fix on users table
-- ============================================================
--
-- Root cause:
-- Migration 014 created the policy "Staff can view workspace users" on
-- the public.users table with a self-referencing subquery:
--   (SELECT u.role FROM public.users u WHERE u.id = auth.uid())
--
-- When RLS is enabled on users and an authenticated user queries the
-- table, PostgreSQL evaluates the policy. The subquery reads users
-- again, which triggers the SAME policy again, creating infinite
-- recursion:
--   policy evaluation → subquery → policy evaluation → subquery → ...
--
-- Fix:
-- Replace the self-referencing subquery with auth.jwt()->>'role',
-- which reads the role from the JWT token claims directly, without
-- touching the users table.
--
-- This is a minimal, additive-only change. RLS remains enabled.
-- No tables are made public. No permissions are expanded.
-- ============================================================

BEGIN;

-- ============================================================
-- Fix: Replace self-referencing subquery with JWT role claim
-- ============================================================

DROP POLICY IF EXISTS "Staff can view workspace users" ON public.users;

CREATE POLICY "Staff can view workspace users"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (
    auth.jwt()->>'role' IN ('admin', 'super_admin')
    OR EXISTS (
      SELECT 1
      FROM public.workspace_members wm
      WHERE wm.workspace_id = users.workspace_id
        AND wm.user_id = auth.uid()
    )
  );

-- ============================================================
-- Documentation
-- ============================================================

COMMENT ON POLICY "Staff can view workspace users" ON public.users IS
  'Admins and super_admins can read all users. Other authenticated users can read users in workspaces they are members of. Role is read from JWT to avoid RLS recursion.';

NOTIFY pgrst, 'reload schema';

COMMIT;
