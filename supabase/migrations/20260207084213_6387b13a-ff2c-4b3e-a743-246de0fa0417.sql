-- Make sender_phone and recipient_phone nullable in whatsapp_messages
-- The conversation_id and from_me fields already provide the necessary context

ALTER TABLE public.whatsapp_messages 
ALTER COLUMN sender_phone DROP NOT NULL;

ALTER TABLE public.whatsapp_messages 
ALTER COLUMN recipient_phone DROP NOT NULL;

-- Set defaults
ALTER TABLE public.whatsapp_messages 
ALTER COLUMN sender_phone SET DEFAULT '';

ALTER TABLE public.whatsapp_messages 
ALTER COLUMN recipient_phone SET DEFAULT '';