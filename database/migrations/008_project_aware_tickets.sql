-- BİŞIŞ V1 — Project-aware support tickets
-- Additive only. Existing tickets remain valid with project_id = NULL.

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS project_id BIGINT REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS tickets_project_id_idx ON public.tickets(project_id);

DROP POLICY IF EXISTS "customers manage own tickets" ON public.tickets;
CREATE POLICY "customers manage own tickets" ON public.tickets
  FOR ALL
  USING (
    auth.uid() = user_id
    AND (
      project_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.orders
        WHERE orders.project_id = tickets.project_id
          AND orders.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND (
      project_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.orders
        WHERE orders.project_id = tickets.project_id
          AND orders.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "staff view workspace tickets" ON public.tickets;
CREATE POLICY "staff view workspace tickets" ON public.tickets
  FOR SELECT
  USING (
    public.execution_role() = 'super_admin'
    OR (
      public.execution_is_staff()
      AND workspace_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.workspace_members
        WHERE workspace_members.workspace_id = tickets.workspace_id
          AND workspace_members.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "staff manage workspace tickets" ON public.tickets;
CREATE POLICY "staff manage workspace tickets" ON public.tickets
  FOR UPDATE
  USING (
    public.execution_role() = 'super_admin'
    OR (
      public.execution_is_staff()
      AND workspace_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.workspace_members
        WHERE workspace_members.workspace_id = tickets.workspace_id
          AND workspace_members.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    public.execution_role() = 'super_admin'
    OR (
      public.execution_is_staff()
      AND workspace_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.workspace_members
        WHERE workspace_members.workspace_id = tickets.workspace_id
          AND workspace_members.user_id = auth.uid()
      )
    )
  );

NOTIFY pgrst, 'reload schema';
