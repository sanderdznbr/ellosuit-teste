import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Mic, MicOff, Video, VideoOff, Monitor, MonitorOff, 
    Phone, PhoneOff, MessageSquare, Users, Settings, ChevronLeft, ChevronRight,
    Send, MoreVertical, Copy, Volume2, VolumeX, Camera, CameraOff, Brain, Sparkles, Target, Heart, Shield, Zap, Briefcase, Plus, Check, Info, X, Activity
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import ellosuitLogo from '@/assets/ellosuit-logo.png';
import DeviceSettings from './DeviceSettings';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface ChatMessage {
  id: string;
  message: string;
  timestamp: string;
  senderName: string;
}

interface VideoParticipant {
  id: string;
  peerId: string;
  displayName: string;
  isHost: boolean;
  audioEnabled: boolean;
  videoEnabled: boolean;
  stream: MediaStream | null;
}

interface SortableVideoProps {
  participant: VideoParticipant;
  videoRef: React.RefObject<HTMLVideoElement>;
  isMainView?: boolean;
}

// Componente SortableVideo 
const SortableVideo: React.FC<SortableVideoProps> = ({ participant, videoRef, isMainView = false }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: participant.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1000 : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`
        relative bg-gray-900 rounded-lg overflow-hidden cursor-move
        ${isMainView ? 'w-full aspect-video max-h-[60vh]' : 'aspect-video'}
        ${isDragging ? 'shadow-2xl scale-105' : ''}
        transition-all duration-200
      `}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={participant.id === 'local'}
        className="w-full h-full object-cover"
      />
      
      {/* Nome e status */}
      <div className="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-sm flex items-center gap-2">
        <span>{participant.displayName}{participant.id === 'local' ? ' (Você)' : ''}</span>
        {!participant.audioEnabled && <MicOff className="h-3 w-3" />}
        {!participant.videoEnabled && <VideoOff className="h-3 w-3" />}
      </div>
      
      {/* Overlay quando vídeo está desativado */}
      {!participant.videoEnabled && (
        <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
          <div className="text-center text-white">
            <div className="w-16 h-16 bg-gray-600 rounded-full flex items-center justify-center mx-auto mb-2">
              <span className="text-2xl font-bold">
                {participant.displayName.charAt(0).toUpperCase()}
              </span>
            </div>
            <p className="text-sm">{participant.displayName}</p>
          </div>
        </div>
      )}
    </div>
  );
};

const MeetingRoom = () => {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const code = (roomCode as string)?.toUpperCase();

  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [room, setRoom] = useState<any>(null);
  const [participants, setParticipants] = useState<VideoParticipant[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peerConnections, setPeerConnections] = useState<Map<string, RTCPeerConnection>>(new Map());
  const [showNamePrompt, setShowNamePrompt] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [myPeerId, setMyPeerId] = useState<string | null>(null);
  const [speakingParticipants, setSpeakingParticipants] = useState<Set<string>>(new Set());
  const [videoOrder, setVideoOrder] = useState<string[]>([]);
  const [showChat, setShowChat] = useState(false);
  const [showSkills, setShowSkills] = useState(false);
  const [showSkillsSelection, setShowSkillsSelection] = useState(false);
  const [skillSelectionPage, setSkillSelectionPage] = useState(0);
   const [activeSkills, setActiveSkills] = useState<string[]>([]);
   const [initialSkillActivated, setInitialSkillActivated] = useState(false);
   const [insights, setInsights] = useState<{ id: string, skill: string, text: string, type: 'summary' | 'key-point' | 'recommendation', time: string }[]>([]);
   const [advisorMessage, setAdvisorMessage] = useState<{ skill: string, text: string } | null>(null);
  const [heartbeatInterval, setHeartbeatInterval] = useState<NodeJS.Timeout | null>(null);
  const [realtimeChannel, setRealtimeChannel] = useState<any>(null);
  const [participantsChannel, setParticipantsChannel] = useState<any>(null);
  const [iceCandidateQueue, setIceCandidateQueue] = useState<Map<string, RTCIceCandidateInit[]>>(new Map());
  const [showAudioPrompt, setShowAudioPrompt] = useState(false);
  const [realtimeReady, setRealtimeReady] = useState(false);
  const [iceConfig, setIceConfig] = useState<{ iceServers: RTCIceServer[] }>({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  });

  const isOwner = user?.id === room?.created_by;

  // Refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRefsMapRef = useRef<Record<string, React.RefObject<HTMLVideoElement>>>({});
  
  const getRemoteVideoRef = useCallback((peerId: string) => {
    if (!remoteVideoRefsMapRef.current[peerId]) {
      remoteVideoRefsMapRef.current[peerId] = React.createRef<HTMLVideoElement>();
    }
    return remoteVideoRefsMapRef.current[peerId];
  }, []);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // VAD setup
  const setupVAD = useCallback((stream: MediaStream) => {
    try {
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      
      analyser.fftSize = 256;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      const detectSpeaking = () => {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;
        const isSpeaking = average > 30 && isAudioEnabled;
        
        setSpeakingParticipants(prev => {
          const newSet = new Set(prev);
          if (isSpeaking) {
            newSet.add('local');
          } else {
            newSet.delete('local');
          }
          return newSet;
        });
      };
      
      const interval = setInterval(detectSpeaking, 100);
      return () => {
        clearInterval(interval);
        audioContext.close();
      };
    } catch (error) {
      console.error('Error setting up VAD:', error);
    }
  }, [isAudioEnabled]);

  // Auto join for room creator or when name is provided in URL
  useEffect(() => {
    if (user && room) {
      const urlParams = new URLSearchParams(window.location.search);
      const nameFromUrl = urlParams.get('name');
      const skillFromUrl = urlParams.get('skill');
      
      if (nameFromUrl) {
        // Guest joining with name from URL
        joinMeeting(nameFromUrl);
      } else if (user.id === room.created_by && showNamePrompt) {
        // Host auto-joining
        joinMeeting(user.user_metadata?.username || user.email?.split('@')[0] || 'Anfitrião');
      }

      // Auto-activate skill if provided in URL, not already activated and IS OWNER
      if (skillFromUrl && !initialSkillActivated && isOwner) {
        console.log('🤖 Auto-activating skill from URL:', skillFromUrl);
        callSkill(skillFromUrl);
        setInitialSkillActivated(true);
        // Open skills panel to show it's active
        setShowSkills(true);
      }
    }
  }, [user, room, showNamePrompt]);

  // Fetch room info
  useEffect(() => {
    const fetchRoom = async () => {
      if (!code) return;
      
      try {
        const { data, error } = await supabase
          .from('meeting_rooms')
          .select('*')
          .eq('room_code', code)
          .eq('is_active', true)
          .single();
        
        if (error || !data) {
          toast({
            title: "Sala não encontrada",
            description: "Esta sala não existe ou foi encerrada",
            variant: "destructive",
          });
          navigate('/dashboard/reunioes');
          return;
        }
        
        setRoom(data);
      } catch (error) {
        console.error('Error fetching room:', error);
      }
    };
    
    fetchRoom();
  }, [code, navigate, toast]);

  // Setup real-time participants subscription
  useEffect(() => {
    if (!room?.id || !isConnected) return;

    console.log('🔔 Setting up participants subscription for room:', room.id);
    
    const channel = supabase
      .channel(`participants_${room.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'room_participants',
          filter: `room_id=eq.${room.id}`,
        },
        (payload) => {
          console.log('👤 New participant added:', payload.new);
          const newParticipant = payload.new as any;
          
          // Skip our own participant
          if (newParticipant.peer_id === myPeerId) return;
          
          setParticipants(prev => [
            ...prev.filter(p => p.peerId !== newParticipant.peer_id),
            {
              id: newParticipant.id,
              peerId: newParticipant.peer_id,
              displayName: newParticipant.display_name,
              isHost: newParticipant.is_host,
              audioEnabled: true,
              videoEnabled: true,  
              stream: null
            }
          ]);

          // Create peer connection for new participant and send offer if we have local stream
          if (localStream && realtimeChannel) {
            console.log('🤝 Creating peer connection and sending offer to new participant:', newParticipant.peer_id);
            createPeerConnectionAndOffer(newParticipant.peer_id);
          }

          toast({
            title: "Participante entrou",
            description: `${newParticipant.display_name} entrou na reunião`,
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'room_participants',
          filter: `room_id=eq.${room.id}`,
        },
        (payload) => {
          console.log('📝 Participant updated:', payload.new);
          const updatedParticipant = payload.new as any;
          
          // If participant left
          if (updatedParticipant.left_at && updatedParticipant.peer_id !== myPeerId) {
            console.log('👋 Participant left:', updatedParticipant.display_name);
            
            setParticipants(prev => prev.filter(p => p.peerId !== updatedParticipant.peer_id));
            
            // Clean up peer connection
            const pc = peerConnections.get(updatedParticipant.peer_id);
            if (pc) {
              pc.close();
              setPeerConnections(prev => {
                const newMap = new Map(prev);
                newMap.delete(updatedParticipant.peer_id);
                return newMap;
              });
            }
            
            toast({
              title: "Participante saiu",
              description: `${updatedParticipant.display_name} saiu da reunião`,
            });
          }
        }
      )
      .subscribe();

    setParticipantsChannel(channel);

    return () => {
      console.log('🧹 Cleaning up participants subscription');
      supabase.removeChannel(channel);  
    };
  }, [room?.id, isConnected, myPeerId, localStream, realtimeChannel, peerConnections]);

  const callSkill = (skillId: string) => {
    if (activeSkills.includes(skillId)) return;
    
    // If already has another skill, don't add more (user limit)
    if (activeSkills.length >= 1) return;

    setActiveSkills(prev => [...prev, skillId]);
    
     // Get name from a more complete list or the constants
     const skillNames: Record<string, string> = {
       'sales-agent': 'Agente de Vendas',
       'satisfaction-agent': 'Sentinela de Satisfação',
       'legal-compliance': 'Compliance & Jurídico',
       'tech-advisor': 'Consultor Técnico',
       'strategic-planner': 'Planejador Estratégico',
       'negotiation-expert': 'Mestre da Negociação',
       'competitor-analyst': 'Analista de Mercado',
       'executive-summarizer': 'Resumo para CEO',
       'transcription-pro': 'Transcrição Premium'
     };

    toast({
       title: `${skillNames[skillId] || 'Agente de IA'} Ativado`,
      description: "O agente de IA entrou na reunião para gerar insights.",
    });

     // Logic moved to the real-time advisor useEffect for better simulation
  };

  // Real-time AI Advisor Intelligence Simulation
  useEffect(() => {
    if (activeSkills.length === 0 || !isConnected) return;

    const skillId = activeSkills[0];
    const skillNames: Record<string, string> = {
      'sales-agent': 'Agente de Vendas',
      'satisfaction-agent': 'Sentinela de Satisfação',
      'legal-compliance': 'Compliance & Jurídico',
      'tech-advisor': 'Consultor Técnico',
      'strategic-planner': 'Planejador Estratégico',
      'negotiation-expert': 'Mestre da Negociação',
      'competitor-analyst': 'Analista de Mercado',
      'executive-summarizer': 'Resumo para CEO',
      'transcription-pro': 'Transcrição Premium'
    };
    const skillName = skillNames[skillId] || 'Especialista IA';

    // 1. Initial greeting
    const greetingTimeout = setTimeout(() => {
      setAdvisorMessage({
        skill: skillName,
        text: `Iniciando análise. Sou o ${skillName} e estou focado em identificar pontos estratégicos para você.`
      });
      setTimeout(() => setAdvisorMessage(null), 6000);
    }, 3000);

    // 2. Periodic strategic insights (simulating real-time analysis)
    const interval = setInterval(() => {
      // Only show message 40% of the time to keep it "strategic"
      if (Math.random() > 0.6) {
        const insightsPool: Record<string, string[]> = {
          'sales-agent': [
            "O cliente demonstrou interesse genuíno quando você citou o suporte 24/7. Explore mais esse diferencial.",
            "A percepção de valor parece estar baixa agora. Tente ancorar o preço com os benefícios de produtividade.",
            "Momento de fechamento: Peça um compromisso de próxima etapa ou envie a proposta agora."
          ],
          'legal-compliance': [
            "Lembre-se: qualquer promessa de SLA deve estar documentada no contrato final.",
            "A menção a dados sensíveis exige que reforcemos nossa conformidade com a LGPD/GDPR.",
            "Evite garantir exclusividade antes da revisão da diretoria jurídica."
          ],
          'tech-advisor': [
            "Boa explicação sobre o backend. Se eles perguntarem sobre segurança, mencione a criptografia AES-256.",
            "A arquitetura microserviços parece ser o que eles precisam para escalar esse volume de dados.",
            "Eles parecem preocupados com o tempo de resposta da API. Enfatize nosso Edge Cache."
          ],
          'strategic-planner': [
            "Estamos há 10 minutos no mesmo tópico. Sugiro avançar para o próximo item da pauta.",
            "Excelente ponto. Esse alinhamento com a visão 2026 da empresa é crucial para a aprovação.",
            "Tente extrair qual é o real 'blocker' para a implementação imediata."
          ]
        };

        const pool = insightsPool[skillId] || [
          "Analisando padrões da conversa... Identifiquei uma boa oportunidade de reforçar nossa autoridade no assunto.",
          "O engajamento dos participantes está alto. Ótimo momento para propor uma demonstração técnica.",
          "Sugestão: Valide se todos entenderam o cronograma antes de encerrar este tópico."
        ];

        const randomText = pool[Math.floor(Math.random() * pool.length)];
        
        setAdvisorMessage({ skill: skillName, text: randomText });
        
        // Log to insights panel too
        const newInsight = {
          id: Math.random().toString(36).substr(2, 9),
          skill: skillName,
          text: randomText,
          type: 'recommendation' as const,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setInsights(prev => [newInsight, ...prev]);

        // Auto-hide after 10 seconds
        setTimeout(() => setAdvisorMessage(null), 10000);
      }
    }, 25000); // Check every 25 seconds for strategic moments

    return () => {
      clearTimeout(greetingTimeout);
      clearInterval(interval);
      setAdvisorMessage(null);
    };
  }, [activeSkills, isConnected]);

  const joinMeeting = async (nameOverride?: string) => {
    try {
      const name = nameOverride || displayName;
      if (!name.trim()) {
        toast({
          title: "Erro",
          description: "Por favor, insira seu nome",
          variant: "destructive",
        });
        return;
      }

      setIsConnecting(true);
      console.log('🚀 Starting meeting join process...');
      
      // Create WebSocket connection  
      const ws = new WebSocket(`wss://jwddiyuezqrpuakazvgg.functions.supabase.co/functions/v1/meeting-signaling`);
      
      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        if (!isConnected) {
          toast({
            title: "Falha ao Conectar",
            description: "Não foi possível conectar à reunião. Verifique sua conexão.",
            variant: "destructive",
          });
        }
        setIsConnecting(false);
      };

      ws.onclose = () => {
        console.log('🔌 WebSocket connection closed');
        setIsConnected(false);
        setIsConnecting(false);
        
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
          setHeartbeatInterval(null);
        }
        
        if (isConnected) {
          toast({
            title: "Conexão Encerrada",
            description: "A conexão com a reunião foi encerrada",
            variant: "destructive",
          });
        }
      };

      ws.onopen = () => {
        console.log('✅ WebSocket connected, joining room...');
        ws.send(JSON.stringify({
          type: 'join-room',
          roomCode: code,
          displayName: name,
          userId: user?.id || null
        }));
        
        // Setup heartbeat
        const interval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 25000);
        setHeartbeatInterval(interval);
      };

      ws.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        console.log('📨 Received WebSocket message:', data.type, data);

        if (data.type === 'joined-room') {
          console.log('🎉 Successfully joined room!');
          setRoom(data.room);
          setMyPeerId(data.peerId);
          setIsConnected(true);
          setIsConnecting(false);
          setShowNamePrompt(false);
          
          // Set up local media
          try {
            console.log('🎥 Requesting user media...');
            const stream = await getUserMedia();
            setLocalStream(stream);
            
            if (localVideoRef.current) {
              localVideoRef.current.srcObject = stream;
            }

            // Setup VAD for local audio
            setupVAD(stream);
            
            // Set up existing participants
            if (data.otherParticipants?.length > 0) {
              console.log('👥 Found existing participants:', data.otherParticipants.length);
              setParticipants(data.otherParticipants.map((p: any) => ({
                id: p.id,
                peerId: p.peer_id,
                displayName: p.display_name,
                isHost: false,
                audioEnabled: true,
                videoEnabled: true,
                stream: null
              })));
            }

            // Setup Realtime channel for WebRTC signaling
            await setupRealtimeChannel(data.room.id, data.peerId);

            // Create peer connections for existing participants after a small delay
            if (data.otherParticipants?.length > 0) {
              setTimeout(() => {
                for (const participant of data.otherParticipants) {
                  console.log('🤝 Creating peer connection for existing participant:', participant.peer_id);
                  createPeerConnectionAndOffer(participant.peer_id);
                }
              }, 1000);
            }
            
          } catch (error) {
            console.error('❌ Error accessing media:', error);
            toast({
              title: "Erro de Mídia",
              description: "Não foi possível acessar câmera/microfone",
              variant: "destructive",
            });
          }
        } else if (data.type === 'pong') {
          // Heartbeat response received
          console.log('💓 Pong received');
        }
      };

      setSocket(ws);
      
    } catch (error) {
      console.error('❌ Error joining meeting:', error);
      setIsConnecting(false);
      toast({
        title: "Erro",
        description: "Não foi possível entrar na reunião",
        variant: "destructive",
      });
    }
  };

  const getUserMedia = async () => {
    const savedAudio = localStorage.getItem('selectedAudioDevice');
    const savedVideo = localStorage.getItem('selectedVideoDevice');

    try {
      console.log('🎥 Requesting user media permissions...');
      
      // Enhanced constraints with fallback
      const constraints: MediaStreamConstraints = {
        audio: savedAudio ? { 
          deviceId: { exact: savedAudio },
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } : {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: savedVideo ? { 
          deviceId: { exact: savedVideo },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        } : {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('✅ Media stream obtained with enhanced settings');
      return stream;
    } catch (error) {
      console.warn('⚠️ Enhanced constraints failed, trying basic:', error);
      
      // Fallback to basic constraints
      try {
        const basicStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        console.log('✅ Media stream obtained with basic settings');
        return basicStream;
      } catch (basicError) {
        console.error('❌ All media access failed:', basicError);
        
        // Show user-friendly error based on error type
        if (basicError.name === 'NotAllowedError') {
          toast({
            title: "⚠️ Permissão Necessária",
            description: "Clique em 'Permitir' para acessar câmera e microfone. Sem isso a reunião não funcionará.",
            variant: "destructive",
          });
        } else if (basicError.name === 'NotFoundError') {
          toast({
            title: "🔍 Dispositivos Não Encontrados",
            description: "Verifique se câmera e microfone estão conectados.",
            variant: "destructive",
          });
        }
        throw basicError;
      }
    }
  };

  const setupRealtimeChannel = async (roomId: string, peerId: string) => {
    console.log('📡 Setting up Realtime channel for room:', roomId);
    
    const channel = supabase
      .channel(`webrtc_${roomId}`)
      .on('broadcast', { event: 'webrtc-offer' }, async (payload) => {
        if (payload.payload.targetPeerId === peerId) {
          console.log('📞 Received WebRTC offer from:', payload.payload.fromPeerId);
          await handleWebRTCOffer(payload.payload);
        }
      })
      .on('broadcast', { event: 'webrtc-answer' }, async (payload) => {
        if (payload.payload.targetPeerId === peerId) {
          console.log('📞 Received WebRTC answer from:', payload.payload.fromPeerId);
          await handleWebRTCAnswer(payload.payload);
        }
      })
      .on('broadcast', { event: 'webrtc-ice-candidate' }, async (payload) => {
        if (payload.payload.targetPeerId === peerId) {
          console.log('🧊 Received ICE candidate from:', payload.payload.fromPeerId);
          await handleWebRTCIceCandidate(payload.payload);
        }
      })
      .on('broadcast', { event: 'chat-message' }, (payload) => {
        console.log('💬 Received chat message:', payload.payload);
        setMessages(prev => [...prev, {
          id: Math.random().toString(),
          message: payload.payload.message,
          timestamp: new Date().toISOString(),
          senderName: payload.payload.senderName
        }]);
      })
      .subscribe((status) => {
        console.log('📶 Realtime channel status:', status);
        if (status === 'SUBSCRIBED') {
          setRealtimeReady(true);
        }
      });

    setRealtimeChannel(channel);
    console.log('✅ Realtime channel setup complete');
  };

  // Helper function to create peer connection and send offer
  const createPeerConnectionAndOffer = async (peerId: string) => {
    if (!localStream || !realtimeChannel) {
      console.log('⚠️ Cannot create peer connection: missing localStream or realtimeChannel');
      return;
    }

    if (!realtimeReady) {
      console.log('⏳ Realtime not ready yet, retrying offer in 300ms...');
      setTimeout(() => createPeerConnectionAndOffer(peerId), 300);
      return;
    }

    const pc = await createPeerConnection(peerId);
    
    // Create and send offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    
    console.log('📤 Sending offer to:', peerId);
    await realtimeChannel.send({
      type: 'broadcast',
      event: 'webrtc-offer',
      payload: {
        targetPeerId: peerId,
        fromPeerId: myPeerId,
        offer: offer
      }
    });
  };

  const createPeerConnection = async (peerId: string) => {
    console.log(`🔗 Creating peer connection for ${peerId}`);
    
    const pc = new RTCPeerConnection({
      iceServers: iceConfig.iceServers
    });

    // Add local stream tracks
    if (localStream) {
      for (const track of localStream.getTracks()) {
        pc.addTrack(track, localStream);
      }
    }

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log(`🎵 Remote track received from ${peerId}`);
      const [remoteStream] = event.streams;
      
      const videoRef = getRemoteVideoRef(peerId);
      if (videoRef.current) {
        videoRef.current.srcObject = remoteStream;
        
        // Handle autoplay blocking
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch((error) => {
            console.warn('⚠️ Autoplay blocked, showing audio prompt:', error);
            setShowAudioPrompt(true);
          });
        }
      }

      // Update participant with stream
      setParticipants(prev => prev.map(p => 
        p.peerId === peerId ? { ...p, stream: remoteStream } : p
      ));
    };

    // ICE handling
    pc.onicecandidate = (event) => {
      if (event.candidate && realtimeChannel) {
        console.log(`🧊 Sending ICE candidate to ${peerId}`);
        realtimeChannel.send({
          type: 'broadcast',
          event: 'webrtc-ice-candidate',
          payload: {
            targetPeerId: peerId,
            fromPeerId: myPeerId,
            candidate: event.candidate
          }
        });
      }
    };

    // Connection state monitoring
    pc.oniceconnectionstatechange = () => {
      console.log(`🧊 ICE connection state for ${peerId}:`, pc.iceConnectionState);
      
      if (pc.iceConnectionState === 'failed') {
        console.log(`🔄 Attempting ICE restart for ${peerId}`);
        pc.restartIce();
      }
    };

    // Handle negotiation needed
    pc.onnegotiationneeded = async () => {
      console.log(`🤝 Negotiation needed for ${peerId}`);
      if (pc.signalingState === 'stable') {
        await createPeerConnectionAndOffer(peerId);
      }
    };

    // Store the connection
    pc.ontrack = (event) => {
      console.log('📺 Received remote track from', peerId, event.streams[0]);
      const remoteStream = event.streams[0];
      
      // Find remote video element for this peer
      const remoteVideoRef = getRemoteVideoRef(peerId);
      if (remoteVideoRef?.current) {
        console.log('🎬 Setting remote stream to video element for', peerId);
        remoteVideoRef.current.srcObject = remoteStream;
        
        // Try to play and handle autoplay restrictions
        remoteVideoRef.current.play().catch((error) => {
          console.log('⚠️ Autoplay blocked, showing audio prompt');
          setShowAudioPrompt(true);
        });
      }
      
      // Update participant with stream
      setParticipants(prev => prev.map(p => 
        p.peerId === peerId ? { ...p, stream: remoteStream } : p
      ));
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && realtimeChannel) {
        console.log('🧊 Sending ICE candidate to:', peerId);
        realtimeChannel.send({
          type: 'broadcast',
          event: 'webrtc-ice-candidate',
          payload: {
            targetPeerId: peerId,
            fromPeerId: myPeerId,
            candidate: event.candidate
          }
        });
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log(`🔌 Peer connection state for ${peerId}:`, pc.connectionState);
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        console.log(`❌ Peer connection failed for ${peerId}`);
        toast({
          title: "Conexão perdida",
          description: `Conexão com ${peerId} foi perdida`,
          variant: "destructive",
        });
      }
    };

    setPeerConnections(prev => new Map(prev.set(peerId, pc)));
    return pc;
  };

  const handleWebRTCOffer = async (data: any) => {
    const fromPeerId = data.fromPeerId;
    console.log('🤝 Handling WebRTC offer from:', fromPeerId);
    
    // Create new peer connection if it doesn't exist
    let pc = peerConnections.get(fromPeerId);
    if (!pc && localStream) {
      pc = await createPeerConnection(fromPeerId);
    }
    
    if (!pc) {
      console.error('❌ No peer connection available for:', fromPeerId);
      return;
    }

    await pc.setRemoteDescription(data.offer);
    console.log('✅ Set remote description for offer from:', fromPeerId);
    
    // Process queued ICE candidates
    const queuedCandidates = iceCandidateQueue.get(fromPeerId) || [];
    for (const candidate of queuedCandidates) {
      try {
        await pc.addIceCandidate(candidate);
        console.log('✅ Added queued ICE candidate from:', fromPeerId);
      } catch (error) {
        console.error('❌ Error adding queued ICE candidate:', error);
      }
    }
    setIceCandidateQueue(prev => {
      const newQueue = new Map(prev);
      newQueue.delete(fromPeerId);
      return newQueue;
    });
    
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    console.log('✅ Created and set local answer for:', fromPeerId);

    if (realtimeChannel) {
      console.log('📤 Sending answer to:', fromPeerId);
      await realtimeChannel.send({
        type: 'broadcast',
        event: 'webrtc-answer',
        payload: {
          targetPeerId: fromPeerId,
          fromPeerId: myPeerId,
          answer: answer
        }
      });
    }
  };

  const handleWebRTCAnswer = async (data: any) => {
    const fromPeerId = data.fromPeerId;
    const pc = peerConnections.get(fromPeerId);
    
    if (pc && pc.signalingState !== 'stable') {
      console.log('✅ Setting remote description for answer from:', fromPeerId);
      await pc.setRemoteDescription(data.answer);
    } else {
      console.warn('⚠️ Cannot set remote description, peer connection not in expected state:', fromPeerId, pc?.signalingState);
    }
  };

  const handleWebRTCIceCandidate = async (data: any) => {
    const fromPeerId = data.fromPeerId;
    const pc = peerConnections.get(fromPeerId);
    
    if (pc && pc.remoteDescription) {
      console.log('✅ Adding ICE candidate from:', fromPeerId);
      try {
        await pc.addIceCandidate(data.candidate);
      } catch (error) {
        console.error('❌ Error adding ICE candidate:', error);
      }
    } else {
      console.log('⏳ Queueing ICE candidate from:', fromPeerId);
      setIceCandidateQueue(prev => {
        const newQueue = new Map(prev);
        const existing = newQueue.get(fromPeerId) || [];
        newQueue.set(fromPeerId, [...existing, data.candidate]);
        return newQueue;
      });
    }
  };

  const leaveMeeting = async () => {
    console.log('👋 Leaving meeting...');
    
    // Cleanup channels
    if (realtimeChannel) {
      supabase.removeChannel(realtimeChannel);
      setRealtimeChannel(null);
    }
    if (participantsChannel) {
      supabase.removeChannel(participantsChannel);
      setParticipantsChannel(null);
    }
    setRealtimeReady(false);
    
    // Cleanup heartbeat
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      setHeartbeatInterval(null);
    }
    
    // Close peer connections
    peerConnections.forEach(pc => pc.close());
    setPeerConnections(new Map());
    
    // Close WebSocket
    if (socket) {
      socket.close();
      setSocket(null);
    }
    
    // Stop local streams
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    
    setIsConnected(false);
    navigate('/dashboard/reunioes');
  };

  const toggleAudio = async () => {
    if (!localStream) return;
    
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !isAudioEnabled;
      setIsAudioEnabled(!isAudioEnabled);
      
      toast({
        title: !isAudioEnabled ? "Microfone ativado" : "Microfone desativado",
        description: !isAudioEnabled ? "Seu áudio está sendo transmitido" : "Seu áudio foi desativado",
      });
    }
  };

  const toggleVideo = async () => {
    if (!localStream) return;
    
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !isVideoEnabled;
      setIsVideoEnabled(!isVideoEnabled);
      
      toast({
        title: !isVideoEnabled ? "Câmera ativada" : "Câmera desativada", 
        description: !isVideoEnabled ? "Seu vídeo está sendo transmitido" : "Seu vídeo foi desativado",
      });
    }
  };

  const toggleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        setIsScreenSharing(true);

        // Replace video track in all peer connections
        peerConnections.forEach((pc) => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          const track = screenStream.getVideoTracks()[0];
          if (sender && track) {
            sender.replaceTrack(track);
          }
        });

        // Show screen locally
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }

        // Handle screen share end
        screenStream.getVideoTracks()[0].addEventListener('ended', () => {
          setIsScreenSharing(false);
          if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
          }
          // Restore original video track
          peerConnections.forEach((pc) => {
            const sender = pc.getSenders().find(s => s.track?.kind === 'video');
            const track = localStream?.getVideoTracks()[0] || null;
            if (sender) {
              sender.replaceTrack(track);
            }
          });
        });

        toast({ title: 'Compartilhamento iniciado', description: 'Sua tela está sendo compartilhada' });
      } else {
        setIsScreenSharing(false);
        if (localVideoRef.current && localStream) {
          localVideoRef.current.srcObject = localStream;
        }
        // Restore original video track
        peerConnections.forEach((pc) => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          const track = localStream?.getVideoTracks()[0] || null;
          if (sender) {
            sender.replaceTrack(track);
          }
        });
        toast({ title: 'Compartilhamento parado', description: 'Compartilhamento de tela foi interrompido' });
      }
    } catch (error) {
      console.error('Error toggling screen share:', error);
      toast({ title: 'Erro', description: 'Não foi possível compartilhar a tela', variant: 'destructive' });
    }
  };

  const sendChatMessage = () => {
    if (!newMessage.trim() || !realtimeChannel || !displayName) return;
    
    console.log('💬 Sending chat message:', newMessage);
    realtimeChannel.send({
      type: 'broadcast',
      event: 'chat-message',
      payload: {
        message: newMessage,
        senderName: displayName
      }
    });
    
    setNewMessage('');
  };

  const copyMeetingLink = () => {
    const link = window.location.href;
    navigator.clipboard.writeText(link);
    toast({
      title: "Link copiado!",
      description: "O link da reunião foi copiado para a área de transferência",
    });
  };

  const handleDeviceChange = async (deviceType: 'audio' | 'video' | 'speaker', deviceId: string) => {
    try {
      if (deviceType === 'speaker') {
        // Set speaker for all video elements
        const videoElements = document.querySelectorAll('video');
        videoElements.forEach(video => {
          if ('setSinkId' in video) {
            (video as any).setSinkId(deviceId);
          }
        });
        return;
      }

      if (!localStream) return;

      // Get new stream with selected device
      const constraints: MediaStreamConstraints = {
        audio: deviceType === 'audio' ? { deviceId: { exact: deviceId } } : localStream.getAudioTracks().length > 0,
        video: deviceType === 'video' ? { deviceId: { exact: deviceId } } : localStream.getVideoTracks().length > 0
      };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Replace tracks in all peer connections
      peerConnections.forEach((pc) => {
        const trackKind = deviceType === 'audio' ? 'audio' : 'video';
        const sender = pc.getSenders().find(s => s.track?.kind === trackKind);
        const newTrack = deviceType === 'audio' ? newStream.getAudioTracks()[0] : newStream.getVideoTracks()[0];
        
        if (sender && newTrack) {
          sender.replaceTrack(newTrack);
        }
      });

      // Update local stream
      const oldTrack = deviceType === 'audio' ? localStream.getAudioTracks()[0] : localStream.getVideoTracks()[0];
      const newTrack = deviceType === 'audio' ? newStream.getAudioTracks()[0] : newStream.getVideoTracks()[0];
      
      if (oldTrack) {
        localStream.removeTrack(oldTrack);
        oldTrack.stop();
      }
      
      if (newTrack) {
        localStream.addTrack(newTrack);
      }

      // Update local video element
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStream;
      }

    } catch (error) {
      console.error('Error changing device:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível alterar o dispositivo',
        variant: 'destructive'
      });
    }
  };

  const activateAudio = async () => {
    try {
      // Request media permissions again
      const stream = await getUserMedia();
      if (localVideoRef.current && stream) {
        localVideoRef.current.srcObject = stream;
        await localVideoRef.current.play();
      }
      
      // Try to play all remote videos
      const videoElements = document.querySelectorAll('video');
      for (const video of videoElements) {
        try {
          await video.play();
        } catch (error) {
          console.warn('Could not play video:', error);
        }
      }
      
      setShowAudioPrompt(false);
      
      toast({
        title: "✅ Mídia Ativada",
        description: "Câmera e áudio foram ativados com sucesso!"
      });
    } catch (error) {
      console.error('Failed to activate media:', error);
      toast({
        title: "Erro ao Ativar Mídia", 
        description: "Verifique as permissões do navegador",
        variant: "destructive"
      });
    }
  };

  // DnD handler
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      setParticipants((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over?.id);

        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  // Prepare video participants list for display
  const videoParticipants: VideoParticipant[] = [
    // Local participant first
    ...(isConnected && myPeerId ? [{
      id: 'local',
      peerId: myPeerId,
      displayName: displayName,
      isHost: user?.id === room?.created_by,
      audioEnabled: isAudioEnabled,
      videoEnabled: isVideoEnabled,
      stream: localStream
    }] : []),
    // Remote participants
    ...participants.filter(p => p.peerId !== myPeerId)
  ];

  console.log('📊 Current video participants:', videoParticipants.length, videoParticipants.map(p => ({
    id: p.id,
    peerId: p.peerId,
    displayName: p.displayName
  })));

  // Not connected - show entry screen
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#F0F2FE] to-white flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl border-0">
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-4">
              <img src={ellosuitLogo} alt="Ellosuit" className="h-12" />
            </div>
            <CardTitle className="text-2xl text-gray-900">
              {isConnecting ? 'Conectando...' : 'Entrar na Reunião'}
            </CardTitle>
            <p className="text-gray-600">
              Código: <span className="font-mono font-semibold text-[#2F428D]">{code}</span>
            </p>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {!showNamePrompt || isConnecting ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2F428D] mx-auto"></div>
                <p className="text-gray-600 mt-2">Entrando na reunião...</p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <label htmlFor="displayName" className="text-sm font-medium text-gray-700">
                    Como você quer aparecer?
                  </label>
                  <Input
                    id="displayName"
                    placeholder="Seu nome"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && joinMeeting()}
                    className="border-gray-300 focus:border-[#374DA4] focus:ring-[#374DA4]"
                  />
                </div>
                
                <div className="flex gap-3">
                  <Button 
                    variant="outline" 
                    onClick={() => navigate('/dashboard/reunioes')} 
                    className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    Cancelar
                  </Button>
                  <Button 
                    onClick={() => joinMeeting()}
                    className="flex-1 bg-[#2F428D] hover:bg-[#253573] text-white" 
                    disabled={!displayName.trim()}
                  >
                    Entrar na Reunião
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Meeting interface
  return (
    <div className="h-screen bg-gradient-to-br from-gray-50 to-[#F0F2FE] flex flex-col overflow-hidden">
      {/* Media Permission Banner */}
      {showAudioPrompt && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 max-w-md">
          <Card className="bg-red-600 text-white border-0 shadow-2xl">
            <CardContent className="p-6">
              <div className="space-y-4 text-center">
                <div className="flex items-center justify-center gap-2">
                  <Camera className="h-6 w-6" />
                  <Mic className="h-6 w-6" />
                </div>
                </div>
                <div>
                  <h3 className="font-bold text-lg mb-2">🔒 Permissões Necessárias</h3>
                  <p className="text-sm opacity-90 mb-4">
                    Para ver e ouvir outros participantes, permita o acesso à câmera e microfone
                  </p>
                </div>
                <Button
                  onClick={activateAudio}
                  variant="secondary" 
                  size="sm"
                  className="w-full bg-white text-red-600 hover:bg-gray-100"
                >
                Ativar
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-[#DFE4FB] px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <img src={ellosuitLogo} alt="Ellosuit" className="h-8" />
          <div>
            <h1 className="text-lg font-semibold text-gray-900">{room?.title || `Reunião ${code}`}</h1>
            <p className="text-sm text-gray-600">
              {videoParticipants.length} participante{videoParticipants.length !== 1 ? 's' : ''} 
              {participants.length > 0 && ` (${participants.length} remoto${participants.length !== 1 ? 's' : ''})`}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <DeviceSettings onDeviceChange={handleDeviceChange} />
          
          {isOwner && (
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (activeSkills.length === 0) {
                    setShowSkillsSelection(!showSkillsSelection);
                  } else {
                    setShowSkills(!showSkills);
                  }
                  setShowChat(false);
                }}
                className={`text-gray-700 hover:bg-[#F0F2FE] hover:text-[#253573] ${
                  showSkills || showSkillsSelection ? 'bg-purple-100 text-purple-700 font-bold' : ''
                }`}
              >
                 <div className="relative">
                   <Zap className={`h-4 w-4 mr-2 ${activeSkills.length > 0 ? 'text-purple-600 fill-purple-600' : ''}`} />
                   {activeSkills.length > 0 && (
                     <span className="absolute -top-1 -right-1 flex h-2 w-2">
                       <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                       <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
                     </span>
                   )}
                 </div>
                 {activeSkills.length > 0 ? "IA Ativa" : "Skills IA"}
              </Button>
              
              {/* Active Skill Popover Indicator */}
              {showSkills && activeSkills.length > 0 && (
                <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-xl shadow-2xl border border-purple-100 p-4 z-50 animate-in fade-in zoom-in-95 duration-200">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Activity className="h-4 w-4 text-purple-600 animate-pulse" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase">Status</p>
                      <p className="text-sm font-bold text-purple-700">IA Ouvindo...</p>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-1">Skill Ativa</p>
                    <p className="text-sm font-medium text-gray-800">
                      {activeSkills[0] === 'sales-agent' ? 'Agente de Vendas' : 
                       activeSkills[0] === 'satisfaction-agent' ? 'Sentinela de Satisfação' :
                       activeSkills[0] === 'legal-compliance' ? 'Compliance & Jurídico' :
                       activeSkills[0] === 'strategic-planner' ? 'Planejador Estratégico' : 'Especialista IA'}
                    </p>
                  </div>
                  <p className="mt-3 text-[10px] text-gray-400 text-center italic">
                    O agente está analisando a reunião em tempo real.
                  </p>
                </div>
              )}
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowChat(!showChat)}
            className="text-gray-700 hover:bg-[#F0F2FE] hover:text-[#253573]"
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            Chat
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="text-gray-700 hover:bg-[#F0F2FE]">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={copyMeetingLink}>
                <Copy className="h-4 w-4 mr-2" />
                Copiar link
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex relative">
          {/* Video area */}
          <div className="flex-1 relative bg-gradient-to-br from-gray-100 to-[#DFE4FB] p-0 md:p-6 pb-24 overflow-hidden">
            {/* Real-time AI Advisor Bubble - ONLY FOR OWNER */}
            {isOwner && advisorMessage && (
              <div className="absolute bottom-32 left-1/2 transform -translate-x-1/2 z-40 w-full max-w-lg px-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-black/90 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl border border-white/10 flex gap-4 items-start relative overflow-hidden group">
                  {/* Animated gradient border effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-[#374DA4]/10 via-purple-500/10 to-pink-500/10 opacity-50"></div>
                  
                  <div className="relative bg-[#2F428D] p-2 rounded-xl shrink-0">
                    <Brain className="h-5 w-5 text-white" />
                  </div>
                  
                  <div className="flex-1 relative">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[#5A74D1]">Sugestão do Especialista</span>
                      <span className="h-1 w-1 rounded-full bg-gray-500"></span>
                      <span className="text-[10px] font-medium text-gray-400">{advisorMessage.skill}</span>
                    </div>
                    <p className="text-sm font-medium leading-relaxed">
                      "{advisorMessage.text}"
                    </p>
                  </div>

                  <button 
                    onClick={() => setAdvisorMessage(null)}
                    className="relative p-1 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

          {videoParticipants.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <Card className="w-80 bg-white shadow-lg">
                <CardContent className="p-8 text-center">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <CardTitle className="mb-2 text-gray-700">Aguardando outros participantes</CardTitle>
                  <p className="text-gray-500">
                    Compartilhe o código <span className="font-mono font-semibold text-[#2F428D]">{code}</span> para convidar pessoas
                  </p>
                </CardContent>
              </Card>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={videoParticipants.map(p => p.id)} strategy={rectSortingStrategy}>
                <div className={`
                  w-full h-full grid gap-4 
                  ${videoParticipants.length === 1 ? 'grid-cols-1' : 
                    videoParticipants.length === 2 ? 'grid-cols-2' : 
                    videoParticipants.length <= 4 ? 'grid-cols-2 grid-rows-2' : 
                    'grid-cols-3 grid-rows-3'}
                `}>
                  {videoParticipants.map((participant) => (
                    <SortableVideo
                      key={participant.id}
                      participant={participant}
                      videoRef={
                        participant.id === 'local' 
                          ? localVideoRef 
                          : getRemoteVideoRef(participant.peerId)
                      }
                      isMainView={videoParticipants.length === 1}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>

        {/* IA Sidebar removed as per user request. Insights now appear in floating bubbles. */}

        {/* Skill Selection Modal - HORIZONTAL */}
        {showSkillsSelection && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <Card className="w-full max-w-4xl bg-white border-0 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="bg-purple-600 p-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 p-2 rounded-xl">
                    <Zap className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl text-white">Escolha seu Especialista IA</CardTitle>
                    <p className="text-purple-100 text-sm">Selecione um agente para monitorar e sugerir melhorias na sua reunião em tempo real.</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={() => setShowSkillsSelection(false)}>
                  <X className="h-6 w-6" />
                </Button>
              </div>

              <div className="p-8">
                <div className="flex items-center gap-4">
                  <Button 
                    variant="outline" 
                    size="icon" 
                    disabled={skillSelectionPage === 0}
                    onClick={() => setSkillSelectionPage(prev => Math.max(0, prev - 1))}
                    className="rounded-full shrink-0 h-12 w-12"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </Button>

                  <div className="flex-1 grid grid-cols-2 gap-6">
                    {[
                      { id: 'sales-agent', name: 'Agente de Vendas', icon: Target, color: 'text-[#2F428D]', bg: 'bg-[#F0F2FE]', description: 'Focado em conversão, identificação de dores do cliente e técnicas de fechamento.' },
                      { id: 'satisfaction-agent', name: 'Sentinela de Satisfação', icon: Heart, color: 'text-red-500', bg: 'bg-red-50', description: 'Monitora o clima da reunião, nível de satisfação e engajamento dos participantes.' },
                      { id: 'legal-compliance', name: 'Compliance & Jurídico', icon: Shield, color: 'text-yellow-600', bg: 'bg-yellow-50', description: 'Garante que os termos acordados estejam em conformidade e alerta sobre riscos legais.' },
                      { id: 'strategic-planner', name: 'Planejador Estratégico', icon: Briefcase, color: 'text-green-600', bg: 'bg-green-50', description: 'Organiza as decisões tomadas, resume pontos chave e ajuda a manter o foco na pauta.' }
                    ].slice(skillSelectionPage * 2, (skillSelectionPage * 2) + 2).map((skill) => (
                      <button
                        key={skill.id}
                        onClick={() => {
                          callSkill(skill.id);
                          setShowSkillsSelection(false);
                          setShowSkills(true);
                        }}
                        className="flex flex-col items-center text-center p-8 rounded-2xl border-2 border-gray-100 hover:border-purple-300 hover:bg-purple-50 transition-all group active:scale-95 h-full"
                      >
                        <div className={`p-4 rounded-2xl mb-4 ${skill.bg} ${skill.color} group-hover:scale-110 transition-transform`}>
                          <skill.icon className="h-10 w-10" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-800 mb-2">{skill.name}</h3>
                        <p className="text-sm text-gray-500 leading-relaxed mb-6">{skill.description}</p>
                        <div className="mt-auto w-full">
                          <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl h-12">
                            Ativar Agora
                          </Button>
                        </div>
                      </button>
                    ))}
                  </div>

                  <Button 
                    variant="outline" 
                    size="icon" 
                    disabled={skillSelectionPage >= 1}
                    onClick={() => setSkillSelectionPage(prev => prev + 1)}
                    className="rounded-full shrink-0 h-12 w-12"
                  >
                    <ChevronRight className="h-6 w-6" />
                  </Button>
                </div>

                <div className="flex justify-center gap-2 mt-8">
                  {[0, 1].map((i) => (
                    <div 
                      key={i} 
                      className={`h-2 w-2 rounded-full transition-all ${skillSelectionPage === i ? 'w-6 bg-purple-600' : 'bg-gray-200'}`} 
                    />
                  ))}
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Chat Sidebar */}
        {showChat && (
          <div className="w-80 bg-white border-l border-[#B3BFF0] shadow-lg flex flex-col">
            <div className="p-4 border-b border-[#B3BFF0]">
              <h3 className="font-semibold text-gray-900">Chat</h3>
            </div>
            
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-3">
                {messages.map((msg) => (
                  <div key={msg.id} className="text-left">
                    <div className="inline-block max-w-xs p-3 rounded-2xl bg-gray-100 text-gray-900">
                      <div className="text-xs mb-1 text-gray-600">
                        {msg.senderName}
                      </div>
                      <div className="text-sm">{msg.message}</div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            
            <div className="p-4 border-t border-[#B3BFF0]">
              <div className="flex gap-2">
                <Input
                  placeholder="Digite sua mensagem..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                  className="flex-1 border-gray-300 focus:border-[#374DA4] focus:ring-[#374DA4]"
                />
                <Button 
                  size="sm" 
                  onClick={sendChatMessage} 
                  disabled={!newMessage.trim()}
                  className="bg-[#2F428D] hover:bg-[#253573]"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#B3BFF0] px-6 py-3 flex items-center justify-center gap-3 z-50">
        <Button
          variant={isAudioEnabled ? "default" : "destructive"}
          size="lg"
          onClick={toggleAudio}
          className={`rounded-full w-12 h-12 ${
            isAudioEnabled 
              ? 'bg-[#2F428D] hover:bg-[#253573] text-white' 
              : 'bg-red-600 hover:bg-red-700 text-white'
          }`}
        >
          {isAudioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        </Button>

        <Button
          variant={isVideoEnabled ? "default" : "destructive"}
          size="lg"
          onClick={toggleVideo}
          className={`rounded-full w-12 h-12 ${
            isVideoEnabled 
              ? 'bg-[#2F428D] hover:bg-[#253573] text-white' 
              : 'bg-red-600 hover:bg-red-700 text-white'
          }`}
        >
          {isVideoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
        </Button>

        <Button
          variant={isScreenSharing ? "secondary" : "outline"}
          size="lg"
          onClick={toggleScreenShare}
          className="rounded-full w-12 h-12"
        >
          {isScreenSharing ? <MonitorOff className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
        </Button>

        <Button
          variant="destructive"
          size="lg"
          onClick={leaveMeeting}
          className="rounded-full w-12 h-12 bg-red-600 hover:bg-red-700"
        >
          <PhoneOff className="h-5 w-5" />
        </Button>
        {showAudioPrompt && (
          <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-[#2F428D] text-white px-4 py-2 rounded-lg shadow-lg z-50">
            <div className="flex items-center gap-2">
              <Volume2 className="h-4 w-4" />
              <span>Clique para ativar o áudio</span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  // Try to play all remote videos
                  Object.values(remoteVideoRefsMapRef.current).forEach(ref => {
                    if (ref.current) {
                      ref.current.play().catch(console.warn);
                    }
                  });
                  setShowAudioPrompt(false);
                }}
              >
                Ativar
              </Button>
            </div>
          </div>
        )}
        
      </div>
    </div>
  );
};

export default MeetingRoom;