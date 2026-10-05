import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
  import { Send, Paperclip, Users, MessageSquare, Bot, Loader2, ChevronRight, ChevronLeft, Mic, MicOff, UserX, Crown, Brain, Sparkles, FileText, Volume2, VolumeX, SlidersHorizontal } from 'lucide-react';
  import { Slider } from '@/components/ui/slider';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
 import { useParticipants, useLocalParticipant, useRoomContext } from '@livekit/components-react';
 import { Track } from 'livekit-client';
import { ALL_SKILLS } from '@/constants/skills';
import chatNotificationSound from '@/assets/sounds/chat-notification.mp3';

interface ChatMessage {
  id: string;
  sender_name: string;
  message: string;
  timestamp: string;
  file_url?: string;
}

interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}

const MeetingChatSidebar: React.FC<any> = (props) => {
  const {
    roomCode,
    transcriptionMessages: parentTranscriptionMessages,
    isHost,
    activeSkillId: propActiveSkillId,
    skillActivationIdentity: propSkillActivationIdentity,
    onTranscriptionClick,
    onVolumeChange,
    onLocalMicVolumeChange,
    participantVolumes = {},
    localMicVolume = 1
  } = props;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'participants' | 'chat' | 'skill'>('chat');
  const [isCollapsed, setIsCollapsed] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const allParticipants = useParticipants();
  // Filter to keep only one entry per participant (identity) and exclude bots/skills if they appear as participants
  const participants = allParticipants;

  const { localParticipant } = useLocalParticipant();
  const room = useRoomContext();

  // Notification sound
  const notificationAudioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    notificationAudioRef.current = new Audio(chatNotificationSound);
    notificationAudioRef.current.volume = 0.7;
    notificationAudioRef.current.preload = 'auto';
  }, []);
  const playNotification = React.useCallback(() => {
    try {
      if (!notificationAudioRef.current) return;
      notificationAudioRef.current.currentTime = 0;
      notificationAudioRef.current.play().catch((e) => console.warn('Notif audio:', e));
    } catch {}
  }, []);

  const [unreadChat, setUnreadChat] = useState(0);
  const [unreadSkill, setUnreadSkill] = useState(0);
  const [chatPulse, setChatPulse] = useState(false);

  // Self-fetch active skill and activator from DB as fallback if prop is not provided
  const [dbActiveSkillId, setDbActiveSkillId] = useState<string | null>(null);
  const [dbSkillActivationIdentity, setDbSkillActivationIdentity] = useState<string | null>(null);
  useEffect(() => {
    if (propActiveSkillId) return; // prefer prop
    let cancelled = false;
    const fetchSkill = async () => {
      const { data: room } = await supabase.from('meeting_rooms').select('id').eq('room_code', roomCode).single();
      if (!room || cancelled) return;
      const { data } = await (supabase as any).from('room_active_skills').select('skill_id, activated_by').eq('room_id', room.id);
      if (cancelled) return;
      if (data && data.length > 0) {
        setDbActiveSkillId(data[0].skill_id);
        setDbSkillActivationIdentity(data[0].activated_by);
      }

      const channel = supabase.channel(`sidebar_skill_${room.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'room_active_skills', filter: `room_id=eq.${room.id}` },
          (p) => {
            if (p.eventType === 'DELETE') {
              setDbActiveSkillId(null);
              setDbSkillActivationIdentity(null);
            } else if (p.new && (p.new as any).skill_id) {
              setDbActiveSkillId((p.new as any).skill_id);
              setDbSkillActivationIdentity((p.new as any).activated_by);
            }
          }).subscribe();
      return () => { supabase.removeChannel(channel); };
    };
    fetchSkill();
    return () => { cancelled = true; };
  }, [roomCode, propActiveSkillId]);

  const activeSkillId = propActiveSkillId !== undefined ? propActiveSkillId : dbActiveSkillId;
  const activeSkill = ALL_SKILLS.find(s => s.id === activeSkillId);
  const skillActivationIdentity = propSkillActivationIdentity !== undefined ? propSkillActivationIdentity : dbSkillActivationIdentity;

  // Auto-switch to skill tab when skill is activated
  const prevSkillIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (activeSkillId && activeSkillId !== prevSkillIdRef.current && prevSkillIdRef.current === null) {
      // Open sidebar and switch to skill tab when skill is first activated
      setIsCollapsed(false);
      setActiveTab('skill');
    }
    prevSkillIdRef.current = activeSkillId;
  }, [activeSkillId]);

  // Filter and deduplicate parent transcription messages
  const transcriptionMessages = React.useMemo(() => {
    if (!parentTranscriptionMessages) return [];
    // If we only have local messages, we need to ensure we're getting all.
    // But standard parentTranscriptionMessages should already have all if handleTranscriptionUpdate is global.
    return parentTranscriptionMessages;
  }, [parentTranscriptionMessages]);

  const [skillMessages, setSkillMessages] = useState<AIMessage[]>([]);
  // Sync external skill messages (like advisor strategic tips)
  useEffect(() => {
    if (props.advisorMessage && props.advisorMessage.type === 'strategic') {
      setSkillMessages(prev => {
        // Avoid duplicates
        if (prev.some(m => m.content === props.advisorMessage.text)) return prev;
        // New skill message arrived → play sound and pulse if user isn't on skill tab
        playNotification();
        if (isCollapsed || activeTab !== 'skill') {
          setUnreadSkill((u) => u + 1);
        }
        return [...prev, { role: 'assistant', content: props.advisorMessage.text }];
      });
    }
  }, [props.advisorMessage, isCollapsed, activeTab, playNotification]);

  const [skillInput, setSkillInput] = useState('');
  const [isSkillLoading, setIsSkillLoading] = useState(false);
  const skillScrollRef = useRef<HTMLDivElement>(null);

   const [playingTTSIndex, setPlayingTTSIndex] = useState<number | null>(null);
 
   const playTTS = async (text: string, index: number) => {
     if (playingTTSIndex !== null) return;
     setPlayingTTSIndex(index);
     try {
       const { data, error } = await supabase.functions.invoke('elevenlabs-tts', {
         body: { text },
       });
       if (error) throw error;
       
       const blob = await data.blob();
       const url = URL.createObjectURL(blob);
       const audio = new Audio(url);
       audio.onended = () => {
         setPlayingTTSIndex(null);
         URL.revokeObjectURL(url);
       };
       await audio.play();
     } catch (e: any) {
       console.error('TTS Error:', e);
       toast({ title: 'Erro no áudio', description: 'Não foi possível gerar a voz.', variant: 'destructive' });
       setPlayingTTSIndex(null);
     }
   };
 
  const handleHostAction = async (action: 'mute' | 'kick', identity: string, trackSid?: string) => {
    try {
      const { error } = await supabase.functions.invoke('livekit-host-controls', {
        body: { action, roomName: roomCode, identity, trackSid, mute: true },
      });
      if (error) throw error;
      toast({ title: action === 'mute' ? 'Participante silenciado' : 'Participante removido' });
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  };

  const askSkill = async () => {
    if (!skillInput.trim() || isSkillLoading || !activeSkill) return;
    const q = skillInput.trim();
    setSkillInput('');
    setSkillMessages(prev => [...prev, { role: 'user', content: q }]);
    setIsSkillLoading(true);
    try {
      const ctx = (transcriptionMessages || []).slice(-30).map(m =>
        `${m.speaker || 'Participante'}: ${m.text}`).join('\n');

      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          message: `Você é o agente "${activeSkill.name}". ${activeSkill.description}\n\nContexto da reunião:\n${ctx}\n\nPergunta: ${q}`,
          roomCode,
        },
      });
      if (error) {
        console.error('Skill Error:', error);
        throw new Error(error.message || 'Erro ao consultar a Skill.');
      }
      setSkillMessages(prev => [...prev, { role: 'assistant', content: data?.response || '...' }]);
    } catch (e: any) {
      console.error('Skill catch error:', e);
      setSkillMessages(prev => [...prev, { role: 'assistant', content: e.message || 'Erro ao consultar a Skill.' }]);
    } finally {
      setIsSkillLoading(false);
    }
  };

  useEffect(() => {
    if (skillScrollRef.current) skillScrollRef.current.scrollTop = skillScrollRef.current.scrollHeight;
  }, [skillMessages]);

  // AI Chat State
  const [aiMessages, setAiMessages] = useState<AIMessage[]>([]);
  const [aiInput, setAiInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const aiScrollRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);

  const scrollToBottom = (smooth = true) => {
    const el = chatScrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  };

  // Track whether user is near the bottom of the chat scroll area.
  // If they are scrolling up to read older messages, do not auto-scroll on new messages.
  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      isNearBottomRef.current = distanceFromBottom < 80;
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [activeTab]);

  useEffect(() => {
    if (isNearBottomRef.current) {
      // Defer to next frame so layout settles after new message render
      requestAnimationFrame(() => scrollToBottom(true));
    }
  }, [messages]);

  // Listen for incoming chat messages from other participants via LiveKit data channel
  useEffect(() => {
    if (!room) return;
    const handleDataReceived = (payload: Uint8Array, participant: any) => {
      try {
        const decoder = new TextDecoder();
        const data = JSON.parse(decoder.decode(payload));
        if (data.type !== 'chat' && data.type !== 'file') return;

        const senderName = participant?.name || participant?.identity || 'Participante';
        const newMsg: ChatMessage = {
          id: `${Date.now()}-${Math.random()}`,
          sender_name: senderName,
          message: data.type === 'chat' ? data.text : `Enviou um arquivo: ${data.fileName}`,
          timestamp: new Date().toISOString(),
          file_url: data.type === 'file' ? data.fileUrl : undefined,
        };
        setMessages((prev) => [...prev, newMsg]);

        // Notify if chat isn't open
        if (isCollapsed || activeTab !== 'chat') {
          playNotification();
          setUnreadChat((u) => u + 1);
          setChatPulse(true);
          setTimeout(() => setChatPulse(false), 2500);
        }
      } catch (e) {
        console.error('Erro ao processar dado de chat:', e);
      }
    };
    room.on('dataReceived', handleDataReceived);
    return () => {
      room.off('dataReceived', handleDataReceived);
    };
  }, [room, isCollapsed, activeTab, playNotification]);

  // Clear unread counts when user opens the corresponding tab
  useEffect(() => {
    if (!isCollapsed && activeTab === 'chat') setUnreadChat(0);
    if (!isCollapsed && activeTab === 'skill') setUnreadSkill(0);
  }, [isCollapsed, activeTab]);

  useEffect(() => {
    if (aiScrollRef.current) {
      aiScrollRef.current.scrollTop = aiScrollRef.current.scrollHeight;
    }
  }, [aiMessages]);

  // Auto-collapse on small screens
  useEffect(() => {
    const checkWidth = () => {
      if (window.innerWidth < 1100) {
        setIsCollapsed(true);
      }
    };
    checkWidth();
    window.addEventListener('resize', checkWidth);
    return () => window.removeEventListener('resize', checkWidth);
  }, []);

  const sendMessage = async () => {
    if (!inputMessage.trim()) return;

    const text = inputMessage.trim();
    const newMessage: ChatMessage = {
      id: Math.random().toString(),
      sender_name: user?.user_metadata?.full_name || 'Convidado',
      message: text,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, newMessage]);
    setInputMessage('');

    // Broadcast to other participants via LiveKit data channel
    try {
      if (room?.localParticipant) {
        const payload = new TextEncoder().encode(
          JSON.stringify({ type: 'chat', text, timestamp: new Date().toISOString() })
        );
        await room.localParticipant.publishData(payload, { reliable: true });
      }
    } catch (e) {
      console.error('Erro ao publicar mensagem:', e);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "O arquivo deve ter no máximo 10MB.",
        variant: "destructive",
      });
      return;
    }

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `chat-files/${roomCode}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('meeting-audios')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('meeting-audios')
        .getPublicUrl(filePath);

      const newMessage: ChatMessage = {
        id: Math.random().toString(),
        sender_name: user?.user_metadata?.full_name || 'Convidado',
        message: `Enviou um arquivo: ${file.name}`,
        timestamp: new Date().toISOString(),
        file_url: data.publicUrl,
      };
      
      setMessages((prev) => [...prev, newMessage]);
      
      toast({
        title: "Arquivo enviado!",
        description: "O arquivo foi compartilhado no chat.",
      });
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "Erro ao enviar arquivo",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleAiSend = async () => {
    if (!aiInput.trim() || isAiLoading) return;

    const userMessage = aiInput.trim();
    setAiInput('');
    setAiMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsAiLoading(true);

    try {
      const transcriptContext = (transcriptionMessages || [])
        .map(m => `[${new Date(m.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}] ${m.speaker || 'Participante'}: ${m.text}`)
        .join('\n');

      const contextMessage = transcriptContext 
        ? `Contexto da reunião (transcrição):\n${transcriptContext}\n\nPergunta do usuário: ${userMessage}`
        : userMessage;

      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: { 
          message: contextMessage,
          roomCode: roomCode 
        }
      });

      if (error) throw error;

      if (data?.response) {
        setAiMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
      }
    } catch (error: any) {
      console.error('AI Chat error:', error);
      toast({
        title: "Erro ao enviar mensagem",
        description: error.message || "Não foi possível processar sua pergunta.",
        variant: "destructive",
      });
      setAiMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Desculpe, ocorreu um erro ao processar sua pergunta. Por favor, tente novamente.' 
      }]);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleAiKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAiSend();
    }
  };

  // Collapsed state - just a toggle button
  if (isCollapsed) {
    return (
      <div className="flex flex-col items-center gap-2 mr-4 mb-4 pt-4">
        <button
          onClick={() => setIsCollapsed(false)}
          className="w-10 h-10 rounded-full bg-white dark:bg-[#1A1A1A] border dark:border-white/10 shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
          title="Abrir chat"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-white/60" />
        </button>
        <button
          onClick={() => { setIsCollapsed(false); setActiveTab('chat'); }}
          className={cn(
            "relative w-10 h-10 rounded-full bg-white dark:bg-[#1A1A1A] border dark:border-white/10 shadow-lg flex items-center justify-center hover:scale-105 transition-transform",
            chatPulse && "ring-2 ring-[#3600FF] animate-pulse"
          )}
          title="Chat"
        >
          <MessageSquare className="w-4 h-4 text-gray-600 dark:text-white/60" />
          {unreadChat > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-[#3600FF] text-white text-[9px] font-bold flex items-center justify-center">
              {unreadChat > 9 ? '9+' : unreadChat}
            </span>
          )}
        </button>
        <button
          onClick={() => { setIsCollapsed(false); setActiveTab('participants'); }}
          className="w-10 h-10 rounded-full bg-white dark:bg-[#1A1A1A] border dark:border-white/10 shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
          title="Participantes"
        >
          <Users className="w-4 h-4 text-gray-600 dark:text-white/60" />
        </button>
        <button
          onClick={() => { setIsCollapsed(false); setActiveTab('skill'); }}
          className={cn(
            "relative w-10 h-10 rounded-full shadow-lg flex items-center justify-center hover:scale-105 transition-transform",
             activeSkill ? "bg-[#3600FF] ring-2 ring-[#3600FF]/40" : "bg-white dark:bg-[#1A1A1A] border dark:border-white/10"
          )}
          title={activeSkill ? `Inteligência · ${activeSkill.name}` : "Inteligência"}
        >
           {activeSkill && <span className="absolute inset-0 rounded-full bg-[#3600FF]/30 animate-ping" />}
          <Brain className={cn("w-4 h-4", activeSkill ? "text-white" : "text-gray-600 dark:text-white/60")} />
          {unreadSkill > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-emerald-500 text-white text-[9px] font-bold flex items-center justify-center">
              {unreadSkill > 9 ? '9+' : unreadSkill}
            </span>
          )}
        </button>
        {onTranscriptionClick && (
          <button
            onClick={onTranscriptionClick}
            className="w-10 h-10 rounded-full bg-white dark:bg-[#1A1A1A] border dark:border-white/10 shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
            title="Transcrição"
          >
            <FileText className="w-4 h-4 text-gray-600 dark:text-white/60" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="w-[340px] xl:w-[380px] h-full max-h-full min-h-0 bg-white dark:bg-[#141414] flex flex-col rounded-3xl shadow-2xl mr-4 mb-4 transition-all duration-300 overflow-hidden border dark:border-white/5">
      {/* Tabs Header */}
      <div className="flex items-center justify-between border-b dark:border-white/5 px-3 py-3 bg-gray-50/50 dark:bg-black/20">
        <div className="flex gap-1 items-center bg-white dark:bg-white/5 rounded-xl p-1 border border-gray-200 dark:border-white/10 shadow-sm">
          <button
            onClick={() => setActiveTab('participants')}
            title={`Participantes (${participants.length})`}
            className={cn(
              "relative flex items-center justify-center w-9 h-9 rounded-lg transition-all",
              activeTab === 'participants'
                ? 'bg-[#3600FF] text-white shadow-sm'
                : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5'
            )}
          >
            <Users className="w-4 h-4" />
            {participants.length > 0 && (
              <span className={cn(
                "absolute -top-1 -right-1 text-[9px] font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-1",
                activeTab === 'participants' ? 'bg-white text-[#3600FF]' : 'bg-[#3600FF] text-white'
              )}>
                {participants.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            title="Chat"
            className={cn(
              "flex items-center justify-center w-9 h-9 rounded-lg transition-all",
              "relative",
              activeTab === 'chat'
                ? 'bg-[#3600FF] text-white shadow-sm'
                : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5'
            )}
          >
            <MessageSquare className="w-4 h-4" />
            {unreadChat > 0 && activeTab !== 'chat' && (
              <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-1 rounded-full bg-[#3600FF] text-white text-[8px] font-bold flex items-center justify-center">
                {unreadChat > 9 ? '9+' : unreadChat}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('skill')}
            title="Inteligência"
            className={cn(
              "relative flex items-center justify-center w-9 h-9 rounded-lg transition-all",
               activeTab === 'skill'
                 ? 'bg-[#3600FF] text-white shadow-sm'
                 : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5'
            )}
          >
            <Brain className="w-4 h-4" />
            {activeSkill && activeTab !== 'skill' && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-emerald-500 rounded-full ring-2 ring-white animate-pulse" />
            )}
          </button>
          <button
            onClick={onTranscriptionClick}
            title="Transcrição"
            className="flex items-center justify-center w-9 h-9 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 transition-all"
          >
            <FileText className="w-4 h-4" />
          </button>
        </div>
        <button
          onClick={() => setIsCollapsed(true)}
          className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-600 dark:hover:text-white/80 transition-colors"
          title="Minimizar"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Active tab label */}
      <div className="px-4 py-2 border-b dark:border-white/5 bg-white dark:bg-transparent">
        <p className="text-[11px] font-bold text-gray-700 dark:text-white/60 uppercase tracking-wider">
          {activeTab === 'participants' && `Participantes · ${participants.length}`}
          {activeTab === 'chat' && 'Mensagens da reunião'}
          {activeTab === 'skill' && (activeSkill?.name || 'Inteligência Estratégica')}
        </p>
      </div>

      {/* Content Area */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'chat' && (
          <div className="h-full flex flex-col min-h-0">
            <div ref={chatScrollRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2">
              {messages.length === 0 && (
                <div className="text-center text-gray-400 dark:text-white/30 text-sm py-8">
                  Nenhuma mensagem ainda
                </div>
              )}
              {messages.map((msg) => (
                <div key={msg.id} className="bg-gray-50 dark:bg-white/5 rounded-2xl p-3 border dark:border-white/5">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-xs text-gray-900 dark:text-white/90">
                      {msg.sender_name}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-white/30">
                      {new Date(msg.timestamp).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-white/70">{msg.message}</p>
                  {msg.file_url && (
                    <a
                      href={msg.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#2F428D] hover:underline mt-1 inline-block"
                    >
                      📎 Abrir arquivo
                    </a>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-3 border-t dark:border-white/5 rounded-b-3xl">
              <div className="flex items-center gap-2 bg-gray-50 dark:bg-white/5 border dark:border-white/5 rounded-full px-3 py-1.5">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-8 w-8 p-0 hover:bg-transparent"
                >
                  <Paperclip className="w-4 h-4 text-gray-600 dark:text-white/60" />
                </Button>
                <Input
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Mensagem..."
                  className="flex-1 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-sm dark:text-white placeholder:dark:text-white/30"
                />
                <Button
                  onClick={sendMessage}
                  size="icon"
                  disabled={!inputMessage.trim()}
                  className="h-8 w-8 p-0 rounded-full"
                  style={{ backgroundColor: '#3600FF' }}
                >
                  <Send className="w-4 h-4 text-white" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'participants' && (
          <div className="h-full overflow-y-auto p-3 space-y-2">
            {participants.length === 0 && (
              <p className="text-sm text-gray-400 dark:text-white/30 text-center py-8">Nenhum participante</p>
            )}
            {participants.map((p) => {
              const isLocal = p.identity === localParticipant?.identity;
              const audioPub = Array.from(p.audioTrackPublications.values() as any)[0] as any;
              const isMuted = !audioPub || audioPub.isMuted;
              const name = p.name || p.identity;
              const isSpeaking = (p as any).isSpeaking;
              const currentVolume = isLocal ? localMicVolume : (participantVolumes[p.identity] ?? 1);

              return (
                <div 
                  key={p.identity} 
                  className={cn(
                    "flex flex-col gap-2 p-3 rounded-xl transition-all duration-200 border mb-2",
                    isSpeaking 
                      ? "bg-emerald-50 border-emerald-200 shadow-sm" 
                       : "bg-gray-50 dark:bg-white/5 border-transparent dark:border-white/5 hover:bg-gray-100 dark:hover:bg-white/10"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-full bg-[#3600FF]/10 dark:bg-[#3600FF]/20 text-[#3600FF] flex items-center justify-center text-xs font-bold shrink-0">
                        {name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-white/90 truncate">
                          {name} {isLocal && <span className="text-xs text-gray-400 dark:text-white/30">(você)</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <div className={cn('p-1.5 rounded-full', isMuted ? 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400' : 'bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400')}>
                        {isMuted ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                      </div>
                      {isHost && !isLocal && (
                        <>
                          {!isMuted && audioPub?.trackSid && (
                            <button
                              onClick={() => handleHostAction('mute', p.identity, audioPub.trackSid)}
                              className="p-1.5 rounded-full hover:bg-orange-100 text-orange-600"
                              title="Silenciar"
                            >
                              <MicOff className="w-3 h-3" />
                            </button>
                          )}
                          <button
                            onClick={() => {
                              if (confirm(`Remover ${name} da reunião?`)) handleHostAction('kick', p.identity);
                            }}
                            className="p-1.5 rounded-full hover:bg-red-100 text-red-600"
                            title="Remover"
                          >
                            <UserX className="w-3 h-3" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  
                  {/* Volume Control */}
                  <div className="flex items-center gap-3 px-1 mt-1">
                    {isLocal ? (
                      <Mic className="h-3 w-3 text-primary shrink-0" />
                    ) : currentVolume === 0 ? (
                      <VolumeX className="h-3 w-3 text-muted-foreground shrink-0" />
                    ) : (
                      <Volume2 className="h-3 w-3 text-muted-foreground shrink-0" />
                    )}
                    <Slider
                      value={[currentVolume * 100]}
                      max={100}
                      step={1}
                      onValueChange={(vals) => {
                        if (isLocal) {
                          onLocalMicVolumeChange?.(vals[0] / 100);
                        } else {
                          onVolumeChange?.(p.identity, vals[0] / 100);
                          // We actually apply the volume to the track here for immediate feedback
                          const track = p.getTrackPublication(Track.Source.Microphone)?.audioTrack;
                          if (track && 'setVolume' in track) {
                            (track as any).setVolume(vals[0] / 100);
                          }
                        }
                      }}
                      className="w-full"
                    />
                    <span className="text-[10px] text-gray-400 w-6 font-mono">
                      {Math.round(currentVolume * 100)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'skill' && (
          <div className="h-full flex flex-col overflow-hidden animate-in fade-in duration-300">
            {activeSkill && (
               <div className="px-4 py-2 border-b dark:border-white/5 bg-[#3600FF]/5 flex items-center justify-between">
                <span className="text-[10px] text-gray-500 dark:text-white/40 uppercase tracking-wide">Analista em tempo real</span>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-[8px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">Ouvindo todos</span>
                  </div>
                  {skillActivationIdentity && (
                    <span className="text-[9px] text-gray-400 dark:text-white/20 italic">
                      Ativado por: {allParticipants.find(p => p.identity === skillActivationIdentity)?.name || 'Anfitrião'}
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="flex-1 overflow-hidden flex flex-col">
              <div ref={skillScrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                {!activeSkill ? (
                  <div className="text-center py-12 px-6">
                    <Sparkles className="w-10 h-10 mx-auto mb-4 text-gray-200" />
                    <p className="text-sm text-gray-500 dark:text-white/40 font-medium">Nenhuma Skill ativada</p>
                    <p className="text-xs text-gray-400 dark:text-white/20 mt-1">Ative uma Skill nos controles inferiores para começar a análise estratégica.</p>
                  </div>
                ) : skillMessages.length === 0 ? (
                  <div className="text-center py-12 px-6">
                     <Bot className="w-10 h-10 mx-auto mb-4 text-[#3600FF]/20 dark:text-[#3600FF]/40" />
                    <p className="text-sm text-gray-600 dark:text-white/60 font-bold">Estou acompanhando...</p>
                    <p className="text-xs text-gray-500 dark:text-white/40 mt-2 leading-relaxed">
                      Vou analisar a transcrição e enviar insights estratégicos.
                      Você também pode me perguntar qualquer coisa sobre a reunião abaixo.
                    </p>
                  </div>
                ) : (
                   skillMessages.map((m, i) => (
                     <div key={i} className={cn(
                       'p-3 rounded-2xl text-sm max-w-[90%] animate-in fade-in slide-in-from-bottom-2 duration-300 relative group/msg',
                       m.role === 'user'
                          ? 'bg-[#3600FF] text-white ml-auto rounded-tr-none'
                         : 'bg-gray-100 dark:bg-white/5 text-gray-800 dark:text-white/80 rounded-tl-none border border-gray-200 dark:border-white/5 shadow-sm'
                     )}>
                       {m.content}
                       {m.role === 'assistant' && (
                         <button
                           onClick={() => playTTS(m.content, i)}
                           disabled={playingTTSIndex !== null}
                           className={cn(
                             "absolute -right-8 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-white/10 shadow-sm opacity-0 group-hover/msg:opacity-100 transition-all hover:bg-gray-50 dark:hover:bg-white/5",
                             playingTTSIndex === i && "opacity-100 bg-[#F0F2FE] dark:bg-[#3600FF]/20 border-[#B3BFF0] dark:border-[#3600FF]/40"
                           )}
                           title="Ouvir com ElevenLabs"
                         >
                           {playingTTSIndex === i ? (
                             <Loader2 className="w-3.5 h-3.5 animate-spin text-[#3600FF]" />
                           ) : (
                             <Volume2 className="w-3.5 h-3.5 text-gray-500 dark:text-white/40" />
                           )}
                         </button>
                       )}
                     </div>
                   ))
                )}
                {isSkillLoading && (
                  <div className="bg-gray-50 text-gray-400 text-xs p-3 rounded-2xl rounded-tl-none flex items-center gap-2 max-w-[60%] border border-gray-100">
                    <Loader2 className="w-3 h-3 animate-spin" /> Analisando...
                  </div>
                )}
              </div>

              <div className="p-4 border-t bg-gray-50/50">
                 <div className="flex items-center gap-2 bg-white border border-gray-200 shadow-sm rounded-2xl px-3 py-1.5 focus-within:border-[#3600FF]/50 transition-all">
                  <Input
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), askSkill())}
                    placeholder={activeSkill ? `Perguntar à ${activeSkill.name}...` : "Ative uma Skill..."}
                    disabled={!activeSkill || isSkillLoading}
                    className="flex-1 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-sm h-9"
                  />
                  <Button
                    onClick={askSkill}
                    size="icon"
                    disabled={!activeSkill || !skillInput.trim() || isSkillLoading}
                     className="h-8 w-8 p-0 rounded-xl bg-[#3600FF] hover:bg-[#3600FF]/90 shadow-sm"
                  >
                    <Send className="w-4 h-4 text-white" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default MeetingChatSidebar;
