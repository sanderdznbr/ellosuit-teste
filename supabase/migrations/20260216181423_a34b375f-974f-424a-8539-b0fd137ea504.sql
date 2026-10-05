
-- Add WhatsApp notification preference columns to notification_settings
ALTER TABLE public.notification_settings
  ADD COLUMN IF NOT EXISTS whatsapp_event_created BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS whatsapp_event_upcoming BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS whatsapp_event_deleted BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS whatsapp_task_due BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS whatsapp_email_sent BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS whatsapp_dispatch_progress BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS whatsapp_enabled BOOLEAN NOT NULL DEFAULT true;
