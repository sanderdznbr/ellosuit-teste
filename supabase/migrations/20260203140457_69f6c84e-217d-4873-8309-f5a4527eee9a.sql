-- Tabela para sessões WhatsApp (QR Code)
CREATE TABLE IF NOT EXISTS public.whatsapp_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  instance_name TEXT NOT NULL,
  instance_id TEXT,
  qr_code TEXT,
  status TEXT NOT NULL DEFAULT 'disconnected',
  phone_number TEXT,
  phone_name TEXT,
  profile_picture TEXT,
  connected_at TIMESTAMP WITH TIME ZONE,
  last_seen_at TIMESTAMP WITH TIME ZONE,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para mensagens WhatsApp
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.whatsapp_sessions(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  message_id TEXT,
  from_me BOOLEAN NOT NULL DEFAULT false,
  sender_phone TEXT NOT NULL,
  sender_name TEXT,
  recipient_phone TEXT NOT NULL,
  recipient_name TEXT,
  content TEXT,
  media_url TEXT,
  media_type TEXT,
  message_type TEXT NOT NULL DEFAULT 'text',
  status TEXT NOT NULL DEFAULT 'sent',
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Adicionar campos na tabela de conversas
ALTER TABLE public.whatsapp_conversations 
ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES public.whatsapp_sessions(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS unread_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_message TEXT,
ADD COLUMN IF NOT EXISTS profile_picture TEXT,
ADD COLUMN IF NOT EXISTS assigned_agent_id UUID REFERENCES public.ai_agents(id) ON DELETE SET NULL;

-- Adicionar campo de integração WhatsApp na tabela de agentes
ALTER TABLE public.ai_agents
ADD COLUMN IF NOT EXISTS whatsapp_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS whatsapp_session_id UUID REFERENCES public.whatsapp_sessions(id) ON DELETE SET NULL;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_company ON public.whatsapp_sessions(company_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_status ON public.whatsapp_sessions(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_session ON public.whatsapp_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_conversation ON public.whatsapp_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_timestamp ON public.whatsapp_messages(timestamp DESC);

-- RLS Policies
ALTER TABLE public.whatsapp_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- Políticas para sessões
CREATE POLICY "Users can view company sessions" ON public.whatsapp_sessions
  FOR SELECT USING (company_id IN (
    SELECT company_id FROM company_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can create sessions in their company" ON public.whatsapp_sessions
  FOR INSERT WITH CHECK (
    company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid())
    AND user_id = auth.uid()
  );

CREATE POLICY "Users can update their sessions" ON public.whatsapp_sessions
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their sessions" ON public.whatsapp_sessions
  FOR DELETE USING (user_id = auth.uid());

-- Políticas para mensagens
CREATE POLICY "Users can view company messages" ON public.whatsapp_messages
  FOR SELECT USING (company_id IN (
    SELECT company_id FROM company_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can create messages in their company" ON public.whatsapp_messages
  FOR INSERT WITH CHECK (company_id IN (
    SELECT company_id FROM company_users WHERE user_id = auth.uid()
  ));

-- Trigger para updated_at
CREATE TRIGGER update_whatsapp_sessions_updated_at
  BEFORE UPDATE ON public.whatsapp_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();