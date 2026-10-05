DO $$
DECLARE
  real_conv_id uuid;
  lid_conv_id uuid;
  target_session_id uuid := '1eb44b77-9107-47c8-846b-40447025d297'::uuid;
  target_company_id uuid;
  moved_count integer := 0;
  latest_msg record;
BEGIN
  SELECT id, company_id INTO real_conv_id, target_company_id
  FROM public.whatsapp_conversations
  WHERE contact_phone = '5541995018630'
    AND session_id = target_session_id
  ORDER BY last_message_at DESC NULLS LAST
  LIMIT 1;

  SELECT id INTO lid_conv_id
  FROM public.whatsapp_conversations
  WHERE contact_phone = '152927226306619'
    AND session_id = target_session_id
  ORDER BY last_message_at DESC NULLS LAST
  LIMIT 1;

  IF real_conv_id IS NOT NULL THEN
    UPDATE public.whatsapp_conversations
    SET contact_lid = '152927226306619',
        remote_jid = '554195018630@s.whatsapp.net',
        updated_at = now()
    WHERE id = real_conv_id;
  END IF;

  IF real_conv_id IS NOT NULL AND lid_conv_id IS NOT NULL THEN
    UPDATE public.whatsapp_messages
    SET conversation_id = real_conv_id,
        session_id = target_session_id,
        company_id = target_company_id
    WHERE conversation_id = lid_conv_id;

    GET DIAGNOSTICS moved_count = ROW_COUNT;

    SELECT content, timestamp INTO latest_msg
    FROM public.whatsapp_messages
    WHERE conversation_id = real_conv_id
    ORDER BY timestamp DESC NULLS LAST, created_at DESC
    LIMIT 1;

    IF latest_msg IS NOT NULL THEN
      UPDATE public.whatsapp_conversations
      SET last_message = latest_msg.content,
          last_message_at = latest_msg.timestamp,
          unread_count = 0,
          updated_at = now()
      WHERE id = real_conv_id;
    END IF;

    DELETE FROM public.whatsapp_conversations
    WHERE id = lid_conv_id
      AND NOT EXISTS (
        SELECT 1 FROM public.whatsapp_messages WHERE conversation_id = lid_conv_id
      );

    RAISE NOTICE 'Moved % messages from LID conversation to real conversation', moved_count;
  END IF;
END $$;