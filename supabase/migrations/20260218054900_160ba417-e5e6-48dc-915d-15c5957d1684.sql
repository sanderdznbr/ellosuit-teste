
-- Table to store phone verification codes
CREATE TABLE public.phone_verifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_phone_verifications_phone ON public.phone_verifications (phone, verified);

-- Auto-cleanup old codes
CREATE OR REPLACE FUNCTION public.cleanup_old_verifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.phone_verifications
  WHERE expires_at < now() - interval '1 hour';
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_cleanup_verifications
AFTER INSERT ON public.phone_verifications
FOR EACH STATEMENT
EXECUTE FUNCTION public.cleanup_old_verifications();

-- RLS: allow anonymous insert/select for verification flow
ALTER TABLE public.phone_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous insert for verification"
ON public.phone_verifications FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow anonymous select for verification"
ON public.phone_verifications FOR SELECT
USING (true);

CREATE POLICY "Allow anonymous update for verification"
ON public.phone_verifications FOR UPDATE
USING (true);
