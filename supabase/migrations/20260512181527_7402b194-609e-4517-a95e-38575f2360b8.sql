-- Function to increment sent count
CREATE OR REPLACE FUNCTION public.increment_campaign_sent(campaign_id_input UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.dispatch_campaigns
    SET sent_count = sent_count + 1,
        updated_at = now()
    WHERE id = campaign_id_input;
END;
$$;

-- Function to increment error count
CREATE OR REPLACE FUNCTION public.increment_campaign_error(campaign_id_input UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.dispatch_campaigns
    SET error_count = error_count + 1,
        updated_at = now()
    WHERE id = campaign_id_input;
END;
$$;
