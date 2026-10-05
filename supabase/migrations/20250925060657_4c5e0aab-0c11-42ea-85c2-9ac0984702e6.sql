-- Enable realtime on room_participants for JOIN/LEAVE detection
ALTER TABLE public.room_participants REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_participants;

-- Create AI agents table for Bot IA
CREATE TABLE IF NOT EXISTS public.ai_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  created_by UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  personality TEXT NOT NULL,
  instructions TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT 'gpt-4o-mini',
  is_active BOOLEAN NOT NULL DEFAULT true,
  avatar_url TEXT,
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;

-- Create policies for ai_agents
DROP POLICY IF EXISTS "Users can create their AI agents" ON public.ai_agents;
CREATE POLICY "Users can create their AI agents"
ON public.ai_agents FOR INSERT
WITH CHECK (
  (company_id IN (
    SELECT company_users.company_id FROM company_users WHERE company_users.user_id = auth.uid()
  )) AND (created_by = auth.uid())
);

DROP POLICY IF EXISTS "Users can update their AI agents" ON public.ai_agents;
CREATE POLICY "Users can update their AI agents"
ON public.ai_agents FOR UPDATE
USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Users can delete their AI agents" ON public.ai_agents;
CREATE POLICY "Users can delete their AI agents"
ON public.ai_agents FOR DELETE
USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Users can view company AI agents" ON public.ai_agents;
CREATE POLICY "Users can view company AI agents"
ON public.ai_agents FOR SELECT
USING (
  company_id IN (
    SELECT company_users.company_id FROM company_users WHERE company_users.user_id = auth.uid()
  )
);

-- Create trigger for updated_at
CREATE TRIGGER ai_agents_set_updated_at
BEFORE UPDATE ON public.ai_agents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();