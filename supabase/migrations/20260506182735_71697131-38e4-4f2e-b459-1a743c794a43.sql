ALTER TABLE public.whatsapp_sessions
ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_company_deleted_status
  ON public.whatsapp_sessions(company_id, deleted_at, status);

UPDATE public.whatsapp_sessions
SET deleted_at = now(), updated_at = now()
WHERE company_id = '60008c43-e536-482d-a090-91904de57534'::uuid
  AND deleted_at IS NULL
  AND instance_name IN (
    'whatsapp-1778089899797',
    'whatsapp-1778089063250',
    'whatsapp-1778088766780',
    'whatsapp-1778087901818',
    'test-debug-2',
    'test-debug-1',
    'whatsapp-1778085593483',
    'whatsapp-1774645043139',
    'whatsapp-1773944602388',
    'whatsapp-test-1773944400',
    'whatsapp-1773943875692',
    'whatsapp-1773681938838',
    'whatsapp-1773681875606'
  );

CREATE OR REPLACE FUNCTION public.cleanup_all_inactive_whatsapp_sessions(_company_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  affected_count integer := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.company_users
    WHERE company_id = _company_id
      AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  UPDATE public.whatsapp_sessions
  SET deleted_at = now(), updated_at = now()
  WHERE company_id = _company_id
    AND deleted_at IS NULL
    AND status IS DISTINCT FROM 'connected';

  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RETURN COALESCE(affected_count, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.soft_delete_whatsapp_session(_session_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  affected_count integer := 0;
BEGIN
  UPDATE public.whatsapp_sessions s
  SET deleted_at = now(), updated_at = now()
  WHERE s.id = _session_id
    AND s.deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.company_users cu
      WHERE cu.company_id = s.company_id
        AND cu.user_id = auth.uid()
    );

  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RETURN affected_count > 0;
END;
$$;