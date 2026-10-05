CREATE TABLE public.ai_agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  user_id uuid NOT NULL,
  conversation_id uuid,
  goal text NOT NULL,
  status text NOT NULL DEFAULT 'running',
  mode text NOT NULL DEFAULT 'foreground',
  plan jsonb NOT NULL DEFAULT '[]'::jsonb,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  final_answer text,
  error text,
  steps_used integer NOT NULL DEFAULT 0,
  max_steps integer NOT NULL DEFAULT 30,
  needs_approval boolean NOT NULL DEFAULT false,
  approval_question text,
  approval_payload jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_agent_runs_company ON public.ai_agent_runs (company_id, created_at DESC);
CREATE INDEX idx_ai_agent_runs_status ON public.ai_agent_runs (status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_agent_runs TO authenticated;
GRANT ALL ON public.ai_agent_runs TO service_role;
ALTER TABLE public.ai_agent_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company members manage agent runs" ON public.ai_agent_runs
  FOR ALL TO authenticated
  USING (public.user_belongs_to_company(company_id, auth.uid()))
  WITH CHECK (public.user_belongs_to_company(company_id, auth.uid()));

CREATE TABLE public.ai_agent_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.ai_agent_runs(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  step_index integer NOT NULL DEFAULT 0,
  kind text NOT NULL DEFAULT 'tool',
  agent_label text NOT NULL DEFAULT 'principal',
  title text,
  content text,
  tool_name text,
  tool_args jsonb,
  tool_result text,
  status text NOT NULL DEFAULT 'done',
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_agent_steps_run ON public.ai_agent_steps (run_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_agent_steps TO authenticated;
GRANT ALL ON public.ai_agent_steps TO service_role;
ALTER TABLE public.ai_agent_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company members manage agent steps" ON public.ai_agent_steps
  FOR ALL TO authenticated
  USING (public.user_belongs_to_company(company_id, auth.uid()))
  WITH CHECK (public.user_belongs_to_company(company_id, auth.uid()));

CREATE TABLE public.ai_agent_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  user_id uuid,
  kind text NOT NULL DEFAULT 'fact',
  content text NOT NULL,
  importance integer NOT NULL DEFAULT 1,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_agent_memory_company ON public.ai_agent_memory (company_id, importance DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_agent_memory TO authenticated;
GRANT ALL ON public.ai_agent_memory TO service_role;
ALTER TABLE public.ai_agent_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company members manage agent memory" ON public.ai_agent_memory
  FOR ALL TO authenticated
  USING (public.user_belongs_to_company(company_id, auth.uid()))
  WITH CHECK (public.user_belongs_to_company(company_id, auth.uid()));

CREATE TRIGGER trg_ai_agent_runs_updated_at BEFORE UPDATE ON public.ai_agent_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ai_agent_memory_updated_at BEFORE UPDATE ON public.ai_agent_memory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_agent_runs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_agent_steps;
ALTER TABLE public.ai_agent_steps REPLICA IDENTITY FULL;
ALTER TABLE public.ai_agent_runs REPLICA IDENTITY FULL;