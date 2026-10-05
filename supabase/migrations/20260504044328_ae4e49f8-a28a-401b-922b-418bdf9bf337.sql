-- Aprovar o perfil
UPDATE public.profiles 
SET approval_status = 'approved' 
WHERE id = 'c63ba931-0c34-4461-ae8d-2908aed7dd20';

-- Aprovar a solicitação de registro se existir
UPDATE public.registration_requests 
SET status = 'approved', 
    reviewed_at = now(),
    review_notes = 'Aprovado via solicitação direta do administrador.'
WHERE user_id = 'c63ba931-0c34-4461-ae8d-2908aed7dd20';