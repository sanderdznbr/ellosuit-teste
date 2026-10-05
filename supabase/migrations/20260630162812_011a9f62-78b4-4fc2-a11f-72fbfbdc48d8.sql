
CREATE TABLE public.conversation_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor_type TEXT NOT NULL DEFAULT 'system',
  actor_id UUID,
  actor_name TEXT,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX idx_conversation_events_conv ON public.conversation_events(conversation_id, created_at DESC);
CREATE INDEX idx_conversation_events_company ON public.conversation_events(company_id);

GRANT SELECT, INSERT ON public.conversation_events TO authenticated;
GRANT ALL ON public.conversation_events TO service_role;

ALTER TABLE public.conversation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members read events"
  ON public.conversation_events FOR SELECT
  TO authenticated
  USING (public.user_belongs_to_company(company_id, auth.uid()));

CREATE POLICY "Company members insert events"
  ON public.conversation_events FOR INSERT
  TO authenticated
  WITH CHECK (public.user_belongs_to_company(company_id, auth.uid()));
