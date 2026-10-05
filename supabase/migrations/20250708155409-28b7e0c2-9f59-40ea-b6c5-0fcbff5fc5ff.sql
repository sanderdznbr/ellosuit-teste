-- Create email_templates table for HTML email marketing templates
CREATE TABLE public.email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  html_content TEXT NOT NULL,
  preview_text TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- Create policies for email templates
CREATE POLICY "Users can view their company email templates" 
ON public.email_templates 
FOR SELECT 
USING (company_id IN (
  SELECT company_users.company_id
  FROM company_users
  WHERE company_users.user_id = auth.uid()
));

CREATE POLICY "Users can create email templates in their company" 
ON public.email_templates 
FOR INSERT 
WITH CHECK (
  company_id IN (
    SELECT company_users.company_id
    FROM company_users
    WHERE company_users.user_id = auth.uid()
  ) 
  AND user_id = auth.uid()
);

CREATE POLICY "Users can update their own email templates" 
ON public.email_templates 
FOR UPDATE 
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own email templates" 
ON public.email_templates 
FOR DELETE 
USING (user_id = auth.uid());

-- Add expires_at column to public_booking_links to support non-expiring links
ALTER TABLE public.public_booking_links 
ADD COLUMN expires_at TIMESTAMP WITH TIME ZONE;

-- Add trigger for updated_at on email_templates
CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Update RLS policy for public_booking_links to allow public access for booking page
CREATE POLICY "Allow public read access to active booking links"
ON public.public_booking_links
FOR SELECT
USING (is_active = true);

-- Ensure public can read availability schedules for booking links
CREATE POLICY "Allow public read access to active availability schedules"
ON public.availability_schedules
FOR SELECT
USING (is_active = true);