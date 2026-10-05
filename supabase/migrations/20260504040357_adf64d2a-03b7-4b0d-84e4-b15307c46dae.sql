-- Aprova a conta admin@gmail.com
UPDATE public.profiles 
SET approval_status = 'approved' 
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'admin@gmail.com'
);