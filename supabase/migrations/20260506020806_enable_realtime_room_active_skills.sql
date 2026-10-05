-- Enable realtime for room_active_skills so the sidebar UI syncs immediately
ALTER TABLE public.room_active_skills REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'room_active_skills'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.room_active_skills';
  END IF;
END $$;
