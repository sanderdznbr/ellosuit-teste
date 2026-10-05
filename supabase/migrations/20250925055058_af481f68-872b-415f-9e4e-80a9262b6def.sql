-- Create workflow groups table
CREATE TABLE public.workflow_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  created_by UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#3B82F6',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create workflows table
CREATE TABLE public.workflows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.workflow_groups(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  created_by UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create workflow columns table
CREATE TABLE public.workflow_columns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  name TEXT NOT NULL,
  position INTEGER NOT NULL,
  color TEXT DEFAULT '#6B7280',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create workflow cards table
CREATE TABLE public.workflow_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  column_id UUID NOT NULL REFERENCES public.workflow_columns(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  created_by UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  position INTEGER NOT NULL,
  priority TEXT DEFAULT 'medium',
  due_date TIMESTAMP WITH TIME ZONE,
  start_date TIMESTAMP WITH TIME ZONE,
  tags TEXT[],
  checklist JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create workflow card assignments table
CREATE TABLE public.workflow_card_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id UUID NOT NULL REFERENCES public.workflow_cards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  company_id UUID NOT NULL,
  assigned_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create workflow card comments table
CREATE TABLE public.workflow_card_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id UUID NOT NULL REFERENCES public.workflow_cards(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  user_id UUID NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create workflow card attachments table
CREATE TABLE public.workflow_card_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id UUID NOT NULL REFERENCES public.workflow_cards(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  uploaded_by UUID NOT NULL,
  filename TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create meeting recordings table
CREATE TABLE public.meeting_recordings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.meeting_rooms(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  created_by UUID NOT NULL,
  title TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  duration_seconds INTEGER,
  transcript TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create AI agents table
CREATE TABLE public.ai_agents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  created_by UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  personality TEXT NOT NULL,
  instructions TEXT NOT NULL,
  model TEXT DEFAULT 'gpt-4o-mini',
  is_active BOOLEAN DEFAULT true,
  avatar_url TEXT,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create WhatsApp integrations table
CREATE TABLE public.whatsapp_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  user_id UUID NOT NULL,
  phone_number TEXT NOT NULL,
  access_token TEXT NOT NULL,
  webhook_url TEXT,
  is_active BOOLEAN DEFAULT true,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create WhatsApp conversations table
CREATE TABLE public.whatsapp_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  integration_id UUID NOT NULL REFERENCES public.whatsapp_integrations(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  contact_phone TEXT NOT NULL,
  contact_name TEXT,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  status TEXT DEFAULT 'open',
  assigned_to UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.workflow_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_card_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_card_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_card_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for workflow_groups
CREATE POLICY "Users can view company workflow groups" ON public.workflow_groups
FOR SELECT USING (company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid()));

CREATE POLICY "Users can create workflow groups" ON public.workflow_groups
FOR INSERT WITH CHECK (company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Users can update their workflow groups" ON public.workflow_groups
FOR UPDATE USING (created_by = auth.uid());

CREATE POLICY "Users can delete their workflow groups" ON public.workflow_groups
FOR DELETE USING (created_by = auth.uid());

-- Create RLS policies for workflows
CREATE POLICY "Users can view company workflows" ON public.workflows
FOR SELECT USING (company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid()));

CREATE POLICY "Users can create workflows" ON public.workflows
FOR INSERT WITH CHECK (company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Users can update their workflows" ON public.workflows
FOR UPDATE USING (created_by = auth.uid());

CREATE POLICY "Users can delete their workflows" ON public.workflows
FOR DELETE USING (created_by = auth.uid());

-- Create RLS policies for workflow_columns
CREATE POLICY "Users can view company workflow columns" ON public.workflow_columns
FOR SELECT USING (company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage workflow columns" ON public.workflow_columns
FOR ALL USING (company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid()));

-- Create RLS policies for workflow_cards
CREATE POLICY "Users can view company workflow cards" ON public.workflow_cards
FOR SELECT USING (company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid()));

CREATE POLICY "Users can create workflow cards" ON public.workflow_cards
FOR INSERT WITH CHECK (company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Users can update workflow cards" ON public.workflow_cards
FOR UPDATE USING (company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete their workflow cards" ON public.workflow_cards
FOR DELETE USING (created_by = auth.uid());

-- Create RLS policies for other tables (similar pattern)
CREATE POLICY "Users can view company workflow card assignments" ON public.workflow_card_assignments
FOR SELECT USING (company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage workflow card assignments" ON public.workflow_card_assignments
FOR ALL USING (company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid()));

CREATE POLICY "Users can view company workflow card comments" ON public.workflow_card_comments
FOR SELECT USING (company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid()));

CREATE POLICY "Users can create workflow card comments" ON public.workflow_card_comments
FOR INSERT WITH CHECK (company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid()) AND user_id = auth.uid());

CREATE POLICY "Users can update their comments" ON public.workflow_card_comments
FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can view company workflow card attachments" ON public.workflow_card_attachments
FOR SELECT USING (company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid()));

CREATE POLICY "Users can create workflow card attachments" ON public.workflow_card_attachments
FOR INSERT WITH CHECK (company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid()) AND uploaded_by = auth.uid());

CREATE POLICY "Users can delete their attachments" ON public.workflow_card_attachments
FOR DELETE USING (uploaded_by = auth.uid());

-- Meeting recordings policies
CREATE POLICY "Users can view company meeting recordings" ON public.meeting_recordings
FOR SELECT USING (company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid()));

CREATE POLICY "Users can create meeting recordings" ON public.meeting_recordings
FOR INSERT WITH CHECK (company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid()) AND created_by = auth.uid());

-- AI agents policies
CREATE POLICY "Users can view company AI agents" ON public.ai_agents
FOR SELECT USING (company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid()));

CREATE POLICY "Users can create AI agents" ON public.ai_agents
FOR INSERT WITH CHECK (company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Users can update their AI agents" ON public.ai_agents
FOR UPDATE USING (created_by = auth.uid());

CREATE POLICY "Users can delete their AI agents" ON public.ai_agents
FOR DELETE USING (created_by = auth.uid());

-- WhatsApp integration policies
CREATE POLICY "Users can view their WhatsApp integrations" ON public.whatsapp_integrations
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can manage their WhatsApp integrations" ON public.whatsapp_integrations
FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users can view company WhatsApp conversations" ON public.whatsapp_conversations
FOR SELECT USING (company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage company WhatsApp conversations" ON public.whatsapp_conversations
FOR ALL USING (company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid()));

-- Add updated_at triggers
CREATE TRIGGER update_workflow_groups_updated_at
BEFORE UPDATE ON public.workflow_groups
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_workflows_updated_at
BEFORE UPDATE ON public.workflows
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_workflow_columns_updated_at
BEFORE UPDATE ON public.workflow_columns
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_workflow_cards_updated_at
BEFORE UPDATE ON public.workflow_cards
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_workflow_card_comments_updated_at
BEFORE UPDATE ON public.workflow_card_comments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_meeting_recordings_updated_at
BEFORE UPDATE ON public.meeting_recordings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ai_agents_updated_at
BEFORE UPDATE ON public.ai_agents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_whatsapp_integrations_updated_at
BEFORE UPDATE ON public.whatsapp_integrations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_whatsapp_conversations_updated_at
BEFORE UPDATE ON public.whatsapp_conversations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();