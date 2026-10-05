
-- Trigger que chama a edge function crm-autopilot-ask-pause via pg_net
-- assim que uma conversa passa a ter human_takeover=true, garantindo prompt ao Pai em <5s.

CREATE OR REPLACE FUNCTION public.trg_autopilot_ask_pause_on_takeover()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text;
  v_key text;
  v_is_active boolean;
BEGIN
  -- Só dispara quando human_takeover passou de false/null para true
  IF NEW.human_takeover IS NOT TRUE THEN RETURN NEW; END IF;
  IF OLD.human_takeover IS TRUE THEN RETURN NEW; END IF;

  -- Só se piloto automático estiver ativo para a empresa
  SELECT is_active INTO v_is_active
  FROM public.crm_autopilot_configs
  WHERE company_id = NEW.company_id
  LIMIT 1;
  IF v_is_active IS NOT TRUE THEN RETURN NEW; END IF;

  SELECT supabase_url, service_role_key INTO v_url, v_key
  FROM public.autopilot_runtime_config WHERE id = 1;
  IF v_url IS NULL OR v_key IS NULL THEN RETURN NEW; END IF;

  PERFORM net.http_post(
    url := v_url || '/functions/v1/crm-autopilot-ask-pause',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || v_key
    ),
    body := jsonb_build_object('conversationId', NEW.id)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Nunca bloqueia o UPDATE por falha do net.http_post
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_autopilot_ask_pause_on_takeover ON public.whatsapp_conversations;
CREATE TRIGGER trg_autopilot_ask_pause_on_takeover
AFTER UPDATE OF human_takeover ON public.whatsapp_conversations
FOR EACH ROW
WHEN (NEW.human_takeover IS TRUE AND (OLD.human_takeover IS DISTINCT FROM NEW.human_takeover))
EXECUTE FUNCTION public.trg_autopilot_ask_pause_on_takeover();
