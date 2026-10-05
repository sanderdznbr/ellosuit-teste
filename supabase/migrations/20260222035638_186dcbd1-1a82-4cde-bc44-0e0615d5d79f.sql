
-- Add birthday reminder toggle to notification_settings
ALTER TABLE public.notification_settings 
ADD COLUMN IF NOT EXISTS whatsapp_birthday_reminder boolean NOT NULL DEFAULT true;
