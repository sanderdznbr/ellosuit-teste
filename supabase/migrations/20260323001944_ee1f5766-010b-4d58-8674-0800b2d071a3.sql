ALTER TABLE public.ycloud_conversations 
  ADD COLUMN IF NOT EXISTS assigned_agent_id uuid REFERENCES public.ai_agents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ai_auto_reply_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_thinking boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS profile_picture text;

ALTER TABLE public.ycloud_messages
  ADD COLUMN IF NOT EXISTS is_ai_response boolean DEFAULT false;