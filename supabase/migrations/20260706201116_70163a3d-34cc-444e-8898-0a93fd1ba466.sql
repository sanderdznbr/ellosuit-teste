
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE TABLE IF NOT EXISTS public.autopilot_runtime_config (
  id SMALLINT PRIMARY KEY DEFAULT 1,
  supabase_url TEXT NOT NULL,
  service_role_key TEXT NOT NULL,
  CHECK (id = 1)
);
REVOKE ALL ON public.autopilot_runtime_config FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.autopilot_runtime_config TO service_role;
ALTER TABLE public.autopilot_runtime_config ENABLE ROW LEVEL SECURITY;

INSERT INTO public.autopilot_runtime_config (id, supabase_url, service_role_key)
SELECT 1, 'https://jwddiyuezqrpuakazvgg.supabase.co', value
FROM public.secret_config WHERE key = 'SUPABASE_SERVICE_ROLE_KEY'
ON CONFLICT (id) DO UPDATE SET
  supabase_url = EXCLUDED.supabase_url,
  service_role_key = EXCLUDED.service_role_key;

CREATE OR REPLACE FUNCTION public.autopilot_dispatch_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg RECORD;
  runtime RECORD;
  conv RECORD;
BEGIN
  SELECT * INTO runtime FROM public.autopilot_runtime_config WHERE id = 1;
  IF runtime IS NULL OR runtime.service_role_key IS NULL OR runtime.service_role_key = '' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO conv FROM public.whatsapp_conversations WHERE id = NEW.conversation_id;
  IF conv IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO cfg FROM public.crm_autopilot_configs WHERE company_id = conv.company_id;
  IF cfg IS NULL OR cfg.is_active IS NOT TRUE THEN RETURN NEW; END IF;

  IF NEW.from_me = false
     AND cfg.parent_phone IS NOT NULL
     AND cfg.parent_phone <> ''
     AND (
       conv.contact_phone = cfg.parent_phone
       OR regexp_replace(conv.contact_phone, '\D', '', 'g') = regexp_replace(cfg.parent_phone, '\D', '', 'g')
     )
  THEN
    PERFORM net.http_post(
      url := runtime.supabase_url || '/functions/v1/crm-autopilot-parent-reply',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || runtime.service_role_key),
      body := jsonb_build_object('companyId', conv.company_id,'parentPhone', cfg.parent_phone,'messageContent', NEW.content,'messageType', NEW.message_type,'mediaUrl', NEW.media_url)
    );
    RETURN NEW;
  END IF;

  IF NEW.from_me = false AND conv.human_takeover IS NOT TRUE THEN
    PERFORM net.http_post(
      url := runtime.supabase_url || '/functions/v1/crm-autopilot-respond',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || runtime.service_role_key),
      body := jsonb_build_object('conversationId', NEW.conversation_id,'incomingMessageId', NEW.id)
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'autopilot_dispatch_on_message: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_autopilot_dispatch ON public.whatsapp_messages;
CREATE TRIGGER trg_autopilot_dispatch
  AFTER INSERT ON public.whatsapp_messages
  FOR EACH ROW EXECUTE FUNCTION public.autopilot_dispatch_on_message();

SELECT cron.schedule(
  'crm-autopilot-parent-timeout',
  '*/5 * * * *',
  $CRON$
  SELECT net.http_post(
    url := (SELECT supabase_url FROM public.autopilot_runtime_config WHERE id = 1) || '/functions/v1/crm-autopilot-parent-timeout',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT service_role_key FROM public.autopilot_runtime_config WHERE id = 1)),
    body := '{}'::jsonb
  );
  $CRON$
);
