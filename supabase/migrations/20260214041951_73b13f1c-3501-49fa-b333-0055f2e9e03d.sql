
-- Create automations table
CREATE TABLE public.automations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL DEFAULT 'webhook',
  trigger_config JSONB DEFAULT '{}',
  actions JSONB DEFAULT '[]',
  nodes JSONB DEFAULT '[]',
  edges JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT false,
  execution_count INTEGER DEFAULT 0,
  last_executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view automations from their company"
ON public.automations FOR SELECT
USING (public.user_belongs_to_company(company_id, auth.uid()));

CREATE POLICY "Users can create automations in their company"
ON public.automations FOR INSERT
WITH CHECK (public.user_belongs_to_company(company_id, auth.uid()));

CREATE POLICY "Users can update automations in their company"
ON public.automations FOR UPDATE
USING (public.user_belongs_to_company(company_id, auth.uid()));

CREATE POLICY "Users can delete automations in their company"
ON public.automations FOR DELETE
USING (public.user_belongs_to_company(company_id, auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_automations_updated_at
BEFORE UPDATE ON public.automations
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Execution logs
CREATE TABLE public.automation_executions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  automation_id UUID NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'running',
  trigger_data JSONB,
  execution_log JSONB DEFAULT '[]',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  error_message TEXT
);

ALTER TABLE public.automation_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view execution logs from their company automations"
ON public.automation_executions FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.automations a
  WHERE a.id = automation_id
  AND public.user_belongs_to_company(a.company_id, auth.uid())
));

CREATE POLICY "System can insert execution logs"
ON public.automation_executions FOR INSERT
WITH CHECK (true);
