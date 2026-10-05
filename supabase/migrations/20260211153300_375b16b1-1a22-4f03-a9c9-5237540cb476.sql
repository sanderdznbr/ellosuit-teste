
-- Create table for tracking links embedded in emails
CREATE TABLE public.email_tracked_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email_id UUID NOT NULL REFERENCES public.emails(id) ON DELETE CASCADE,
  original_url TEXT NOT NULL,
  tracking_id TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  click_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for individual click events on email links
CREATE TABLE public.email_link_clicks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tracked_link_id UUID NOT NULL REFERENCES public.email_tracked_links(id) ON DELETE CASCADE,
  email_id UUID NOT NULL REFERENCES public.emails(id) ON DELETE CASCADE,
  clicked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_agent TEXT,
  ip_address INET,
  browser TEXT,
  os TEXT,
  device_type TEXT,
  country TEXT,
  city TEXT,
  referrer TEXT
);

-- Indexes
CREATE INDEX idx_email_tracked_links_email_id ON public.email_tracked_links(email_id);
CREATE INDEX idx_email_tracked_links_tracking_id ON public.email_tracked_links(tracking_id);
CREATE INDEX idx_email_link_clicks_tracked_link_id ON public.email_link_clicks(tracked_link_id);
CREATE INDEX idx_email_link_clicks_email_id ON public.email_link_clicks(email_id);

-- RLS
ALTER TABLE public.email_tracked_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_link_clicks ENABLE ROW LEVEL SECURITY;

-- Policies: users can see links/clicks for emails they own
CREATE POLICY "Users can view their tracked links" ON public.email_tracked_links
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.emails WHERE emails.id = email_tracked_links.email_id AND emails.user_id = auth.uid())
  );

CREATE POLICY "Users can insert tracked links" ON public.email_tracked_links
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.emails WHERE emails.id = email_tracked_links.email_id AND emails.user_id = auth.uid())
  );

CREATE POLICY "Users can view their link clicks" ON public.email_link_clicks
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.emails WHERE emails.id = email_link_clicks.email_id AND emails.user_id = auth.uid())
  );

-- Service role insert for edge function (no auth context)
CREATE POLICY "Service role can insert link clicks" ON public.email_link_clicks
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role can manage tracked links" ON public.email_tracked_links
  FOR ALL USING (true);
