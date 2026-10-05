
CREATE TABLE public.chatbot_builder_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'Nova conversa',
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  nodes JSONB NOT NULL DEFAULT '[]'::jsonb,
  edges JSONB NOT NULL DEFAULT '[]'::jsonb,
  flow_name TEXT NOT NULL DEFAULT 'Novo chatbot',
  published_flow_id UUID NULL REFERENCES public.chatbot_flows(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chatbot_builder_sessions TO authenticated;
GRANT ALL ON public.chatbot_builder_sessions TO service_role;

ALTER TABLE public.chatbot_builder_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own builder sessions"
  ON public.chatbot_builder_sessions FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND public.user_belongs_to_company(company_id, auth.uid()));

CREATE POLICY "Users create own builder sessions"
  ON public.chatbot_builder_sessions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.user_belongs_to_company(company_id, auth.uid()));

CREATE POLICY "Users update own builder sessions"
  ON public.chatbot_builder_sessions FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete own builder sessions"
  ON public.chatbot_builder_sessions FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX idx_chatbot_builder_sessions_user ON public.chatbot_builder_sessions(user_id, updated_at DESC);

CREATE TRIGGER trg_chatbot_builder_sessions_updated_at
  BEFORE UPDATE ON public.chatbot_builder_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
