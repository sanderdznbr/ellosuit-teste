
-- Tabela de API Keys para WhatsApp
CREATE TABLE public.whatsapp_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.whatsapp_sessions(id) ON DELETE CASCADE,
  api_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT 'Default',
  is_active BOOLEAN NOT NULL DEFAULT true,
  rate_limit_per_minute INTEGER NOT NULL DEFAULT 30,
  total_messages_sent BIGINT NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de logs de chamadas à API
CREATE TABLE public.whatsapp_api_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID NOT NULL REFERENCES public.whatsapp_api_keys(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  message_preview TEXT,
  status TEXT NOT NULL,
  error_message TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_api_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for whatsapp_api_keys
CREATE POLICY "Users can view their company api keys"
ON public.whatsapp_api_keys FOR SELECT
USING (
  company_id IN (
    SELECT company_id FROM public.company_users WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can create api keys for their company"
ON public.whatsapp_api_keys FOR INSERT
WITH CHECK (
  company_id IN (
    SELECT company_id FROM public.company_users WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their company api keys"
ON public.whatsapp_api_keys FOR UPDATE
USING (
  company_id IN (
    SELECT company_id FROM public.company_users WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their company api keys"
ON public.whatsapp_api_keys FOR DELETE
USING (
  company_id IN (
    SELECT company_id FROM public.company_users WHERE user_id = auth.uid()
  )
);

-- RLS policies for whatsapp_api_logs (view only via company)
CREATE POLICY "Users can view their company api logs"
ON public.whatsapp_api_logs FOR SELECT
USING (
  api_key_id IN (
    SELECT id FROM public.whatsapp_api_keys WHERE company_id IN (
      SELECT company_id FROM public.company_users WHERE user_id = auth.uid()
    )
  )
);

-- Service role needs to insert logs from edge function
CREATE POLICY "Service role can insert api logs"
ON public.whatsapp_api_logs FOR INSERT
WITH CHECK (true);

-- Trigger for updated_at on api_keys
CREATE TRIGGER update_whatsapp_api_keys_updated_at
BEFORE UPDATE ON public.whatsapp_api_keys
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for fast API key lookups
CREATE INDEX idx_whatsapp_api_keys_api_key ON public.whatsapp_api_keys(api_key);
CREATE INDEX idx_whatsapp_api_logs_api_key_id ON public.whatsapp_api_logs(api_key_id);
CREATE INDEX idx_whatsapp_api_logs_created_at ON public.whatsapp_api_logs(created_at);
