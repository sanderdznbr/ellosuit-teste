DELETE FROM public.whatsapp_messages
WHERE wa_message_id LIKE 'chat-preview:%'
   OR content = '[Mensagem]';