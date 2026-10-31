-- Correct the staff users policy without trusting mutable JWT metadata.
-- execution_role() is SECURITY DEFINER with a fixed search_path and reads the
-- authoritative public.users role for auth.uid(), avoiding users-table RLS recursion.
BEGIN;

DROP POLICY IF EXISTS "Staff can view workspace users" ON public.users;

CREATE POLICY "Staff can view workspace users"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (
    public.execution_role() IN ('admin', 'super_admin')
    OR EXISTS (
      SELECT 1
      FROM public.workspace_members wm
      WHERE wm.workspace_id = users.workspace_id
        AND wm.user_id = (SELECT auth.uid())
    )
  );

-- Policies invoke this helper; do not expose direct RPC access to anon/PUBLIC.
REVOKE ALL ON FUNCTION public.execution_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.execution_role() TO authenticated;

COMMENT ON POLICY "Staff can view workspace users" ON public.users IS
  'Admins and super_admins are resolved from the authoritative users table through execution_role(); workspace members can read users in their own workspace.';

NOTIFY pgrst, 'reload schema';
COMMIT;
