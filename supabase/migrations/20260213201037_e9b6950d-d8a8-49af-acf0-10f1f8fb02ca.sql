
-- Table to store all system notifications and user action logs
CREATE TABLE public.system_notifications_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL, -- 'whatsapp_connected', 'whatsapp_disconnected', 'bulk_dispatch_started', 'bulk_dispatch_completed', 'email_sent', 'user_registered', 'email_campaign_sent'
  event_title TEXT NOT NULL,
  event_description TEXT,
  user_id UUID, -- user who triggered the action
  user_email TEXT,
  company_id UUID,
  company_name TEXT,
  metadata JSONB DEFAULT '{}',
  notification_sent BOOLEAN DEFAULT false, -- whether WhatsApp notification was sent to admin
  notification_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_notifications_log ENABLE ROW LEVEL SECURITY;

-- Only adminmaster can view logs
CREATE POLICY "Adminmaster can view all logs"
ON public.system_notifications_log
FOR SELECT
USING (public.is_adminmaster(auth.uid()));

-- Edge functions can insert (using service role)
CREATE POLICY "Service role can insert logs"
ON public.system_notifications_log
FOR INSERT
WITH CHECK (true);

-- Index for fast querying
CREATE INDEX idx_system_notifications_created_at ON public.system_notifications_log(created_at DESC);
CREATE INDEX idx_system_notifications_event_type ON public.system_notifications_log(event_type);
