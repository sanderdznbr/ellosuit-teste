
DO $$
DECLARE jid bigint;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname='crm-autopilot-parent-timeout';
  IF jid IS NOT NULL THEN PERFORM cron.unschedule(jid); END IF;
END $$;

SELECT cron.schedule(
  'crm-autopilot-parent-timeout',
  '* * * * *',
  $cmd$
  SELECT net.http_post(
    url := (SELECT supabase_url FROM public.autopilot_runtime_config WHERE id = 1) || '/functions/v1/crm-autopilot-parent-timeout',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT service_role_key FROM public.autopilot_runtime_config WHERE id = 1)),
    body := '{}'::jsonb
  );
  $cmd$
);
