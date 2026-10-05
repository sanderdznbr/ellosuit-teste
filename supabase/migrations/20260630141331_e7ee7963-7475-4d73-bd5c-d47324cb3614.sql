ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS human_takeover BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS human_takeover_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_human_takeover ON public.whatsapp_conversations(human_takeover) WHERE human_takeover = true;