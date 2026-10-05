
-- Create table for storing email design templates
CREATE TABLE public.email_designs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  design_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  thumbnail_url TEXT,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_designs ENABLE ROW LEVEL SECURITY;

-- Create policies for email designs
CREATE POLICY "Users can view their company email designs" 
ON public.email_designs 
FOR SELECT 
USING (company_id IN (
  SELECT company_users.company_id
  FROM company_users
  WHERE company_users.user_id = auth.uid()
));

CREATE POLICY "Users can create email designs in their company" 
ON public.email_designs 
FOR INSERT 
WITH CHECK (
  company_id IN (
    SELECT company_users.company_id
    FROM company_users
    WHERE company_users.user_id = auth.uid()
  ) 
  AND user_id = auth.uid()
);

CREATE POLICY "Users can update their own email designs" 
ON public.email_designs 
FOR UPDATE 
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own email designs" 
ON public.email_designs 
FOR DELETE 
USING (user_id = auth.uid());

-- Add trigger for updated_at on email_designs
CREATE TRIGGER update_email_designs_updated_at
  BEFORE UPDATE ON public.email_designs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
