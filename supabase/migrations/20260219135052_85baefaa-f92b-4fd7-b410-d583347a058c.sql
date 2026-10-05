
-- Add design_data column to email_templates for block-based editing
ALTER TABLE public.email_templates 
ADD COLUMN IF NOT EXISTS design_data jsonb DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.email_templates.design_data IS 'Block-based design data for the visual email builder. When present, the template can be edited in the block editor.';
