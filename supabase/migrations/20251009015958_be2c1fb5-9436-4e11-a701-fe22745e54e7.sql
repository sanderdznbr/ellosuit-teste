-- Criar tabela room_participants se não existir
CREATE TABLE IF NOT EXISTS public.room_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.meeting_rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  peer_id TEXT,
  is_host BOOLEAN DEFAULT false,
  audio_enabled BOOLEAN DEFAULT true,
  video_enabled BOOLEAN DEFAULT true,
  waiting_approval BOOLEAN DEFAULT true,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  left_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.room_participants ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Participants can send reactions" ON public.room_participants;
DROP POLICY IF EXISTS "Participants can view reactions in their rooms" ON public.room_participants;
DROP POLICY IF EXISTS "Anyone can join a room" ON public.room_participants;
DROP POLICY IF EXISTS "Participants can view other participants" ON public.room_participants;
DROP POLICY IF EXISTS "Participants can update their own status" ON public.room_participants;
DROP POLICY IF EXISTS "Room creators can manage participants" ON public.room_participants;

-- Política 1: Qualquer pessoa pode se adicionar como participante (para permitir guests)
CREATE POLICY "Anyone can join as participant"
ON public.room_participants
FOR INSERT
WITH CHECK (true);

-- Política 2: Participantes podem ver outros participantes da mesma sala
CREATE POLICY "Participants can view room participants"
ON public.room_participants
FOR SELECT
USING (
  room_id IN (
    SELECT room_id 
    FROM public.room_participants 
    WHERE id = room_participants.id
  )
);

-- Política 3: Participantes podem atualizar seu próprio status
CREATE POLICY "Participants can update their own status"
ON public.room_participants
FOR UPDATE
USING (
  user_id = auth.uid() OR 
  user_id IS NULL OR
  id IN (
    SELECT id 
    FROM public.room_participants 
    WHERE user_id = auth.uid() OR user_id IS NULL
  )
);

-- Política 4: Hosts podem atualizar qualquer participante da sala
CREATE POLICY "Hosts can manage room participants"
ON public.room_participants
FOR UPDATE
USING (
  room_id IN (
    SELECT room_id 
    FROM public.room_participants 
    WHERE user_id = auth.uid() AND is_host = true
  )
);

-- Política 5: Hosts podem deletar participantes
CREATE POLICY "Hosts can remove participants"
ON public.room_participants
FOR DELETE
USING (
  room_id IN (
    SELECT room_id 
    FROM public.room_participants 
    WHERE user_id = auth.uid() AND is_host = true
  )
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_room_participants_room_id ON public.room_participants(room_id);
CREATE INDEX IF NOT EXISTS idx_room_participants_user_id ON public.room_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_room_participants_peer_id ON public.room_participants(peer_id);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_room_participants_updated_at ON public.room_participants;
CREATE TRIGGER update_room_participants_updated_at
BEFORE UPDATE ON public.room_participants
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();