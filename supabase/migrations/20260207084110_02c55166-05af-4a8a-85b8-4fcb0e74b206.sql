-- Make integration_id nullable in whatsapp_conversations
-- This column was required but not being used - session_id is the correct reference

ALTER TABLE public.whatsapp_conversations 
ALTER COLUMN integration_id DROP NOT NULL;

-- Add default value for integration_id if needed
ALTER TABLE public.whatsapp_conversations 
ALTER COLUMN integration_id SET DEFAULT NULL;