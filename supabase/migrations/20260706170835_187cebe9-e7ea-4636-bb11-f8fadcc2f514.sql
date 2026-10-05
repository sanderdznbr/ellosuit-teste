
CREATE TABLE public.chatbot_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  provider TEXT NOT NULL,
  name TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  credentials JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chatbot_connections TO authenticated;
GRANT ALL ON public.chatbot_connections TO service_role;

ALTER TABLE public.chatbot_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view company chatbot connections"
  ON public.chatbot_connections FOR SELECT
  USING (company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid()));

CREATE POLICY "Users create chatbot connections in their company"
  ON public.chatbot_connections FOR INSERT
  WITH CHECK (
    company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid())
    AND created_by = auth.uid()
  );

CREATE POLICY "Users update company chatbot connections"
  ON public.chatbot_connections FOR UPDATE
  USING (company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid()));

CREATE POLICY "Users delete company chatbot connections"
  ON public.chatbot_connections FOR DELETE
  USING (company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid()));

CREATE INDEX idx_chatbot_connections_company ON public.chatbot_connections(company_id);

CREATE TRIGGER update_chatbot_connections_updated_at
  BEFORE UPDATE ON public.chatbot_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
