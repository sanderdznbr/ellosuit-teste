-- Create email_send_limits table for daily limit tracking
CREATE TABLE public.email_send_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  company_id UUID NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  sent_count INTEGER NOT NULL DEFAULT 0,
  daily_limit INTEGER NOT NULL DEFAULT 500,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Enable RLS
ALTER TABLE public.email_send_limits ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own limits
CREATE POLICY "Users can view their own email limits"
ON public.email_send_limits
FOR SELECT
USING (user_id = auth.uid());

-- Policy: Users can insert their own limits
CREATE POLICY "Users can insert their own email limits"
ON public.email_send_limits
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Policy: Users can update their own limits
CREATE POLICY "Users can update their own email limits"
ON public.email_send_limits
FOR UPDATE
USING (user_id = auth.uid());

-- Create function to increment email count
CREATE OR REPLACE FUNCTION public.increment_email_count(p_user_id UUID, p_company_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.email_send_limits (user_id, company_id, date, sent_count)
  VALUES (p_user_id, p_company_id, CURRENT_DATE, 1)
  ON CONFLICT (user_id, date)
  DO UPDATE SET sent_count = email_send_limits.sent_count + 1;
END;
$$;

-- Create index for faster queries
CREATE INDEX idx_email_send_limits_user_date ON public.email_send_limits(user_id, date);