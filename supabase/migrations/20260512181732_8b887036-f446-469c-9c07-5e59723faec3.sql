ALTER TABLE public.dispatch_campaigns
  ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_agent_id UUID,
  ADD COLUMN IF NOT EXISTS session_id UUID;