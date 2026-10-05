-- Associar usuário gustavo@runavimedia.com à empresa existente
DO $$
DECLARE
    user_uuid UUID;
    company_uuid UUID;
BEGIN
    -- Buscar o UUID do usuário
    SELECT id INTO user_uuid 
    FROM auth.users 
    WHERE email = 'gustavo@runavimedia.com';
    
    -- Buscar a empresa existente
    SELECT id INTO company_uuid 
    FROM public.companies 
    WHERE domain = 'runavimedia.com';
    
    -- Verificar se já existe associação
    IF NOT EXISTS (
        SELECT 1 FROM public.company_users 
        WHERE company_id = company_uuid AND user_id = user_uuid
    ) THEN
        -- Associar usuário à empresa como admin
        INSERT INTO public.company_users (company_id, user_id, role)
        VALUES (company_uuid, user_uuid, 'admin');
        
        RAISE NOTICE 'Usuário associado à empresa com sucesso';
    ELSE
        RAISE NOTICE 'Usuário já está associado à empresa';
    END IF;
END $$;