-- BİŞIŞ V1 additive performance hardening.
-- Adds covering indexes for foreign keys reported by Supabase Performance Advisor.
-- Does not change data, RLS semantics, historical migrations, or payment behavior.

CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON public.conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_notifications_order_id ON public.notifications(order_id);
CREATE INDEX IF NOT EXISTS idx_order_events_actor_id ON public.order_events(actor_id);
CREATE INDEX IF NOT EXISTS idx_order_files_uploaded_by ON public.order_files(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_orders_package_id ON public.orders(package_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_project_activity_actor_id ON public.project_activity(actor_id);
CREATE INDEX IF NOT EXISTS idx_project_deliveries_prepared_by ON public.project_deliveries(prepared_by);
CREATE INDEX IF NOT EXISTS idx_project_milestones_created_by ON public.project_milestones(created_by);
CREATE INDEX IF NOT EXISTS idx_project_requirements_created_by ON public.project_requirements(created_by);
CREATE INDEX IF NOT EXISTS idx_project_requirements_updated_by ON public.project_requirements(updated_by);
CREATE INDEX IF NOT EXISTS idx_project_tasks_assignee_id ON public.project_tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_created_by ON public.project_tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_project_tasks_order_id ON public.project_tasks(order_id);
CREATE INDEX IF NOT EXISTS idx_project_templates_created_by ON public.project_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON public.projects(created_by);
CREATE INDEX IF NOT EXISTS idx_projects_workspace_id ON public.projects(workspace_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON public.tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON public.workspace_members(user_id);
