
-- Extend autopilot config with self-learning fields
ALTER TABLE public.crm_autopilot_configs
  ADD COLUMN IF NOT EXISTS learning_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_configure boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS learned_prompt text,
  ADD COLUMN IF NOT EXISTS writing_style_summary text,
  ADD COLUMN IF NOT EXISTS avg_msgs_per_turn numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_self_config_at timestamptz;

-- Trigger to auto-collect user outbound text messages into style corpus for learning
CREATE OR REPLACE FUNCTION public.autopilot_collect_style()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_learning boolean;
BEGIN
  IF NEW.from_me IS NOT TRUE THEN RETURN NEW; END IF;
  IF NEW.message_type IS DISTINCT FROM 'text' THEN RETURN NEW; END IF;
  IF NEW.content IS NULL OR length(btrim(NEW.content)) < 6 THEN RETURN NEW; END IF;

  SELECT company_id INTO v_company_id FROM whatsapp_conversations WHERE id = NEW.conversation_id;
  IF v_company_id IS NULL THEN RETURN NEW; END IF;

  SELECT COALESCE(learning_enabled, true) INTO v_learning
  FROM crm_autopilot_configs WHERE company_id = v_company_id;
  IF v_learning IS FALSE THEN RETURN NEW; END IF;

  INSERT INTO crm_autopilot_style_corpus (company_id, source, content, metadata)
  VALUES (v_company_id, 'whatsapp_outbound', NEW.content, jsonb_build_object('conversation_id', NEW.conversation_id, 'message_id', NEW.id));

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'autopilot_collect_style: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_autopilot_collect_style ON public.whatsapp_messages;
CREATE TRIGGER trg_autopilot_collect_style
AFTER INSERT ON public.whatsapp_messages
FOR EACH ROW EXECUTE FUNCTION public.autopilot_collect_style();
