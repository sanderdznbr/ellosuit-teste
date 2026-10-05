ALTER TABLE public.whatsapp_conversations 
ADD COLUMN IF NOT EXISTS ai_agent_id UUID REFERENCES public.ai_agents(id);

COMMENT ON COLUMN public.whatsapp_conversations.ai_agent_id IS 'ID do agente de IA vinculado a esta conversa para respostas automáticas';