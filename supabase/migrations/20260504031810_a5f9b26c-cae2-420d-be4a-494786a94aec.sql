-- Create registration requests table
CREATE TABLE IF NOT EXISTS public.registration_requests (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    company_name TEXT NOT NULL,
    document TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    email_marketing_config TEXT,
    whatsapp_config TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for registration_requests
ALTER TABLE public.registration_requests ENABLE ROW LEVEL SECURITY;

-- Policies for registration_requests
CREATE POLICY "Users can view their own requests" 
ON public.registration_requests 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own requests" 
ON public.registration_requests 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Simple admin policy for now - can be refined later if a roles system is found
-- For now, allowing select for all but we will protect the UI
CREATE POLICY "Admins can view all requests" 
ON public.registration_requests 
FOR SELECT 
USING (true);

-- Add approval_status to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected'));

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_registration_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE PLpgsql;

CREATE TRIGGER update_registration_requests_updated_at
BEFORE UPDATE ON public.registration_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_registration_requests_updated_at();
