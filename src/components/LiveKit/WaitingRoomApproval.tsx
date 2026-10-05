import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Check, X, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import waitingBellSound from '@/assets/sounds/waiting-room-bell.mp3';

interface WaitingParticipant {
  id: string;
  display_name: string;
  joined_at: string;
}

interface WaitingRoomApprovalProps {
  roomId: string;
  isHost: boolean;
}

const WaitingRoomApproval: React.FC<WaitingRoomApprovalProps> = ({ roomId, isHost }) => {
  const [waitingParticipants, setWaitingParticipants] = useState<WaitingParticipant[]>([]);
  const { toast } = useToast();
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const pollingIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const knownIdsRef = React.useRef<Set<string>>(new Set());
  const initializedRef = React.useRef(false);

  const playBell = React.useCallback(() => {
    try {
      if (!audioRef.current) return;
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch((e) => console.error('Erro ao tocar áudio:', e));
    } catch (e) {
      console.error('Erro ao tocar áudio:', e);
    }
  }, []);

  const fetchWaitingParticipants = React.useCallback(async () => {
    try {
      console.log('🔍 [WaitingRoomApproval] Buscando participantes aguardando para room:', roomId);
      
      const { data, error } = await supabase
        .from('room_participants')
        .select('id, display_name, joined_at')
        .eq('room_id', roomId)
        .eq('waiting_approval', true)
        .is('left_at', null)
        .order('joined_at', { ascending: true });

      if (error) {
        console.error('❌ [WaitingRoomApproval] Erro ao buscar:', error);
        throw error;
      }
      
      console.log('✅ [WaitingRoomApproval] Participantes encontrados:', data?.length || 0, data);
      const list = data || [];
      const currentIds = new Set(list.map((p: any) => p.id));

      // Detect new arrivals (only after the first fetch to avoid playing on mount)
      if (initializedRef.current) {
        const newcomers = list.filter((p: any) => !knownIdsRef.current.has(p.id));
        if (newcomers.length > 0) {
          playBell();
        }
      }
      knownIdsRef.current = currentIds;
      initializedRef.current = true;

      setWaitingParticipants(list);
    } catch (error) {
      console.error('❌ [WaitingRoomApproval] Erro fatal ao buscar participantes aguardando:', error);
    }
  }, [roomId, playBell]);

  useEffect(() => {
    if (!isHost) return;

    console.log('🔔 [WaitingRoomApproval] Iniciando monitoramento para room:', roomId);

    // Carregar áudio de notificação
    audioRef.current = new Audio(waitingBellSound);
    audioRef.current.volume = 0.8;
    audioRef.current.preload = 'auto';

    // Fetch inicial IMEDIATO
    fetchWaitingParticipants();

    // Polling a cada 3 segundos como fallback
    pollingIntervalRef.current = setInterval(() => {
      console.log('🔄 [WaitingRoomApproval] Polling periódico...');
      fetchWaitingParticipants();
    }, 3000);

    // Realtime subscription for waiting participants
    const channel = supabase
      .channel(`waiting_room_${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'room_participants',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          console.log('🔔 [WaitingRoomApproval] Nova inserção detectada:', payload);
          const newParticipant = payload.new as any;
          
          if (newParticipant.waiting_approval) {
            console.log('⏳ [WaitingRoomApproval] Novo participante aguardando aprovação:', newParticipant.display_name);

            console.log(`🔔 ${newParticipant.display_name} está na sala de espera`);

            fetchWaitingParticipants();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'room_participants',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          console.log('🔄 [WaitingRoomApproval] Update detectado:', payload);
          fetchWaitingParticipants();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'room_participants',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          console.log('❌ [WaitingRoomApproval] Delete detectado:', payload);
          fetchWaitingParticipants();
        }
      )
      .subscribe((status) => {
        console.log('📡 [WaitingRoomApproval] Status do canal realtime:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ [WaitingRoomApproval] Canal realtime conectado com sucesso!');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ [WaitingRoomApproval] Erro no canal realtime!');
        }
      });

    return () => {
      console.log('🔌 [WaitingRoomApproval] Desconectando canal realtime e parando polling');
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [roomId, isHost, toast, fetchWaitingParticipants]);

  const approveParticipant = React.useCallback(async (participantId: string, participantName: string) => {
    try {
      console.log('🟢 Tentando aprovar participante:', { participantId, participantName, roomId });
      
      const { data, error } = await supabase
        .from('room_participants')
        .update({ 
          waiting_approval: false,
          connection_status: 'connected'
        })
        .eq('id', participantId)
        .select();

      if (error) {
        console.error('❌ Erro ao aprovar:', error);
        throw error;
      }

      console.log('✅ Participante aprovado com sucesso:', data);

      console.log(`✅ ${participantName} aprovado`);
      
      // Recarregar lista
      fetchWaitingParticipants();
    } catch (error) {
      console.error('❌ Erro ao aprovar participante:', error);
      console.error("Erro ao aprovar participante");
    }
  }, [roomId, toast, fetchWaitingParticipants]);

  const rejectParticipant = React.useCallback(async (participantId: string, participantName: string) => {
    try {
      console.log('🔴 Tentando rejeitar participante:', { participantId, participantName, roomId });
      
      const { data, error } = await supabase
        .from('room_participants')
        .update({ 
          left_at: new Date().toISOString(),
          connection_status: 'rejected'
        })
        .eq('id', participantId)
        .select();

      if (error) {
        console.error('❌ Erro ao rejeitar:', error);
        throw error;
      }

      console.log('✅ Participante rejeitado com sucesso:', data);

      console.log(`❌ ${participantName} rejeitado`);
      
      // Recarregar lista
      fetchWaitingParticipants();
    } catch (error) {
      console.error('❌ Erro ao rejeitar participante:', error);
      console.error("Erro ao rejeitar participante");
    }
  }, [roomId, toast, fetchWaitingParticipants]);

  // Não renderizar nada se não for host ou não houver participantes
  if (!isHost || waitingParticipants.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-20 right-6 w-80 z-50 animate-in slide-in-from-right duration-300">
      <Card className="bg-background border-primary shadow-xl">
        <div className="p-4 border-b border-border bg-primary/10">
          <div className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-foreground">Sala de Espera</h3>
            <Badge variant="secondary" className="ml-auto">
              {waitingParticipants.length}
            </Badge>
          </div>
        </div>
        
        <ScrollArea className="max-h-96">
          <div className="p-2 space-y-2">
            {waitingParticipants.map((participant) => (
              <Card key={participant.id} className="p-3 border-border">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground truncate">
                      {participant.display_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Aguardando aprovação
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => approveParticipant(participant.id, participant.display_name)}
                      className="h-8 w-8 p-0 rounded-full"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => rejectParticipant(participant.id, participant.display_name)}
                      className="h-8 w-8 p-0 rounded-full"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </Card>
    </div>
  );
};

export default WaitingRoomApproval;
