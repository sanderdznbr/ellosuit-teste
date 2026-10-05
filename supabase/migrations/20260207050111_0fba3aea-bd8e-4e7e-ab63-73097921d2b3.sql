-- ===== WHATSAPP CRM COMPLETE SCHEMA =====

-- Drop existing tables if they need restructuring (careful in production!)
-- We'll add columns if they don't exist instead

-- Ensure whatsapp_sessions has all required columns
ALTER TABLE IF EXISTS public.whatsapp_sessions 
ADD COLUMN IF NOT EXISTS baileys_server_url text,
ADD COLUMN IF NOT EXISTS webhook_secret text DEFAULT gen_random_uuid()::text,
ADD COLUMN IF NOT EXISTS session_data jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS last_seen_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS profile_picture text,
ADD COLUMN IF NOT EXISTS push_name text;

-- Create whatsapp_contacts table
CREATE TABLE IF NOT EXISTS public.whatsapp_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  session_id uuid REFERENCES public.whatsapp_sessions(id) ON DELETE CASCADE,
  wa_id text NOT NULL,
  phone_number text NOT NULL,
  push_name text,
  profile_picture text,
  is_business boolean DEFAULT false,
  business_name text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(company_id, wa_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_wa_id ON public.whatsapp_contacts(wa_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_company ON public.whatsapp_contacts(company_id);

-- Ensure whatsapp_conversations has all required columns
ALTER TABLE IF EXISTS public.whatsapp_conversations 
ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES public.whatsapp_contacts(id),
ADD COLUMN IF NOT EXISTS pipeline_stage text DEFAULT 'novo',
ADD COLUMN IF NOT EXISTS labels text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS assigned_user_id uuid,
ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS is_pinned boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS notes text;

-- Ensure whatsapp_messages has all required columns  
ALTER TABLE IF EXISTS public.whatsapp_messages
ADD COLUMN IF NOT EXISTS wa_message_id text,
ADD COLUMN IF NOT EXISTS media_url text,
ADD COLUMN IF NOT EXISTS media_type text,
ADD COLUMN IF NOT EXISTS media_caption text,
ADD COLUMN IF NOT EXISTS quoted_message_id text,
ADD COLUMN IF NOT EXISTS is_forwarded boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS reaction text,
ADD COLUMN IF NOT EXISTS read_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS delivered_at timestamp with time zone;

-- Create index for message lookups
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_wa_id ON public.whatsapp_messages(wa_message_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_conversation ON public.whatsapp_messages(conversation_id);

-- Create webhook events log table for debugging
CREATE TABLE IF NOT EXISTS public.whatsapp_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.whatsapp_sessions(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  processed boolean DEFAULT false,
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_session ON public.whatsapp_webhook_events(session_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_type ON public.whatsapp_webhook_events(event_type);

-- Enable RLS on new tables
ALTER TABLE public.whatsapp_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_webhook_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for whatsapp_contacts
CREATE POLICY "Users can view company contacts" ON public.whatsapp_contacts
  FOR SELECT USING (company_id IN (
    SELECT company_id FROM company_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can create contacts in their company" ON public.whatsapp_contacts
  FOR INSERT WITH CHECK (company_id IN (
    SELECT company_id FROM company_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can update company contacts" ON public.whatsapp_contacts
  FOR UPDATE USING (company_id IN (
    SELECT company_id FROM company_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can delete company contacts" ON public.whatsapp_contacts
  FOR DELETE USING (company_id IN (
    SELECT company_id FROM company_users WHERE user_id = auth.uid()
  ));

-- RLS Policies for whatsapp_webhook_events  
CREATE POLICY "Users can view company webhook events" ON public.whatsapp_webhook_events
  FOR SELECT USING (session_id IN (
    SELECT id FROM whatsapp_sessions WHERE company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  ));

-- Allow anonymous inserts for webhooks (validated by secret)
CREATE POLICY "Allow webhook event creation" ON public.whatsapp_webhook_events
  FOR INSERT WITH CHECK (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION update_whatsapp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS whatsapp_contacts_updated_at ON public.whatsapp_contacts;
CREATE TRIGGER whatsapp_contacts_updated_at
  BEFORE UPDATE ON public.whatsapp_contacts
  FOR EACH ROW EXECUTE FUNCTION update_whatsapp_updated_at();