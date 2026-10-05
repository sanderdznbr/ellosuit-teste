
-- Step 1: Merge LID conversations into their phone counterparts by matching profile_picture

-- Gustavo Oliveira: lid conv 544187e8 (4 msgs) -> phone conv 4f03a0ee (3 msgs, phone 5541985334806)
UPDATE whatsapp_messages SET conversation_id = '4f03a0ee-1f58-4c2c-9c23-deaed4697f2b' 
WHERE conversation_id = '544187e8-53b3-420f-8d48-df678862658f';

UPDATE whatsapp_conversations SET 
  contact_name = 'Gustavo Oliveira',
  last_message_at = GREATEST(
    (SELECT last_message_at FROM whatsapp_conversations WHERE id = '4f03a0ee-1f58-4c2c-9c23-deaed4697f2b'),
    (SELECT last_message_at FROM whatsapp_conversations WHERE id = '544187e8-53b3-420f-8d48-df678862658f')
  )
WHERE id = '4f03a0ee-1f58-4c2c-9c23-deaed4697f2b';

DELETE FROM whatsapp_conversations WHERE id = '544187e8-53b3-420f-8d48-df678862658f';

-- Julia Matozo: lid conv b711bbcb (5 msgs) -> phone conv c224a6dd (87 msgs, phone 5541996875461)
UPDATE whatsapp_messages SET conversation_id = 'c224a6dd-ca13-43fe-bae0-2b99e0cbe043' 
WHERE conversation_id = 'b711bbcb-993e-4571-b212-96bb0842c990';

UPDATE whatsapp_conversations SET 
  contact_name = 'Julia Matozo 𓆉',
  last_message_at = GREATEST(
    (SELECT last_message_at FROM whatsapp_conversations WHERE id = 'c224a6dd-ca13-43fe-bae0-2b99e0cbe043'),
    (SELECT last_message_at FROM whatsapp_conversations WHERE id = 'b711bbcb-993e-4571-b212-96bb0842c990')
  )
WHERE id = 'c224a6dd-ca13-43fe-bae0-2b99e0cbe043';

DELETE FROM whatsapp_conversations WHERE id = 'b711bbcb-993e-4571-b212-96bb0842c990';

-- Sander without country code: 41985350504 (0 msgs) -> 5541985350504 (12 msgs)
UPDATE whatsapp_messages SET conversation_id = '6bb8c8d9-11b9-4247-86fa-2840cdf92e58' 
WHERE conversation_id = '03a54a22-5cff-4414-96b8-b4af9293088c';

DELETE FROM whatsapp_conversations WHERE id = '03a54a22-5cff-4414-96b8-b4af9293088c';

-- Step 2: Create AI credits tables

-- AI credit balances per company
CREATE TABLE public.ai_credit_balances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_purchased NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_consumed NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);

ALTER TABLE public.ai_credit_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company credits" ON public.ai_credit_balances
  FOR SELECT USING (public.user_belongs_to_company(company_id, auth.uid()));

CREATE POLICY "Admins can update company credits" ON public.ai_credit_balances
  FOR UPDATE USING (public.is_company_admin_or_manager(company_id, auth.uid()));

-- AI credit transactions log
CREATE TABLE public.ai_credit_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID,
  agent_id UUID REFERENCES public.ai_agents(id) ON DELETE SET NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('purchase', 'consumption', 'bonus', 'refund')),
  amount NUMERIC(12,2) NOT NULL,
  balance_after NUMERIC(12,2) NOT NULL,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company transactions" ON public.ai_credit_transactions
  FOR SELECT USING (public.user_belongs_to_company(company_id, auth.uid()));

CREATE POLICY "System can insert transactions" ON public.ai_credit_transactions
  FOR INSERT WITH CHECK (public.user_belongs_to_company(company_id, auth.uid()));

-- AI credit packages for purchase
CREATE TABLE public.ai_credit_packages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  credits NUMERIC(12,2) NOT NULL,
  price_brl NUMERIC(10,2) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_popular BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_credit_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active packages" ON public.ai_credit_packages
  FOR SELECT USING (is_active = true);

-- Insert default packages
INSERT INTO public.ai_credit_packages (name, credits, price_brl, description, is_popular, sort_order) VALUES
  ('Starter', 100, 19.90, '100 créditos de IA', false, 1),
  ('Pro', 500, 79.90, '500 créditos de IA', true, 2),
  ('Business', 1500, 199.90, '1500 créditos de IA', false, 3),
  ('Enterprise', 5000, 499.90, '5000 créditos de IA', false, 4);

-- Function to consume AI credits
CREATE OR REPLACE FUNCTION public.consume_ai_credits(
  p_company_id UUID,
  p_agent_id UUID,
  p_amount NUMERIC,
  p_description TEXT DEFAULT 'Mensagem de agente IA'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_balance NUMERIC;
  new_balance NUMERIC;
BEGIN
  -- Get or create balance
  INSERT INTO public.ai_credit_balances (company_id, balance)
  VALUES (p_company_id, 0)
  ON CONFLICT (company_id) DO NOTHING;

  -- Lock and get current balance
  SELECT balance INTO current_balance
  FROM public.ai_credit_balances
  WHERE company_id = p_company_id
  FOR UPDATE;

  IF current_balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_credits', 'balance', current_balance);
  END IF;

  new_balance := current_balance - p_amount;

  -- Update balance
  UPDATE public.ai_credit_balances
  SET balance = new_balance, total_consumed = total_consumed + p_amount, updated_at = now()
  WHERE company_id = p_company_id;

  -- Log transaction
  INSERT INTO public.ai_credit_transactions (company_id, agent_id, transaction_type, amount, balance_after, description)
  VALUES (p_company_id, p_agent_id, 'consumption', -p_amount, new_balance, p_description);

  RETURN jsonb_build_object('success', true, 'balance', new_balance, 'consumed', p_amount);
END;
$$;

-- Function to add AI credits (purchase)
CREATE OR REPLACE FUNCTION public.add_ai_credits(
  p_company_id UUID,
  p_amount NUMERIC,
  p_description TEXT DEFAULT 'Compra de créditos'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_balance NUMERIC;
BEGIN
  INSERT INTO public.ai_credit_balances (company_id, balance, total_purchased)
  VALUES (p_company_id, p_amount, p_amount)
  ON CONFLICT (company_id) DO UPDATE
  SET balance = ai_credit_balances.balance + p_amount,
      total_purchased = ai_credit_balances.total_purchased + p_amount,
      updated_at = now();

  SELECT balance INTO new_balance FROM public.ai_credit_balances WHERE company_id = p_company_id;

  INSERT INTO public.ai_credit_transactions (company_id, transaction_type, amount, balance_after, description)
  VALUES (p_company_id, 'purchase', p_amount, new_balance, p_description);

  RETURN jsonb_build_object('success', true, 'balance', new_balance);
END;
$$;

-- Triggers
CREATE TRIGGER update_ai_credit_balances_updated_at
  BEFORE UPDATE ON public.ai_credit_balances
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Give initial free credits to all existing companies
INSERT INTO public.ai_credit_balances (company_id, balance, total_purchased)
SELECT id, 10, 10 FROM public.companies
ON CONFLICT (company_id) DO NOTHING;
