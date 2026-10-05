
-- Contact groups for bulk messaging
CREATE TABLE public.contact_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.contact_group_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.contact_groups(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Unique constraint to avoid duplicate phones in same group
CREATE UNIQUE INDEX idx_group_member_unique ON public.contact_group_members(group_id, phone);

ALTER TABLE public.contact_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage groups in their company"
  ON public.contact_groups FOR ALL
  USING (company_id IN (SELECT company_id FROM public.company_users WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage group members via group"
  ON public.contact_group_members FOR ALL
  USING (group_id IN (
    SELECT id FROM public.contact_groups 
    WHERE company_id IN (SELECT company_id FROM public.company_users WHERE user_id = auth.uid())
  ));
