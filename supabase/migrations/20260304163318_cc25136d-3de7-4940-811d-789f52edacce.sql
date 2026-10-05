
-- Conversations table for AI assistant chat history
CREATE TABLE public.ai_assistant_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Nova conversa',
  last_message_preview TEXT,
  message_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Messages table
CREATE TABLE public.ai_assistant_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.ai_assistant_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  file_url TEXT,
  file_name TEXT,
  file_type TEXT,
  action JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_ai_conversations_user ON public.ai_assistant_conversations(user_id, updated_at DESC);
CREATE INDEX idx_ai_messages_conversation ON public.ai_assistant_messages(conversation_id, created_at);

-- RLS
ALTER TABLE public.ai_assistant_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_assistant_messages ENABLE ROW LEVEL SECURITY;

-- Policies: users can only access their own conversations
CREATE POLICY "Users can manage own conversations"
  ON public.ai_assistant_conversations FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage messages in own conversations"
  ON public.ai_assistant_messages FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ai_assistant_conversations c
    WHERE c.id = conversation_id AND c.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.ai_assistant_conversations c
    WHERE c.id = conversation_id AND c.user_id = auth.uid()
  ));

-- Auto-update updated_at
CREATE TRIGGER handle_ai_conversations_updated_at
  BEFORE UPDATE ON public.ai_assistant_conversations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
