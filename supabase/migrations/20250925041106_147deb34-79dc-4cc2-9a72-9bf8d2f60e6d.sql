-- Criar tabelas para sistema de reuniões em tempo real

-- Tabela para salas de reunião
CREATE TABLE public.meeting_rooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  created_by UUID NOT NULL,
  room_code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  max_participants INTEGER DEFAULT 50,
  is_active BOOLEAN DEFAULT true,
  is_locked BOOLEAN DEFAULT false,
  password_hash TEXT,
  recording_enabled BOOLEAN DEFAULT false,
  chat_enabled BOOLEAN DEFAULT true,
  screen_sharing_enabled BOOLEAN DEFAULT true,
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para participantes da reunião
CREATE TABLE public.room_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.meeting_rooms(id) ON DELETE CASCADE,
  user_id UUID,
  display_name TEXT NOT NULL,
  peer_id TEXT NOT NULL UNIQUE,
  is_host BOOLEAN DEFAULT false,
  is_moderator BOOLEAN DEFAULT false,
  audio_enabled BOOLEAN DEFAULT true,
  video_enabled BOOLEAN DEFAULT true,
  screen_sharing BOOLEAN DEFAULT false,
  connection_status TEXT DEFAULT 'connecting',
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  left_at TIMESTAMP WITH TIME ZONE
);

-- Tabela para mensagens do chat
CREATE TABLE public.room_chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.meeting_rooms(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES public.room_participants(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  message_type TEXT DEFAULT 'text',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para reações
CREATE TABLE public.room_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.meeting_rooms(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES public.room_participants(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.meeting_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_reactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies para meeting_rooms
CREATE POLICY "Users can create rooms in their company" 
ON public.meeting_rooms 
FOR INSERT 
WITH CHECK (
  company_id IN (
    SELECT company_users.company_id
    FROM company_users
    WHERE company_users.user_id = auth.uid()
  ) AND created_by = auth.uid()
);

CREATE POLICY "Users can view company rooms" 
ON public.meeting_rooms 
FOR SELECT 
USING (
  company_id IN (
    SELECT company_users.company_id
    FROM company_users
    WHERE company_users.user_id = auth.uid()
  ) OR is_active = true
);

CREATE POLICY "Room creators can update their rooms" 
ON public.meeting_rooms 
FOR UPDATE 
USING (created_by = auth.uid());

CREATE POLICY "Room creators can delete their rooms" 
ON public.meeting_rooms 
FOR DELETE 
USING (created_by = auth.uid());

-- RLS Policies para room_participants
CREATE POLICY "Anyone can join active rooms" 
ON public.room_participants 
FOR INSERT 
WITH CHECK (
  room_id IN (
    SELECT id FROM public.meeting_rooms 
    WHERE is_active = true
  )
);

CREATE POLICY "Users can view participants in rooms they joined" 
ON public.room_participants 
FOR SELECT 
USING (
  room_id IN (
    SELECT DISTINCT room_id FROM public.room_participants 
    WHERE user_id = auth.uid() OR user_id IS NULL
  ) OR 
  room_id IN (
    SELECT id FROM public.meeting_rooms 
    WHERE created_by = auth.uid()
  )
);

CREATE POLICY "Users can update their own participant data" 
ON public.room_participants 
FOR UPDATE 
USING (user_id = auth.uid() OR user_id IS NULL);

-- RLS Policies para room_chat_messages
CREATE POLICY "Participants can send messages" 
ON public.room_chat_messages 
FOR INSERT 
WITH CHECK (
  participant_id IN (
    SELECT id FROM public.room_participants 
    WHERE user_id = auth.uid() OR user_id IS NULL
  )
);

CREATE POLICY "Participants can view messages in their rooms" 
ON public.room_chat_messages 
FOR SELECT 
USING (
  room_id IN (
    SELECT DISTINCT room_id FROM public.room_participants 
    WHERE user_id = auth.uid() OR user_id IS NULL
  )
);

-- RLS Policies para room_reactions
CREATE POLICY "Participants can send reactions" 
ON public.room_reactions 
FOR INSERT 
WITH CHECK (
  participant_id IN (
    SELECT id FROM public.room_participants 
    WHERE user_id = auth.uid() OR user_id IS NULL
  )
);

CREATE POLICY "Participants can view reactions in their rooms" 
ON public.room_reactions 
FOR SELECT 
USING (
  room_id IN (
    SELECT DISTINCT room_id FROM public.room_participants 
    WHERE user_id = auth.uid() OR user_id IS NULL
  )
);

-- Triggers para updated_at
CREATE TRIGGER update_meeting_rooms_updated_at
  BEFORE UPDATE ON public.meeting_rooms
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_meeting_rooms_room_code ON public.meeting_rooms(room_code);
CREATE INDEX idx_meeting_rooms_company_id ON public.meeting_rooms(company_id);
CREATE INDEX idx_room_participants_room_id ON public.room_participants(room_id);
CREATE INDEX idx_room_participants_peer_id ON public.room_participants(peer_id);
CREATE INDEX idx_room_chat_messages_room_id ON public.room_chat_messages(room_id);
CREATE INDEX idx_room_reactions_room_id ON public.room_reactions(room_id);