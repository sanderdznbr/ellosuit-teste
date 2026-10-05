
-- Fallback function: scan conversations and dispatch autopilot for any client
-- message that has been waiting too long (X seconds) without a reply.
CREATE OR REPLACE FUNCTION public.autopilot_fallback_scan()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  runtime RECORD;
  rec RECORD;
  wait_seconds int := 45; -- X seconds threshold
BEGIN
  SELECT * INTO runtime FROM public.autopilot_runtime_config WHERE id = 1;
  IF runtime IS NULL OR runtime.service_role_key IS NULL OR runtime.service_role_key = '' THEN
    RETURN;
  END IF;

  FOR rec IN
    WITH last_inbound AS (
      SELECT DISTINCT ON (m.conversation_id)
        m.conversation_id, m.timestamp AS ts, m.id AS msg_id
      FROM public.whatsapp_messages m
      WHERE m.from_me = false
        AND m.timestamp > now() - interval '30 minutes'
        AND m.timestamp < now() - make_interval(secs => wait_seconds)
      ORDER BY m.conversation_id, m.timestamp DESC
    ),
    last_outbound AS (
      SELECT DISTINCT ON (m.conversation_id)
        m.conversation_id, m.timestamp AS ts
      FROM public.whatsapp_messages m
      WHERE m.from_me = true
        AND m.message_type IS DISTINCT FROM 'system'
      ORDER BY m.conversation_id, m.timestamp DESC
    )
    SELECT c.id AS conversation_id, c.company_id, li.msg_id, li.ts AS inbound_ts
    FROM last_inbound li
    JOIN public.whatsapp_conversations c ON c.id = li.conversation_id
    LEFT JOIN last_outbound lo ON lo.conversation_id = li.conversation_id
    JOIN public.crm_autopilot_configs cfg
      ON cfg.company_id = c.company_id AND cfg.is_active = true
    WHERE (lo.ts IS NULL OR lo.ts < li.ts)
      AND c.human_takeover IS NOT TRUE
      AND NOT EXISTS (
        -- No chatbot execution active and recently talking
        SELECT 1 FROM public.chatbot_executions ce
        WHERE ce.conversation_id = c.id
          AND ce.status = 'running'
          AND COALESCE(ce.last_activity_at, ce.started_at) > now() - make_interval(secs => wait_seconds)
      )
      AND NOT EXISTS (
        -- Not already dispatched for this exact inbound message
        SELECT 1 FROM public.crm_autopilot_events e
        WHERE e.conversation_id = c.id
          AND e.event_type IN ('answered','escalated_to_parent','fallback_dispatched')
          AND e.created_at > li.ts
      )
    LIMIT 50
  LOOP
    -- Mark dispatch to avoid duplicate triggers on subsequent runs
    INSERT INTO public.crm_autopilot_events (company_id, conversation_id, event_type, description, metadata)
    VALUES (rec.company_id, rec.conversation_id, 'fallback_dispatched',
      'Cliente aguardando > ' || wait_seconds || 's — piloto acionado pelo fallback',
      jsonb_build_object('inbound_ts', rec.inbound_ts, 'msg_id', rec.msg_id));

    PERFORM net.http_post(
      url := runtime.supabase_url || '/functions/v1/crm-autopilot-respond',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'Authorization','Bearer ' || runtime.service_role_key
      ),
      body := jsonb_build_object('conversationId', rec.conversation_id)
    );
  END LOOP;
END;
$$;

-- Schedule every minute
SELECT cron.unschedule('autopilot-fallback-scan') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'autopilot-fallback-scan'
);
SELECT cron.schedule(
  'autopilot-fallback-scan',
  '* * * * *',
  $$ SELECT public.autopilot_fallback_scan(); $$
);
