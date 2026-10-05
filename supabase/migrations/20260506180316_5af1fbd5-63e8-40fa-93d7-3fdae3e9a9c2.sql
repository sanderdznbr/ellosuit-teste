
-- Enable pg_cron and pg_net for scheduled cleanup
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Function to clean inactive WhatsApp sessions older than 24 hours
CREATE OR REPLACE FUNCTION public.cleanup_inactive_whatsapp_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  WITH deleted AS (
    DELETE FROM public.whatsapp_sessions
    WHERE status <> 'connected'
      AND COALESCE(last_seen_at, updated_at, created_at) < (now() - interval '24 hours')
    RETURNING id
  )
  SELECT count(*) INTO deleted_count FROM deleted;
  RETURN deleted_count;
END;
$$;

-- Schedule hourly cleanup (drop existing job if present)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-inactive-whatsapp-sessions') THEN
    PERFORM cron.unschedule('cleanup-inactive-whatsapp-sessions');
  END IF;
END $$;

SELECT cron.schedule(
  'cleanup-inactive-whatsapp-sessions',
  '0 * * * *',
  $$SELECT public.cleanup_inactive_whatsapp_sessions();$$
);
