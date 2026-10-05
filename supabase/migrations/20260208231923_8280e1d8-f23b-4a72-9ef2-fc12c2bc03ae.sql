
-- Delete all WhatsApp sessions from sander@criativize.co account
DELETE FROM whatsapp_sessions
WHERE company_id = '92c0552b-4e6c-4c4a-b9a8-db9749bb2c37';

-- Create function to cleanup disconnected sessions older than 1 hour
CREATE OR REPLACE FUNCTION public.cleanup_disconnected_whatsapp_sessions()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  DELETE FROM public.whatsapp_sessions
  WHERE status IN ('disconnected', 'waiting_qr', 'connecting')
    AND updated_at < now() - interval '1 hour';
$$;

-- Create a scheduled cleanup trigger that runs on any insert/update
-- This will clean old sessions whenever there's activity
CREATE OR REPLACE FUNCTION public.trigger_cleanup_old_sessions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Cleanup sessions disconnected for more than 1 hour
  DELETE FROM public.whatsapp_sessions
  WHERE status IN ('disconnected', 'waiting_qr', 'connecting')
    AND updated_at < now() - interval '1 hour';
  
  RETURN NEW;
END;
$$;

-- Create trigger on whatsapp_sessions table
DROP TRIGGER IF EXISTS cleanup_old_whatsapp_sessions ON whatsapp_sessions;
CREATE TRIGGER cleanup_old_whatsapp_sessions
  AFTER INSERT ON whatsapp_sessions
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.trigger_cleanup_old_sessions();
