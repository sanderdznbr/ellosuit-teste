DO $$
DECLARE
  v_new_balance NUMERIC;
BEGIN
  -- Insert or update credits for the company
  INSERT INTO public.ai_credit_balances (company_id, balance)
  VALUES ('e4625533-166d-4cc1-b487-6e4318641c76', 50.00)
  ON CONFLICT (company_id) DO UPDATE SET balance = ai_credit_balances.balance + 50.00
  RETURNING balance INTO v_new_balance;

  -- Record the transaction
  INSERT INTO public.ai_credit_transactions (company_id, amount, transaction_type, description, balance_after)
  VALUES ('e4625533-166d-4cc1-b487-6e4318641c76', 50.00, 'bonus', 'Créditos de teste adicionados pelo sistema', v_new_balance);
END $$;
