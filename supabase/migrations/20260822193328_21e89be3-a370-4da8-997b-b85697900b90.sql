REVOKE EXECUTE ON FUNCTION public.claim_ai_reply(uuid, integer) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_ai_reply(uuid, integer) TO service_role;