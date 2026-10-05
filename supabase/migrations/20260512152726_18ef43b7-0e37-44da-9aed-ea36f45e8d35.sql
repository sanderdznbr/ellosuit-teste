ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS is_partner BOOLEAN NOT NULL DEFAULT false;

UPDATE public.companies SET is_partner = true WHERE id = 'e4625533-166d-4cc1-b487-6e4318641c76';

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
  is_partner_company BOOLEAN;
BEGIN
  SELECT COALESCE(is_partner, false) INTO is_partner_company FROM public.companies WHERE id = p_company_id;

  IF is_partner_company THEN
    INSERT INTO public.ai_credit_balances (company_id, balance) VALUES (p_company_id, 0)
    ON CONFLICT (company_id) DO NOTHING;
    INSERT INTO public.ai_credit_transactions (company_id, agent_id, transaction_type, amount, balance_after, description)
    VALUES (p_company_id, p_agent_id, 'consumption', 0, 0, p_description || ' (partner)');
    RETURN jsonb_build_object('success', true, 'balance', 999999, 'consumed', 0, 'partner', true);
  END IF;

  INSERT INTO public.ai_credit_balances (company_id, balance) VALUES (p_company_id, 0)
  ON CONFLICT (company_id) DO NOTHING;

  SELECT balance INTO current_balance FROM public.ai_credit_balances WHERE company_id = p_company_id FOR UPDATE;

  IF current_balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_credits', 'balance', current_balance);
  END IF;

  new_balance := current_balance - p_amount;

  UPDATE public.ai_credit_balances SET balance = new_balance, total_consumed = total_consumed + p_amount, updated_at = now()
  WHERE company_id = p_company_id;

  INSERT INTO public.ai_credit_transactions (company_id, agent_id, transaction_type, amount, balance_after, description)
  VALUES (p_company_id, p_agent_id, 'consumption', -p_amount, new_balance, p_description);

  RETURN jsonb_build_object('success', true, 'balance', new_balance, 'consumed', p_amount);
END;
$$;