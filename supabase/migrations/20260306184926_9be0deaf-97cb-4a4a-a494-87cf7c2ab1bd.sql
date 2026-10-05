
-- Table to store payment history / invoices
CREATE TABLE public.subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  status TEXT NOT NULL DEFAULT 'pending', -- pending, paid, failed, refunded
  payment_method TEXT, -- credit_card, pix, boleto
  card_brand TEXT,
  card_last_digits TEXT,
  description TEXT,
  invoice_url TEXT,
  pagarme_charge_id TEXT,
  paid_at TIMESTAMPTZ,
  due_date TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_subscription_payments_company ON public.subscription_payments(company_id);
CREATE INDEX idx_subscription_payments_status ON public.subscription_payments(status);

-- RLS
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company payments"
  ON public.subscription_payments
  FOR SELECT
  TO authenticated
  USING (public.user_belongs_to_company(company_id, auth.uid()));

-- Updated at trigger
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.subscription_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
