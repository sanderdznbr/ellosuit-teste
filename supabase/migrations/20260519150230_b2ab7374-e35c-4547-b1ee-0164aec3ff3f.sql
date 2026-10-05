create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Remove existing schedule if any (idempotent)
do $$
begin
  perform cron.unschedule('sync-whatsapp-profiles-every-minute');
exception when others then null;
end$$;

select cron.schedule(
  'sync-whatsapp-profiles-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://jwddiyuezqrpuakazvgg.supabase.co/functions/v1/cron-sync-whatsapp-profiles',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3ZGRpeXVlenFycHVha2F6dmdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEzNDIzNTgsImV4cCI6MjA2NjkxODM1OH0.CrUu3HGCfWh6cPfGsbDXGQNG5AWOsi9X2GGix1-7izg"}'::jsonb,
    body := jsonb_build_object('triggered_at', now())
  );
  $$
);