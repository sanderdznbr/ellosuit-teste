import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Clock, UserCheck } from 'lucide-react';
import { Card } from '@/components/ui/card';
import logoEllo from '@/assets/logoellosuit.png';

interface WaitingRoomScreenProps {
  roomName: string;
  participantId: string;
  onApproved: () => void;
  onRejected: () => void;
}

const WaitingRoomScreen: React.FC<WaitingRoomScreenProps> = ({
  roomName,
  participantId,
  onApproved,
  onRejected,
}) => {
  const [waitTime, setWaitTime] = useState(0);

  useEffect(() => {
    // Start timer
    const timer = setInterval(() => {
      setWaitTime(prev => prev + 1);
    }, 1000);

    // Listen for approval status changes
    const checkApprovalStatus = async () => {
      const { data, error } = await supabase
        .from('room_participants')
        .select('waiting_approval, connection_status, left_at')
        .eq('id', participantId)
        .single();

      if (error) {
        console.error('❌ [WaitingRoomScreen] Erro ao verificar status de aprovação:', error);
        return;
      }

      console.log('📊 [WaitingRoomScreen] Status atual do participante:', data);

      if (!data.waiting_approval) {
        console.log('✅ [WaitingRoomScreen] Participante aprovado! Chamando onApproved()');
        onApproved();
      } else if (data.left_at || data.connection_status === 'rejected') {
        console.log('❌ [WaitingRoomScreen] Participante rejeitado! Chamando onRejected()');
        onRejected();
      }
    };

    // Initial check
    checkApprovalStatus();

    // Setup realtime subscription
    const channel = supabase
      .channel(`participant_${participantId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'room_participants',
          filter: `id=eq.${participantId}`,
        },
        (payload) => {
          const newData = payload.new as any;
          console.log('🔔 [WaitingRoomScreen] Atualização em tempo real recebida:', newData);
          
          if (!newData.waiting_approval) {
            console.log('✅ [WaitingRoomScreen] Realtime: Participante aprovado!');
            onApproved();
          } else if (newData.left_at || newData.connection_status === 'rejected') {
            console.log('❌ [WaitingRoomScreen] Realtime: Participante rejeitado!');
            onRejected();
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [participantId, onApproved, onRejected]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#0f172a' }}>
      <Card className="max-w-lg w-full shadow-2xl border border-slate-700" style={{ background: '#1e293b' }}>
        {/* Header */}
        <div className="p-6 border-b border-slate-700">
          <div className="flex justify-center mb-6">
            <img src={logoEllo} alt="ElloSuit" className="h-14 w-auto" />
          </div>
          
          {/* Animated Icon */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 rounded-full animate-ping" style={{ background: '#374DA4', opacity: 0.2 }} />
              <div className="relative w-24 h-24 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #1e40af, #374DA4)' }}>
                <Clock className="h-12 w-12 animate-pulse text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-8 space-y-6">
          <div className="text-center space-y-3">
            <h2 className="text-3xl font-bold text-white">
              Aguardando Aprovação
            </h2>
            
            <p className="text-base leading-relaxed text-slate-300">
              O anfitrião da reunião{' '}
              <span className="font-bold px-2 py-1 rounded-md bg-[#2F428D] text-white">
                {roomName}
              </span>
              {' '}foi notificado da sua presença e aprovará sua entrada em breve.
            </p>
          </div>
          
          {/* Timer */}
          <div className="flex items-center justify-center gap-3 p-4 rounded-xl bg-slate-700 border border-slate-600">
            <Loader2 className="h-5 w-5 animate-spin text-[#5A74D1]" />
            <span className="text-lg font-semibold text-white">
              {formatTime(waitTime)}
            </span>
          </div>

          {/* Info Footer */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-[#1A2551]/30 border border-[#253573]/50">
            <UserCheck className="h-5 w-5 mt-0.5 flex-shrink-0 text-[#5A74D1]" />
            <div className="text-sm leading-relaxed text-slate-200">
              Por segurança, apenas participantes aprovados pelo anfitrião podem entrar nesta reunião.
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default WaitingRoomScreen;