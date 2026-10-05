-- CLASSES / CARGOS
CREATE TABLE public.brain_agent_classes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 3,
  color TEXT NOT NULL DEFAULT '#3000E3',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brain_agent_classes TO authenticated;
GRANT ALL ON public.brain_agent_classes TO service_role;
ALTER TABLE public.brain_agent_classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members manage agent classes"
ON public.brain_agent_classes FOR ALL TO authenticated
USING (public.user_belongs_to_company(company_id, auth.uid()))
WITH CHECK (public.user_belongs_to_company(company_id, auth.uid()));

-- AGENTES
CREATE TABLE public.brain_agents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#3000E3',
  icon TEXT NOT NULL DEFAULT 'bot',
  class_id UUID REFERENCES public.brain_agent_classes(id) ON DELETE SET NULL,
  class_name TEXT NOT NULL DEFAULT 'Executor',
  level INTEGER NOT NULL DEFAULT 3,
  family TEXT NOT NULL DEFAULT 'Geral',
  instructions TEXT NOT NULL DEFAULT '',
  duties JSONB NOT NULL DEFAULT '[]'::jsonb,
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  link_mode TEXT NOT NULL DEFAULT 'own_family',
  execution_mode TEXT NOT NULL DEFAULT 'manual',
  frequency TEXT NOT NULL DEFAULT 'daily',
  status TEXT NOT NULL DEFAULT 'idle',
  position_x DOUBLE PRECISION NOT NULL DEFAULT 0,
  position_y DOUBLE PRECISION NOT NULL DEFAULT 0,
  last_executed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brain_agents TO authenticated;
GRANT ALL ON public.brain_agents TO service_role;
ALTER TABLE public.brain_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members manage brain agents"
ON public.brain_agents FOR ALL TO authenticated
USING (public.user_belongs_to_company(company_id, auth.uid()))
WITH CHECK (public.user_belongs_to_company(company_id, auth.uid()));

-- LIGAÇÕES
CREATE TABLE public.brain_agent_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  source_id UUID NOT NULL REFERENCES public.brain_agents(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES public.brain_agents(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL DEFAULT 'hierarchy',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (source_id, target_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brain_agent_links TO authenticated;
GRANT ALL ON public.brain_agent_links TO service_role;
ALTER TABLE public.brain_agent_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members manage agent links"
ON public.brain_agent_links FOR ALL TO authenticated
USING (public.user_belongs_to_company(company_id, auth.uid()))
WITH CHECK (public.user_belongs_to_company(company_id, auth.uid()));

-- EXECUÇÕES
CREATE TABLE public.brain_agent_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  agent_id UUID NOT NULL REFERENCES public.brain_agents(id) ON DELETE CASCADE,
  triggered_by UUID,
  input TEXT NOT NULL DEFAULT '',
  output TEXT,
  status TEXT NOT NULL DEFAULT 'running',
  error TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brain_agent_runs TO authenticated;
GRANT ALL ON public.brain_agent_runs TO service_role;
ALTER TABLE public.brain_agent_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members view agent runs"
ON public.brain_agent_runs FOR ALL TO authenticated
USING (public.user_belongs_to_company(company_id, auth.uid()))
WITH CHECK (public.user_belongs_to_company(company_id, auth.uid()));

CREATE INDEX idx_brain_agents_company ON public.brain_agents(company_id);
CREATE INDEX idx_brain_agent_links_company ON public.brain_agent_links(company_id);
CREATE INDEX idx_brain_agent_runs_agent ON public.brain_agent_runs(agent_id, created_at DESC);

CREATE TRIGGER update_brain_agents_updated_at BEFORE UPDATE ON public.brain_agents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_brain_agent_classes_updated_at BEFORE UPDATE ON public.brain_agent_classes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_brain_agent_runs_updated_at BEFORE UPDATE ON public.brain_agent_runs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();