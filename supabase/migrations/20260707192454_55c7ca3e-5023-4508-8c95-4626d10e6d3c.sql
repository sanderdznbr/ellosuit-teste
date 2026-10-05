
-- Allow session_id to be NULL on messages so history survives session deletion
ALTER TABLE public.whatsapp_messages ALTER COLUMN session_id DROP NOT NULL;

-- Switch cascade → SET NULL for session_id on conversations, messages and contacts
ALTER TABLE public.whatsapp_conversations DROP CONSTRAINT IF EXISTS whatsapp_conversations_session_id_fkey;
ALTER TABLE public.whatsapp_conversations
  ADD CONSTRAINT whatsapp_conversations_session_id_fkey
  FOREIGN KEY (session_id) REFERENCES public.whatsapp_sessions(id) ON DELETE SET NULL;

ALTER TABLE public.whatsapp_messages DROP CONSTRAINT IF EXISTS whatsapp_messages_session_id_fkey;
ALTER TABLE public.whatsapp_messages
  ADD CONSTRAINT whatsapp_messages_session_id_fkey
  FOREIGN KEY (session_id) REFERENCES public.whatsapp_sessions(id) ON DELETE SET NULL;

ALTER TABLE public.whatsapp_contacts DROP CONSTRAINT IF EXISTS whatsapp_contacts_session_id_fkey;
ALTER TABLE public.whatsapp_contacts
  ADD CONSTRAINT whatsapp_contacts_session_id_fkey
  FOREIGN KEY (session_id) REFERENCES public.whatsapp_sessions(id) ON DELETE SET NULL;

-- Helpful indexes so re-linking-by-phone on reconnect is fast
CREATE INDEX IF NOT EXISTS idx_wa_conversations_company_phone
  ON public.whatsapp_conversations (company_id, contact_phone);
CREATE INDEX IF NOT EXISTS idx_wa_sessions_company_phone
  ON public.whatsapp_sessions (company_id, phone_number);
