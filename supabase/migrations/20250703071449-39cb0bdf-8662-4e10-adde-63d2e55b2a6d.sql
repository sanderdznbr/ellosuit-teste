
-- Create companies table
CREATE TABLE public.companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT UNIQUE,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create company_users junction table
CREATE TYPE public.company_role AS ENUM ('admin', 'manager', 'employee');

CREATE TABLE public.company_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.company_role NOT NULL DEFAULT 'employee',
  permissions JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, user_id)
);

-- Create calendar_events table
CREATE TYPE public.event_type AS ENUM ('meeting', 'appointment', 'reminder');
CREATE TYPE public.meeting_provider AS ENUM ('google_meet', 'zoom', 'teams');

CREATE TABLE public.calendar_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  event_type public.event_type NOT NULL,
  meeting_provider public.meeting_provider,
  meeting_link TEXT,
  meeting_data JSONB DEFAULT '{}'::jsonb,
  attendees JSONB DEFAULT '[]'::jsonb,
  is_all_day BOOLEAN DEFAULT false,
  recurrence_rule TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create meeting_integrations table
CREATE TABLE public.meeting_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider public.meeting_provider NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  provider_user_id TEXT,
  provider_email TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, user_id, provider)
);

-- Add updated_at triggers
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER company_users_updated_at
  BEFORE UPDATE ON public.company_users
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER calendar_events_updated_at
  BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER meeting_integrations_updated_at
  BEFORE UPDATE ON public.meeting_integrations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Enable Row Level Security
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_integrations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for companies
CREATE POLICY "Users can view companies they belong to"
  ON public.companies FOR SELECT
  USING (id IN (
    SELECT company_id FROM public.company_users 
    WHERE user_id = auth.uid()
  ));

CREATE POLICY "Company admins can update their company"
  ON public.companies FOR UPDATE
  USING (id IN (
    SELECT company_id FROM public.company_users 
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- RLS Policies for company_users
CREATE POLICY "Users can view company users from their companies"
  ON public.company_users FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM public.company_users 
    WHERE user_id = auth.uid()
  ));

CREATE POLICY "Company admins can manage company users"
  ON public.company_users FOR ALL
  USING (company_id IN (
    SELECT company_id FROM public.company_users 
    WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
  ));

-- RLS Policies for calendar_events
CREATE POLICY "Users can view events from their companies"
  ON public.calendar_events FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM public.company_users 
    WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can create events in their companies"
  ON public.calendar_events FOR INSERT
  WITH CHECK (company_id IN (
    SELECT company_id FROM public.company_users 
    WHERE user_id = auth.uid()
  ) AND created_by = auth.uid());

CREATE POLICY "Users can update events they created"
  ON public.calendar_events FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "Users can delete events they created"
  ON public.calendar_events FOR DELETE
  USING (created_by = auth.uid());

-- RLS Policies for meeting_integrations
CREATE POLICY "Users can view their own meeting integrations"
  ON public.meeting_integrations FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own meeting integrations"
  ON public.meeting_integrations FOR ALL
  USING (user_id = auth.uid());
