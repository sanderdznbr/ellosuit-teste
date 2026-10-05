-- Function to cleanup and auto-expire meeting rooms
CREATE OR REPLACE FUNCTION public.cleanup_meeting_rooms()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  -- Mark rooms older than 1 hour as inactive and set ended_at
  UPDATE public.meeting_rooms
  SET is_active = false, ended_at = now()
  WHERE is_active = true AND created_at < now() - interval '1 hour';

  -- Hard delete rooms older than 24 hours (cascade will remove participants/chat)
  DELETE FROM public.meeting_rooms
  WHERE ended_at IS NOT NULL AND ended_at < now() - interval '24 hours';
$$;

-- Enable pg_cron extension (safe if already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Schedule cleanup every 5 minutes
SELECT cron.schedule(
  'cleanup-meeting-rooms-every-5-min',
  '*/5 * * * *',
  $$
    SELECT public.cleanup_meeting_rooms();
  $$
);
