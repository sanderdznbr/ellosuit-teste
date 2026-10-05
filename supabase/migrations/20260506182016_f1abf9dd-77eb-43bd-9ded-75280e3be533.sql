CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_session_id
  ON public.whatsapp_conversations(session_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_session_id
  ON public.whatsapp_contacts(session_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_api_keys_session_id
  ON public.whatsapp_api_keys(session_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_company_status
  ON public.whatsapp_sessions(company_id, status);

CREATE OR REPLACE FUNCTION public.cleanup_all_inactive_whatsapp_sessions(_company_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.company_users
    WHERE company_id = _company_id
      AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  WITH inactive AS (
    SELECT id
    FROM public.whatsapp_sessions
    WHERE company_id = _company_id
      AND status IS DISTINCT FROM 'connected'
  ), deleted AS (
    DELETE FROM public.whatsapp_sessions s
    USING inactive i
    WHERE s.id = i.id
    RETURNING s.id
  )
  SELECT count(*) INTO deleted_count FROM deleted;

  RETURN COALESCE(deleted_count, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_inactive_whatsapp_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer := 0;
BEGIN
  WITH inactive AS (
    SELECT id
    FROM public.whatsapp_sessions
    WHERE status IS DISTINCT FROM 'connected'
      AND COALESCE(last_seen_at, updated_at, created_at) < (now() - interval '24 hours')
  ), deleted AS (
    DELETE FROM public.whatsapp_sessions s
    USING inactive i
    WHERE s.id = i.id
    RETURNING s.id
  )
  SELECT count(*) INTO deleted_count FROM deleted;

  RETURN COALESCE(deleted_count, 0);
END;
$$;