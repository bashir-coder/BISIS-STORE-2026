-- BİŞIŞ V1 services seed reconciliation.
-- Adds the canonical metadata column that the launch contract and seed system use.
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS duration_days INTEGER;

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.packages
  ADD COLUMN IF NOT EXISTS features JSONB NOT NULL DEFAULT '[]'::jsonb;

NOTIFY pgrst, 'reload schema';
