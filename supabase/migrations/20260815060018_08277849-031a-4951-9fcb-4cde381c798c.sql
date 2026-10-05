ALTER TABLE public.brain_agents
  ADD COLUMN IF NOT EXISTS scraping jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS autonomy text NOT NULL DEFAULT 'guided',
  ADD COLUMN IF NOT EXISTS default_deadline_minutes integer NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS can_spawn boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_helpers integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.brain_agent_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  user_id uuid,
  agent_id uuid NOT NULL REFERENCES public.brain_agents(id) ON DELETE CASCADE,
  title text NOT NULL,
  details text NOT NULL DEFAULT '',
  deadline_minutes integer NOT NULL DEFAULT 60,
  due_at timestamptz,
  priority text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'pending',
  result text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brain_agent_tasks TO authenticated;
GRANT ALL ON public.brain_agent_tasks TO service_role;

ALTER TABLE public.brain_agent_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members manage brain agent tasks"
ON public.brain_agent_tasks
FOR ALL
TO authenticated
USING (public.user_belongs_to_company(company_id, auth.uid()))
WITH CHECK (public.user_belongs_to_company(company_id, auth.uid()));

CREATE INDEX IF NOT EXISTS brain_agent_tasks_agent_idx ON public.brain_agent_tasks(agent_id);
CREATE INDEX IF NOT EXISTS brain_agent_tasks_company_idx ON public.brain_agent_tasks(company_id);

CREATE TRIGGER brain_agent_tasks_updated_at
BEFORE UPDATE ON public.brain_agent_tasks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();