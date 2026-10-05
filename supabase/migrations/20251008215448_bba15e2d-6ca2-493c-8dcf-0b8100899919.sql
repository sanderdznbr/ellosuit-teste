-- Create table for meeting audio settings
CREATE TABLE IF NOT EXISTS public.meeting_audio_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  audio_type TEXT NOT NULL CHECK (audio_type IN ('user_joined', 'user_left', 'user_waiting')),
  audio_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, audio_type)
);

-- Enable RLS
ALTER TABLE public.meeting_audio_settings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their company audio settings"
  ON public.meeting_audio_settings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.company_users
      WHERE company_users.company_id = meeting_audio_settings.company_id
        AND company_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert audio settings"
  ON public.meeting_audio_settings
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_users
      WHERE company_users.company_id = meeting_audio_settings.company_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins can update audio settings"
  ON public.meeting_audio_settings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.company_users
      WHERE company_users.company_id = meeting_audio_settings.company_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins can delete audio settings"
  ON public.meeting_audio_settings
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.company_users
      WHERE company_users.company_id = meeting_audio_settings.company_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('admin', 'manager')
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_meeting_audio_settings_updated_at
  BEFORE UPDATE ON public.meeting_audio_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Create storage bucket for meeting audios if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('meeting-audios', 'meeting-audios', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for meeting-audios bucket
CREATE POLICY "Anyone can view meeting audios"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'meeting-audios');

CREATE POLICY "Authenticated users can upload meeting audios"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'meeting-audios' 
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Users can update their company meeting audios"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'meeting-audios' 
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Users can delete their company meeting audios"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'meeting-audios' 
    AND auth.role() = 'authenticated'
  );