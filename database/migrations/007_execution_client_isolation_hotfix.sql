-- BİŞIŞ V1 — Execution Engine client isolation hotfix
-- Additive corrective migration. Do not modify 001/005/006 and do not run legacy schema.
-- Canonical client ownership: projects.id -> orders.project_id -> orders.user_id = auth.uid().

CREATE OR REPLACE FUNCTION public.execution_client_can_access_project(p_project_id BIGINT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.project_id = p_project_id
      AND o.user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.execution_client_can_access_project(BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.execution_client_can_access_project(BIGINT) TO authenticated;

-- Replace legacy broad project policies with explicit staff/client scope.
DROP POLICY IF EXISTS "members view workspace projects" ON public.projects;
DROP POLICY IF EXISTS "Users can view projects in their workspace" ON public.projects;
DROP POLICY IF EXISTS "Admins can manage projects" ON public.projects;
DROP POLICY IF EXISTS "Enable all for projects" ON public.projects;
DROP POLICY IF EXISTS "execution staff view projects" ON public.projects;
DROP POLICY IF EXISTS "execution client view owned projects" ON public.projects;
DROP POLICY IF EXISTS "execution staff manage projects" ON public.projects;
CREATE POLICY "execution staff view projects" ON public.projects
  FOR SELECT
  USING (public.execution_is_staff() AND public.execution_can_access_project(id));
CREATE POLICY "execution client view owned projects" ON public.projects
  FOR SELECT
  USING (public.execution_role() = 'client' AND public.execution_client_can_access_project(id));
CREATE POLICY "execution staff manage projects" ON public.projects
  FOR ALL
  USING (public.execution_is_staff() AND (public.execution_role() = 'super_admin' OR EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = projects.workspace_id AND wm.user_id = auth.uid()
  )))
  WITH CHECK (public.execution_is_staff() AND (public.execution_role() = 'super_admin' OR EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = projects.workspace_id AND wm.user_id = auth.uid()
  )));

-- Milestones: staff use the existing operational workspace scope; clients use
-- order ownership plus the existing client-visible task rule.
DROP POLICY IF EXISTS "execution view milestones" ON public.project_milestones;
CREATE POLICY "execution view milestones" ON public.project_milestones
  FOR SELECT
  USING (
    (public.execution_is_staff() AND public.execution_can_access_project(project_id))
    OR (
      public.execution_role() = 'client'
      AND public.execution_client_can_access_project(project_id)
      AND EXISTS (
        SELECT 1
        FROM public.project_tasks t
        WHERE t.milestone_id = project_milestones.id
          AND t.client_visible = true
      )
    )
  );

DROP POLICY IF EXISTS "execution manage milestones" ON public.project_milestones;
CREATE POLICY "execution manage milestones" ON public.project_milestones
  FOR ALL
  USING (public.execution_is_staff() AND public.execution_can_access_project(project_id))
  WITH CHECK (public.execution_is_staff() AND public.execution_can_access_project(project_id));

-- Tasks: client reads only client-visible tasks in projects owned through orders.
DROP POLICY IF EXISTS "execution view tasks" ON public.project_tasks;
CREATE POLICY "execution view tasks" ON public.project_tasks
  FOR SELECT
  USING (
    (public.execution_is_staff() AND public.execution_can_access_project(project_id))
    OR (
      public.execution_role() = 'client'
      AND public.execution_client_can_access_project(project_id)
      AND client_visible = true
    )
  );

DROP POLICY IF EXISTS "execution manage tasks" ON public.project_tasks;
CREATE POLICY "execution manage tasks" ON public.project_tasks
  FOR ALL
  USING (public.execution_is_staff() AND public.execution_can_access_project(project_id))
  WITH CHECK (public.execution_is_staff() AND public.execution_can_access_project(project_id));

-- Activity: client reads only client-visible activity for the owned project;
-- clients receive no INSERT/UPDATE/DELETE policy.
DROP POLICY IF EXISTS "execution view activity" ON public.project_activity;
CREATE POLICY "execution view activity" ON public.project_activity
  FOR SELECT
  USING (
    (public.execution_is_staff() AND public.execution_can_access_project(project_id))
    OR (
      public.execution_role() = 'client'
      AND public.execution_client_can_access_project(project_id)
      AND visibility = 'client'
    )
  );

DROP POLICY IF EXISTS "execution insert activity" ON public.project_activity;
CREATE POLICY "execution insert activity" ON public.project_activity
  FOR INSERT
  WITH CHECK (public.execution_is_staff() AND public.execution_can_access_project(project_id));

-- Keep the already-correct Service Delivery client policies explicitly aligned
-- with the same ownership helper, and retain staff workspace scope.
DROP POLICY IF EXISTS "service delivery staff requirements" ON public.project_requirements;
CREATE POLICY "service delivery staff requirements" ON public.project_requirements
  FOR ALL
  USING (public.execution_is_staff() AND public.execution_can_access_project(project_id))
  WITH CHECK (public.execution_is_staff() AND public.execution_can_access_project(project_id));

DROP POLICY IF EXISTS "service delivery client requirements" ON public.project_requirements;
CREATE POLICY "service delivery client requirements" ON public.project_requirements
  FOR SELECT
  USING (public.execution_role() = 'client' AND public.execution_client_can_access_project(project_id) AND client_visible = true);

DROP POLICY IF EXISTS "service delivery staff deliveries" ON public.project_deliveries;
CREATE POLICY "service delivery staff deliveries" ON public.project_deliveries
  FOR ALL
  USING (public.execution_is_staff() AND public.execution_can_access_project(project_id))
  WITH CHECK (public.execution_is_staff() AND public.execution_can_access_project(project_id));

DROP POLICY IF EXISTS "service delivery client deliveries" ON public.project_deliveries;
CREATE POLICY "service delivery client deliveries" ON public.project_deliveries
  FOR SELECT
  USING (public.execution_role() = 'client' AND public.execution_client_can_access_project(project_id));

NOTIFY pgrst, 'reload schema';
