
-- Add 'free' as a valid status for subscriptions
-- Update the default subscription function to create 'free' plan instead of 'trialing'

CREATE OR REPLACE FUNCTION public.create_default_subscription()
RETURNS TRIGGER AS $$
BEGIN
  -- Create default subscription as FREE (no trial until card is registered)
  INSERT INTO public.subscriptions (company_id, plan_type, status, monthly_price)
  VALUES (NEW.id, 'free', 'free', 0.00);
  
  -- Create default limits (free plan - minimal)
  INSERT INTO public.subscription_limits (
    company_id, max_users, max_storage_gb
  ) VALUES (NEW.id, 1, 1);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
