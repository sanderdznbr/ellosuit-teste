-- Table to track RSVP status for meeting attendees
CREATE TABLE public.meeting_rsvp (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  attendee_phone TEXT,
  attendee_email TEXT,
  attendee_name TEXT,
  resolved_jid TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, confirmed, declined, reminded
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  reminder_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.meeting_rsvp ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view RSVP for their company events"
  ON public.meeting_rsvp FOR SELECT
  USING (public.user_belongs_to_company(company_id, auth.uid()));

CREATE POLICY "Users can insert RSVP for their company"
  ON public.meeting_rsvp FOR INSERT
  WITH CHECK (public.user_belongs_to_company(company_id, auth.uid()));

CREATE POLICY "Users can update RSVP for their company"
  ON public.meeting_rsvp FOR UPDATE
  USING (public.user_belongs_to_company(company_id, auth.uid()));

CREATE POLICY "Users can delete RSVP for their company"
  ON public.meeting_rsvp FOR DELETE
  USING (public.user_belongs_to_company(company_id, auth.uid()));

-- Index for webhook lookups by phone/jid
CREATE INDEX idx_meeting_rsvp_phone ON public.meeting_rsvp(attendee_phone);
CREATE INDEX idx_meeting_rsvp_jid ON public.meeting_rsvp(resolved_jid);
CREATE INDEX idx_meeting_rsvp_event ON public.meeting_rsvp(event_id);
CREATE INDEX idx_meeting_rsvp_status ON public.meeting_rsvp(status);

-- Trigger for updated_at
CREATE TRIGGER update_meeting_rsvp_updated_at
  BEFORE UPDATE ON public.meeting_rsvp
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();