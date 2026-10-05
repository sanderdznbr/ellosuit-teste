
-- Add company_id to emails table for proper data isolation
ALTER TABLE public.emails ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);

-- Add user_id to emails table
ALTER TABLE public.emails ADD COLUMN IF NOT EXISTS user_id uuid;

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Allow all access to emails" ON public.emails;

-- Create proper RLS policies
CREATE POLICY "Users can view company emails"
  ON public.emails FOR SELECT
  USING (
    company_id IN (
      SELECT company_users.company_id FROM company_users
      WHERE company_users.user_id = auth.uid()
    )
    OR user_id = auth.uid()
  );

CREATE POLICY "Users can insert emails"
  ON public.emails FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_users.company_id FROM company_users
      WHERE company_users.user_id = auth.uid()
    )
    OR user_id = auth.uid()
  );

CREATE POLICY "Users can update their emails"
  ON public.emails FOR UPDATE
  USING (
    company_id IN (
      SELECT company_users.company_id FROM company_users
      WHERE company_users.user_id = auth.uid()
    )
    OR user_id = auth.uid()
  );

CREATE POLICY "Users can delete their emails"
  ON public.emails FOR DELETE
  USING (
    company_id IN (
      SELECT company_users.company_id FROM company_users
      WHERE company_users.user_id = auth.uid()
    )
    OR user_id = auth.uid()
  );

-- Also fix email_campaigns which has the same issue
DROP POLICY IF EXISTS "Allow all access to email_campaigns" ON public.email_campaigns;

ALTER TABLE public.email_campaigns ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.email_campaigns ADD COLUMN IF NOT EXISTS user_id uuid;

CREATE POLICY "Users can view company email campaigns"
  ON public.email_campaigns FOR SELECT
  USING (
    company_id IN (
      SELECT company_users.company_id FROM company_users
      WHERE company_users.user_id = auth.uid()
    )
    OR user_id = auth.uid()
    OR company_id IS NULL
  );

CREATE POLICY "Users can manage email campaigns"
  ON public.email_campaigns FOR ALL
  USING (
    company_id IN (
      SELECT company_users.company_id FROM company_users
      WHERE company_users.user_id = auth.uid()
    )
    OR user_id = auth.uid()
  );
