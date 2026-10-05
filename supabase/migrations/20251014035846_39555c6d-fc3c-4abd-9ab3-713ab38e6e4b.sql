-- Remover política atual que pode estar bloqueando
DROP POLICY IF EXISTS "Enable all updates for participants and hosts" ON public.room_participants;

-- Criar política mais permissiva para UPDATE
-- Permite atualização se:
-- 1. É o próprio participante (autenticado ou convidado com peer_id)
-- 2. OU qualquer usuário pode atualizar (para permitir hosts aprovarem)
CREATE POLICY "Allow participant updates"
  ON public.room_participants
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);