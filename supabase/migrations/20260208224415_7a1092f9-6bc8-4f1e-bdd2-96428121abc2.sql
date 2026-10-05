-- Create enums for subscription system
CREATE TYPE plan_type AS ENUM ('base', 'pro', 'business', 'enterprise', 'custom');
CREATE TYPE billing_cycle AS ENUM ('monthly', 'yearly');
CREATE TYPE subscription_status AS ENUM ('active', 'canceled', 'past_due', 'trialing');
CREATE TYPE module_type AS ENUM ('omni', 'flow', 'track');
CREATE TYPE addon_type AS ENUM (
  'users', 'storage', 'emails', 'ai_agents', 
  'whatsapp_sessions', 'booking_links', 'meeting_hours', 
  'tracked_docs', 'priority_support'
);
CREATE TYPE resource_type AS ENUM (
  'users', 'storage_gb', 'emails_sent', 'ai_agents_active',
  'whatsapp_sessions_active', 'booking_links_active', 
  'meeting_hours_used', 'tracked_docs_created',
  'tracked_links_created', 'tracked_videos_created'
);

-- Create subscriptions table (main company subscription)
CREATE TABLE public.subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  plan_type plan_type NOT NULL DEFAULT 'base',
  billing_cycle billing_cycle NOT NULL DEFAULT 'monthly',
  status subscription_status NOT NULL DEFAULT 'trialing',
  base_users_included INTEGER NOT NULL DEFAULT 2,
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_end TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  trial_ends_at TIMESTAMPTZ DEFAULT (now() + interval '7 days'),
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  monthly_price DECIMAL(10,2) NOT NULL DEFAULT 97.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_company_subscription UNIQUE (company_id)
);

-- Create subscription_modules table
CREATE TABLE public.subscription_modules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  module_type module_type NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  activated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  monthly_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_company_module UNIQUE (company_id, module_type)
);

-- Create subscription_addons table
CREATE TABLE public.subscription_addons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  addon_type addon_type NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create subscription_limits table (consolidated limits per company)
CREATE TABLE public.subscription_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  max_users INTEGER NOT NULL DEFAULT 2,
  max_storage_gb INTEGER NOT NULL DEFAULT 5,
  max_emails_month INTEGER NOT NULL DEFAULT 0,
  max_ai_agents INTEGER NOT NULL DEFAULT 0,
  max_whatsapp_sessions INTEGER NOT NULL DEFAULT 0,
  max_booking_links INTEGER NOT NULL DEFAULT 0,
  max_meeting_hours INTEGER NOT NULL DEFAULT 0,
  max_tracked_docs INTEGER NOT NULL DEFAULT 0,
  max_tracked_links INTEGER NOT NULL DEFAULT 0,
  max_tracked_videos INTEGER NOT NULL DEFAULT 0,
  max_chatbot_flows INTEGER NOT NULL DEFAULT 0,
  max_meeting_participants INTEGER NOT NULL DEFAULT 4,
  has_meeting_recording BOOLEAN NOT NULL DEFAULT false,
  has_priority_support BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_company_limits UNIQUE (company_id)
);

-- Create subscription_usage table
CREATE TABLE public.subscription_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  resource_type resource_type NOT NULL,
  current_usage INTEGER NOT NULL DEFAULT 0,
  period_start DATE NOT NULL DEFAULT CURRENT_DATE,
  period_end DATE NOT NULL DEFAULT (CURRENT_DATE + interval '30 days'),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_company_resource_period UNIQUE (company_id, resource_type, period_start)
);

-- Enable RLS on all tables
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subscriptions
CREATE POLICY "Users can view their company subscription"
ON public.subscriptions FOR SELECT
USING (company_id IN (
  SELECT company_id FROM company_users WHERE user_id = auth.uid()
));

CREATE POLICY "Admins can update their company subscription"
ON public.subscriptions FOR UPDATE
USING (company_id IN (
  SELECT company_id FROM company_users 
  WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
));

-- RLS Policies for subscription_modules
CREATE POLICY "Users can view their company modules"
ON public.subscription_modules FOR SELECT
USING (company_id IN (
  SELECT company_id FROM company_users WHERE user_id = auth.uid()
));

-- RLS Policies for subscription_addons
CREATE POLICY "Users can view their company addons"
ON public.subscription_addons FOR SELECT
USING (company_id IN (
  SELECT company_id FROM company_users WHERE user_id = auth.uid()
));

-- RLS Policies for subscription_limits
CREATE POLICY "Users can view their company limits"
ON public.subscription_limits FOR SELECT
USING (company_id IN (
  SELECT company_id FROM company_users WHERE user_id = auth.uid()
));

-- RLS Policies for subscription_usage
CREATE POLICY "Users can view their company usage"
ON public.subscription_usage FOR SELECT
USING (company_id IN (
  SELECT company_id FROM company_users WHERE user_id = auth.uid()
));

CREATE POLICY "System can update usage"
ON public.subscription_usage FOR ALL
USING (company_id IN (
  SELECT company_id FROM company_users WHERE user_id = auth.uid()
));

-- Create function to auto-create subscription limits when company is created
CREATE OR REPLACE FUNCTION public.create_default_subscription()
RETURNS TRIGGER AS $$
BEGIN
  -- Create default subscription
  INSERT INTO public.subscriptions (company_id, plan_type, status, monthly_price)
  VALUES (NEW.id, 'base', 'trialing', 97.00);
  
  -- Create default limits (base plan)
  INSERT INTO public.subscription_limits (
    company_id, max_users, max_storage_gb
  ) VALUES (NEW.id, 2, 5);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to auto-create subscription for new companies
CREATE TRIGGER on_company_created_subscription
AFTER INSERT ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.create_default_subscription();

-- Create function to update limits when modules are activated
CREATE OR REPLACE FUNCTION public.update_subscription_limits()
RETURNS TRIGGER AS $$
BEGIN
  -- Update limits based on active modules
  UPDATE public.subscription_limits sl
  SET 
    max_emails_month = CASE WHEN EXISTS (
      SELECT 1 FROM subscription_modules sm 
      WHERE sm.company_id = sl.company_id AND sm.module_type = 'omni' AND sm.is_active = true
    ) THEN GREATEST(sl.max_emails_month, 2000) ELSE sl.max_emails_month END,
    
    max_ai_agents = CASE WHEN EXISTS (
      SELECT 1 FROM subscription_modules sm 
      WHERE sm.company_id = sl.company_id AND sm.module_type = 'omni' AND sm.is_active = true
    ) THEN GREATEST(sl.max_ai_agents, 2) ELSE sl.max_ai_agents END,
    
    max_whatsapp_sessions = CASE WHEN EXISTS (
      SELECT 1 FROM subscription_modules sm 
      WHERE sm.company_id = sl.company_id AND sm.module_type = 'omni' AND sm.is_active = true
    ) THEN GREATEST(sl.max_whatsapp_sessions, 1) ELSE sl.max_whatsapp_sessions END,
    
    max_chatbot_flows = CASE WHEN EXISTS (
      SELECT 1 FROM subscription_modules sm 
      WHERE sm.company_id = sl.company_id AND sm.module_type = 'omni' AND sm.is_active = true
    ) THEN GREATEST(sl.max_chatbot_flows, 3) ELSE sl.max_chatbot_flows END,
    
    max_booking_links = CASE WHEN EXISTS (
      SELECT 1 FROM subscription_modules sm 
      WHERE sm.company_id = sl.company_id AND sm.module_type = 'flow' AND sm.is_active = true
    ) THEN GREATEST(sl.max_booking_links, 2) ELSE sl.max_booking_links END,
    
    max_meeting_participants = CASE WHEN EXISTS (
      SELECT 1 FROM subscription_modules sm 
      WHERE sm.company_id = sl.company_id AND sm.module_type = 'flow' AND sm.is_active = true
    ) THEN GREATEST(sl.max_meeting_participants, 8) ELSE sl.max_meeting_participants END,
    
    max_meeting_hours = CASE WHEN EXISTS (
      SELECT 1 FROM subscription_modules sm 
      WHERE sm.company_id = sl.company_id AND sm.module_type = 'flow' AND sm.is_active = true
    ) THEN GREATEST(sl.max_meeting_hours, 5) ELSE sl.max_meeting_hours END,
    
    max_tracked_docs = CASE WHEN EXISTS (
      SELECT 1 FROM subscription_modules sm 
      WHERE sm.company_id = sl.company_id AND sm.module_type = 'track' AND sm.is_active = true
    ) THEN GREATEST(sl.max_tracked_docs, 100) ELSE sl.max_tracked_docs END,
    
    max_tracked_links = CASE WHEN EXISTS (
      SELECT 1 FROM subscription_modules sm 
      WHERE sm.company_id = sl.company_id AND sm.module_type = 'track' AND sm.is_active = true
    ) THEN GREATEST(sl.max_tracked_links, 200) ELSE sl.max_tracked_links END,
    
    max_tracked_videos = CASE WHEN EXISTS (
      SELECT 1 FROM subscription_modules sm 
      WHERE sm.company_id = sl.company_id AND sm.module_type = 'track' AND sm.is_active = true
    ) THEN GREATEST(sl.max_tracked_videos, 50) ELSE sl.max_tracked_videos END,
    
    updated_at = now()
  WHERE sl.company_id = NEW.company_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for module changes
CREATE TRIGGER on_module_change_update_limits
AFTER INSERT OR UPDATE ON public.subscription_modules
FOR EACH ROW EXECUTE FUNCTION public.update_subscription_limits();

-- Create indexes for performance
CREATE INDEX idx_subscriptions_company ON public.subscriptions(company_id);
CREATE INDEX idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX idx_subscription_modules_company ON public.subscription_modules(company_id);
CREATE INDEX idx_subscription_addons_company ON public.subscription_addons(company_id);
CREATE INDEX idx_subscription_limits_company ON public.subscription_limits(company_id);
CREATE INDEX idx_subscription_usage_company ON public.subscription_usage(company_id);
CREATE INDEX idx_subscription_usage_resource ON public.subscription_usage(resource_type);