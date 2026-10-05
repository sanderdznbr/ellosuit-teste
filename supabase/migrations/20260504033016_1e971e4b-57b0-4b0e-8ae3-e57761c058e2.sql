-- Create table for custom client types/tags
CREATE TABLE IF NOT EXISTS public.client_custom_types (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    value TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT 'bg-blue-100 text-blue-700 border-blue-200',
    icon_name TEXT NOT NULL DEFAULT 'Users',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(company_id, value)
);

-- Enable RLS
ALTER TABLE public.client_custom_types ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their company's custom types" 
ON public.client_custom_types 
FOR SELECT 
USING (EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.company_id = client_custom_types.company_id 
    AND company_users.user_id = auth.uid()
));

CREATE POLICY "Users can insert custom types for their company" 
ON public.client_custom_types 
FOR INSERT 
WITH CHECK (EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.company_id = client_custom_types.company_id 
    AND company_users.user_id = auth.uid()
));

CREATE POLICY "Users can update their company's custom types" 
ON public.client_custom_types 
FOR UPDATE 
USING (EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.company_id = client_custom_types.company_id 
    AND company_users.user_id = auth.uid()
));

CREATE POLICY "Users can delete their company's custom types" 
ON public.client_custom_types 
FOR DELETE 
USING (EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.company_id = client_custom_types.company_id 
    AND company_users.user_id = auth.uid()
));

-- Trigger for updated_at
CREATE TRIGGER update_client_custom_types_updated_at
BEFORE UPDATE ON public.client_custom_types
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
