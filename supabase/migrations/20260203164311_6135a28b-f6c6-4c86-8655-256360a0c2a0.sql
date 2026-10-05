-- Create conversation_labels table for managing labels/tags
CREATE TABLE public.conversation_labels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL
);

-- Add labels column to whatsapp_conversations (if exists)
DO $$ 
BEGIN 
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'whatsapp_conversations') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'whatsapp_conversations' AND column_name = 'labels') THEN
      ALTER TABLE public.whatsapp_conversations ADD COLUMN labels UUID[] DEFAULT '{}';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'whatsapp_conversations' AND column_name = 'pipeline_stage') THEN
      ALTER TABLE public.whatsapp_conversations ADD COLUMN pipeline_stage TEXT DEFAULT 'novo';
    END IF;
  END IF;
END $$;

-- Enable RLS on conversation_labels
ALTER TABLE public.conversation_labels ENABLE ROW LEVEL SECURITY;

-- RLS policies for conversation_labels
CREATE POLICY "Users can view company labels"
ON public.conversation_labels
FOR SELECT
USING (company_id IN (
  SELECT company_id FROM company_users WHERE user_id = auth.uid()
));

CREATE POLICY "Users can create labels in their company"
ON public.conversation_labels
FOR INSERT
WITH CHECK (
  company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid())
  AND created_by = auth.uid()
);

CREATE POLICY "Users can update company labels"
ON public.conversation_labels
FOR UPDATE
USING (company_id IN (
  SELECT company_id FROM company_users WHERE user_id = auth.uid()
));

CREATE POLICY "Users can delete company labels"
ON public.conversation_labels
FOR DELETE
USING (company_id IN (
  SELECT company_id FROM company_users WHERE user_id = auth.uid()
));