ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS lead_score_data jsonb,
  ADD COLUMN IF NOT EXISTS lead_score_updated_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS lead_score_sig text;

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_lead_score_updated_at
  ON public.whatsapp_conversations (lead_score_updated_at);