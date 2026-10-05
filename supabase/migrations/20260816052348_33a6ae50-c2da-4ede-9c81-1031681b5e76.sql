-- Corrigindo GRANTs que podem estar faltando
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dispatch_campaigns TO authenticated;
GRANT ALL ON public.dispatch_campaigns TO service_role;

-- Recriando políticas para garantir que o owner seja o service_role do sistema
DROP POLICY IF EXISTS "Users can insert their own campaigns" ON public.dispatch_campaigns;
CREATE POLICY "Users can insert their own campaigns" ON public.dispatch_campaigns FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their company's campaigns" ON public.dispatch_campaigns;
CREATE POLICY "Users can update their company's campaigns" ON public.dispatch_campaigns FOR UPDATE TO authenticated USING (company_id IN (SELECT company_id FROM public.company_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their company's campaigns" ON public.dispatch_campaigns;
CREATE POLICY "Users can view their company's campaigns" ON public.dispatch_campaigns FOR SELECT TO authenticated USING (company_id IN (SELECT company_id FROM public.company_users WHERE user_id = auth.uid()));