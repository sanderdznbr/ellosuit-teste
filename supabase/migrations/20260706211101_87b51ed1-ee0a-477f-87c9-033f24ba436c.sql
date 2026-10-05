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
    WHERE lo.ts < now() - interval '20 seconds'
      AND lo.ts > now() - interval '30 minutes'
      AND (
        lo.content ~* 'estou verificando|vou verificar|vou confirmar|j[aá] te confirmo|um instante|aguarde|s[oó] um momento|vou checar|vou dar uma olhada|vou olhar'
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.crm_autopilot_pending_escalations pe
        WHERE pe.conversation_id = c.id
          AND pe.status = 'waiting'
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

-- Agenda cron a cada 1 minuto (junto com o fallback existente)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'autopilot-proactive-scan') THEN
    PERFORM cron.schedule('autopilot-proactive-scan', '* * * * *', $cron$SELECT public.autopilot_proactive_scan();$cron$);
  END IF;
END $$;