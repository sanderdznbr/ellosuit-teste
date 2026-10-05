
-- Trigger function to notify on new calendar event
CREATE OR REPLACE FUNCTION public.notify_on_calendar_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Notify the event creator
  INSERT INTO public.notifications (user_id, company_id, title, message, type, category, icon, action_url, metadata)
  VALUES (
    NEW.created_by,
    NEW.company_id,
    'Novo evento na agenda',
    'Evento "' || NEW.title || '" agendado para ' || to_char(NEW.start_date::timestamp, 'DD/MM às HH24:MI'),
    'info',
    'calendar',
    'Calendar',
    '/dashboard/agenda',
    jsonb_build_object('event_id', NEW.id, 'event_type', NEW.event_type)
  );

  -- If assigned to someone else, notify them too
  IF NEW.assigned_user_id IS NOT NULL AND NEW.assigned_user_id != NEW.created_by THEN
    INSERT INTO public.notifications (user_id, company_id, title, message, type, category, icon, action_url, metadata)
    VALUES (
      NEW.assigned_user_id,
      NEW.company_id,
      'Evento atribuído a você',
      'Você foi atribuído ao evento "' || NEW.title || '" em ' || to_char(NEW.start_date::timestamp, 'DD/MM às HH24:MI'),
      'action',
      'calendar',
      'Calendar',
      '/dashboard/agenda',
      jsonb_build_object('event_id', NEW.id)
    );
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER notify_calendar_event_created
AFTER INSERT ON public.calendar_events
FOR EACH ROW EXECUTE FUNCTION public.notify_on_calendar_event();

-- Trigger function to notify on new client
CREATE OR REPLACE FUNCTION public.notify_on_new_client()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.notifications (user_id, company_id, title, message, type, category, icon, action_url, metadata)
  VALUES (
    NEW.created_by,
    NEW.company_id,
    'Novo contato cadastrado',
    NEW.name || COALESCE(' (' || NEW.email || ')', '') || ' foi adicionado à sua base',
    'success',
    'crm',
    'Users',
    '/dashboard/cadastros',
    jsonb_build_object('client_id', NEW.id, 'client_type', NEW.client_type)
  );
  RETURN NEW;
END;
$function$;

CREATE TRIGGER notify_new_client
AFTER INSERT ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.notify_on_new_client();

-- Trigger function to notify on new WhatsApp message (incoming only)
CREATE OR REPLACE FUNCTION public.notify_on_whatsapp_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  conv_record RECORD;
  target_user_id UUID;
BEGIN
  -- Only notify for incoming messages
  IF NEW.is_from_me = true THEN
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
$function$;

CREATE TRIGGER notify_whatsapp_message
AFTER INSERT ON public.whatsapp_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_on_whatsapp_message();

-- Trigger on email opens
CREATE OR REPLACE FUNCTION public.notify_on_email_open()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  email_record RECORD;
BEGIN
  IF NEW.event_type != 'open' THEN
    RETURN NEW;
  END IF;

  SELECT e.user_id, e.company_id, e.subject, e.recipient_name, e.recipient_email
  INTO email_record
  FROM emails e
  WHERE e.id = NEW.email_id;

  IF email_record IS NOT NULL AND email_record.user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, company_id, title, message, type, category, icon, action_url, metadata)
    VALUES (
      email_record.user_id,
      email_record.company_id,
      'Email aberto',
      COALESCE(email_record.recipient_name, email_record.recipient_email) || ' abriu "' || LEFT(email_record.subject, 50) || '"',
      'success',
      'email',
      'Mail',
      '/dashboard/email-tracker',
      jsonb_build_object('email_id', NEW.email_id)
    );
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER notify_email_open
AFTER INSERT ON public.email_events
FOR EACH ROW EXECUTE FUNCTION public.notify_on_email_open();

-- Trigger on meeting room creation
CREATE OR REPLACE FUNCTION public.notify_on_meeting_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.notifications (user_id, company_id, title, message, type, category, icon, action_url, metadata)
  VALUES (
    NEW.created_by,
    NEW.company_id,
    'Sala de reunião criada',
    'Sala "' || NEW.name || '" está ativa e pronta para participantes',
    'info',
    'meeting',
    'Video',
    '/dashboard/reunioes',
    jsonb_build_object('room_id', NEW.id)
  );
  RETURN NEW;
END;
$function$;

CREATE TRIGGER notify_meeting_created
AFTER INSERT ON public.meeting_rooms
FOR EACH ROW EXECUTE FUNCTION public.notify_on_meeting_created();
