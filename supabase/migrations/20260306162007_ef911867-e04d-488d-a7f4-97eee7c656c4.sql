
-- Meta WhatsApp Sessions (API Oficial)
CREATE TABLE public.meta_whatsapp_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  instance_name TEXT NOT NULL DEFAULT 'Meta Business',
  status TEXT NOT NULL DEFAULT 'disconnected',
  phone_number TEXT,
  phone_name TEXT,
  phone_number_id TEXT,
  waba_id TEXT,
  access_token TEXT,
  webhook_verify_token TEXT DEFAULT encode(gen_random_bytes(16), 'hex'),
  profile_picture TEXT,
  connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Meta WhatsApp Conversations
CREATE TABLE public.meta_whatsapp_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.meta_whatsapp_sessions(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  contact_phone TEXT NOT NULL,
  contact_name TEXT,
  profile_picture TEXT,
  last_message TEXT,
  last_message_at TIMESTAMPTZ DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'active',
  unread_count INT DEFAULT 0,
  pipeline_stage TEXT DEFAULT 'new',
  labels TEXT[] DEFAULT '{}',
  assigned_agent_id UUID,
  ai_auto_reply_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Meta WhatsApp Messages
CREATE TABLE public.meta_whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.meta_whatsapp_conversations(id) ON DELETE CASCADE NOT NULL,
  session_id UUID REFERENCES public.meta_whatsapp_sessions(id) ON DELETE CASCADE,
  content TEXT,
  from_me BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'sent',
  sender_name TEXT,
  wa_message_id TEXT,
  message_type TEXT DEFAULT 'text',
  media_url TEXT,
  media_mime_type TEXT,
  reply_to_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_meta_wa_sessions_company ON public.meta_whatsapp_sessions(company_id);
CREATE INDEX idx_meta_wa_convos_company ON public.meta_whatsapp_conversations(company_id);
CREATE INDEX idx_meta_wa_convos_session ON public.meta_whatsapp_conversations(session_id);
CREATE INDEX idx_meta_wa_convos_phone ON public.meta_whatsapp_conversations(contact_phone);
CREATE INDEX idx_meta_wa_msgs_convo ON public.meta_whatsapp_messages(conversation_id);
CREATE INDEX idx_meta_wa_msgs_wa_id ON public.meta_whatsapp_messages(wa_message_id);

-- RLS
ALTER TABLE public.meta_whatsapp_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own company meta sessions"
ON public.meta_whatsapp_sessions FOR ALL TO authenticated
USING (public.user_belongs_to_company(company_id, auth.uid()));

CREATE POLICY "Users can manage own company meta conversations"
ON public.meta_whatsapp_conversations FOR ALL TO authenticated
USING (public.user_belongs_to_company(company_id, auth.uid()));

CREATE POLICY "Users can manage own company meta messages"
ON public.meta_whatsapp_messages FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.meta_whatsapp_conversations c
  WHERE c.id = meta_whatsapp_messages.conversation_id
  AND public.user_belongs_to_company(c.company_id, auth.uid())
));

-- Auto-update updated_at
CREATE TRIGGER meta_sessions_updated_at BEFORE UPDATE ON public.meta_whatsapp_sessions
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER meta_convos_updated_at BEFORE UPDATE ON public.meta_whatsapp_conversations
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
