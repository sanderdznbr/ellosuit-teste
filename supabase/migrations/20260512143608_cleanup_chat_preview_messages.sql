-- Remove unreliable preview rows created from chats.upsert events.
-- These were inserted with synthetic wa_message_id and often contained
-- "[Mensagem]" placeholder content or wrong from_me direction.
DELETE FROM public.whatsapp_messages
WHERE wa_message_id LIKE 'chat-preview:%'
   OR content = '[Mensagem]';
