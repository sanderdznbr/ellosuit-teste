
DO $$
DECLARE
  sub_id uuid;
BEGIN
  -- Insert subscription
  INSERT INTO public.subscriptions (company_id, plan_type, status, monthly_price)
  VALUES ('60008c43-e536-482d-a090-91904de57534', 'business', 'active', 397.00)
  RETURNING id INTO sub_id;

  -- Insert modules with subscription_id
  INSERT INTO public.subscription_modules (subscription_id, company_id, module_type, is_active, monthly_price)
  VALUES 
    (sub_id, '60008c43-e536-482d-a090-91904de57534', 'omni', true, 197.00),
    (sub_id, '60008c43-e536-482d-a090-91904de57534', 'flow', true, 147.00),
    (sub_id, '60008c43-e536-482d-a090-91904de57534', 'track', true, 97.00);

  -- Ensure subscription limits exist
  INSERT INTO public.subscription_limits (company_id, max_users, max_storage_gb)
  VALUES ('60008c43-e536-482d-a090-91904de57534', 10, 50)
  ON CONFLICT DO NOTHING;
END $$;
