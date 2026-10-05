-- First, create the subscription for admin
INSERT INTO public.subscriptions (company_id, plan_type, status, monthly_price, billing_cycle, current_period_start, current_period_end)
VALUES (
  '92c0552b-2985-4ff7-8cf5-78298f564a72',
  'business',
  'active',
  0,
  'yearly',
  now(),
  '2099-12-31 23:59:59+00'
)
ON CONFLICT (company_id) DO UPDATE SET 
  plan_type = 'business',
  status = 'active',
  monthly_price = 0,
  current_period_end = '2099-12-31 23:59:59+00';