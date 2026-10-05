
-- Auto-approve all new registrations (remove 24h friction)
ALTER TABLE public.profiles ALTER COLUMN approval_status SET DEFAULT 'approved';

-- Approve all existing pending users
UPDATE public.profiles SET approval_status = 'approved' WHERE approval_status = 'pending' OR approval_status IS NULL;

-- Also approve any pending registration_requests
UPDATE public.registration_requests SET status = 'approved' WHERE status = 'pending';
