
DROP INDEX IF EXISTS public.whatsapp_messages_wa_message_id_unique;
ALTER TABLE public.whatsapp_messages DROP CONSTRAINT IF EXISTS whatsapp_messages_wa_message_id_key;
DROP INDEX IF EXISTS public.whatsapp_messages_wa_message_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_messages_wa_msg_company_unique
  ON public.whatsapp_messages (wa_message_id, company_id)
  WHERE wa_message_id IS NOT NULL;
