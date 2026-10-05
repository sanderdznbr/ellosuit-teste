
-- Drop existing adminmaster-only policies
DROP POLICY IF EXISTS "adminmaster_ycloud_sessions" ON public.ycloud_sessions;
DROP POLICY IF EXISTS "adminmaster_ycloud_conversations" ON public.ycloud_conversations;
DROP POLICY IF EXISTS "adminmaster_ycloud_messages" ON public.ycloud_messages;

-- Sessions: users see only their own sessions (created_by) OR adminmaster sees all
CREATE POLICY "users_own_ycloud_sessions" ON public.ycloud_sessions
  FOR ALL TO authenticated
  USING (
    created_by = auth.uid() 
    OR public.is_adminmaster(auth.uid())
  )
  WITH CHECK (
    created_by = auth.uid() 
    OR public.is_adminmaster(auth.uid())
  );

-- Conversations: users see only conversations from their own sessions
CREATE POLICY "users_own_ycloud_conversations" ON public.ycloud_conversations
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ycloud_sessions s 
      WHERE s.id = ycloud_conversations.session_id 
      AND (s.created_by = auth.uid() OR public.is_adminmaster(auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ycloud_sessions s 
      WHERE s.id = ycloud_conversations.session_id 
      AND (s.created_by = auth.uid() OR public.is_adminmaster(auth.uid()))
    )
  );

-- Messages: users see only messages from their own conversations/sessions
CREATE POLICY "users_own_ycloud_messages" ON public.ycloud_messages
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ycloud_conversations c
      JOIN public.ycloud_sessions s ON s.id = c.session_id
      WHERE c.id = ycloud_messages.conversation_id
      AND (s.created_by = auth.uid() OR public.is_adminmaster(auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ycloud_conversations c
      JOIN public.ycloud_sessions s ON s.id = c.session_id
      WHERE c.id = ycloud_messages.conversation_id
      AND (s.created_by = auth.uid() OR public.is_adminmaster(auth.uid()))
    )
  );
