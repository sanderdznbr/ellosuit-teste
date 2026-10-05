
-- Table to track reschedule requests when a participant declines
CREATE TABLE public.meeting_reschedule_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  rsvp_id UUID NOT NULL REFERENCES public.meeting_rsvp(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  attendee_phone TEXT NOT NULL,
  attendee_name TEXT,
  request_type TEXT NOT NULL DEFAULT 'pending', -- 'reschedule' or 'cancel'
  suggested_date TIMESTAMPTZ,
  suggested_text TEXT, -- raw text from the participant
  ai_interpreted_date TIMESTAMPTZ, -- AI-parsed date
  ai_interpretation TEXT, -- AI explanation
  status TEXT NOT NULL DEFAULT 'awaiting_response', -- 'awaiting_response', 'reschedule_proposed', 'confirmed', 'denied', 'cancelled'
  organizer_response TEXT, -- 'confirmed' or 'denied'
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.meeting_reschedule_requests ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view reschedule requests for their company"
ON public.meeting_reschedule_requests
FOR SELECT
USING (public.user_belongs_to_company(company_id, auth.uid()));

CREATE POLICY "Users can update reschedule requests for their company"
ON public.meeting_reschedule_requests
FOR UPDATE
USING (public.user_belongs_to_company(company_id, auth.uid()));

CREATE POLICY "Service role can insert reschedule requests"
ON public.meeting_reschedule_requests
FOR INSERT
WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_reschedule_requests_updated_at
BEFORE UPDATE ON public.meeting_reschedule_requests
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Index for fast lookups
CREATE INDEX idx_reschedule_requests_event ON public.meeting_reschedule_requests(event_id);
CREATE INDEX idx_reschedule_requests_status ON public.meeting_reschedule_requests(status);
CREATE INDEX idx_reschedule_requests_phone ON public.meeting_reschedule_requests(attendee_phone);
