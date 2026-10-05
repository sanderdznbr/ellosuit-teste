
-- Update subscription to business plan
UPDATE public.subscriptions 
SET plan_type = 'business', status = 'active', monthly_price = 397.00
WHERE company_id = '192ed19d-5d24-4454-b84e-af06fa180ff1';

-- Add all modules (omni, flow, track)
INSERT INTO public.subscription_modules (subscription_id, company_id, module_type, is_active, monthly_price)
VALUES 
  ('78c29634-95f7-4266-8ae9-abe61825aa3a', '192ed19d-5d24-4454-b84e-af06fa180ff1', 'omni', true, 197.00),
  ('78c29634-95f7-4266-8ae9-abe61825aa3a', '192ed19d-5d24-4454-b84e-af06fa180ff1', 'flow', true, 147.00),
  ('78c29634-95f7-4266-8ae9-abe61825aa3a', '192ed19d-5d24-4454-b84e-af06fa180ff1', 'track', true, 97.00)
ON CONFLICT (company_id, module_type) 
DO UPDATE SET is_active = true;
