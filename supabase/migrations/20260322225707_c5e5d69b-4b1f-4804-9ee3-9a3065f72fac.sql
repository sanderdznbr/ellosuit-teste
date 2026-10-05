-- YCloud WhatsApp CRM tables (admin-only testing)

CREATE TABLE public.ycloud_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  phone_number text,
  ycloud_api_key text NOT NULL,
  ycloud_phone_number_id text,
  waba_id text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error')),
  webhook_secret text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

CREATE TABLE public.ycloud_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.ycloud_sessions(id) ON DELETE CASCADE NOT NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  contact_phone text NOT NULL,
  contact_name text,
  last_message text,
  last_message_at timestamptz DEFAULT now(),
  unread_count int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(session_id, contact_phone)
);

CREATE TABLE public.ycloud_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.ycloud_conversations(id) ON DELETE CASCADE NOT NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  ycloud_message_id text,
  wamid text,
  from_me boolean DEFAULT false,
  content text,
  message_type text DEFAULT 'text',
  media_url text,
  status text DEFAULT 'sent',
  raw_payload jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_ycloud_conversations_session ON public.ycloud_conversations(session_id);
CREATE INDEX idx_ycloud_conversations_company ON public.ycloud_conversations(company_id);
CREATE INDEX idx_ycloud_messages_conversation ON public.ycloud_messages(conversation_id);
CREATE INDEX idx_ycloud_messages_created ON public.ycloud_messages(created_at DESC);

ALTER TABLE public.ycloud_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ycloud_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ycloud_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "adminmaster_ycloud_sessions" ON public.ycloud_sessions
  FOR ALL TO authenticated
  USING (public.is_adminmaster(auth.uid()));

CREATE POLICY "adminmaster_ycloud_conversations" ON public.ycloud_conversations
  FOR ALL TO authenticated
  USING (public.is_adminmaster(auth.uid()));

CREATE POLICY "adminmaster_ycloud_messages" ON public.ycloud_messages
  FOR ALL TO authenticated
  USING (public.is_adminmaster(auth.uid()));

CREATE TRIGGER ycloud_sessions_updated_at
  BEFORE UPDATE ON public.ycloud_sessions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER ycloud_conversations_updated_at
  BEFORE UPDATE ON public.ycloud_conversations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();