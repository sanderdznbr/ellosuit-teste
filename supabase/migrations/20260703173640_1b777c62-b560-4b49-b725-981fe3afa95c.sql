CREATE TABLE public.crm_satisfaction_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  analyzed_conversations integer NOT NULL DEFAULT 0,
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_crm_satisfaction_company_generated ON public.crm_satisfaction_analyses (company_id, generated_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_satisfaction_analyses TO authenticated;
GRANT ALL ON public.crm_satisfaction_analyses TO service_role;

ALTER TABLE public.crm_satisfaction_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view satisfaction analyses"
ON public.crm_satisfaction_analyses FOR SELECT
TO authenticated
USING (public.user_belongs_to_company(company_id, auth.uid()));

CREATE POLICY "Company members can insert satisfaction analyses"
ON public.crm_satisfaction_analyses FOR INSERT
TO authenticated
WITH CHECK (public.user_belongs_to_company(company_id, auth.uid()));

CREATE POLICY "Service role manages satisfaction analyses"
ON public.crm_satisfaction_analyses FOR ALL
TO service_role
USING (true) WITH CHECK (true);