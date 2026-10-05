-- Ensure all existing notification_settings have all whatsapp toggles enabled
UPDATE public.notification_settings SET 
  whatsapp_enabled = true,
  whatsapp_event_created = true,
  whatsapp_event_upcoming = true,
  whatsapp_event_deleted = true,
  whatsapp_task_due = true,
  whatsapp_email_sent = true,
  whatsapp_dispatch_progress = true,
  whatsapp_birthday_reminder = true
WHERE whatsapp_enabled = false 
   OR whatsapp_event_created = false 
   OR whatsapp_event_upcoming = false;

-- Ensure defaults are true for whatsapp_enabled in notification_settings
ALTER TABLE public.notification_settings 
  ALTER COLUMN whatsapp_enabled SET DEFAULT true;

-- Ensure defaults are true for notification_preferences
ALTER TABLE public.notification_preferences 
  ALTER COLUMN whatsapp_enabled SET DEFAULT true;

-- Auto-create notification_settings for new users via trigger
CREATE OR REPLACE FUNCTION public.auto_create_notification_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.notification_settings (user_id, company_id, whatsapp_enabled)
  VALUES (NEW.user_id, NEW.company_id, true)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$function$;

-- Trigger on company_users insert
DROP TRIGGER IF EXISTS auto_create_notif_settings ON public.company_users;
CREATE TRIGGER auto_create_notif_settings
  AFTER INSERT ON public.company_users
  FOR EACH ROW EXECUTE FUNCTION public.auto_create_notification_settings();