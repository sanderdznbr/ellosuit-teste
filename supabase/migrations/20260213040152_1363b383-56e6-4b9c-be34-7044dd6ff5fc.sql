
-- Table for team invitations
CREATE TABLE public.team_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'employee',
  permissions TEXT[] NOT NULL DEFAULT '{}',
  token TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex') UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  accepted_at TIMESTAMPTZ,
  accepted_by UUID,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for lookups
CREATE INDEX idx_team_invitations_token ON public.team_invitations(token);
CREATE INDEX idx_team_invitations_company ON public.team_invitations(company_id);
CREATE INDEX idx_team_invitations_email ON public.team_invitations(email);

-- Enable RLS
ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Company admins can manage invitations"
ON public.team_invitations
FOR ALL
USING (public.is_company_admin(auth.uid(), company_id));

CREATE POLICY "Anyone can read their own invitation by token"
ON public.team_invitations
FOR SELECT
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_team_invitations_updated_at
BEFORE UPDATE ON public.team_invitations
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();
