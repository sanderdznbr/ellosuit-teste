-- Enable realtime for WhatsApp CRM tables
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_conversations;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_contacts;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_sessions;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END$$;

-- Optional: ensure DELETE/UPDATE events work reliably
-- (Realtime uses WAL; REPLICA IDENTITY FULL helps if tables lack PK usage in client filters)
ALTER TABLE public.whatsapp_messages REPLICA IDENTITY FULL;
ALTER TABLE public.whatsapp_conversations REPLICA IDENTITY FULL;
ALTER TABLE public.whatsapp_contacts REPLICA IDENTITY FULL;
ALTER TABLE public.whatsapp_sessions REPLICA IDENTITY FULL;
