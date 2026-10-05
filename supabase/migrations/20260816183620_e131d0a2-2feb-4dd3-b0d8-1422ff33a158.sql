ALTER TABLE public.dispatch_campaigns
  ADD COLUMN IF NOT EXISTS chatbot_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS chatbot_flow_id uuid;