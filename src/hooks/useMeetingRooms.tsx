import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface MeetingRoom {
  id: string;
  company_id: string;
  created_by: string;
  room_code: string;
  title: string;
  description?: string;
  max_participants: number;
  is_active: boolean;
  is_locked: boolean;
  recording_enabled: boolean;
  chat_enabled: boolean;
  screen_sharing_enabled: boolean;
  started_at?: string;
  ended_at?: string;
  created_at: string;
  updated_at: string;
}

export interface RoomParticipant {
  id: string;
  room_id: string;
  user_id?: string;
  display_name: string;
  peer_id: string;
  is_host: boolean;
  is_moderator: boolean;
  audio_enabled: boolean;
  video_enabled: boolean;
  screen_sharing: boolean;
  connection_status: string;
  joined_at: string;
  left_at?: string;
}

export const useMeetingRooms = () => {
  const [rooms, setRooms] = useState<MeetingRoom[]>([]);
  const [currentRoom, setCurrentRoom] = useState<MeetingRoom | null>(null);
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  // Buscar salas recentes (ativas e criadas na última hora)
  const fetchRooms = async () => {
    setLoading(true);
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('meeting_rooms')
        .select('*')
        .eq('is_active', true)
        .gt('created_at', oneHourAgo)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRooms(data || []);
    } catch (error) {
      console.error('Erro ao buscar salas:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as salas de reunião",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Criar nova sala
  const createRoom = async (roomData: {
    title: string;
    recording_enabled?: boolean;
    chat_enabled?: boolean;
    screen_sharing_enabled?: boolean;
  }) => {
    console.log('🔐 Verificando autenticação:', { hasUser: !!user, userId: user?.id });
    
    if (!user) {
      console.error('❌ Usuário não autenticado!');
      toast({
        title: "Erro de autenticação",
        description: "Você precisa estar logado para criar uma sala. Faça login e tente novamente.",
        variant: "destructive",
      });
      return null;
    }

    try {
      // Buscar dados da empresa do usuário
      const { data: companyUser, error: companyError } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (companyError) {
        console.error('Erro ao buscar empresa:', companyError);
        toast({
          title: "Erro",
          description: "Não foi possível encontrar sua empresa",
          variant: "destructive",
        });
        return null;
      }

      // Gerar código único da sala
      const roomCode = Math.random().toString(36).substring(2, 12).toUpperCase();
      
      const { data, error } = await supabase
        .from('meeting_rooms')
        .insert({
          title: roomData.title,
          room_code: roomCode,
          max_participants: 50,
          recording_enabled: roomData.recording_enabled || false,
          chat_enabled: roomData.chat_enabled !== false,
          screen_sharing_enabled: roomData.screen_sharing_enabled !== false,
          company_id: companyUser.company_id,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Sala criada!",
        description: `Sala "${roomData.title}" criada com código ${roomCode}`,
      });

      fetchRooms();
      return data;
    } catch (error) {
      console.error('Erro ao criar sala:', error);
      toast({
        title: "Erro",
        description: "Não foi possível criar a sala",
        variant: "destructive",
      });
      return null;
    }
  };

  // Entrar em uma sala
  const joinRoom = async (roomCode: string, displayName: string) => {
    try {
      const code = (roomCode || '').toUpperCase();
      console.log('🔍 Tentando entrar na sala:', { code, displayName, hasUser: !!user });

      // Buscar sala pelo código
      const { data: room, error: roomError } = await supabase
        .from('meeting_rooms')
        .select('*')
        .eq('room_code', code)
        .eq('is_active', true)
        .single();

      if (roomError || !room) {
        console.error('❌ Sala não encontrada:', roomError);
        toast({
          title: "Sala não encontrada",
          description: "Verifique o código da sala e tente novamente",
          variant: "destructive",
        });
        return null;
      }

      // Gerar peer ID único
      const peerId = `peer_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      // Check if user is host
      const isHost = user ? room.created_by === user.id : false;
      
      // Adicionar participante (convidados ficam em espera, anfitrião entra direto)
      const { data: participant, error: participantError } = await supabase
        .from('room_participants')
        .insert({
          room_id: room.id,
          user_id: user?.id || null,
          display_name: displayName,
          peer_id: peerId,
          is_host: isHost,
          connection_status: isHost ? 'connected' : 'waiting',
          waiting_approval: !isHost, // Apenas não-anfitriões aguardam aprovação
        })
        .select()
        .single();

      if (participantError) {
        console.error('❌ Erro ao adicionar participante:', participantError);
        toast({
          title: 'Erro',
          description: participantError.message || 'Falha ao entrar na sala',
          variant: 'destructive',
        });
        return null;
      }

      setCurrentRoom(room);
      await fetchParticipants(room.id);

      toast({
        title: 'Conectado',
        description: `Você entrou na sala "${room.title}"`,
      });

      return { room, participant };
    } catch (error) {
      console.error('❌ Erro inesperado ao entrar na sala:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Não foi possível entrar na sala',
        variant: 'destructive',
      });
      return null;
    }
  };

  // Sair da sala
  const leaveRoom = async (participantId: string) => {
    try {
      await supabase
        .from('room_participants')
        .update({ 
          left_at: new Date().toISOString(),
          connection_status: 'disconnected'
        })
        .eq('id', participantId);

      setCurrentRoom(null);
      setParticipants([]);
    } catch (error) {
      console.error('Erro ao sair da sala:', error);
    }
  };

  // Buscar participantes da sala atual
  const fetchParticipants = async (roomId: string) => {
    try {
      const { data, error } = await supabase
        .from('room_participants')
        .select('*')
        .eq('room_id', roomId)
        .is('left_at', null)
        .order('joined_at', { ascending: true });

      if (error) throw error;
      setParticipants(data || []);
    } catch (error) {
      console.error('Erro ao buscar participantes:', error);
    }
  };

  // Atualizar status do participante
  const updateParticipantStatus = async (participantId: string, updates: {
    audio_enabled?: boolean;
    video_enabled?: boolean;
    screen_sharing?: boolean;
    connection_status?: string;
  }) => {
    try {
      const { error } = await supabase
        .from('room_participants')
        .update(updates)
        .eq('id', participantId);

      if (error) throw error;
      
      if (currentRoom) {
        fetchParticipants(currentRoom.id);
      }
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
    }
  };

  // Encerrar sala (apenas host)
  const endRoom = async (roomId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('meeting_rooms')
        .update({ 
          is_active: false,
          ended_at: new Date().toISOString()
        })
        .eq('id', roomId)
        .eq('created_by', user.id);

      if (error) throw error;

      toast({
        title: "Reunião encerrada",
        description: "A reunião foi encerrada com sucesso",
      });

      setCurrentRoom(null);
      setParticipants([]);
      fetchRooms();
    } catch (error) {
      console.error('Erro ao encerrar sala:', error);
      toast({
        title: "Erro",
        description: "Não foi possível encerrar a reunião",
        variant: "destructive",
      });
    }
  };

  // Configurar real-time para participantes
  useEffect(() => {
    if (!currentRoom) return;

    const channel = supabase
      .channel(`room_${currentRoom.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_participants',
          filter: `room_id=eq.${currentRoom.id}`,
        },
        () => {
          fetchParticipants(currentRoom.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentRoom]);

  useEffect(() => {
    if (user) {
      fetchRooms();
    }
  }, [user]);

  return {
    rooms,
    currentRoom,
    participants,
    loading,
    createRoom,
    joinRoom,
    leaveRoom,
    endRoom,
    updateParticipantStatus,
    fetchRooms,
    fetchParticipants,
    deleteRoom: async (roomId: string) => {
      try {
        const { error } = await supabase
          .from('meeting_rooms')
          .delete()
          .eq('id', roomId);
        if (error) throw error;
        toast({ title: 'Sala excluída' });
        fetchRooms();
      } catch (error) {
        console.error('Erro ao excluir sala:', error);
        toast({ title: 'Erro', description: 'Não foi possível excluir a sala', variant: 'destructive' });
      }
    }
  };
};