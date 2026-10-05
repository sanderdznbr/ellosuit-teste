-- Add enriched tracking columns to email_events
ALTER TABLE public.email_events
ADD COLUMN IF NOT EXISTS browser text,
ADD COLUMN IF NOT EXISTS os text,
ADD COLUMN IF NOT EXISTS device_type text,
ADD COLUMN IF NOT EXISTS country text,
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS screen_resolution text,
ADD COLUMN IF NOT EXISTS referrer text,
ADD COLUMN IF NOT EXISTS open_count integer DEFAULT 1;

-- Add open tracking fields to emails table for quick access
ALTER TABLE public.emails
ADD COLUMN IF NOT EXISTS opened_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS open_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_opened_at timestamp with time zone;

-- Create index for faster tracking queries
CREATE INDEX IF NOT EXISTS idx_email_events_email_id_type ON public.email_events(email_id, event_type);
CREATE INDEX IF NOT EXISTS idx_emails_tracking_pixel ON public.emails(tracking_pixel_id);