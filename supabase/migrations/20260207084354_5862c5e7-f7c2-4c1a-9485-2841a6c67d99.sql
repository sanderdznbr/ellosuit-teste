-- Add unique constraint on wa_message_id to allow upsert
ALTER TABLE public.whatsapp_messages
ADD CONSTRAINT whatsapp_messages_wa_message_id_key UNIQUE (wa_message_id);

-- Also ensure there's a unique constraint on session_id + contact_phone for conversations upsert
-- First check if it exists, if not create it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'whatsapp_conversations_session_id_contact_phone_key'
  ) THEN
    ALTER TABLE public.whatsapp_conversations
    ADD CONSTRAINT whatsapp_conversations_session_id_contact_phone_key 
    UNIQUE (session_id, contact_phone);
  END IF;
END $$;