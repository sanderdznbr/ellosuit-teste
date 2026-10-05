
ALTER TABLE public.whatsapp_conversations ADD COLUMN IF NOT EXISTS contact_lid text;
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_contact_lid ON public.whatsapp_conversations(company_id, contact_lid) WHERE contact_lid IS NOT NULL;

-- Map Sander's LID to the real conversation
UPDATE public.whatsapp_conversations
SET contact_lid = '196473966842093'
WHERE id = '1ca5b588-59ee-47fa-ba2e-59e1ba327357';

-- Move orphan messages from the LID-created conversation to the real Sander conversation
UPDATE public.whatsapp_messages
SET conversation_id = '1ca5b588-59ee-47fa-ba2e-59e1ba327357'
WHERE conversation_id = '37f992f6-086d-4583-9a39-d61944e917cb';

-- Delete the orphan conversation
DELETE FROM public.whatsapp_conversations
WHERE id = '37f992f6-086d-4583-9a39-d61944e917cb';

-- Update last_message on Sander's conversation to reflect the merged message
UPDATE public.whatsapp_conversations
SET last_message = 'testeeee', last_message_at = '2026-05-11 20:01:19+00'
WHERE id = '1ca5b588-59ee-47fa-ba2e-59e1ba327357';
