-- Create trackable documents table (fixed)
CREATE TABLE public.trackable_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  company_id uuid NOT NULL,
  title text NOT NULL,
  original_filename text NOT NULL,
  file_url text NOT NULL,
  file_size bigint,
  mime_type text NOT NULL,
  tracking_enabled boolean NOT NULL DEFAULT true,
  public_link_id text UNIQUE NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', ''),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.trackable_documents ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can create trackable documents in their company" 
ON public.trackable_documents 
FOR INSERT 
WITH CHECK ((company_id IN ( SELECT company_users.company_id
   FROM company_users
  WHERE (company_users.user_id = auth.uid()))) AND (user_id = auth.uid()));

CREATE POLICY "Users can view their company trackable documents" 
ON public.trackable_documents 
FOR SELECT 
USING (company_id IN ( SELECT company_users.company_id
   FROM company_users
  WHERE (company_users.user_id = auth.uid())));

CREATE POLICY "Users can update their trackable documents" 
ON public.trackable_documents 
FOR UPDATE 
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their trackable documents" 
ON public.trackable_documents 
FOR DELETE 
USING (user_id = auth.uid());

-- Create document tracking events table
CREATE TABLE public.document_tracking_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES public.trackable_documents(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  event_type text NOT NULL, -- 'page_view', 'scroll', 'click', 'zoom', 'time_spent'
  page_number integer,
  timestamp timestamp with time zone NOT NULL DEFAULT now(),
  data jsonb DEFAULT '{}',
  user_agent text,
  ip_address inet,
  visitor_id text -- For anonymous tracking
);

-- Enable RLS
ALTER TABLE public.document_tracking_events ENABLE ROW LEVEL SECURITY;

-- Allow public read access for tracking events (needed for public document viewing)
CREATE POLICY "Allow tracking events creation" 
ON public.document_tracking_events 
FOR INSERT 
WITH CHECK (true);

-- Users can view tracking events for their documents
CREATE POLICY "Users can view tracking events for their documents" 
ON public.document_tracking_events 
FOR SELECT 
USING (document_id IN (
  SELECT td.id FROM public.trackable_documents td
  JOIN company_users cu ON td.company_id = cu.company_id
  WHERE cu.user_id = auth.uid()
));

-- Create indexes for better performance
CREATE INDEX idx_trackable_documents_user_id ON public.trackable_documents(user_id);
CREATE INDEX idx_trackable_documents_company_id ON public.trackable_documents(company_id);
CREATE INDEX idx_trackable_documents_public_link ON public.trackable_documents(public_link_id);
CREATE INDEX idx_document_tracking_events_document_id ON public.document_tracking_events(document_id);
CREATE INDEX idx_document_tracking_events_session_id ON public.document_tracking_events(session_id);
CREATE INDEX idx_document_tracking_events_timestamp ON public.document_tracking_events(timestamp);

-- Create storage bucket for trackable documents
INSERT INTO storage.buckets (id, name, public) VALUES ('trackable-documents', 'trackable-documents', true);

-- Create storage policies
CREATE POLICY "Users can upload trackable documents" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'trackable-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Trackable documents are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'trackable-documents');

CREATE POLICY "Users can update their trackable documents" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'trackable-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their trackable documents" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'trackable-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Add trigger for updated_at
CREATE TRIGGER update_trackable_documents_updated_at
BEFORE UPDATE ON public.trackable_documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();