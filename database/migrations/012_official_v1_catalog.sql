-- BİŞIŞ V1 official catalog contract.
-- Adds delivery metadata without removing any historical rows.
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS delivery TEXT;

NOTIFY pgrst, 'reload schema';