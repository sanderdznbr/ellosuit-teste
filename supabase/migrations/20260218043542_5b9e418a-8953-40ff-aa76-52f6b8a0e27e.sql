
-- Table to track ALL API usage with real costs
CREATE TABLE public.api_usage_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id),
  user_id UUID,
  service_type TEXT NOT NULL, -- 'elevenlabs_tts', 'lovable_ai', 'openai', 'send_email', 'whatsapp_message', 'whatsapp_media', 'assemblyai', 'deepgram', 'livekit', 'pagarme'
  action TEXT NOT NULL, -- 'tts_generate', 'chat_completion', 'send_message', 'transcribe', etc.
  model TEXT, -- 'eleven_multilingual_v2', 'google/gemini-2.5-flash', 'gpt-5', etc.
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  characters_used INTEGER DEFAULT 0, -- for TTS
  duration_seconds NUMERIC DEFAULT 0, -- for audio/meetings
  file_size_bytes BIGINT DEFAULT 0, -- for media
  unit_cost NUMERIC(10,6) NOT NULL DEFAULT 0, -- cost per unit in USD
  total_cost NUMERIC(10,6) NOT NULL DEFAULT 0, -- total cost in USD
  metadata JSONB DEFAULT '{}', -- extra details
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for fast querying
CREATE INDEX idx_api_usage_logs_company ON public.api_usage_logs(company_id);
CREATE INDEX idx_api_usage_logs_service ON public.api_usage_logs(service_type);
CREATE INDEX idx_api_usage_logs_created ON public.api_usage_logs(created_at);
CREATE INDEX idx_api_usage_logs_user ON public.api_usage_logs(user_id);

-- Enable RLS
ALTER TABLE public.api_usage_logs ENABLE ROW LEVEL SECURITY;

-- Only adminmaster can read
CREATE POLICY "Adminmaster can view all usage logs"
ON public.api_usage_logs FOR SELECT
USING (public.is_adminmaster(auth.uid()));

-- Edge functions insert via service role (no RLS needed for insert from backend)
CREATE POLICY "Service role can insert usage logs"
ON public.api_usage_logs FOR INSERT
WITH CHECK (true);
