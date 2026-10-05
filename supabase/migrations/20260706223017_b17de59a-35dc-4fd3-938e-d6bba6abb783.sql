-- Adiciona flag "piloto pausado" por conversa, aplicada quando o Pai escolhe
-- pausar só uma conversa (choice=1) ou todas (choice=2).
ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS autopilot_paused BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS autopilot_paused_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS autopilot_paused_scope TEXT;

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_autopilot_paused
  ON public.whatsapp_conversations(company_id, autopilot_paused)
  WHERE autopilot_paused = true;