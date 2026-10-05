-- ==================== LEAD FUNNEL SYSTEM ====================

-- Tabela principal dos funis
CREATE TABLE public.lead_funnels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  created_by UUID NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT false,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(slug)
);

-- Etapas do funil
CREATE TABLE public.lead_funnel_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_id UUID NOT NULL REFERENCES public.lead_funnels(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  step_type TEXT NOT NULL,
  title TEXT,
  description TEXT,
  content JSONB DEFAULT '{}',
  required BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Submissões/Leads capturados
CREATE TABLE public.lead_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_id UUID NOT NULL REFERENCES public.lead_funnels(id),
  session_id TEXT NOT NULL,
  status TEXT DEFAULT 'in_progress',
  current_step INTEGER DEFAULT 1,
  answers JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Eventos de tracking por etapa
CREATE TABLE public.lead_step_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_id UUID NOT NULL,
  step_id UUID,
  submission_id UUID,
  event_type TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT now(),
  metadata JSONB DEFAULT '{}'
);

-- Enable RLS
ALTER TABLE public.lead_funnels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_funnel_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_step_events ENABLE ROW LEVEL SECURITY;

-- RLS for lead_funnels
CREATE POLICY "Users can view company funnels" ON public.lead_funnels
  FOR SELECT USING (company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid()));

CREATE POLICY "Users can create funnels in their company" ON public.lead_funnels
  FOR INSERT WITH CHECK (
    company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid()) 
    AND created_by = auth.uid()
  );

CREATE POLICY "Users can update their funnels" ON public.lead_funnels
  FOR UPDATE USING (created_by = auth.uid());

CREATE POLICY "Users can delete their funnels" ON public.lead_funnels
  FOR DELETE USING (created_by = auth.uid());

-- RLS for lead_funnel_steps
CREATE POLICY "Users can view funnel steps" ON public.lead_funnel_steps
  FOR SELECT USING (funnel_id IN (
    SELECT id FROM lead_funnels WHERE company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "Users can manage funnel steps" ON public.lead_funnel_steps
  FOR ALL USING (funnel_id IN (
    SELECT id FROM lead_funnels WHERE created_by = auth.uid()
  ));

-- RLS for lead_submissions
CREATE POLICY "Users can view company submissions" ON public.lead_submissions
  FOR SELECT USING (funnel_id IN (
    SELECT id FROM lead_funnels WHERE company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "Public can create submissions" ON public.lead_submissions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Public can update submissions" ON public.lead_submissions
  FOR UPDATE USING (true);

-- RLS for lead_step_events (tracking - public insert)
CREATE POLICY "Public can insert tracking events" ON public.lead_step_events
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view company events" ON public.lead_step_events
  FOR SELECT USING (funnel_id IN (
    SELECT id FROM lead_funnels WHERE company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  ));

-- Create updated_at trigger
CREATE TRIGGER update_lead_funnels_updated_at
  BEFORE UPDATE ON public.lead_funnels
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster slug lookup
CREATE INDEX idx_lead_funnels_slug ON public.lead_funnels(slug);
CREATE INDEX idx_lead_submissions_funnel_id ON public.lead_submissions(funnel_id);
CREATE INDEX idx_lead_step_events_funnel_id ON public.lead_step_events(funnel_id);