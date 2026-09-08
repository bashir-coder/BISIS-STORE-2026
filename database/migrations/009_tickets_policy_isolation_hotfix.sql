-- BİŞIŞ V1 — Tickets policy isolation hotfix
-- Corrective only. Drops only legacy broad policies identified by read-only metadata.

DROP POLICY IF EXISTS "Admins can update all tickets" ON public.tickets;
DROP POLICY IF EXISTS "Admins can view all tickets" ON public.tickets;
DROP POLICY IF EXISTS "Enable all for tickets based on user_id" ON public.tickets;
DROP POLICY IF EXISTS "Users can create their own tickets" ON public.tickets;
DROP POLICY IF EXISTS "Users can view their own tickets" ON public.tickets;

NOTIFY pgrst, 'reload schema';
