-- Create user dashboard KPIs configuration table
CREATE TABLE IF NOT EXISTS public.user_dashboard_kpis (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    dashboard_key TEXT NOT NULL, -- e.g., 'unified_database'
    kpi_key TEXT NOT NULL,       -- e.g., 'total', 'cliente', 'fornecedor', etc.
    is_visible BOOLEAN DEFAULT true,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, dashboard_key, kpi_key)
);

-- Enable RLS
ALTER TABLE public.user_dashboard_kpis ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own KPI settings" 
ON public.user_dashboard_kpis 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own KPI settings" 
ON public.user_dashboard_kpis 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own KPI settings" 
ON public.user_dashboard_kpis 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own KPI settings" 
ON public.user_dashboard_kpis 
FOR DELETE 
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_user_dashboard_kpis_updated_at
BEFORE UPDATE ON public.user_dashboard_kpis
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
