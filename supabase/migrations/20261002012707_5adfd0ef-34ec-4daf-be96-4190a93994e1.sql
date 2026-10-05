ALTER TABLE public.whatsapp_api_keys
  ADD COLUMN IF NOT EXISTS webhook_url text,
  ADD COLUMN IF NOT EXISTS webhook_secret text DEFAULT encode(gen_random_bytes(24),'hex');
UPDATE public.whatsapp_api_keys SET webhook_secret = encode(gen_random_bytes(24),'hex') WHERE webhook_secret IS NULL;

CREATE TABLE public.post_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  api_key_id uuid REFERENCES public.whatsapp_api_keys(id) ON DELETE SET NULL,
  session_id uuid,
  conversation_id uuid,
  contact_phone text NOT NULL,
  contact_name text,
  external_id text,
  media_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  caption text,
  question text,
  status text NOT NULL DEFAULT 'pending',
  stage text NOT NULL DEFAULT 'awaiting_approval',
  version integer NOT NULL DEFAULT 1,
  history jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_client_reply text,
  revision_notes text,
  webhook_url text,
  auto_publish boolean NOT NULL DEFAULT false,
  publish_targets jsonb NOT NULL DEFAULT '[]'::jsonb,
  published_results jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.post_approvals TO authenticated;
GRANT ALL ON public.post_approvals TO service_role;
ALTER TABLE public.post_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company members view post approvals" ON public.post_approvals FOR SELECT TO authenticated
  USING (public.user_belongs_to_company(company_id, auth.uid()));
CREATE POLICY "Company members update post approvals" ON public.post_approvals FOR UPDATE TO authenticated
  USING (public.user_belongs_to_company(company_id, auth.uid()));
CREATE INDEX idx_post_approvals_conv_status ON public.post_approvals(conversation_id, status);
CREATE INDEX idx_post_approvals_company ON public.post_approvals(company_id, created_at DESC);
CREATE INDEX idx_post_approvals_phone ON public.post_approvals(company_id, contact_phone);
CREATE TRIGGER trg_post_approvals_updated BEFORE UPDATE ON public.post_approvals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.api_webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  api_key_id uuid REFERENCES public.whatsapp_api_keys(id) ON DELETE SET NULL,
  event text NOT NULL,
  url text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  response_status integer,
  response_body text,
  next_attempt_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.api_webhook_deliveries TO authenticated;
GRANT ALL ON public.api_webhook_deliveries TO service_role;
ALTER TABLE public.api_webhook_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company members view webhook deliveries" ON public.api_webhook_deliveries FOR SELECT TO authenticated
  USING (public.user_belongs_to_company(company_id, auth.uid()));
CREATE INDEX idx_api_webhook_deliveries_retry ON public.api_webhook_deliveries(status, next_attempt_at);
CREATE TRIGGER trg_api_webhook_deliveries_updated BEFORE UPDATE ON public.api_webhook_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.autopilot_dispatch_on_message()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  cfg RECORD; runtime RECORD; conv RECORD;
BEGIN
  SELECT * INTO runtime FROM public.autopilot_runtime_config WHERE id = 1;
  IF runtime IS NULL OR runtime.service_role_key IS NULL OR runtime.service_role_key = '' THEN RETURN NEW; END IF;
  SELECT * INTO conv FROM public.whatsapp_conversations WHERE id = NEW.conversation_id;
  IF conv IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO cfg FROM public.crm_autopilot_configs WHERE company_id = conv.company_id;
  IF cfg IS NULL OR cfg.is_active IS NOT TRUE THEN RETURN NEW; END IF;

  IF NEW.from_me = false AND cfg.parent_phone IS NOT NULL AND cfg.parent_phone <> '' AND (
       conv.contact_phone = cfg.parent_phone
       OR regexp_replace(conv.contact_phone, '\D', '', 'g') = regexp_replace(cfg.parent_phone, '\D', '', 'g'))
  THEN
    PERFORM net.http_post(
      url := runtime.supabase_url || '/functions/v1/crm-autopilot-parent-reply',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || runtime.service_role_key),
      body := jsonb_build_object('companyId', conv.company_id,'parentPhone', cfg.parent_phone,'messageContent', NEW.content,'messageType', NEW.message_type,'mediaUrl', NEW.media_url));
    RETURN NEW;
  END IF;

  -- Conversa reservada para aprovação de post via API: piloto não responde
  IF EXISTS (SELECT 1 FROM public.post_approvals pa WHERE pa.conversation_id = conv.id
             AND pa.status IN ('pending','awaiting_decision') AND (pa.expires_at IS NULL OR pa.expires_at > now())) THEN
    RETURN NEW;
  END IF;

  IF NEW.from_me = false AND conv.human_takeover IS NOT TRUE THEN
    PERFORM net.http_post(
      url := runtime.supabase_url || '/functions/v1/crm-autopilot-respond',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || runtime.service_role_key),
      body := jsonb_build_object('conversationId', NEW.conversation_id,'incomingMessageId', NEW.id));
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'autopilot_dispatch_on_message: %', SQLERRM;
  RETURN NEW;
END;
$function$;