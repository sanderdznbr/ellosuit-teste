create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

do $$
declare jid bigint;
begin
  select jobid into jid from cron.job where jobname = 'crm-followup-dispatch-every-5min';
  if jid is not null then perform cron.unschedule(jid); end if;
end $$;

select cron.schedule(
  'crm-followup-dispatch-every-5min',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://hsmswxqlcnjbomnzpjfh.functions.supabase.co/crm-followup-dispatch',
    headers := jsonb_build_object('Content-Type','application/json'),
    body := '{}'::jsonb
  );
  $$
);