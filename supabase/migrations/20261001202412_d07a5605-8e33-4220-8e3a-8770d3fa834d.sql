ALTER TABLE public.whatsapp_conversations ADD COLUMN IF NOT EXISTS channel_phone text;
CREATE INDEX IF NOT EXISTS idx_wa_conv_company_channel_phone ON public.whatsapp_conversations(company_id, channel_phone);

CREATE OR REPLACE FUNCTION public.wa_conv_fill_channel_phone()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.session_id IS NOT NULL AND (NEW.channel_phone IS NULL OR TG_OP='UPDATE' AND NEW.session_id IS DISTINCT FROM OLD.session_id) THEN
    SELECT regexp_replace(phone_number, '\D', '', 'g') INTO NEW.channel_phone
    FROM public.whatsapp_sessions WHERE id = NEW.session_id AND phone_number IS NOT NULL AND phone_number <> '';
    IF NEW.channel_phone IS NULL AND TG_OP='UPDATE' THEN NEW.channel_phone := OLD.channel_phone; END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_wa_conv_fill_channel_phone ON public.whatsapp_conversations;
CREATE TRIGGER trg_wa_conv_fill_channel_phone BEFORE INSERT OR UPDATE OF session_id ON public.whatsapp_conversations
FOR EACH ROW EXECUTE FUNCTION public.wa_conv_fill_channel_phone();

CREATE OR REPLACE FUNCTION public.wa_session_reattach_conversations()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_phone text := regexp_replace(coalesce(NEW.phone_number,''), '\D', '', 'g');
BEGIN
  IF v_phone = '' OR NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' AND regexp_replace(coalesce(OLD.phone_number,''), '\D', '', 'g') = v_phone AND OLD.deleted_at IS NOT DISTINCT FROM NEW.deleted_at THEN RETURN NEW; END IF;
  -- tag conversations of this session that still lack the number
  UPDATE public.whatsapp_conversations SET channel_phone = v_phone
   WHERE session_id = NEW.id AND channel_phone IS NULL;
  -- pull every older conversation/message from the same number into this channel
  UPDATE public.whatsapp_conversations SET session_id = NEW.id
   WHERE company_id = NEW.company_id AND channel_phone = v_phone AND session_id IS DISTINCT FROM NEW.id;
  UPDATE public.whatsapp_messages m SET session_id = NEW.id
   FROM public.whatsapp_conversations c
   WHERE m.conversation_id = c.id AND c.session_id = NEW.id AND m.session_id IS DISTINCT FROM NEW.id;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'wa_session_reattach_conversations: %', SQLERRM; RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_wa_session_reattach ON public.whatsapp_sessions;
CREATE TRIGGER trg_wa_session_reattach AFTER INSERT OR UPDATE OF phone_number, deleted_at ON public.whatsapp_sessions
FOR EACH ROW EXECUTE FUNCTION public.wa_session_reattach_conversations();

-- automatic cleanups now soft-delete instead of removing channels
CREATE OR REPLACE FUNCTION public.cleanup_disconnected_whatsapp_sessions()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  UPDATE public.whatsapp_sessions SET deleted_at = now(), updated_at = now()
  WHERE deleted_at IS NULL AND status IN ('disconnected','waiting_qr','connecting')
    AND updated_at < now() - interval '1 hour'
    AND (phone_number IS NULL OR phone_number = '');
$$;
CREATE OR REPLACE FUNCTION public.cleanup_inactive_whatsapp_sessions()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n integer := 0;
BEGIN
  UPDATE public.whatsapp_sessions SET deleted_at = now(), updated_at = now()
  WHERE deleted_at IS NULL AND status IS DISTINCT FROM 'connected'
    AND COALESCE(last_seen_at, updated_at, created_at) < now() - interval '24 hours';
  GET DIAGNOSTICS n = ROW_COUNT; RETURN n;
END $$;