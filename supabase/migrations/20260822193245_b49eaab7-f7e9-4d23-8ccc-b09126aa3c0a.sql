CREATE TABLE IF NOT EXISTS public.ai_reply_locks (
  conversation_id uuid PRIMARY KEY,
  locked_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.ai_reply_locks TO service_role;
ALTER TABLE public.ai_reply_locks ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.claim_ai_reply(p_conversation_id uuid, p_ttl_seconds integer DEFAULT 60)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows integer;
BEGIN
  INSERT INTO public.ai_reply_locks (conversation_id, locked_at)
  VALUES (p_conversation_id, now())
  ON CONFLICT (conversation_id) DO UPDATE
    SET locked_at = now()
    WHERE public.ai_reply_locks.locked_at < now() - make_interval(secs => p_ttl_seconds);
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;