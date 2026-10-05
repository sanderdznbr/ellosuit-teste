CREATE OR REPLACE FUNCTION public.autopilot_fallback_scan()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  runtime RECORD;
  rec RECORD;
  wait_seconds int := 8;
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
    ),
    human_reply AS (
      SELECT DISTINCT ON (m.conversation_id)
        m.conversation_id, m.timestamp AS ts
      FROM public.whatsapp_messages m
      WHERE m.from_me = true
        AND m.message_type IS DISTINCT FROM 'system'
        AND m.is_ai_response = false
      ORDER BY m.conversation_id, m.timestamp DESC
    )
    SELECT c.id AS conversation_id, c.company_id, li.msg_id, li.ts AS inbound_ts
    FROM last_inbound li
    JOIN public.whatsapp_conversations c ON c.id = li.conversation_id
    LEFT JOIN last_outbound lo ON lo.conversation_id = li.conversation_id
    LEFT JOIN human_reply hr ON hr.conversation_id = li.conversation_id
    JOIN public.crm_autopilot_configs cfg
      ON cfg.company_id = c.company_id AND cfg.is_active = true
    WHERE (lo.ts IS NULL OR lo.ts < li.ts)
      AND (c.human_takeover IS NOT TRUE OR hr.ts IS NULL OR hr.ts < li.ts)
      AND NOT EXISTS (
        SELECT 1 FROM public.crm_autopilot_events e
        WHERE e.conversation_id = c.id
          AND e.event_type IN ('answered','escalated_to_parent','fallback_dispatched')
          AND e.created_at > li.ts
      )
  LOOP
    INSERT INTO public.crm_autopilot_events (company_id, conversation_id, event_type, description, metadata)
    VALUES (rec.company_id, rec.conversation_id, 'fallback_dispatched',
            'Fallback disparado — cliente sem resposta',
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
$function$;