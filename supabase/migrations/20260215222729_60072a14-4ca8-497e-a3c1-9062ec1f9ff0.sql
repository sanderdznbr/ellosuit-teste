-- Add last_activity_at to track inactivity for chatbot timeout
ALTER TABLE public.chatbot_executions 
ADD COLUMN last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Backfill existing rows
UPDATE public.chatbot_executions SET last_activity_at = started_at WHERE last_activity_at IS NULL;