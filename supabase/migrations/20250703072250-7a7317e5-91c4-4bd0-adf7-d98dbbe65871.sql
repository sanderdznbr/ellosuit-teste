
-- Criar a empresa Criativize
INSERT INTO public.companies (name, domain, settings)
VALUES ('Criativize', 'criativize.co', '{}');

-- Vincular a conta sander@criativize.co à empresa Criativize
INSERT INTO public.company_users (company_id, user_id, role)
SELECT 
  c.id as company_id,
  u.id as user_id,
  'admin'::company_role as role
FROM public.companies c
CROSS JOIN auth.users u
WHERE c.name = 'Criativize' 
  AND u.email = 'sander@criativize.co';
