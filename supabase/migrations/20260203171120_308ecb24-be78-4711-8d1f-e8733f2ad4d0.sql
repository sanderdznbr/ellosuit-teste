-- Add assigned_user_id to calendar_events for task assignments
ALTER TABLE public.calendar_events 
ADD COLUMN IF NOT EXISTS assigned_user_id UUID REFERENCES auth.users(id);

-- Create task routines table for recurring automatic task creation
CREATE TABLE IF NOT EXISTS public.task_routines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  assigned_user_id UUID,
  frequency TEXT NOT NULL DEFAULT 'daily', -- daily, weekly, monthly
  days_of_week INTEGER[], -- 0-6 for weekly
  day_of_month INTEGER, -- 1-31 for monthly
  time_of_day TIME DEFAULT '09:00:00',
  duration_minutes INTEGER DEFAULT 60,
  color TEXT DEFAULT '#3600FF',
  priority TEXT DEFAULT 'medium',
  is_active BOOLEAN DEFAULT true,
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add assigned_user_id to workflow_cards for card assignments
ALTER TABLE public.workflow_cards 
ADD COLUMN IF NOT EXISTS assigned_user_id UUID;

-- Enable RLS
ALTER TABLE public.task_routines ENABLE ROW LEVEL SECURITY;

-- RLS policies for task_routines
CREATE POLICY "Users can view their company routines" 
ON public.task_routines 
FOR SELECT 
USING (
  company_id IN (
    SELECT company_id FROM public.company_users WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can create routines for their company" 
ON public.task_routines 
FOR INSERT 
WITH CHECK (
  company_id IN (
    SELECT company_id FROM public.company_users WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their company routines" 
ON public.task_routines 
FOR UPDATE 
USING (
  company_id IN (
    SELECT company_id FROM public.company_users WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their company routines" 
ON public.task_routines 
FOR DELETE 
USING (
  company_id IN (
    SELECT company_id FROM public.company_users WHERE user_id = auth.uid()
  )
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_task_routines_company ON public.task_routines(company_id);
CREATE INDEX IF NOT EXISTS idx_task_routines_next_run ON public.task_routines(next_run_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_calendar_events_assigned ON public.calendar_events(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_cards_assigned ON public.workflow_cards(assigned_user_id);