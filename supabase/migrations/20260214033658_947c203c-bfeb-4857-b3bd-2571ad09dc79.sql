
ALTER TABLE public.company_services
ADD COLUMN IF NOT EXISTS cost_price numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS cost_items jsonb DEFAULT '[]',
ADD COLUMN IF NOT EXISTS show_cost_to_client boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS included_items text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS duration_estimate text,
ADD COLUMN IF NOT EXISTS warranty_info text,
ADD COLUMN IF NOT EXISTS service_type text DEFAULT 'service';
