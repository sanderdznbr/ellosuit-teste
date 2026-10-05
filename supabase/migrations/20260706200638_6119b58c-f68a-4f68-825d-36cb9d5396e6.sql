
-- ============ CONFIGS ============
CREATE TABLE public.crm_autopilot_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT false,
  objective TEXT DEFAULT '',
  personality TEXT DEFAULT '',
  tone_preset TEXT DEFAULT 'cordial',
  max_chars INTEGER NOT NULL DEFAULT 500,
  allow_audio BOOLEAN NOT NULL DEFAULT false,
  send_hour_start SMALLINT NOT NULL DEFAULT 8,
  send_hour_end SMALLINT NOT NULL DEFAULT 20,
  max_msgs_per_hour_per_contact INTEGER NOT NULL DEFAULT 4,
  voice_id TEXT,
  voice_status TEXT DEFAULT 'none',
  voice_preview_url TEXT,
  parent_phone TEXT,
  parent_session_id UUID REFERENCES public.whatsapp_sessions(id) ON DELETE SET NULL,
  confidence_threshold NUMERIC(3,2) NOT NULL DEFAULT 0.70,
  parent_timeout_minutes INTEGER NOT NULL DEFAULT 30,
  parent_fallback_behavior TEXT NOT NULL DEFAULT 'wait',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  activated_at TIMESTAMPTZ,
  activated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_autopilot_configs TO authenticated;
GRANT ALL ON public.crm_autopilot_configs TO service_role;
ALTER TABLE public.crm_autopilot_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "autopilot_configs_select" ON public.crm_autopilot_configs
  FOR SELECT TO authenticated USING (public.user_belongs_to_company(company_id, auth.uid()));
CREATE POLICY "autopilot_configs_insert" ON public.crm_autopilot_configs
  FOR INSERT TO authenticated WITH CHECK (public.user_belongs_to_company(company_id, auth.uid()));
CREATE POLICY "autopilot_configs_update" ON public.crm_autopilot_configs
  FOR UPDATE TO authenticated USING (public.user_belongs_to_company(company_id, auth.uid()));
CREATE POLICY "autopilot_configs_delete" ON public.crm_autopilot_configs
  FOR DELETE TO authenticated USING (public.is_company_admin_or_manager(company_id, auth.uid()));

CREATE TRIGGER trg_autopilot_configs_updated_at BEFORE UPDATE ON public.crm_autopilot_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ VOICE SAMPLES ============
CREATE TABLE public.crm_autopilot_voice_samples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  message_id UUID,
  storage_path TEXT NOT NULL,
  duration_seconds NUMERIC,
  used_for_cloning BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_autopilot_voice_samples TO authenticated;
GRANT ALL ON public.crm_autopilot_voice_samples TO service_role;
ALTER TABLE public.crm_autopilot_voice_samples ENABLE ROW LEVEL SECURITY;
CREATE POLICY "autopilot_voice_select" ON public.crm_autopilot_voice_samples
  FOR SELECT TO authenticated USING (public.user_belongs_to_company(company_id, auth.uid()));
CREATE POLICY "autopilot_voice_insert" ON public.crm_autopilot_voice_samples
  FOR INSERT TO authenticated WITH CHECK (public.user_belongs_to_company(company_id, auth.uid()));
CREATE POLICY "autopilot_voice_delete" ON public.crm_autopilot_voice_samples
  FOR DELETE TO authenticated USING (public.is_company_admin_or_manager(company_id, auth.uid()));
CREATE INDEX idx_autopilot_voice_company ON public.crm_autopilot_voice_samples(company_id, created_at DESC);

-- ============ STYLE CORPUS ============
CREATE TABLE public.crm_autopilot_style_corpus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'message',
  content TEXT NOT NULL,
  message_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_autopilot_style_corpus TO authenticated;
GRANT ALL ON public.crm_autopilot_style_corpus TO service_role;
ALTER TABLE public.crm_autopilot_style_corpus ENABLE ROW LEVEL SECURITY;
CREATE POLICY "autopilot_style_select" ON public.crm_autopilot_style_corpus
  FOR SELECT TO authenticated USING (public.user_belongs_to_company(company_id, auth.uid()));
CREATE POLICY "autopilot_style_insert" ON public.crm_autopilot_style_corpus
  FOR INSERT TO authenticated WITH CHECK (public.user_belongs_to_company(company_id, auth.uid()));
CREATE INDEX idx_autopilot_style_company ON public.crm_autopilot_style_corpus(company_id, created_at DESC);

-- ============ EVENTS LOG ============
CREATE TABLE public.crm_autopilot_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  conversation_id UUID,
  event_type TEXT NOT NULL,
  description TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.crm_autopilot_events TO authenticated;
GRANT ALL ON public.crm_autopilot_events TO service_role;
ALTER TABLE public.crm_autopilot_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "autopilot_events_select" ON public.crm_autopilot_events
  FOR SELECT TO authenticated USING (public.user_belongs_to_company(company_id, auth.uid()));
CREATE POLICY "autopilot_events_insert" ON public.crm_autopilot_events
  FOR INSERT TO authenticated WITH CHECK (public.user_belongs_to_company(company_id, auth.uid()));
CREATE INDEX idx_autopilot_events_company ON public.crm_autopilot_events(company_id, created_at DESC);

-- ============ PENDING ESCALATIONS ============
CREATE TABLE public.crm_autopilot_pending_escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL,
  session_id UUID,
  customer_phone TEXT,
  question_sent TEXT NOT NULL,
  original_customer_message TEXT,
  parent_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'waiting',
  parent_answer TEXT,
  final_answer_sent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  answered_at TIMESTAMPTZ,
  timeout_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE ON public.crm_autopilot_pending_escalations TO authenticated;
GRANT ALL ON public.crm_autopilot_pending_escalations TO service_role;
ALTER TABLE public.crm_autopilot_pending_escalations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "autopilot_escal_select" ON public.crm_autopilot_pending_escalations
  FOR SELECT TO authenticated USING (public.user_belongs_to_company(company_id, auth.uid()));
CREATE POLICY "autopilot_escal_insert" ON public.crm_autopilot_pending_escalations
  FOR INSERT TO authenticated WITH CHECK (public.user_belongs_to_company(company_id, auth.uid()));
CREATE POLICY "autopilot_escal_update" ON public.crm_autopilot_pending_escalations
  FOR UPDATE TO authenticated USING (public.user_belongs_to_company(company_id, auth.uid()));
CREATE INDEX idx_autopilot_escal_status ON public.crm_autopilot_pending_escalations(company_id, status, created_at DESC);

-- ============ REALTIME for live log ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_autopilot_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_autopilot_configs;
