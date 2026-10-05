ALTER TABLE public.workflow_cards ADD COLUMN attachments TEXT[] DEFAULT '{}';
ALTER TABLE public.workflow_cards ADD COLUMN links TEXT[] DEFAULT '{}';
ALTER TABLE public.workflow_cards ADD COLUMN comments JSONB DEFAULT '[]';