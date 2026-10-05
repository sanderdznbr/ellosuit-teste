ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS human_takeover_reason TEXT,
  ADD COLUMN IF NOT EXISTS last_human_interaction_message_id UUID,
  ADD COLUMN IF NOT EXISTS last_human_interaction_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_human_takeover
  ON public.whatsapp_conversations (company_id, human_takeover, last_human_interaction_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_last_human_msg
  ON public.whatsapp_conversations (last_human_interaction_message_id)
  WHERE last_human_interaction_message_id IS NOT NULL;