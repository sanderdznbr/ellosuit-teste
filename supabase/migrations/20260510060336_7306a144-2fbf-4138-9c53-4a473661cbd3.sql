-- Add UPDATE policy for Admin Masters on registration_requests
CREATE POLICY "Admin masters can update all requests" 
ON public.registration_requests 
FOR UPDATE 
USING (is_adminmaster(auth.uid()));

-- Add UPDATE policy for Admin Masters on profiles
CREATE POLICY "Admin masters can update all profiles" 
ON public.profiles 
FOR UPDATE 
USING (is_adminmaster(auth.uid()));

-- Fix Fernando Athanasio's registration request which was approved but stuck as pending due to RLS
UPDATE public.registration_requests 
SET status = 'approved', 
    reviewed_at = now(),
    review_notes = 'Aprovado (Corrigido via sistema após falha de RLS)'
WHERE id = 'cfaf3d89-49c8-4fbe-b3bc-8a17c542c488';
