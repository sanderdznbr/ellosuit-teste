
-- Fix Sander's LID conversation
UPDATE public.whatsapp_conversations 
SET remote_jid = '114392511307798@lid' 
WHERE contact_phone = '114392511307798';
