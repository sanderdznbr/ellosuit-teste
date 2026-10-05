
CREATE TABLE IF NOT EXISTS public.crm_followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.whatsapp_sessions(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested','approved','sent','canceled','failed')),
  kind TEXT NOT NULL DEFAULT 'retomada' CHECK (kind IN ('retomada','cobranca','satisfacao','lembrete','reengajamento','outro')),
  reason TEXT,
  message TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  canceled_reason TEXT,
  auto_cancel_if_replied BOOLEAN NOT NULL DEFAULT true,
  respect_business_hours BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_model TEXT,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_followups TO authenticated;
GRANT ALL ON public.crm_followups TO service_role;

ALTER TABLE public.crm_followups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can view followups in their company"
  ON public.crm_followups FOR SELECT TO authenticated
  USING (public.user_belongs_to_company(company_id, auth.uid()));

CREATE POLICY "members can create followups in their company"
  ON public.crm_followups FOR INSERT TO authenticated
  WITH CHECK (public.user_belongs_to_company(company_id, auth.uid()));

CREATE POLICY "members can update followups in their company"
  ON public.crm_followups FOR UPDATE TO authenticated
  USING (public.user_belongs_to_company(company_id, auth.uid()))
  WITH CHECK (public.user_belongs_to_company(company_id, auth.uid()));

CREATE POLICY "members can delete followups in their company"
  ON public.crm_followups FOR DELETE TO authenticated
  USING (public.user_belongs_to_company(company_id, auth.uid()));

CREATE INDEX IF NOT EXISTS idx_crm_followups_dispatch
  ON public.crm_followups (status, scheduled_for)
  WHERE status = 'approved';

CREATE INDEX IF NOT EXISTS idx_crm_followups_conversation
  ON public.crm_followups (conversation_id, status, created_at DESC);

CREATE TRIGGER trg_crm_followups_updated_at
  BEFORE UPDATE ON public.crm_followups
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_followups;
