
-- Create support_tickets table
CREATE TABLE public.support_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'medium',
  category TEXT,
  response TEXT,
  responded_by UUID,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Adminmaster can manage all tickets"
  ON public.support_tickets FOR ALL
  USING (public.is_adminmaster(auth.uid()));

CREATE POLICY "Users can view own tickets"
  ON public.support_tickets FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create tickets"
  ON public.support_tickets FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Create bug_reports table
CREATE TABLE public.bug_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  screenshot_url TEXT,
  browser_info TEXT,
  steps_to_reproduce TEXT,
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Adminmaster can manage all bug reports"
  ON public.bug_reports FOR ALL
  USING (public.is_adminmaster(auth.uid()));

CREATE POLICY "Users can view own bug reports"
  ON public.bug_reports FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create bug reports"
  ON public.bug_reports FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Create admin_impersonation_logs table
CREATE TABLE public.admin_impersonation_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_user_id UUID NOT NULL,
  target_user_id UUID NOT NULL,
  reason TEXT,
  ip_address TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ
);

ALTER TABLE public.admin_impersonation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Adminmaster can view impersonation logs"
  ON public.admin_impersonation_logs FOR ALL
  USING (public.is_adminmaster(auth.uid()));

-- Triggers
CREATE TRIGGER update_support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_bug_reports_updated_at
  BEFORE UPDATE ON public.bug_reports
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
