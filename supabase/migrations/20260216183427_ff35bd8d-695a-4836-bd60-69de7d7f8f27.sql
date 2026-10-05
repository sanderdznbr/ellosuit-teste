
-- Tabela para mídias dos agentes de IA
CREATE TABLE public.ai_agent_media (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'image',
  description TEXT NOT NULL,
  context_keywords TEXT[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for quick lookups by agent
CREATE INDEX idx_ai_agent_media_agent ON public.ai_agent_media(agent_id);

-- RLS
ALTER TABLE public.ai_agent_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view media from their company"
ON public.ai_agent_media FOR SELECT
USING (public.user_belongs_to_company(company_id, auth.uid()));

CREATE POLICY "Users can insert media for their company"
ON public.ai_agent_media FOR INSERT
WITH CHECK (public.user_belongs_to_company(company_id, auth.uid()));

CREATE POLICY "Users can update media from their company"
ON public.ai_agent_media FOR UPDATE
USING (public.user_belongs_to_company(company_id, auth.uid()));

CREATE POLICY "Users can delete media from their company"
ON public.ai_agent_media FOR DELETE
USING (public.user_belongs_to_company(company_id, auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_ai_agent_media_updated_at
BEFORE UPDATE ON public.ai_agent_media
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();
