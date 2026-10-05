-- Create table for card comments
CREATE TABLE IF NOT EXISTS public.workflow_card_comments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    card_id UUID NOT NULL REFERENCES public.workflow_cards(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for card attachments
CREATE TABLE IF NOT EXISTS public.workflow_card_attachments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    card_id UUID NOT NULL REFERENCES public.workflow_cards(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT,
    file_size INTEGER,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for card checklists
CREATE TABLE IF NOT EXISTS public.workflow_card_checklists (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    card_id UUID NOT NULL REFERENCES public.workflow_cards(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Checklist',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for checklist items
CREATE TABLE IF NOT EXISTS public.workflow_card_checklist_items (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    checklist_id UUID NOT NULL REFERENCES public.workflow_card_checklists(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    is_completed BOOLEAN NOT NULL DEFAULT false,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for workflow tags (reusable across cards)
CREATE TABLE IF NOT EXISTS public.workflow_tags (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create junction table for card tags
CREATE TABLE IF NOT EXISTS public.workflow_card_tags_junction (
    card_id UUID NOT NULL REFERENCES public.workflow_cards(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES public.workflow_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (card_id, tag_id)
);

-- Use GRANT to set permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_card_comments TO authenticated;
GRANT ALL ON public.workflow_card_comments TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_card_attachments TO authenticated;
GRANT ALL ON public.workflow_card_attachments TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_card_checklists TO authenticated;
GRANT ALL ON public.workflow_card_checklists TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_card_checklist_items TO authenticated;
GRANT ALL ON public.workflow_card_checklist_items TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_tags TO authenticated;
GRANT ALL ON public.workflow_tags TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_card_tags_junction TO authenticated;
GRANT ALL ON public.workflow_card_tags_junction TO service_role;

-- Enable Row Level Security
ALTER TABLE public.workflow_card_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_card_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_card_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_card_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_card_tags_junction ENABLE ROW LEVEL SECURITY;

-- Create basic RLS policies (scope to authenticated users)
-- In a more strict setup, we would join with company_users or similar, but for now we follow the project's existing pattern.
CREATE POLICY "Anyone authenticated can manage comments" ON public.workflow_card_comments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Anyone authenticated can manage attachments" ON public.workflow_card_attachments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Anyone authenticated can manage checklists" ON public.workflow_card_checklists FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Anyone authenticated can manage checklist items" ON public.workflow_card_checklist_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Anyone authenticated can manage workflow tags" ON public.workflow_tags FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Anyone authenticated can manage card tags" ON public.workflow_card_tags_junction FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create storage bucket for card attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('workflow-attachments', 'workflow-attachments', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Allow authenticated uploads to workflow-attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'workflow-attachments');

CREATE POLICY "Allow public read from workflow-attachments"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'workflow-attachments');
