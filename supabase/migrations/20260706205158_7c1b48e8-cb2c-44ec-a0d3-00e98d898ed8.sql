
CREATE OR REPLACE FUNCTION public.autopilot_on_chatbot_end()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  runtime RECORD;
  cfg RECORD;
  conv RECORD;
  last_inbound_ts timestamptz;
  last_outbound_ts timestamptz;
BEGIN
  -- Only fire when status transitions to a terminal state
  IF NEW.status NOT IN ('completed', 'stopped', 'failed') THEN
    RETURN NEW;
  END IF;
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT * INTO runtime FROM public.autopilot_runtime_config WHERE id = 1;
  IF runtime IS NULL OR runtime.service_role_key IS NULL OR runtime.service_role_key = '' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO conv FROM public.whatsapp_conversations WHERE id = NEW.conversation_id;
  IF conv IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO cfg FROM public.crm_autopilot_configs WHERE company_id = conv.company_id;
  IF cfg IS NULL OR cfg.is_active IS NOT TRUE THEN RETURN NEW; END IF;

  -- Check if the last customer message is unanswered
  SELECT MAX(timestamp) INTO last_inbound_ts
  FROM public.whatsapp_messages
  WHERE conversation_id = NEW.conversation_id AND from_me = false;

  SELECT MAX(timestamp) INTO last_outbound_ts
  FROM public.whatsapp_messages
  WHERE conversation_id = NEW.conversation_id
    AND from_me = true
    AND message_type <> 'system';

  IF last_inbound_ts IS NULL THEN RETURN NEW; END IF;
  IF last_outbound_ts IS NOT NULL AND last_outbound_ts >= last_inbound_ts THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := runtime.supabase_url || '/functions/v1/crm-autopilot-respond',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || runtime.service_role_key
    ),
    body := jsonb_build_object('conversationId', NEW.conversation_id)
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'autopilot_on_chatbot_end: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_autopilot_on_chatbot_end ON public.chatbot_executions;
CREATE TRIGGER trg_autopilot_on_chatbot_end
AFTER UPDATE ON public.chatbot_executions
FOR EACH ROW
EXECUTE FUNCTION public.autopilot_on_chatbot_end();
