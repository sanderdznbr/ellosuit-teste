-- Add settings JSONB to chatbot_flows for per-flow runtime config (e.g. responseDelayMs)
ALTER TABLE public.chatbot_flows
  ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}'::jsonb;
