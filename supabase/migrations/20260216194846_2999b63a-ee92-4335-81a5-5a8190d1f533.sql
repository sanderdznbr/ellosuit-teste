CREATE OR REPLACE FUNCTION notify_on_whatsapp_message()
RETURNS TRIGGER AS $$
DECLARE
  conv_record RECORD;
BEGIN
  -- Only notify for incoming messages
  IF NEW.from_me = true THEN
    RETURN NEW;
  END IF;

  -- Get conversation details
  SELECT c.contact_name, c.contact_phone, c.company_id, cu.user_id
  INTO conv_record
  FROM whatsapp_conversations c
  JOIN company_users cu ON cu.company_id = c.company_id AND cu.role IN ('admin', 'manager')
  WHERE c.id = NEW.conversation_id
  LIMIT 1;

  IF conv_record IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, company_id, title, message, type, category, icon, action_url, metadata)
    VALUES (
      conv_record.user_id,
      conv_record.company_id,
      'Nova mensagem no WhatsApp',
      COALESCE(conv_record.contact_name, conv_record.contact_phone) || ': ' || LEFT(COALESCE(NEW.content, '[Mídia]'), 80),
      'info',
      'crm',
      'MessageSquare',
      '/dashboard/crm-whatsapp',
      jsonb_build_object('conversation_id', NEW.conversation_id)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;