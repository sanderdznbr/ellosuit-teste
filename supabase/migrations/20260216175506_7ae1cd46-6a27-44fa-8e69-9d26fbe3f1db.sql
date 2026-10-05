
-- Notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info', -- info, success, warning, action
  category TEXT NOT NULL DEFAULT 'system', -- system, calendar, crm, task, meeting, email, drive
  icon TEXT, -- lucide icon name
  action_url TEXT, -- link to navigate to
  is_read BOOLEAN NOT NULL DEFAULT false,
  whatsapp_sent BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_notifications_user_created ON public.notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_company ON public.notifications(company_id);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can see their own notifications
CREATE POLICY "Users can view own notifications"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id);

-- Users can update (mark as read) their own notifications
CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications"
ON public.notifications FOR DELETE
USING (auth.uid() = user_id);

-- Service role / edge functions can insert (no user-facing insert policy)
CREATE POLICY "Service role can insert notifications"
ON public.notifications FOR INSERT
WITH CHECK (true);

-- Notification preferences per user
CREATE TABLE public.notification_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  whatsapp_enabled BOOLEAN NOT NULL DEFAULT true,
  whatsapp_number TEXT,
  categories JSONB NOT NULL DEFAULT '{"system": true, "calendar": true, "crm": true, "task": true, "meeting": true, "email": true, "drive": true}',
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preferences"
ON public.notification_preferences FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can upsert own preferences"
ON public.notification_preferences FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
ON public.notification_preferences FOR UPDATE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_notification_preferences_updated_at
BEFORE UPDATE ON public.notification_preferences
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
