import React, { useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import SimpleLiveKitRoom from '@/components/LiveKit/SimpleLiveKitRoom';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';

const LiveKitMeeting = () => {
  const { roomCode } = useParams<{ roomCode: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme();

  useEffect(() => {
    console.log('🚀 [LiveKitMeeting] Componente montado');
    console.log('📍 [LiveKitMeeting] Room Code:', roomCode);
    console.log('👤 [LiveKitMeeting] User:', user?.id || 'Guest');
    console.log('🔗 [LiveKitMeeting] URL Params:', Object.fromEntries(searchParams.entries()));
  }, [roomCode, user, searchParams]);

  if (!roomCode) {
    console.warn('⚠️ [LiveKitMeeting] Sem room code, redirecionando...');
    navigate('/dashboard/reunioes');
    return null;
  }

  const handleLeaveRoom = () => {
    console.log('👋 [LiveKitMeeting] Saindo da reunião');
    navigate('/dashboard/meet-hub');
  };

  // Get name from URL params (for guests)
  const urlName = searchParams.get('name');
  const participantName = user?.user_metadata?.full_name || urlName || 'Convidado';

  console.log('✅ [LiveKitMeeting] Renderizando SimpleLiveKitRoom com:', {
    roomCode,
    participantName,
    isGuest: !user
  });

  return (
    <div 
      data-meeting-page 
      data-meeting-theme={theme}
      style={{ 
        backgroundColor: theme === 'dark' ? '#101010' : '#faf9f7', 
        minHeight: '100vh', 
        width: '100%',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'hidden'
      }}
    >
      <SimpleLiveKitRoom
        roomName={roomCode}
        participantName={participantName}
        onLeave={handleLeaveRoom}
      />
    </div>
  );
};

export default LiveKitMeeting;