
-- Table to persist user's preferred email alias
CREATE TABLE public.user_email_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID NOT NULL,
  default_from_email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, company_id)
);

ALTER TABLE public.user_email_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preferences"
  ON public.user_email_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
  ON public.user_email_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON public.user_email_preferences FOR UPDATE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_user_email_preferences_updated_at
  BEFORE UPDATE ON public.user_email_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
