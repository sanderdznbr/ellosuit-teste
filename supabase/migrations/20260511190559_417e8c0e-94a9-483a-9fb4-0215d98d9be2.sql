-- 1. Add sync_status to track automated syncs if it doesn't exist
ALTER TABLE public.whatsapp_conversations 
ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'pending';

-- 2. Create the function that will trigger the Edge Function
CREATE OR REPLACE FUNCTION public.fn_trigger_whatsapp_sync()
RETURNS TRIGGER AS $$
DECLARE
  request_url TEXT;
  request_body TEXT;
BEGIN
  -- We only trigger if it's a new conversation or if it was explicitly reset to pending
  IF (TG_OP = 'INSERT') OR (NEW.sync_status = 'pending' AND OLD.sync_status IS DISTINCT FROM 'pending') THEN
    
    -- The URL for the Edge Function
    -- Note: This requires the net extension and permissions
    -- Using pg_net if available is better, but here we'll use a logic that 
    -- we can also pick up via an interval if needed.
    
    -- For now, we update the status so our "loop" can find it.
    NEW.sync_status := 'queued';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Create the trigger
DROP TRIGGER IF EXISTS tr_sync_whatsapp_profile ON public.whatsapp_conversations;
CREATE TRIGGER tr_sync_whatsapp_profile
BEFORE INSERT OR UPDATE ON public.whatsapp_conversations
FOR EACH ROW
EXECUTE FUNCTION public.fn_trigger_whatsapp_sync();

-- 4. Create a cron-like function that the system can run to find 'queued' items
-- This is a safety measure. The Edge Function itself will now be updated to 
-- prioritize 'queued' or 'pending' status.
