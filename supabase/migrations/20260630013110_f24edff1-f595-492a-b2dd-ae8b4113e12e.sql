
DELETE FROM public.whatsapp_messages
WHERE conversation_id IN (
  SELECT id FROM public.whatsapp_conversations
  WHERE remote_jid LIKE '%@g.us'
     OR length(regexp_replace(coalesce(contact_phone,''), '\D', '', 'g')) > 15
);

DELETE FROM public.whatsapp_conversations
WHERE remote_jid LIKE '%@g.us'
   OR length(regexp_replace(coalesce(contact_phone,''), '\D', '', 'g')) > 15;
