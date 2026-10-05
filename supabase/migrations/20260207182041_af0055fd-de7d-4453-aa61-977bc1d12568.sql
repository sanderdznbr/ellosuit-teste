-- Allow public read access to active funnels
CREATE POLICY "Public can view active funnels" 
ON public.lead_funnels 
FOR SELECT 
USING (is_active = true);

-- Allow public read access to funnel steps of active funnels
CREATE POLICY "Public can view steps of active funnels" 
ON public.lead_funnel_steps 
FOR SELECT 
USING (
  funnel_id IN (
    SELECT id FROM public.lead_funnels WHERE is_active = true
  )
);