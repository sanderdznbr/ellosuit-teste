-- Add Pagar.me columns to subscriptions table
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS pagarme_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS pagarme_customer_id TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_pagarme_subscription 
ON public.subscriptions(pagarme_subscription_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_pagarme_customer 
ON public.subscriptions(pagarme_customer_id);

-- Create webhook logs table for debugging
CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB,
  processed_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on webhook_logs
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- Only service role can access webhook logs
CREATE POLICY "Service role can manage webhook logs"
ON public.webhook_logs
FOR ALL
USING (true)
WITH CHECK (true);