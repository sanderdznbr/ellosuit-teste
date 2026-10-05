-- Remove TODAS as políticas UPDATE existentes que podem estar conflitando
DROP POLICY IF EXISTS "Allow hosts and room creators to manage participants" ON public.room_participants;
DROP POLICY IF EXISTS "Participants can update their own record" ON public.room_participants;
DROP POLICY IF EXISTS "Users can update their own participant data" ON public.room_participants;
DROP POLICY IF EXISTS "Users can update their participant status" ON public.room_participants;

-- Criar UMA política UPDATE abrangente que funciona para todos os casos
CREATE POLICY "Enable all updates for participants and hosts"
  ON public.room_participants
  FOR UPDATE
  TO public
  USING (
    -- Permitir se o usuário está autenticado E (é o próprio participante OU é host/criador da sala)
    (
      -- Caso 1: Próprio participante (autenticado ou convidado)
      (auth.uid() = user_id) OR
      (user_id IS NULL AND peer_id IS NOT NULL)
    )
    OR
    (
      -- Caso 2: É host na sala
      EXISTS (
        SELECT 1 FROM public.room_participants rp
        WHERE rp.room_id = room_participants.room_id
          AND rp.user_id = auth.uid()
          AND rp.is_host = true
          AND rp.left_at IS NULL
      )
    )
    OR
    (
      -- Caso 3: Criou a sala
      EXISTS (
        SELECT 1 FROM public.meeting_rooms mr
        WHERE mr.id = room_participants.room_id
          AND mr.created_by = auth.uid()
      )
    )
  );