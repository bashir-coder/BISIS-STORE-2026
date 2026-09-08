-- BİŞIŞ V1 — Execution Engine policy runner (auxiliary only)
-- Canonical source of truth: 005_execution_engine.sql. This file is for SQL Editor batching/documentation and must not be executed as a second migration.

CREATE OR REPLACE FUNCTION public.execution_role() RETURNS TEXT LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT role FROM public.users WHERE id = auth.uid() AND is_active = true LIMIT 1; $$;
CREATE OR REPLACE FUNCTION public.execution_is_staff() RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT public.execution_role() IN ('admin','super_admin','manager','editor'); $$;
CREATE OR REPLACE FUNCTION public.execution_can_access_project(p_project_id BIGINT) RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT public.execution_role() = 'super_admin' OR EXISTS (SELECT 1 FROM public.projects p JOIN public.workspace_members wm ON wm.workspace_id = p.workspace_id WHERE p.id = p_project_id AND wm.user_id = auth.uid()); $$;
REVOKE ALL ON FUNCTION public.execution_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.execution_is_staff() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.execution_can_access_project(BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.execution_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.execution_is_staff() TO authenticated;
GRANT EXECUTE ON FUNCTION public.execution_can_access_project(BIGINT) TO authenticated;
ALTER TABLE project_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_template_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_template_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_activity ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "execution staff templates" ON project_templates;
CREATE POLICY "execution staff templates" ON project_templates FOR ALL USING (public.execution_is_staff()) WITH CHECK (public.execution_is_staff());
DROP POLICY IF EXISTS "execution staff template milestones" ON project_template_milestones;
CREATE POLICY "execution staff template milestones" ON project_template_milestones FOR ALL USING (public.execution_is_staff()) WITH CHECK (public.execution_is_staff());
DROP POLICY IF EXISTS "execution staff template tasks" ON project_template_tasks;
CREATE POLICY "execution staff template tasks" ON project_template_tasks FOR ALL USING (public.execution_is_staff()) WITH CHECK (public.execution_is_staff());
DROP POLICY IF EXISTS "execution view milestones" ON project_milestones;
CREATE POLICY "execution view milestones" ON project_milestones FOR SELECT USING (public.execution_can_access_project(project_id) AND (public.execution_is_staff() OR (public.execution_role() = 'client' AND EXISTS (SELECT 1 FROM project_tasks t WHERE t.milestone_id = project_milestones.id AND t.client_visible))));
DROP POLICY IF EXISTS "execution manage milestones" ON project_milestones;
CREATE POLICY "execution manage milestones" ON project_milestones FOR ALL USING (public.execution_is_staff() AND public.execution_can_access_project(project_id)) WITH CHECK (public.execution_is_staff() AND public.execution_can_access_project(project_id));
DROP POLICY IF EXISTS "execution view tasks" ON project_tasks;
CREATE POLICY "execution view tasks" ON project_tasks FOR SELECT USING (public.execution_can_access_project(project_id) AND (public.execution_is_staff() OR (public.execution_role() = 'client' AND client_visible)));
DROP POLICY IF EXISTS "execution manage tasks" ON project_tasks;
CREATE POLICY "execution manage tasks" ON project_tasks FOR ALL USING (public.execution_is_staff() AND public.execution_can_access_project(project_id)) WITH CHECK (public.execution_is_staff() AND public.execution_can_access_project(project_id));
DROP POLICY IF EXISTS "execution view activity" ON project_activity;
CREATE POLICY "execution view activity" ON project_activity FOR SELECT USING (public.execution_can_access_project(project_id) AND (public.execution_is_staff() OR (public.execution_role() = 'client' AND visibility = 'client')));
DROP POLICY IF EXISTS "execution insert activity" ON project_activity;
CREATE POLICY "execution insert activity" ON project_activity FOR INSERT WITH CHECK (public.execution_is_staff() AND public.execution_can_access_project(project_id));
NOTIFY pgrst, 'reload schema';
