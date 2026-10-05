GRANT DELETE ON public.dispatch_campaigns TO authenticated;
GRANT DELETE ON public.dispatch_jobs TO authenticated;

CREATE POLICY "Users can delete their company's campaigns"
ON public.dispatch_campaigns FOR DELETE TO authenticated
USING (company_id IN (SELECT company_users.company_id FROM public.company_users WHERE company_users.user_id = auth.uid()));

CREATE POLICY "Users can delete jobs for their company"
ON public.dispatch_jobs FOR DELETE TO authenticated
USING (company_id IN (SELECT company_users.company_id FROM public.company_users WHERE company_users.user_id = auth.uid()));