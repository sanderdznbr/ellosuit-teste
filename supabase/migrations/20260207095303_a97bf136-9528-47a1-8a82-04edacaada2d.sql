-- Create chatbot_flows table for storing flow configurations
CREATE TABLE public.chatbot_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  nodes JSONB NOT NULL DEFAULT '[]',
  edges JSONB NOT NULL DEFAULT '[]',
  trigger_config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT false,
  execution_count INTEGER DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create chatbot_executions table for tracking flow executions
CREATE TABLE public.chatbot_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id UUID NOT NULL REFERENCES chatbot_flows(id) ON DELETE CASCADE,
  conversation_id UUID,
  contact_phone TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running',
  current_node_id TEXT,
  variables JSONB DEFAULT '{}',
  execution_path JSONB DEFAULT '[]'
);

-- Enable RLS
ALTER TABLE public.chatbot_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatbot_executions ENABLE ROW LEVEL SECURITY;

-- RLS policies for chatbot_flows
CREATE POLICY "Users can view company chatbot flows"
  ON public.chatbot_flows FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM company_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can create chatbot flows in their company"
  ON public.chatbot_flows FOR INSERT
  WITH CHECK (
    company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid())
    AND created_by = auth.uid()
  );

CREATE POLICY "Users can update their chatbot flows"
  ON public.chatbot_flows FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "Users can delete their chatbot flows"
  ON public.chatbot_flows FOR DELETE
  USING (created_by = auth.uid());

-- RLS policies for chatbot_executions
CREATE POLICY "Users can view executions of company flows"
  ON public.chatbot_executions FOR SELECT
  USING (flow_id IN (
    SELECT id FROM chatbot_flows WHERE company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "Users can insert executions"
  ON public.chatbot_executions FOR INSERT
  WITH CHECK (true);

-- Indexes for performance
CREATE INDEX idx_chatbot_flows_company ON public.chatbot_flows(company_id);
CREATE INDEX idx_chatbot_flows_active ON public.chatbot_flows(is_active) WHERE is_active = true;
CREATE INDEX idx_chatbot_executions_flow ON public.chatbot_executions(flow_id);
CREATE INDEX idx_chatbot_executions_status ON public.chatbot_executions(status);

-- Trigger for updated_at
CREATE TRIGGER update_chatbot_flows_updated_at
  BEFORE UPDATE ON public.chatbot_flows
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();