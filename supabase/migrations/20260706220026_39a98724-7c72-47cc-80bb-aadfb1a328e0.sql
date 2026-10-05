CREATE OR REPLACE FUNCTION public.autopilot_fallback_scan()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  runtime RECORD;
  rec RECORD;
  wait_seconds int := 5;
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
      AND NOT (
        regexp_replace(coalesce(c.contact_phone, ''), '\D', '', 'g') = regexp_replace(coalesce(cfg.parent_phone, ''), '\D', '', 'g')
        OR (
          regexp_replace(coalesce(c.contact_phone, ''), '\D', '', 'g') LIKE '55%'
          AND regexp_replace(coalesce(cfg.parent_phone, ''), '\D', '', 'g') LIKE '55%'
          AND length(regexp_replace(coalesce(c.contact_phone, ''), '\D', '', 'g')) IN (12, 13)
          AND length(regexp_replace(coalesce(cfg.parent_phone, ''), '\D', '', 'g')) IN (12, 13)
          AND substring(regexp_replace(coalesce(c.contact_phone, ''), '\D', '', 'g') from 1 for 4) = substring(regexp_replace(coalesce(cfg.parent_phone, ''), '\D', '', 'g') from 1 for 4)
          AND right(regexp_replace(coalesce(c.contact_phone, ''), '\D', '', 'g'), 8) = right(regexp_replace(coalesce(cfg.parent_phone, ''), '\D', '', 'g'), 8)
        )
      )
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
      body := jsonb_build_object('conversationId', rec.conversation_id, 'force', true)
    );
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.autopilot_proactive_scan()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  runtime RECORD;
  rec RECORD;
BEGIN
  SELECT * INTO runtime FROM public.autopilot_runtime_config WHERE id = 1;
  IF runtime IS NULL OR runtime.service_role_key IS NULL OR runtime.service_role_key = '' THEN
    RETURN;
  END IF;

  FOR rec IN
    WITH last_out AS (
      SELECT DISTINCT ON (m.conversation_id)
        m.conversation_id, m.timestamp AS ts, m.content
      FROM public.whatsapp_messages m
      WHERE m.from_me = true
        AND m.message_type IS DISTINCT FROM 'system'
        AND m.timestamp > now() - interval '2 hours'
      ORDER BY m.conversation_id, m.timestamp DESC
    )
    SELECT c.id AS conversation_id, c.company_id
    FROM last_out lo
    JOIN public.whatsapp_conversations c ON c.id = lo.conversation_id
    JOIN public.crm_autopilot_configs cfg
      ON cfg.company_id = c.company_id AND cfg.is_active = true
    WHERE lo.ts < now() - interval '5 seconds'
      AND lo.ts > now() - interval '30 minutes'
      AND (
        lo.content ~* 'estou verificando|vou verificar|vou confirmar|j[aá] te confirmo|um instante|aguarde|s[oó] um momento|vou checar|vou dar uma olhada|vou olhar'
      )
      AND NOT (
        regexp_replace(coalesce(c.contact_phone, ''), '\D', '', 'g') = regexp_replace(coalesce(cfg.parent_phone, ''), '\D', '', 'g')
        OR (
          regexp_replace(coalesce(c.contact_phone, ''), '\D', '', 'g') LIKE '55%'
          AND regexp_replace(coalesce(cfg.parent_phone, ''), '\D', '', 'g') LIKE '55%'
          AND length(regexp_replace(coalesce(c.contact_phone, ''), '\D', '', 'g')) IN (12, 13)
          AND length(regexp_replace(coalesce(cfg.parent_phone, ''), '\D', '', 'g')) IN (12, 13)
          AND substring(regexp_replace(coalesce(c.contact_phone, ''), '\D', '', 'g') from 1 for 4) = substring(regexp_replace(coalesce(cfg.parent_phone, ''), '\D', '', 'g') from 1 for 4)
          AND right(regexp_replace(coalesce(c.contact_phone, ''), '\D', '', 'g'), 8) = right(regexp_replace(coalesce(cfg.parent_phone, ''), '\D', '', 'g'), 8)
        )
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.crm_autopilot_pending_escalations pe
        WHERE pe.conversation_id = c.id
          AND pe.status IN ('waiting', 'processing')
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.crm_autopilot_events e
        WHERE e.conversation_id = c.id
          AND e.event_type IN ('escalated_to_parent','proactive_dispatched')
          AND e.created_at > lo.ts
      )
  LOOP
    INSERT INTO public.crm_autopilot_events (company_id, conversation_id, event_type, description)
    VALUES (rec.company_id, rec.conversation_id, 'proactive_dispatched',
            'Proativo: piloto disse que ia verificar mas não consultou o Pai — disparando agora');

    PERFORM net.http_post(
      url := runtime.supabase_url || '/functions/v1/crm-autopilot-respond',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'Authorization','Bearer ' || runtime.service_role_key
      ),
      body := jsonb_build_object('conversationId', rec.conversation_id, 'mode', 'proactive_followup', 'force', true)
    );
  END LOOP;
END;
$function$;

UPDATE public.whatsapp_conversations
SET human_takeover = false,
    human_takeover_at = NULL,
    human_takeover_reason = NULL,
    ai_auto_reply_enabled = true
WHERE id = '53acfc06-4bd2-4756-b66f-ae684444fecc';

UPDATE public.whatsapp_conversations c
SET human_takeover = false,
    human_takeover_at = NULL,
    human_takeover_reason = NULL,
    ai_auto_reply_enabled = false,
    assigned_agent_id = NULL
FROM public.crm_autopilot_configs cfg
WHERE cfg.company_id = c.company_id
  AND cfg.is_active = true
  AND cfg.parent_phone IS NOT NULL
  AND (
    regexp_replace(coalesce(c.contact_phone, ''), '\D', '', 'g') = regexp_replace(coalesce(cfg.parent_phone, ''), '\D', '', 'g')
    OR (
      regexp_replace(coalesce(c.contact_phone, ''), '\D', '', 'g') LIKE '55%'
      AND regexp_replace(coalesce(cfg.parent_phone, ''), '\D', '', 'g') LIKE '55%'
      AND length(regexp_replace(coalesce(c.contact_phone, ''), '\D', '', 'g')) IN (12, 13)
      AND length(regexp_replace(coalesce(cfg.parent_phone, ''), '\D', '', 'g')) IN (12, 13)
      AND substring(regexp_replace(coalesce(c.contact_phone, ''), '\D', '', 'g') from 1 for 4) = substring(regexp_replace(coalesce(cfg.parent_phone, ''), '\D', '', 'g') from 1 for 4)
      AND right(regexp_replace(coalesce(c.contact_phone, ''), '\D', '', 'g'), 8) = right(regexp_replace(coalesce(cfg.parent_phone, ''), '\D', '', 'g'), 8)
    )
  );