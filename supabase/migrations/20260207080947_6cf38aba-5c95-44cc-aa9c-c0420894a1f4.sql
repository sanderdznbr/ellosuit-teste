-- Add unique constraint for upsert to work on whatsapp_conversations
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_conversations_session_contact_unique 
ON whatsapp_conversations(session_id, contact_phone);

-- Add unique constraint on whatsapp_messages for wa_message_id
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_messages_wa_message_id_unique 
ON whatsapp_messages(wa_message_id) 
WHERE wa_message_id IS NOT NULL;