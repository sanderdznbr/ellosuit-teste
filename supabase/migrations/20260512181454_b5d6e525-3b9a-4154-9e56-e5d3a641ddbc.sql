-- Create campaign table
CREATE TABLE public.dispatch_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    title TEXT NOT NULL,
    message_template TEXT,
    media_url TEXT,
    media_type TEXT DEFAULT 'text',
    media_caption TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, paused, cancelled
    total_recipients INTEGER NOT NULL DEFAULT 0,
    sent_count INTEGER NOT NULL DEFAULT 0,
    error_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create jobs table
CREATE TABLE public.dispatch_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES public.dispatch_campaigns(id) ON DELETE CASCADE,
    company_id UUID NOT NULL,
    phone TEXT NOT NULL,
    contact_name TEXT,
    custom_fields JSONB DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pending', -- pending, sending, sent, error
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.dispatch_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_jobs ENABLE ROW LEVEL SECURITY;

-- Policies for campaigns
CREATE POLICY "Users can view their company's campaigns"
ON public.dispatch_campaigns FOR SELECT
USING (company_id IN (SELECT company_id FROM public.company_users WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert their own campaigns"
ON public.dispatch_campaigns FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their company's campaigns"
ON public.dispatch_campaigns FOR UPDATE
USING (company_id IN (SELECT company_id FROM public.company_users WHERE user_id = auth.uid()));

-- Policies for jobs
CREATE POLICY "Users can view their company's jobs"
ON public.dispatch_jobs FOR SELECT
USING (company_id IN (SELECT company_id FROM public.company_users WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert jobs for their company"
ON public.dispatch_jobs FOR INSERT
WITH CHECK (company_id IN (SELECT company_id FROM public.company_users WHERE user_id = auth.uid()));

CREATE POLICY "Users can update jobs for their company"
ON public.dispatch_jobs FOR UPDATE
USING (company_id IN (SELECT company_id FROM public.company_users WHERE user_id = auth.uid()));

-- Index for performance
CREATE INDEX idx_dispatch_jobs_campaign_id ON public.dispatch_jobs(campaign_id);
CREATE INDEX idx_dispatch_jobs_status ON public.dispatch_jobs(status);
CREATE INDEX idx_dispatch_campaigns_company_id ON public.dispatch_campaigns(company_id);
