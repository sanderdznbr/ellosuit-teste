
-- Update subscription to business plan with 30-day trial
UPDATE public.subscriptions
SET plan_type = 'business',
    status = 'trialing',
    billing_cycle = 'monthly',
    monthly_price = 397.00,
    trial_ends_at = now() + interval '30 days',
    current_period_start = now(),
    current_period_end = now() + interval '30 days',
    updated_at = now()
WHERE company_id = '3cfd7b44-2cac-4f3f-903d-ee39852c0b01';

-- Activate all modules (omni, flow, track)
INSERT INTO public.subscription_modules (company_id, module_type, is_active, activated_at, monthly_price, subscription_id)
VALUES 
  ('3cfd7b44-2cac-4f3f-903d-ee39852c0b01', 'omni', true, now(), 0, '7c666bbe-0ca6-41d6-9e28-a94d6896f9dc'),
  ('3cfd7b44-2cac-4f3f-903d-ee39852c0b01', 'flow', true, now(), 0, '7c666bbe-0ca6-41d6-9e28-a94d6896f9dc'),
  ('3cfd7b44-2cac-4f3f-903d-ee39852c0b01', 'track', true, now(), 0, '7c666bbe-0ca6-41d6-9e28-a94d6896f9dc')
ON CONFLICT (company_id, module_type)
DO UPDATE SET is_active = true, activated_at = now(), monthly_price = 0;
