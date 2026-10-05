
-- Table for API WhatsApp subscriptions managed via BeehiveHub
CREATE TABLE public.api_whatsapp_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  
  -- Plan details
  plan_name TEXT NOT NULL, -- 'starter', 'professional', 'business', 'enterprise'
  plan_label TEXT NOT NULL, -- Display name
  sessions_included INT NOT NULL DEFAULT 1,
  annual_price INT NOT NULL, -- Price in cents (e.g., 30000 = R$300)
  installments INT NOT NULL DEFAULT 1,
  installment_amount INT NOT NULL, -- Amount per installment in cents
  
  -- BeehiveHub transaction data
  beehive_transaction_id TEXT,
  beehive_status TEXT DEFAULT 'pending', -- pending, processing, paid, refused, refunded, canceled
  beehive_secure_id TEXT,
  beehive_secure_url TEXT,
  payment_method TEXT, -- credit_card, boleto, pix
  card_last_digits TEXT,
  card_brand TEXT,
  
  -- Subscription lifecycle
  status TEXT NOT NULL DEFAULT 'pending', -- pending, active, expired, canceled, suspended
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  
  -- Customer data sent to BeehiveHub
  customer_name TEXT,
  customer_email TEXT,
  customer_document TEXT,
  customer_phone TEXT,
  
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.api_whatsapp_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can view their own company subscriptions
CREATE POLICY "Users can view own company api_whatsapp_subscriptions"
ON public.api_whatsapp_subscriptions FOR SELECT
USING (public.user_belongs_to_company(company_id, auth.uid()));

-- Users can create subscriptions for their company
CREATE POLICY "Users can create api_whatsapp_subscriptions"
ON public.api_whatsapp_subscriptions FOR INSERT
WITH CHECK (public.user_belongs_to_company(company_id, auth.uid()));

-- Users can update their own company subscriptions
CREATE POLICY "Users can update own company api_whatsapp_subscriptions"
ON public.api_whatsapp_subscriptions FOR UPDATE
USING (public.user_belongs_to_company(company_id, auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_api_whatsapp_subscriptions_updated_at
BEFORE UPDATE ON public.api_whatsapp_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Index for quick lookups
CREATE INDEX idx_api_whatsapp_subs_company ON public.api_whatsapp_subscriptions(company_id);
CREATE INDEX idx_api_whatsapp_subs_beehive_tx ON public.api_whatsapp_subscriptions(beehive_transaction_id);
CREATE INDEX idx_api_whatsapp_subs_status ON public.api_whatsapp_subscriptions(status);
