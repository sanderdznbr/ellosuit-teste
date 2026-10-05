UPDATE public.whatsapp_sessions
SET session_data = COALESCE(session_data, '{}'::jsonb)
  || jsonb_build_object(
    'owner_lid', '114392511307798',
    'owner_lid_learned_at', now()::text,
    'owner_lid_source', 'manual_seed'
  )
WHERE id = '1eb44b77-9107-47c8-846b-40447025d297';

UPDATE public.whatsapp_messages m
SET from_me = true,
    status = 'sent'
FROM public.whatsapp_conversations c
WHERE m.conversation_id = c.id
  AND c.session_id = '1eb44b77-9107-47c8-846b-40447025d297'
  AND m.from_me = false
  AND m.sender_phone = '114392511307798';