
-- Add custom_fields JSONB column to clients table for additional dynamic data
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS custom_fields jsonb DEFAULT '{}';

COMMENT ON COLUMN public.clients.custom_fields IS 'Campos adicionais dinâmicos: produto, compra, serviço, financeiro, etc.';
