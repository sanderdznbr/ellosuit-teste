ALTER TABLE public.whatsapp_conversations 
ADD COLUMN IF NOT EXISTS typing_status TEXT,
ADD COLUMN IF NOT EXISTS typing_updated_at TIMESTAMP WITH TIME ZONE;

-- Comentários para documentação
COMMENT ON COLUMN public.whatsapp_conversations.typing_status IS 'Status atual do contato (composing, recording, available, unavailable)';
COMMENT ON COLUMN public.whatsapp_conversations.typing_updated_at IS 'Data e hora da última atualização do status de digitação';
