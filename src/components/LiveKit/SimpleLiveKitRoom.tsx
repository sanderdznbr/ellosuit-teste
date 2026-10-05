import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useRoomContext,
  useConnectionState,
} from '@livekit/components-react';
import { Room, Track, ConnectionState } from 'livekit-client';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
 import { Loader2, AlertCircle, RefreshCw, Share2, FileText, Download, PlayCircle } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import SimpleMeetingControls from './SimpleMeetingControls';
import MeetingSidebar from './MeetingSidebar';
import ShareMeetingModal from './ShareMeetingModal';
import FloatingChatPanel from './FloatingChatPanel';
import { MeetingExitModal } from './MeetingExitModal';
import ZoomPreJoin from './ZoomPreJoin';
import ZoomParticipantGrid from './ZoomParticipantGrid';
import MobileMeetingLayout from './MobileMeetingLayout';
import { RoomContextCapture } from './RoomContextCapture';
import WaitingRoomApproval from './WaitingRoomApproval';
import WaitingRoomScreen from './WaitingRoomScreen';
import WhiteboardCanvas from './WhiteboardCanvas';
import AudioDevicePersistence from './AudioDevicePersistence';
import logoEllo from '@/assets/logoellosuit.png';
 import DeviceSettingsModal from './DeviceSettingsModal';
  import MeetingSkillsModal from './MeetingSkillsModal';
  import { ALL_SKILLS } from '@/constants/skills';
import TranscriptionModal from './TranscriptionModal';
import MeetingRecordingModal from './MeetingRecordingModal';
import { LiveKitAudioCapture } from './LiveKitAudioCapture';
import InviteModal from './InviteModal';
import RecordingConsentDialog from './RecordingConsentDialog';
import { APP_CONFIG } from '@/config/app';
import '@/styles/livekit.css';
import MeetingLayout from './MeetingLayout';
import '@/styles/meeting-dark-theme.css';

interface SimpleLiveKitRoomProps {
  roomName: string;
  participantName: string;
  onLeave: () => void;
}

interface TokenResponse {
  token: string;
  url: string;
  roomName: string;
  participantName: string;
  userId: string;
}

interface TranscriptionMessage {
  text: string;
  is_final: boolean;
  timestamp: string;
  speaker?: string;
}

 interface RoomEventsListenerProps {
   onRoomClosed: () => void;
   isHost: boolean;
 }
 
 const RoomEventsListener: React.FC<RoomEventsListenerProps> = ({ onRoomClosed, isHost }) => {
   const room = useRoomContext();
   
   useEffect(() => {
     if (!room) return;
     
     const handleDataReceived = (payload: Uint8Array) => {
       try {
         const decoder = new TextDecoder();
         const data = JSON.parse(decoder.decode(payload));
         
         if (data.type === 'room_closed' && !isHost) {
           console.log('🚪 [RoomEventsListener] Reunião encerrada pelo anfitrião');
           onRoomClosed();
         }
       } catch (e) {
         // Ignore malformed JSON
       }
     };
     
     room.on('dataReceived', handleDataReceived);
     return () => {
       room.off('dataReceived', handleDataReceived);
     };
   }, [room, onRoomClosed, isHost]);
   
   return null;
 };
 
const SimpleLiveKitRoom: React.FC<SimpleLiveKitRoomProps> = ({ 
  roomName, 
  participantName, 
  onLeave 
}) => {
  const [searchParams] = useSearchParams();
  const [token, setToken] = useState<string>('');
  const [serverUrl, setServerUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [connectingToRoom, setConnectingToRoom] = useState(false);
  const [error, setError] = useState<string>('');
  const [preJoinChoices, setPreJoinChoices] = useState<any>();
  const [showPreJoin, setShowPreJoin] = useState(false); // Começar false - decidiremos depois
  const [activeTab, setActiveTab] = useState<'chat' | 'participants' | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showFloatingChat, setShowFloatingChat] = useState(false);
  const [showTranscriptionModal, setShowTranscriptionModal] = useState(false); // Removed waiting popup
  const [showRecordingModal, setShowRecordingModal] = useState(false);
  const [companyId, setCompanyId] = useState<string>('');
  const [transcriptionMessages, setTranscriptionMessages] = useState<TranscriptionMessage[]>([]);
  const [isTranscribing, setIsTranscribing] = useState(true); // Auto-start transcription
  const [showExitModal, setShowExitModal] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);
   const [savedAudioUrl, setSavedAudioUrl] = useState<string>('');
   const [maxParticipants, setMaxParticipants] = useState(0);
    const [lastSavedMeetingId, setLastSavedMeetingId] = useState<string | null>(null);
   const [meetingStats, setMeetingStats] = useState({
     participantCount: 0,
     duration: 0,
     startTime: Date.now()
   });
  const [showDeviceSettings, setShowDeviceSettings] = useState(false);
   const [showSkillsModal, setShowSkillsModal] = useState(false);
  const [isWaitingApproval, setIsWaitingApproval] = useState(false);
  const [participantId, setParticipantId] = useState<string>('');
  const [isHost, setIsHost] = useState(false);
  const [currentRoomId, setCurrentRoomId] = useState<string>('');
  const [showWhiteboard, setShowWhiteboard] = useState(false);
    const [activeSkillId, setActiveSkillId] = useState<string | null>(null);
    const [skillActivationIdentity, setSkillActivationIdentity] = useState<string | null>(null);
    const [advisorMessage, setAdvisorMessage] = useState<{ skill: string, text: string, type?: 'strategic' | 'user' } | null>(null);
   const [skillFeedbacks, setSkillFeedbacks] = useState<string[]>([]);
   const [meetingStartTime] = useState<number>(Date.now());
   const [elapsedTime, setElapsedTime] = useState<string>('00:00');
    const lastAdvisorTimeRef = useRef<number>(0);
    const [participantVolumes, setParticipantVolumes] = useState<Record<string, number>>({});
    const [localMicVolume, setLocalMicVolume] = useState(1);

    const handleVolumeChange = useCallback((participantIdentity: string, volume: number) => {
      setParticipantVolumes(prev => ({ ...prev, [participantIdentity]: volume }));
    }, []);

    const handleLocalMicVolumeChange = useCallback((volume: number) => {
      setLocalMicVolume(volume);
    }, []);
   // Timer logic for elapsed meeting time
   useEffect(() => {
     const interval = setInterval(() => {
       const elapsed = Math.floor((Date.now() - meetingStartTime) / 1000);
       const hours = Math.floor(elapsed / 3600);
       const minutes = Math.floor((elapsed % 3600) / 60);
       const seconds = elapsed % 60;
       
       const timeString = hours > 0 
         ? `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
         : `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
         
       setElapsedTime(timeString);
     }, 1000);
     return () => clearInterval(interval);
   }, [meetingStartTime]);


   // Sync active skills from database
   useEffect(() => {
     if (!currentRoomId) return;
 
     const fetchActiveSkill = async () => {
       try {
         const { data, error } = await (supabase as any)
           .from('room_active_skills')
           .select('skill_id')
           .eq('room_id', currentRoomId);
 
         if (error) throw error;
          if (data && data.length > 0) {
            setActiveSkillId(data[0].skill_id);
            setSkillActivationIdentity(data[0].activated_by);
          } else {
            setActiveSkillId(null);
            setSkillActivationIdentity(null);
          }
       } catch (error) {
         console.error('❌ [SimpleLiveKitRoom] Erro ao buscar skill ativa:', error);
       }
     };
 
     fetchActiveSkill();
 
     // Subscribe to real-time updates for skills
     const channel = supabase
       .channel(`active_skills_${currentRoomId}`)
       .on(
         'postgres_changes',
         {
           event: '*',
           schema: 'public',
           table: 'room_active_skills',
           filter: `room_id=eq.${currentRoomId}`,
         },
         (payload) => {
           console.log('🤖 [SimpleLiveKitRoom] Mudança na Skill detectada:', payload.eventType);
            if (payload.eventType === 'DELETE') {
              setActiveSkillId(null);
              setSkillActivationIdentity(null);
            } else if (payload.new && (payload.new as any).skill_id) {
              setActiveSkillId((payload.new as any).skill_id);
              setSkillActivationIdentity((payload.new as any).activated_by);
            }
         }
       )
       .subscribe();
 
     return () => {
       supabase.removeChannel(channel);
     };
   }, [currentRoomId]);

   // Strategic AI Intelligence Logic for ElloMeeting
   useEffect(() => {
     if (!activeSkillId || !isHost || !currentRoomId) return;
 
     console.log('🧠 [SimpleLiveKitRoom] Ativando inteligência estratégica para skill:', activeSkillId);
     const skill = ALL_SKILLS.find(s => s.id === activeSkillId);
     if (!skill) return;

       // Confirmar ativação silenciosamente ou via toast se necessário, removendo o advisorMessage inicial
       // para evitar poluição visual imediata no topo
       lastAdvisorTimeRef.current = Date.now();

      // Insights periódicos — não dependem mais de transcrição para garantir visibilidade
      const SUGGESTION_CHECK_INTERVAL = 45000;
      const MIN_INTERVAL = 60000;
      const STRATEGIC_PROBABILITY = 0.6;
      let lastTranscriptCount = 0;
 
     const interval = setInterval(() => {
       const now = Date.now();
       const timeSinceLast = now - lastAdvisorTimeRef.current;

        if (timeSinceLast < MIN_INTERVAL) return;
 
       if (Math.random() < STRATEGIC_PROBABILITY) {
         lastTranscriptCount = transcriptionMessages.length;
         const insightsPool: Record<string, string[]> = {
           'sales-agent': [
             "O cliente demonstrou interesse genuíno. Explore mais os diferenciais competitivos agora.",
             "A percepção de valor parece estar variando. Tente ancorar o preço com os benefícios de ROI.",
             "Momento de fechamento: Peça um compromisso de próxima etapa ou envie a proposta agora."
           ],
           'legal-compliance': [
             "Lembre-se: qualquer promessa de SLA deve estar documentada no contrato final.",
             "A menção a dados sensíveis exige que reforcemos nossa conformidade com a LGPD.",
             "Evite garantir exclusividade antes da revisão da diretoria jurídica."
           ],
           'tech-advisor': [
             "Boa explicação técnica. Se perguntarem sobre segurança, mencione a criptografia AES-256.",
             "A arquitetura microserviços parece ser o que eles precisam para escalar esse volume.",
             "Eles parecem preocupados com o tempo de resposta. Enfatize nossa infraestrutura de borda."
           ],
           'strategic-planner': [
             "Estamos há algum tempo no mesmo tópico. Sugiro avançar para garantir que cubramos toda a pauta.",
             "Excelente ponto. Esse alinhamento com a visão de longo prazo da empresa é crucial.",
             "Tente extrair qual é o real obstáculo para a implementação imediata deste projeto."
           ]
         };
 
         const pool = insightsPool[activeSkillId] || [
           "Analisando padrões da conversa... Identifiquei uma boa oportunidade de reforçar nossa autoridade.",
           "O engajamento dos participantes está em um ponto alto. Ótimo momento para propor próximos passos.",
           "Sugestão: Valide se todos entenderam o cronograma antes de encerrar este tópico específico."
         ];
 
         const randomText = pool[Math.floor(Math.random() * pool.length)];
         
         console.log('🤖 [SimpleLiveKitRoom] Gerando sugestão estratégica:', randomText);
          setAdvisorMessage({ skill: skill.name, text: randomText, type: 'strategic' });
          setSkillFeedbacks(prev => [...prev, `[${new Date().toLocaleTimeString('pt-BR')}] ${randomText}`]);
         lastAdvisorTimeRef.current = now;
         
         // Auto-hide after 10 seconds to not disturb
         setTimeout(() => setAdvisorMessage(null), 10000);
       }
     }, SUGGESTION_CHECK_INTERVAL);
 
     return () => {
       clearInterval(interval);
       setAdvisorMessage(null);
     };
    }, [activeSkillId, isHost, currentRoomId, transcriptionMessages]);
 
  const [isCheckingHost, setIsCheckingHost] = useState(true); // Começar true - verificando primeiro
  const [whiteboardBgColor, setWhiteboardBgColor] = useState<'white' | 'black'>('white');
  const [livekitConnectedAt, setLivekitConnectedAt] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingId, setRecordingId] = useState<string>('');
  const [hadRecording, setHadRecording] = useState(false);
  const [livekitRecordingId, setLivekitRecordingId] = useState<string>('');
  const [showRecordingConsent, setShowRecordingConsent] = useState(false);
  const [pendingRecordingRequest, setPendingRecordingRequest] = useState(false);
   const [isProcessingRecording, setIsProcessingRecording] = useState(false);
   const [recordingStatus, setRecordingStatus] = useState<'idle' | 'recording' | 'finalizing' | 'processing'>('idle');
  const [isInitialConnection, setIsInitialConnection] = useState(true);
  const [connectionStable, setConnectionStable] = useState(false);
  const hasCheckedHostRef = useRef(false); // Prevenir múltiplas execuções
  const meetingControlsRef = useRef<any>(null);
  const meetingDurationTimerRef = useRef<NodeJS.Timeout>();
  const connectionTimeoutRef = useRef<NodeJS.Timeout>();
  const { user } = useAuth();
  const { toast } = useToast();
  const { isMobile } = useIsMobile();
  const roomRef = useRef<Room | null>(null);
  const audioRecordersRef = useRef<Map<string, { recorder: MediaRecorder; chunks: Blob[] }>>(new Map());

  console.log('🎬 [SimpleLiveKitRoom] Componente montado:', {
    roomName,
    participantName,
    hasUser: !!user,
    userId: user?.id
  });

  // Host permissions removed - users can enter without devices and configure later

  // Check if user is the first to enter (becomes host automatically)
  useEffect(() => {
    // Prevenir múltiplas execuções
    if (hasCheckedHostRef.current) {
      console.log('⚠️ [SimpleLiveKitRoom] Checagem já executada, ignorando...');
      return;
    }
    
    hasCheckedHostRef.current = true;
    
    const checkFirstParticipant = async () => {
      console.log('🔍 [SimpleLiveKitRoom] === VERIFICANDO PRIMEIRO PARTICIPANTE ===');
      
      try {
        // First, get the room data
        console.log('📡 [SimpleLiveKitRoom] Buscando dados da sala...');
        const { data: roomData, error: roomError } = await supabase
          .from('meeting_rooms')
          .select('id, created_by, title')
          .eq('room_code', roomName)
          .eq('is_active', true)
          .single();

        if (roomError) {
          console.error('❌ [SimpleLiveKitRoom] Erro ao buscar sala:', roomError);
          setError('Sala não encontrada');
          setIsCheckingHost(false);
          return;
        }

        console.log('✅ [SimpleLiveKitRoom] Sala encontrada:', roomData);
        setCurrentRoomId(roomData.id);

        // Check if there are any participants already in the room
        console.log('👥 [SimpleLiveKitRoom] Verificando participantes existentes...');
        const { data: existingParticipants, error: participantsError } = await supabase
          .from('room_participants')
          .select('id, is_host, display_name')
          .eq('room_id', roomData.id);

        if (participantsError) {
          console.error('❌ [SimpleLiveKitRoom] Erro ao buscar participantes:', participantsError);
        }

        // Get user data early
        const { data: userData } = await supabase.auth.getUser();
        
        const participantCount = existingParticipants?.length || 0;
        const isFirstParticipant = participantCount === 0;
        const isOwner = userData?.user && roomData.created_by === userData.user.id;
        
        console.log('📊 [SimpleLiveKitRoom] Participantes existentes:', participantCount);
        console.log('🎯 [SimpleLiveKitRoom] É o primeiro participante?', isFirstParticipant);
        console.log('👑 [SimpleLiveKitRoom] É o dono da sala?', isOwner);

        const userName = userData?.user?.user_metadata?.full_name || 
                        userData?.user?.email?.split('@')[0] || 
                        participantName ||
                        'Participante';

        // Get company ID
        if (userData?.user) {
          const { data: companyUsers } = await supabase
            .from('company_users')
            .select('company_id')
            .eq('user_id', userData.user.id)
            .limit(1);
          
          if (companyUsers && companyUsers.length > 0) {
            setCompanyId(companyUsers[0].company_id);
          }
        }

        if (isFirstParticipant || isOwner) {
          console.log(isFirstParticipant 
            ? '👑 [SimpleLiveKitRoom] ✨ PRIMEIRO A ENTRAR - VIRANDO HOST AUTOMATICAMENTE!' 
            : '👑 [SimpleLiveKitRoom] ✨ DONO REENTRANDO - RECUPERANDO HOST!');
            
          setIsHost(true);
          
          // Create participant record as host
          console.log('💾 [SimpleLiveKitRoom] Criando registro como host...');
          const peerId = `peer_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
          
          // First check if user is already in participants (to avoid duplicates when re-entering)
          const { data: existingMe } = await supabase
            .from('room_participants')
            .select('id')
            .eq('room_id', roomData.id)
            .eq('user_id', userData?.user?.id || '')
            .is('left_at', null)
            .maybeSingle();

          let participantData;
          let participantError;

          if (existingMe) {
            console.log('♻️ [SimpleLiveKitRoom] Reusando registro de participante existente');
            const { data: updateData, error: updateError } = await (supabase as any)
              .from('room_participants')
              .update({
                is_host: true,
                waiting_approval: false,
                connection_status: 'connected',
                display_name: userName,
                peer_id: peerId // Novo peer_id para nova conexão
              })
              .eq('id', existingMe.id)
              .select()
              .single();
            participantData = updateData;
            participantError = updateError;
          } else {
            const { data: insertData, error: insertError } = await (supabase as any)
              .from('room_participants')
              .insert({
                room_id: roomData.id,
                user_id: userData?.user?.id || null,
                display_name: userName,
                peer_id: peerId,
                is_host: true,
                waiting_approval: false,
                connection_status: 'connected'
              })
              .select()
              .single();
            participantData = insertData;
            participantError = insertError;
          }

          if (participantError) {
            console.error('❌ [SimpleLiveKitRoom] Erro ao criar participante host:', participantError);
            toast({
              title: "Erro ao entrar na sala",
              description: participantError.message,
              variant: "destructive"
            });
            setIsCheckingHost(false);
            return;
          }

          console.log('✅ [SimpleLiveKitRoom] Participante host criado:', participantData);

          // Generate token and enter room directly (NO PRE-JOIN)
          console.log('🎫 [SimpleLiveKitRoom] Gerando token para host...');
          
          // Definir configurações padrão para o host (já que não há pre-join)
          console.log('⚙️ [SimpleLiveKitRoom] Definindo preJoinChoices padrão para host');
          setPreJoinChoices({
            username: userName,
            videoEnabled: true,
            audioEnabled: true
          });
          console.log('✅ [SimpleLiveKitRoom] PreJoinChoices definido:', {
            username: userName,
            videoEnabled: true,
            audioEnabled: true
          });
          
          setShowPreJoin(false);
          
          // --- Skill Activation Logic ---
          const skillParam = searchParams.get('skill');
          if (skillParam) {
            console.log('🔮 [SimpleLiveKitRoom] Skill detectada na URL:', skillParam);
            
            // Check if there is already an active skill
            const { data: activeSkill } = await (supabase as any)
              .from('room_active_skills')
              .select('id')
              .eq('room_id', roomData.id)
              .maybeSingle();

            if (!activeSkill) {
              console.log('🚀 [SimpleLiveKitRoom] Ativando skill automática:', skillParam);
              await (supabase as any)
                .from('room_active_skills')
                .insert({
                  room_id: roomData.id,
                  skill_id: skillParam,
                  activated_by: userData?.user?.id
                });
            } else {
              console.log('ℹ️ [SimpleLiveKitRoom] Skill já está ativa na sala, ignorando parâmetro da URL');
            }
          }

          // Gerar token e entrar direto na sala
          console.log('🎫 [SimpleLiveKitRoom] Gerando token para host...');
          await generateToken(userName);
          setIsCheckingHost(false);
          
          console.log('✅ [SimpleLiveKitRoom] ✨ HOST (primeiro a entrar) na sala com sucesso!');
        } else {
          console.log('👥 [SimpleLiveKitRoom] NÃO é o primeiro - mostrando pre-join para guest');
          setIsHost(false);
          setIsCheckingHost(false);
          setShowPreJoin(true);
        }
      } catch (error) {
        console.error('❌ [SimpleLiveKitRoom] Erro ao verificar primeiro participante:', error);
        setError('Erro ao conectar com a sala');
        setIsCheckingHost(false);
      }
    };

    checkFirstParticipant();
  }, [roomName, participantName, toast]);

  // Clock update (Brasília time)
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const brasiliaTime = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(now);
      setCurrentTime(brasiliaTime);
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);
    
    return () => {
      clearInterval(interval);
      // Cleanup timeout de conexão
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
      }
    };
  }, []);

  // Meeting duration timer (1 hour limit)
  useEffect(() => {
    if (!showPreJoin && token && serverUrl) {
      const ONE_HOUR = 60 * 60 * 1000; // 1 hour in milliseconds
      
      meetingDurationTimerRef.current = setTimeout(() => {
        toast({
          title: "Reunião encerrada",
          description: "A reunião atingiu o limite de 1 hora e foi encerrada automaticamente",
          variant: "destructive",
        });
        handleLeaveClick();
      }, ONE_HOUR);

      return () => {
        if (meetingDurationTimerRef.current) {
          clearTimeout(meetingDurationTimerRef.current);
        }
      };
    }
  }, [showPreJoin, token, serverUrl]);

  // Enhanced connection management with better visibility handling
  useEffect(() => {
    let reconnectTimeout: NodeJS.Timeout;
    
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        if (reconnectTimeout) {
          clearTimeout(reconnectTimeout);
        }
        console.log('Page visible - maintaining stable connection');
      } else {
        console.log('Page hidden - connection maintained');
      }
    };

    const handleFocus = () => {
      console.log('Window focused - ensuring connection stability');
    };

    const handleBlur = () => {
      console.log('Window blurred - maintaining connection');
    };

    const preventDisconnect = (e: Event) => {
      e.preventDefault();
      return false;
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('beforeunload', preventDisconnect);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('beforeunload', preventDisconnect);
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, []);

  // Play connection sound on successful join
  useEffect(() => {
    if (!showPreJoin && token && serverUrl) {
      const audio = new Audio();
      audio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1hdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmEaAzuJzfPJdSgEJnzE8N+MSg0PVqrl7q9bGgtBluL0u2EaAzqIyvXEdCgEJnzE8N+NSg0PVqrl7q9bGgtBluL0u2EaAzqIyvXEdCgEJnzE8N+NSg0PVqvl7q9bGgtBluL0u2EaAzqIyvXEdCgEJnzE8N+NSg0PVqvl7q9bGgtBluL0u2EaAzqIyvXEdCgEJnzE8N+NSg0PVqvl7q9bGgtBluL0u2EaAzqIyvXEdCgEJnzE8N+NSg0PVqvl7q9bGgtBluL0u2EaAzqIyvXEdCgEJnzE8N+NSg0PVqvl7q5bGgtBluL0u2EaAzqIyvXEdCgEJnzE8N+NSg0PVqvl7q5bGgtBluL0u2EaAzqIyvXEdCgEJnzE8N+PSg0PVqvl7q5bGgtBluL0u2EaAzqIy';
      audio.play().catch(() => {
        console.log('Could not play connection sound');
      });
    }
  }, [showPreJoin, token, serverUrl]);

  const generateToken = useCallback(async (username: string) => {
    try {
      console.log('🎫 [generateToken] Iniciando geração de token');
      console.log('📝 [generateToken] Sala:', roomName, 'Usuário:', username);
      
      setConnectingToRoom(true);
      setError('');
      setIsInitialConnection(true);
      setConnectionStable(false);

      const { data, error } = await supabase.functions.invoke('livekit-token', {
        body: {
          roomName,
          participantName: username
        }
      });

      if (error) {
        console.error('❌ [generateToken] Erro do Supabase:', error);
        throw new Error(error.message || 'Erro ao gerar token');
      }

      if (!data || !data.token || !data.url) {
        console.error('❌ [generateToken] Resposta inválida:', data);
        throw new Error('Resposta inválida do servidor');
      }

      const tokenData = data as TokenResponse;
      console.log('✅ [generateToken] Token gerado com sucesso');
      console.log('🌐 [generateToken] Server URL:', tokenData.url);

      // Validate URL before setting it
      let validUrl = tokenData.url.trim();
      if (!validUrl.startsWith('wss://') && !validUrl.startsWith('https://')) {
        validUrl = `wss://${validUrl}`;
      }
      
      try {
        new URL(validUrl);
      } catch {
        console.error('❌ [generateToken] URL inválida:', validUrl);
        throw new Error('URL do servidor LiveKit inválida. Verifique a configuração.');
      }

      setToken(tokenData.token);
      setServerUrl(validUrl);
      setConnectingToRoom(false);
      
      // Set timeout de segurança: se após 30 segundos não conectar, mostrar erro
      connectionTimeoutRef.current = setTimeout(() => {
        console.error('⏰ [generateToken] Timeout ao conectar - 30 segundos sem resposta');
        setError('Tempo de conexão esgotado. Tente novamente.');
        setToken('');
        setServerUrl('');
        setIsInitialConnection(false);
      console.error("Timeout de conexão");
      }, 30000);
      
      console.log('✅ [generateToken] Estados atualizados - pronto para conectar');
    } catch (err) {
      console.error('❌ [generateToken] Erro fatal:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro ao conectar na sala';
      setError(errorMessage);
      setConnectingToRoom(false);
      setIsInitialConnection(false);
      console.error('❌ Erro fatal:', errorMessage);
    }
  }, [roomName, toast]);


  const handlePreJoinSubmit = useCallback(async (values: any) => {
    console.log('✅ [PreJoin] === INÍCIO DO SUBMIT ===');
    console.log('✅ [PreJoin] Valores recebidos:', values);
    console.log('🆔 [PreJoin] Room ID atual:', currentRoomId);
    console.log('👤 [PreJoin] User ID:', user?.id || 'sem user');
    console.log('📝 [PreJoin] Participant name:', participantName);
    
    if (!currentRoomId) {
      console.error('❌ [PreJoin] ERRO CRÍTICO: currentRoomId está vazio!');
      console.error('❌ [PreJoin] Estado completo:', {
        currentRoomId,
        hasUser: !!user,
        roomName,
        showPreJoin
      });
      console.error("Sala não encontrada");
      return;
    }
    
    setPreJoinChoices(values);
    
    const finalUsername = values.username || participantName || 'Convidado';
    console.log('👤 [PreJoin] Nome final do convidado:', finalUsername);

    try {
      // Guest joining - create participant record and wait for approval
      const peerId = `peer_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      console.log('🔑 [PreJoin] Criando participante com peer_id:', peerId);
      console.log('📋 [PreJoin] Dados do insert:', {
        room_id: currentRoomId,
        user_id: user?.id || null,
        display_name: finalUsername,
        peer_id: peerId,
        is_host: false,
        connection_status: 'waiting',
        waiting_approval: true,
      });
      
      const { data: participantData, error: insertError } = await supabase
        .from('room_participants')
        .insert({
          room_id: currentRoomId,
          user_id: user?.id || null,
          display_name: finalUsername,
          peer_id: peerId,
          is_host: false,
          connection_status: 'waiting',
          waiting_approval: true,
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('❌ [PreJoin] Erro ao criar participante - DETALHES:', {
          error: insertError,
          message: insertError.message,
          details: insertError.details,
          hint: insertError.hint,
          code: insertError.code
        });
        toast({
          title: "Erro ao entrar",
          description: insertError.message || "Não foi possível entrar na sala. Tente novamente.",
          variant: "destructive",
        });
        return;
      }

      if (participantData) {
        console.log('✅ [PreJoin] Participante criado com sucesso:', participantData.id);
        setParticipantId(participantData.id);
        setIsWaitingApproval(true);
        setShowPreJoin(false);
        console.log('⏳ [PreJoin] Aguardando aprovação do anfitrião...');
        console.log('✅ [PreJoin] === FIM DO SUBMIT COM SUCESSO ===');
      }
    } catch (err) {
      console.error('❌ [PreJoin] Erro fatal capturado:', err);
      console.error('❌ [PreJoin] Tipo do erro:', typeof err);
      console.error('❌ [PreJoin] Stack:', (err as Error).stack);
      toast({
        title: "Erro inesperado",
        description: `Erro: ${(err as Error).message}`,
        variant: "destructive",
      });
    }
  }, [currentRoomId, participantName, user, toast]);

  const handleTranscriptionUpdate = useCallback((message: TranscriptionMessage) => {
    if (!message.is_final || !message.text?.trim()) return;

    const normalizedText = message.text.trim().toLowerCase().replace(/\s+/g, ' ');
    setTranscriptionMessages(prev => {
      const alreadyExists = prev.some(item =>
        item.is_final &&
        item.speaker === message.speaker &&
        item.text.trim().toLowerCase().replace(/\s+/g, ' ') === normalizedText
      );
      return alreadyExists ? prev : [...prev, { ...message, text: message.text.trim(), is_final: true }];
    });
  }, []);

  // Monitor Active Skill in the room
  useEffect(() => {
    if (!currentRoomId) return;

    const fetchActiveSkill = async () => {
      console.log('🔍 [SimpleLiveKitRoom] Buscando skill ativa para sala:', currentRoomId);
      const { data, error } = await supabase
        .from('room_active_skills')
        .select('skill_id')
        .eq('room_id', currentRoomId)
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        console.log('✅ [SimpleLiveKitRoom] Skill ativa encontrada:', data.skill_id);
        setActiveSkillId(data.skill_id);
      } else {
        setActiveSkillId(null);
      }
    };

    fetchActiveSkill();

    const channel = supabase
      .channel(`active-skill:${currentRoomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_active_skills',
          filter: `room_id=eq.${currentRoomId}`
        },
        () => {
          console.log('🔄 [SimpleLiveKitRoom] Mudança na skill ativa detectada');
          fetchActiveSkill();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentRoomId]);

  // Listen for recording consent requests via Realtime
  useEffect(() => {
    if (!currentRoomId || isHost) return; // Host doesn't need to see their own request

    const channel = supabase
      .channel(`recording-consent:${currentRoomId}`)
      .on(
        'broadcast',
        { event: 'recording-request' },
        () => {
          console.log('📢 Received recording consent request');
          setShowRecordingConsent(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentRoomId, isHost]);
  const checkAllConsents = async (): Promise<boolean> => {
    if (!currentRoomId) return false;

    // Get all participants in the room
    const { data: participants } = await supabase
      .from('room_participants')
      .select('id, display_name')
      .eq('room_id', currentRoomId)
      .is('left_at', null);

    if (!participants || participants.length === 0) return false;

    // Get all consents
    const { data: consents } = await supabase
      .from('recording_consents')
      .select('*')
      .eq('room_id', currentRoomId);

    // Check if all participants have consented
    const allConsented = participants.every(p => 
      consents?.some(c => c.participant_name === p.display_name && c.consented === true)
    );

    return allConsented;
  };

  const startRecordingDirectly = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('meeting-recording', {
        body: {
          action: 'start',
          roomName: roomName,
          userId: user?.id,
          companyId: companyId
        }
      });

      if (error) throw error;

       setIsRecording(true);
       setRecordingStatus('recording');
       setRecordingId(data.recording_id);
       setLivekitRecordingId(data.livekit_recording_id || '');
       setHadRecording(true);

      console.log("Gravação iniciada");
    } catch (error) {
      console.error('Erro ao iniciar gravação:', error);
      console.error("Erro ao iniciar gravação");
    }
  };

  const startRecording = async () => {
    if (!isHost) {
      console.warn("Apenas o anfitrião pode iniciar gravação");
      return;
    }

    console.log('🎥 Host starting recording directly (consent disabled)');
    await startRecordingDirectly();
  };

  const handleRecordingConsent = async () => {
    await supabase
      .from('recording_consents')
      .insert({
        room_id: currentRoomId,
        participant_name: participantName,
        consented: true,
      });

    setShowRecordingConsent(false);
  };

  const handleRecordingReject = async () => {
    await supabase
      .from('recording_consents')
      .insert({
        room_id: currentRoomId,
        participant_name: participantName,
        consented: false,
      });

    setShowRecordingConsent(false);

    // Notify host
    console.warn("Gravação negada");
  };

  const stopRecording = async () => {
    if (!recordingId) return;

    try {
       console.log('🔴 [stopRecording] Parando gravação...', { recordingId, livekitRecordingId });
       setIsProcessingRecording(true);
       setRecordingStatus('finalizing');
 
       console.log("Processando gravação...");

      const { data, error } = await supabase.functions.invoke('meeting-recording', {
        body: {
          action: 'stop',
          roomName: roomName,
          recordingId: recordingId,
          livekitRecordingId: livekitRecordingId
        }
      });

      if (error) {
        console.error('❌ [stopRecording] Erro:', error);
        throw error;
      }

      console.log('✅ [stopRecording] Gravação parada com sucesso:', data);

       setIsRecording(false);
       setRecordingStatus('idle');
       setRecordingId('');
       setLivekitRecordingId('');
       setIsProcessingRecording(false);

      console.log("Gravação salva!");
    } catch (error) {
      console.error('❌ [stopRecording] Erro ao parar gravação:', error);
      setIsProcessingRecording(false);
      toast({
        title: "Erro ao parar gravação",
        description: "Não foi possível finalizar a gravação",
        variant: "destructive",
      });
    }
  };

  const toggleRecording = async () => {
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  };

  const thoroughCleanup = useCallback(async (shouldExit = false) => {
    console.log('🧹 Iniciando limpeza completa de mídia...');
    
    // Stop transcription immediately
    setIsTranscribing(false);
    
    // Stop all media tracks explicitly
    try {
      // Stop via Room reference
      if (roomRef.current) {
        console.log('⏹️ Parando todas as tracks via Room...');
        
        roomRef.current.localParticipant.audioTrackPublications.forEach((pub) => {
          if (pub.track) {
            pub.track.stop();
            pub.track.mediaStreamTrack?.stop();
          }
        });
        
        // Stop all tracks (audio, video, screen share)
        roomRef.current.localParticipant.trackPublications.forEach((pub) => {
          try {
            if (pub.track) {
              console.log(`🔇 Parando track: ${pub.track.kind}`);
              pub.track.stop();
              if (pub.track.mediaStreamTrack) {
                pub.track.mediaStreamTrack.stop();
              }
            }
          } catch (e) {
            console.error('Erro ao parar track individual:', e);
          }
        });

        // Disconnect the Room explicitly with true to stop local tracks
        console.log('🔌 Desconectando Room...');
        await roomRef.current.disconnect(true);
        console.log('✅ Room desconectado');
        roomRef.current = null;
      }

      console.log('🔇 Cleanup de mídia concluído');
    } catch (error) {
      console.error('❌ Erro ao limpar mídia:', error);
    }

    // Mark room as inactive if host
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const { data: roomData } = await supabase
        .from('meeting_rooms')
        .select('created_by')
        .eq('room_code', roomName)
        .single();
      
      if (roomData && currentUser && roomData.created_by === currentUser.id) {
        await supabase
          .from('meeting_rooms')
          .update({ is_active: false, ended_at: new Date().toISOString() })
          .eq('room_code', roomName);
        console.log('👑 Sala marcada como inativa pelo host');
      }
    } catch (error) {
      console.error('❌ Erro ao atualizar sala:', error);
    }

    console.log("👋 Desconectado da sala");
    
    // Removido o redirecionamento automático para meet-hub aqui para permitir
    // que o anfitrião também veja a tela de agradecimento.
    // O redirecionamento será manual através do botão na tela de agradecimento.
  }, [onLeave, toast, roomName]);

  // Emergency cleanup on unmount
  useEffect(() => {
    return () => {
      if (roomRef.current) {
        console.log('🚮 SimpleLiveKitRoom unmounting - performing final room disconnect');
        roomRef.current.disconnect(true);
      }
    };
  }, []);

  const handleLeaveClick = async () => {
    console.log('🚪 Iniciando processo de saída...');
    
    // Stop transcription to kill AudioContexts in LiveKitAudioCapture
    setIsTranscribing(false);
    
    // Stop recording if active
    const wasRecording = isRecording && recordingId;
    if (isRecording && recordingId) {
      console.log('🔴 Parando gravação antes de sair...');
      setIsProcessingRecording(true);
      console.log("Finalizando gravação...");
      await stopRecording();
    }
    
    // Clear meeting duration timer
    if (meetingDurationTimerRef.current) {
      clearTimeout(meetingDurationTimerRef.current);
    }
    
    // Auto-save meeting before leaving (only for host)
    if (isHost && transcriptionMessages.length > 0) {
      console.log('💾 Auto-salvando reunião...');
      const savedId = await autoSaveMeeting();
      if (savedId) setLastSavedMeetingId(savedId);
    }
    
    // Wait a bit if recording was just stopped, to let LiveKit Egress flush the file
    if (wasRecording) {
      console.log('⏳ Aguardando finalização da gravação (5s)...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      setIsProcessingRecording(false);
    }
    
     // Se for host, notificar todos os outros que a sala está fechando
     if (isHost && roomRef.current?.localParticipant) {
       try {
         const payload = new TextEncoder().encode(JSON.stringify({ type: 'room_closed' }));
         await roomRef.current.localParticipant.publishData(payload, { reliable: true });
         console.log('📡 [handleLeaveClick] Notificação de fechamento enviada para todos');
       } catch (e) {
         console.error('❌ [handleLeaveClick] Erro ao notificar fechamento:', e);
       }
     }
 
     // Force cleanup and leave (bypasses connection stability guards)
     // All participants see the thank you screen
     setShowThankYou(true);
     await thoroughCleanup(isHost);
   };

  // Auto-save meeting function
  const autoSaveMeeting = async () => {
    try {
      if (!companyId || !user?.id || !currentRoomId) {
        console.log('⚠️ Sem companyId, user.id ou currentRoomId, não é possível salvar');
        return;
      }

      // Only persist FINAL transcriptions (skip provisional/interim)
      const finalMessages = transcriptionMessages.filter(msg => msg.is_final);

      if (finalMessages.length === 0) {
        console.log('⚠️ Nenhuma transcrição final para salvar');
        return;
      }

      console.log('💾 Salvando reunião automaticamente com', finalMessages.length, 'mensagens finais...');

      // Concatenate all transcription messages
      const fullTranscript = finalMessages
        .map(msg => `[${msg.timestamp}] ${msg.speaker}: ${msg.text}`)
        .join('\n\n');

      console.log('📝 Transcrição completa:', fullTranscript.substring(0, 200) + '...');

      // Get participant count
      const { data: participantsData } = await (supabase as any)
        .from('room_participants')
        .select('id', { count: 'exact' })
        .eq('room_id', currentRoomId);
      
      const participantCount = participantsData?.length || 0;

      // Save to meeting_recordings (LiveKit meeting = online)
      const { data, error } = await (supabase as any)
        .from('meeting_recordings')
        .insert({
          title: `Reunião ${roomName} - ${new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })} ${new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
          transcript: fullTranscript,
          company_id: companyId,
          created_by: user.id,
          room_id: currentRoomId,
          file_url: '',
          meeting_type: 'online',
          participant_count: participantCount,
          skill_id: activeSkillId,
          skill_feedback: skillFeedbacks.join('\n'),
          meeting_metadata: {
            elapsed_time: elapsedTime,
            total_participants_detected: participantCount,
            active_skill: activeSkillId,
            end_time: new Date().toISOString()
          },
          transcript_with_timestamps: finalMessages.map(msg => ({
            timestamp: msg.timestamp,
            speaker: msg.speaker,
            text: msg.text,
            is_final: msg.is_final
          })) as any,
          duration_seconds: Math.floor((Date.now() - Date.parse(finalMessages[0]?.timestamp || new Date().toISOString())) / 1000)
        })
        .select()
        .single();

       if (error) {
         console.error('❌ Erro do Supabase ao salvar:', error);
         throw error;
       }
 
       console.log('✅ Reunião salva automaticamente:', data.id);
       return data.id;
    } catch (error) {
      console.error('❌ Erro ao salvar reunião:', error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar a reunião automaticamente. Use 'Recuperar Reunião'.",
        variant: "destructive"
      });
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar a reunião automaticamente.",
        variant: "destructive",
      });
    }
  };
  
  const handleDisconnected = useCallback(async () => {
    console.log('🔴 [handleDisconnected] === DESCONEXÃO DETECTADA ===');
    console.log('🔍 [handleDisconnected] Estado da conexão:', {
      isInitialConnection,
      connectionStable,
      livekitConnectedAt,
      timeSinceConnect: livekitConnectedAt > 0 ? Date.now() - livekitConnectedAt : 0
    });
    
    // PROTEÇÃO CRÍTICA: Ignorar TODAS as desconexões nos primeiros 30 segundos
    if (livekitConnectedAt > 0) {
      const connectionTime = Date.now() - livekitConnectedAt;
      console.log('⏱️ [handleDisconnected] Tempo desde conexão:', connectionTime, 'ms');
      
      if (connectionTime < 30000) {
        console.warn('🛡️ [handleDisconnected] BLOQUEADO - Desconexão nos primeiros 30 segundos!');
        console.log('🛡️ [handleDisconnected] Ignorando para prevenir desconexão prematura');
        console.log('🔄 [handleDisconnected] Conexão será mantida para estabilização');
        console.log("Estabilizando conexão...");
        return;
      }
    }
    
    // Proteção extra: se for o host, adicionar mais validação
    if (isHost && livekitConnectedAt > 0) {
      const connectionTime = Date.now() - livekitConnectedAt;
      if (connectionTime < 45000) {
        console.warn('👑 [handleDisconnected] HOST BLOQUEADO - Desconexão nos primeiros 45 segundos!');
        console.log('🛡️ [handleDisconnected] Hosts precisam de mais tempo para estabilizar');
        toast({
          title: "Estabilizando como anfitrião...",
          description: "Configurando a sala para você",
        });
        return;
      }
    }
    
    // Se não há timestamp de conexão mas ainda está inicial, também ignorar
    if (isInitialConnection || !connectionStable) {
      console.warn('🛡️ [handleDisconnected] BLOQUEADO - Conexão ainda não estável!');
      toast({
        title: "Conectando...",
        description: "Estabelecendo conexão com a sala...",
      });
      return;
    }
    
    console.log('✅ [handleDisconnected] Desconexão válida após conexão estável, processando saída...');
    
    // Stop all local media tracks before leaving using the thorough cleanup
    await thoroughCleanup(false);
    
    const audio = new Audio();
    audio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmEaAzuJzfPJdSgEJnzE8N+MSg0PVqrl7q9bGgtBluL0u2EaAzqIyvXEdCgEJnzE8N+NSg0PVqrl7q9bGgtBluL0u2EaAzqIyvXEdCgEJnzE8N+NSg0PVqvl7q9bGgtBluL0u2EaAzqIyvXEdCgEJnzE8N+NSg0PVqvl7q9bGgtBluL0u2EaAzqIyvXEdCgEJnzE8N+NSg0PVqvl7q9bGgtBluL0u2EaAzqIyvXEdCgEJnzE8N+NSg0PVqvl7q9bGgtBluL0u2EaAzqIyvXEdCgEJnzE8N+NSg0PVqvl7q5bGgtBluL0u2EaAzqIyvXEdCgEJnzE8N+NSg0PVqvl7q5bGgtBluL0u2EaAzqIyvXEdCgEJnzE8N+NSg0PVqvl7q5bGgtBluL0u2EaAzqIyvXEdCgEJnzE8N+NSg0PVqvl7q5bGgtBluL0u2EaAzqIyvXEdCgEJnzE8N+NSg0PVqvl7q5bGgtBluL0u2EaAzqIyvXEdCgEJnzE8N+NSg0PVqvl7q5bGgtBluL0u2EaAzqIyvXEdCgEJnzE8N+NSg0PVqvl7q5bGgtBluL0u2EaAzqIyvXEdCgEJnzE8N+NSg0PVqvl7q5bGgtBluL0u2EaAzqIyvXEdCgEJnzE8N+NSg0PVqvl7q5bGgtBluL0u2EaAzqIy';
    audio.play().catch(() => {
      console.log('Could not play disconnect sound');
    });
    
    toast({
      title: "Desconectado",
      description: "Você saiu da sala de reunião",
    });
    
    setTimeout(() => {
      if (isHost) {
        console.log('🚪 [handleDisconnected] Host → navegando para meet-hub');
        onLeave();
      } else {
        console.log('🙏 [handleDisconnected] Guest → exibindo tela de agradecimento');
        setShowThankYou(true);
      }
    }, 500);
  }, [onLeave, toast, roomName, livekitConnectedAt, isHost]);

  const handleError = useCallback((error: Error) => {
    console.error('🚨 [handleError] LiveKit error:', error);
    console.log('🔍 [handleError] Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    
    // Detectar erros de dispositivo não disponível
    const isDeviceError = 
      error.message.toLowerCase().includes('device') ||
      error.message.toLowerCase().includes('dispositivo') ||
      error.message.toLowerCase().includes('not found') ||
      error.message.toLowerCase().includes('não encontrado') ||
      error.name === 'NotFoundError' ||
      error.name === 'DevicesNotFoundError';
    
    if (isDeviceError) {
      console.warn('⚠️ [handleError] Erro de dispositivo detectado - abrindo configurações');
      setShowDeviceSettings(true);
      console.warn("Dispositivo não encontrado");
      return;
    }
    
    // Detectar erros de permissão - ESTES NÃO SÃO FATAIS!
    const isPermissionError = 
      error.name === 'NotAllowedError' ||
      error.name === 'PermissionDeniedError' ||
      error.message.toLowerCase().includes('permission') ||
      error.message.toLowerCase().includes('denied') ||
      error.message.toLowerCase().includes('camera') ||
      error.message.toLowerCase().includes('microphone') ||
      error.message.toLowerCase().includes('mic') ||
      error.message.toLowerCase().includes('video');
    
    if (isPermissionError) {
      console.warn('⚠️ [handleError] Erro de permissão detectado - tratando como não-fatal');
      console.log('✅ [handleError] Permitindo reunião continuar sem mídia');
      setShowDeviceSettings(true);
      console.warn("Sem acesso a câmera/microfone");
      // NÃO chamar setError() - deixar a reunião continuar
      return;
    }
    
    // Para outros erros, manter comportamento original (erro fatal)
    console.error('❌ [handleError] Erro fatal detectado - mostrando tela de erro');
    setError(error.message);
    console.error("Erro na chamada:", error.message);
  }, [toast]);

  // ========== MOVER TODOS OS HOOKS PARA ANTES DOS EARLY RETURNS ==========
  const handleApprovalGranted = useCallback(async () => {
    console.log('✅ [handleApprovalGranted] Participante aprovado! Gerando token...');
    setIsWaitingApproval(false);
    const finalUsername = preJoinChoices?.username || participantName || 'Convidado';
    console.log('👤 [handleApprovalGranted] Nome do usuário:', finalUsername);
    await generateToken(finalUsername);
    console.log('✅ [handleApprovalGranted] Token gerado, entrando na sala...');
  }, [preJoinChoices, participantName, generateToken]);

  const handleApprovalRejected = useCallback(() => {
    console.error("Acesso negado");
    setTimeout(() => onLeave(), 2000);
  }, [toast, onLeave]);
  // ========================================================================

  console.log('🎬 [Render] Estados atuais:', {
    showPreJoin,
    isHost,
    isWaitingApproval,
    connectingToRoom,
    hasToken: !!token,
    hasServerUrl: !!serverUrl,
    isCheckingHost
  });

  // Fetch the meeting recording ID for guests or if not saved yet
  useEffect(() => {
    if (showThankYou && !lastSavedMeetingId && currentRoomId) {
      const fetchLastMeetingId = async () => {
        const { data } = await supabase
          .from('meeting_recordings')
          .select('id')
          .eq('room_id', currentRoomId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (data) {
          setLastSavedMeetingId(data.id);
        }
      };
      fetchLastMeetingId();
    }
  }, [showThankYou, lastSavedMeetingId, currentRoomId]);

   const handleDownloadPDF = async () => {
     const finalMessages = transcriptionMessages.filter(m => m.is_final);
     if (finalMessages.length === 0) {
       toast({
         title: "Sem transcrição",
         description: "Não há mensagens para gerar a transcrição.",
         variant: "destructive"
       });
       return;
     }
 
     try {
       const { buildBrandedTranscriptPdf } = await import('@/utils/brandedTranscriptPdf');
       const ordered = [...finalMessages].sort(
         (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
       );
       const fullTranscript = ordered
         .map(msg => `[${new Date(msg.timestamp).toLocaleTimeString('pt-BR')}] ${msg.speaker || 'Participante'}: ${msg.text}`)
         .join('\n\n');

       const doc = await buildBrandedTranscriptPdf({
         title: 'Transcrição da Reunião',
         roomName,
         body: fullTranscript,
         subtitle: `Reunião: ${roomName} · ${ordered.length} trecho${ordered.length !== 1 ? 's' : ''}`,
       });
       doc.save(`transcricao-${roomName}-${Date.now()}.pdf`);
       toast({ title: "Download iniciado", description: "O PDF da transcrição está sendo gerado." });
     } catch (error) {
       console.error('Erro ao gerar PDF:', error);
       toast({ title: "Erro no download", description: "Não foi possível gerar o PDF.", variant: "destructive" });
     }
   };
 
  // Show loading while checking host status
  if (isCheckingHost) {
    console.log('🔄 [Render] Mostrando tela de verificação de acesso');
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6" style={{ background: '#0f172a' }}>
        <img src={logoEllo} alt="ElloSuit" className="h-16 w-auto mb-4" />
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-[#374DA4]" />
          <p className="text-lg text-white font-medium">Entrando na reunião...</p>
          <p className="text-sm text-slate-400">Verificando credenciais</p>
        </div>
      </div>
    );
  }

  if (showThankYou) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center px-6 relative overflow-hidden" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
        {/* Subtle background glow */}
        <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-[#2F428D]/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] bg-purple-600/10 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-20 items-center z-10">
          {/* Left Column: Branding and Main Message */}
          <div className="flex flex-col items-start text-left space-y-8">
            <img src={logoEllo} alt="ElloMeeting" className="h-10 w-auto opacity-90" />
            
            <div className="space-y-6">
              <h1 className="text-5xl md:text-7xl font-bold text-white tracking-tight leading-[1.1]">
                Obrigado pela<br />reunião!
              </h1>
              <p className="text-xl text-zinc-400 font-light max-w-sm leading-relaxed">
                Sua sessão foi encerrada com sucesso. Tudo foi salvo no seu hub.
              </p>
            </div>

            <button
              onClick={() => window.location.href = '/meet-hub'}
              className="group flex items-center gap-2 text-zinc-500 hover:text-zinc-300 transition-colors text-sm font-medium pt-4"
            >
              <svg className="w-4 h-4 transform group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              voltar ao meet hub
            </button>
          </div>

          {/* Right Column: Actions */}
          <div className="flex flex-col gap-6">
           {/* Transcript Block - Only show if there are messages */}
           {transcriptionMessages.length > 0 && (
             <div className="p-8 rounded-[2rem] bg-zinc-900/40 border border-zinc-800/50 backdrop-blur-sm hover:border-zinc-700/50 transition-all group">
               <div className="flex items-center justify-between mb-8">
                 <div className="w-12 h-12 rounded-2xl bg-[#374DA4]/10 flex items-center justify-center">
                   <FileText className="w-6 h-6 text-[#5A74D1]" />
                 </div>
                 <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Registro</span>
               </div>
               <h3 className="text-2xl font-semibold text-white mb-2">Transcrição</h3>
               <p className="text-zinc-400 text-sm mb-8 leading-relaxed font-light">
                 Baixe o PDF com o registro textual completo e timestamps da sua conversa.
               </p>
               <button
                 onClick={handleDownloadPDF}
                 className="w-full py-4 rounded-2xl bg-white text-black font-bold hover:bg-zinc-200 transition-all flex items-center justify-center gap-2 shadow-xl shadow-white/5 active:scale-[0.98]"
               >
                 <Download className="w-5 h-5" />
                 Baixar Transcrição
               </button>
             </div>
           )}

            {/* Recording Block - Only show if there is a potential recording or meeting ID */}
            {(hadRecording || isRecording || lastSavedMeetingId) && (
              <div className="p-8 rounded-[2rem] bg-zinc-900/40 border border-zinc-800/50 backdrop-blur-sm hover:border-zinc-700/50 transition-all group">
                <div className="flex items-center justify-between mb-8">
                  <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center">
                    <PlayCircle className="w-6 h-6 text-purple-400" />
                  </div>
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Multimídia</span>
                </div>
                <h3 className="text-2xl font-semibold text-white mb-2">Gravação</h3>
                <p className="text-zinc-400 text-sm mb-8 leading-relaxed font-light">
                  Assista ao vídeo e áudio da sessão diretamente no histórico do Meet Hub.
                </p>
                <button
                  onClick={() => setShowRecordingModal(true)}
                  className="w-full py-4 rounded-2xl bg-zinc-800/80 text-white font-bold hover:bg-zinc-700 transition-all flex items-center justify-center gap-2 border border-zinc-700 active:scale-[0.98]"
                >
                  <PlayCircle className="w-5 h-5" />
                  {recordingStatus === 'processing' || recordingStatus === 'finalizing' ? 'Processando Gravação...' : 'Ver Gravação'}
                </button>
              </div>
            )}
          </div>
        </div>

        <MeetingRecordingModal 
          isOpen={showRecordingModal}
          onClose={() => setShowRecordingModal(false)}
          meetingId={lastSavedMeetingId}
          roomId={currentRoomId}
        />

        {/* Footer branding */}
        <div className="absolute bottom-10 left-6 md:left-auto flex items-center gap-3 text-zinc-700">
          <div className="w-8 h-[1px] bg-zinc-800" />
          <span className="text-[10px] tracking-[0.3em] uppercase font-bold">ellosuit.online</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6" style={{ background: '#0f172a' }}>
        <img src={logoEllo} alt="ElloSuit" className="h-16 w-auto mb-4" />
        <div className="flex flex-col items-center gap-4 text-center px-6">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
            <svg className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.072 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <p className="text-xl text-white font-semibold">{error}</p>
          <p className="text-sm text-slate-400">A reunião pode ter sido encerrada ou o link está incorreto.</p>
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 bg-[#2F428D] hover:bg-[#253573] text-white rounded-lg text-sm font-medium transition-colors"
            >
              Tentar novamente
            </button>
            <button
              onClick={onLeave}
              className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Voltar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#101010', minHeight: '100vh', width: '100%' }}>
      {showPreJoin && !isHost ? (
        <ZoomPreJoin 
          roomName={roomName}
          participantName={participantName}
          onSubmit={handlePreJoinSubmit}
          onCancel={onLeave}
        />
      ) : isWaitingApproval ? (
        <WaitingRoomScreen
          roomName={roomName}
          participantId={participantId}
          onApproved={handleApprovalGranted}
          onRejected={handleApprovalRejected}
        />
      ) : connectingToRoom ? (
        <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-white text-lg font-medium">Entrando na reunião...</p>
            <p className="text-zinc-400 text-sm">Aguarde um momento</p>
          </div>
        </div>
      ) : token && serverUrl ? (
        <div style={{ backgroundColor: '#101010', minHeight: '100vh', width: '100%' }}>
           <LiveKitRoom
             video={preJoinChoices?.videoEnabled ?? false}
             audio={preJoinChoices?.audioEnabled ?? false}
             token={token}
             serverUrl={serverUrl}
             onDisconnected={handleDisconnected}
             onError={handleError}
             onMediaDeviceFailure={(error) => {
               console.warn('⚠️ [LiveKitRoom] Falha no dispositivo de mídia:', error);
               // Não bloqueia a entrada, apenas avisa
                console.warn('⚠️ Problema com dispositivos de mídia');
               setShowDeviceSettings(true);
             }}
            onConnected={() => {
              console.log('🟢 [LiveKitRoom] === CONECTADO COM SUCESSO ===');
              console.log('🎉 [LiveKitRoom] Token válido, sessão iniciada');
              console.log('🎬 [LiveKitRoom] Preferências de mídia:', {
                video: preJoinChoices?.videoEnabled ?? true,
                audio: preJoinChoices?.audioEnabled ?? true
              });
              const now = Date.now();
              setLivekitConnectedAt(now);
              
              // Marcar que não é mais conexão inicial
              console.log('✅ [LiveKitRoom] Marcando como não-inicial');
              setIsInitialConnection(false);
              
              // Limpar timeout de conexão se existir
              if (connectionTimeoutRef.current) {
                console.log('🔄 [LiveKitRoom] Limpando timeout de conexão');
                clearTimeout(connectionTimeoutRef.current);
                connectionTimeoutRef.current = undefined;
              }
              
              // Aguardar 10 segundos para marcar a conexão como estável (mais tempo para hosts)
              const stabilizationTime = isHost ? 10000 : 7000;
              console.log(`⏱️ [LiveKitRoom] Aguardando ${stabilizationTime/1000}s para estabilizar (${isHost ? 'HOST' : 'GUEST'})`);
              
              setTimeout(() => {
                console.log('✅ [LiveKitRoom] ⭐ CONEXÃO ESTABILIZADA - proteção ativa');
                setConnectionStable(true);
              }, stabilizationTime);
              
              // Mostrar aviso se entrou sem mídia
              console.log('🎬 [LiveKitRoom] Verificando status da mídia:', {
                videoEnabled: preJoinChoices?.videoEnabled,
                audioEnabled: preJoinChoices?.audioEnabled
              });
              
              console.log('✅ [LiveKitRoom] Conexão concluída sem notificações visuais');
            }}
          options={{
            adaptiveStream: true,
            disconnectOnPageLeave: false,
            publishDefaults: {
              simulcast: false,
              stopMicTrackOnMute: false,
              videoCodec: 'vp8',
            },
            reconnectPolicy: {
              nextRetryDelayInMs: (context) => {
                console.log('🔄 [LiveKitRoom] Tentando reconectar...', { 
                  tentativa: context.retryCount,
                  tempoDecorrido: context.elapsedMs,
                  isInitialConnection,
                  connectionStable,
                  isHost
                });
                
                // Durante a conexão inicial, tentar mais agressivamente
                if (isInitialConnection || !connectionStable) {
                  console.log('🔄 [LiveKitRoom] Conexão inicial - retry rápido (300ms)');
                  return 300;
                }
                
                // Se for o host, ser mais persistente
                if (isHost) {
                  console.log('👑 [LiveKitRoom] Host - retry persistente');
                  return 500;
                }
                
                // Após estabilizado, usar política normal
                if (context.elapsedMs < 10_000) {
                  return 1000;
                }
                return Math.min(context.retryCount * 2000, 10000);
              },
            },
          }}
        >
          <RoomContextCapture onRoomReady={(room) => {
            console.log('Room ready:', room.name);
            roomRef.current = room;
          }} />
          <RoomAudioRenderer />
          <AudioDevicePersistence />
          
          {/* Local Audio Capture for Real-time Transcription */}
          <LiveKitAudioCapture 
            isActive={isTranscribing}
            roomName={roomName}
            onTranscriptionUpdate={handleTranscriptionUpdate}
          />
          
          {/* Waiting Room Approval Panel (for hosts) */}
          {!isMobile && isHost && (
            <WaitingRoomApproval
              roomId={currentRoomId}
              isHost={isHost}
            />
          )}

           {isMobile ? (
           <MobileMeetingLayout
             roomName={roomName}
             onLeave={handleLeaveClick}
             onShareMeeting={() => setShowShareModal(true)}
             onToggleRecording={toggleRecording}
             isRecording={isRecording}
             recordingStatus={recordingStatus}
             elapsedTime={elapsedTime}
             activeSkillId={activeSkillId}
             skillActivationIdentity={skillActivationIdentity}
             onToggleSkills={() => setShowSkillsModal(true)}
           />
          ) : (
            <>
               {/* Recording Status Overlay */}
               <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] pointer-events-none">
                 <div className="flex flex-col gap-2 items-center">
                   {recordingStatus === 'recording' && (
                     <div className="flex items-center gap-2 bg-red-500/90 backdrop-blur-md text-white px-4 py-1.5 rounded-full shadow-[0_0_20px_rgba(239,68,68,0.3)] animate-pulse">
                       <div className="w-2.5 h-2.5 bg-white rounded-full" />
                       <span className="text-xs font-bold uppercase tracking-widest">Gravando</span>
                     </div>
                   )}
                   {recordingStatus === 'finalizing' && (
                     <div className="flex items-center gap-2 bg-amber-500/90 backdrop-blur-md text-white px-4 py-1.5 rounded-full shadow-[0_0_20px_rgba(245,158,11,0.3)]">
                       <div className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full" />
                       <span className="text-xs font-bold uppercase tracking-widest">Finalizando...</span>
                     </div>
                   )}
                   {recordingStatus === 'processing' && (
                     <div className="flex items-center gap-2 bg-[#374DA4]/90 backdrop-blur-md text-white px-4 py-1.5 rounded-full shadow-[0_0_20px_rgba(59,130,246,0.3)]">
                       <div className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full" />
                       <span className="text-xs font-bold uppercase tracking-widest">Processando...</span>
                     </div>
                   )}
                 </div>
               </div>

              {pendingRecordingRequest && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
                  <div className="bg-white p-8 rounded-xl shadow-2xl max-w-md w-full mx-4 text-center">
                    <div className="mb-4">
                      <div className="mx-auto w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                        <div className="w-8 h-8 bg-red-600 rounded-full animate-pulse" />
                      </div>
                    </div>
                    <h3 className="text-xl font-semibold mb-2 text-foreground">Aguardando consentimento...</h3>
                    <p className="text-muted-foreground">
                      Aguardando todos os participantes concordarem com a gravação da reunião.
                    </p>
                  </div>
                </div>
              )}

              {/* Meeting Layout - Clean and Simple */}
           <RoomEventsListener 
             onRoomClosed={() => setShowThankYou(true)} 
             isHost={isHost} 
           />
           <MeetingLayout
             roomName={roomName}
                companyId={companyId}
                participantName={participantName}
                activeTab={activeTab}
                transcriptionMessages={transcriptionMessages}
                isTranscribing={isTranscribing}
                isHost={isHost}
                onTabChange={setActiveTab}
                onTranscriptionMessagesUpdate={setTranscriptionMessages}
                onLeave={handleLeaveClick}
                onDeviceSettings={() => setShowDeviceSettings(true)}
                onTranscriptionToggle={() => {
                  setIsTranscribing(!isTranscribing);
                  console.log(isTranscribing ? "Transcrição pausada" : "Transcrição iniciada");
                }}
                onShareMeeting={() => setShowShareModal(true)}
                onTranscriptionClick={() => setShowTranscriptionModal(true)}
                onVolumeChange={handleVolumeChange}
                onLocalMicVolumeChange={handleLocalMicVolumeChange}
                participantVolumes={participantVolumes}
                localMicVolume={localMicVolume}
                meetingControlsRef={meetingControlsRef}
                onToggleSkills={() => setShowSkillsModal(true)}
                onToggleRecording={toggleRecording}
                isRecording={isRecording}
                recordingStatus={recordingStatus}
                activeSkillId={activeSkillId}
                advisorMessage={advisorMessage}
                onCloseAdvisor={() => setAdvisorMessage(null)}
              />

               {/* AI Skills Modals and Chat - Only for host */}
               {isHost && (
                 <>
                   <MeetingSkillsModal
                     isOpen={showSkillsModal}
                     onClose={() => setShowSkillsModal(false)}
                     roomId={currentRoomId}
                     companyId={companyId}
                      onSkillActivated={(id) => setActiveSkillId(id)}
                   />
 
                 </>
               )}
              
              {/* Modals */}
              <DeviceSettingsModal
                isOpen={showDeviceSettings}
                onClose={() => setShowDeviceSettings(false)}
                companyId={companyId}
              />

              <TranscriptionModal
                isOpen={showTranscriptionModal}
                onClose={() => setShowTranscriptionModal(false)}
                messages={transcriptionMessages}
                isActive={isTranscribing}
              />

              <WhiteboardCanvas
                isOpen={showWhiteboard}
                onClose={() => setShowWhiteboard(false)}
                backgroundColor={whiteboardBgColor}
              />
            </>
          )}

          <ShareMeetingModal
            isOpen={showShareModal}
            onClose={() => setShowShareModal(false)}
            roomName={roomName}
          />

          <InviteModal
            isOpen={showInviteModal}
            onClose={() => setShowInviteModal(false)}
            meetingLink={APP_CONFIG.getMeetingUrl(roomName)}
          />

          <RecordingConsentDialog
            isOpen={showRecordingConsent}
            onConsent={handleRecordingConsent}
            onReject={handleRecordingReject}
            roomId={currentRoomId}
            participantName={participantName}
          />
        </LiveKitRoom>
        </div>
      ) : null}
    </div>
  );
};

export default SimpleLiveKitRoom;
