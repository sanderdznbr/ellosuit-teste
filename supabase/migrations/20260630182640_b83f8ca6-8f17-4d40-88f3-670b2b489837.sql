
-- Restrict WhatsApp conversations: non-admin members only see conversations assigned to them
DROP POLICY IF EXISTS "Users can manage company WhatsApp conversations" ON public.whatsapp_conversations;
DROP POLICY IF EXISTS "Users can view company WhatsApp conversations" ON public.whatsapp_conversations;

-- Admins / managers: full access on company conversations
CREATE POLICY "Admins manage company conversations"
ON public.whatsapp_conversations
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = whatsapp_conversations.company_id
      AND cu.user_id = auth.uid()
      AND cu.role IN ('admin','adminmaster','manager')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = whatsapp_conversations.company_id
      AND cu.user_id = auth.uid()
      AND cu.role IN ('admin','adminmaster','manager')
  )
);

-- Regular members: view only conversations explicitly assigned to them
CREATE POLICY "Members view assigned conversations"
ON public.whatsapp_conversations
FOR SELECT
TO authenticated
USING (
  assigned_user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = whatsapp_conversations.company_id
      AND cu.user_id = auth.uid()
  )
);

-- Regular members: update only conversations assigned to them
CREATE POLICY "Members update assigned conversations"
ON public.whatsapp_conversations
FOR UPDATE
TO authenticated
USING (
  assigned_user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = whatsapp_conversations.company_id
      AND cu.user_id = auth.uid()
  )
)
WITH CHECK (
  assigned_user_id = auth.uid()
);
