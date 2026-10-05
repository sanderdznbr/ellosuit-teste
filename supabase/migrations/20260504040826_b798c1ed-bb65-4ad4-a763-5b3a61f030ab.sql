-- Altera o status para pendente para o admin@gmail.com
UPDATE public.profiles 
SET approval_status = 'pending' 
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'admin@gmail.com'
);