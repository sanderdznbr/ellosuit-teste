import React, { useState, useEffect, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
 import { Send, Users, MessageSquare, Crown, Mic, MicOff, Video, VideoOff, FileText, Paperclip, Download, File, Volume2, VolumeX, SlidersHorizontal } from 'lucide-react';
 import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import {
  useParticipants, 
  useRoomContext,
   useLocalParticipant
 } from '@livekit/components-react';
 import { Track } from 'livekit-client';
import TranscriptionPanel from './TranscriptionPanel';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface MeetingSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: 'participants' | 'chat';
  onTabChange: (tab: 'participants' | 'chat') => void;
  roomId?: string;
  transcriptionMessages: Array<{text: string, is_final: boolean, timestamp: string, speaker?: string}>;
  onTranscriptionMessagesUpdate: (messages: Array<{text: string, is_final: boolean, timestamp: string, speaker?: string}>) => void;
}

interface ChatMessage {
  id: number;
  participant: string;
  message?: string;
  file?: { name: string; size: number; type: string; url: string };
  timestamp: Date;
}

interface SupabaseParticipant {
  id: string;
  display_name: string;
  user_id: string | null;
  is_host: boolean;
  audio_enabled: boolean;
  video_enabled: boolean;
  waiting_approval: boolean;
}

const MeetingSidebar: React.FC<MeetingSidebarProps> = ({ 
  isOpen, 
  onClose, 
  activeTab, 
  onTabChange,
  roomId,
  transcriptionMessages,
  onTranscriptionMessagesUpdate
}) => {
  const [inputMessage, setInputMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [supabaseParticipants, setSupabaseParticipants] = useState<SupabaseParticipant[]>([]);
   const participants = useParticipants();
   const { localParticipant } = useLocalParticipant();
   const room = useRoomContext();
   const [participantVolumes, setParticipantVolumes] = useState<Record<string, number>>({});
   const [localMicVolume, setLocalMicVolume] = useState(1);
   // Load initial volumes
   useEffect(() => {
     const volumes: Record<string, number> = {};
     participants.forEach(p => {
       const audioTrack = p.getTrackPublication(Track.Source.Microphone)?.audioTrack;
       if (audioTrack && 'setVolume' in audioTrack) {
         // LiveKit doesn't have a getVolume, so we default to 1 or last known
         volumes[p.identity] = 1;
       }
     });
     setParticipantVolumes(prev => ({ ...volumes, ...prev }));
   }, [participants.length]);

   const handleVolumeChange = (participantIdentity: string, volume: number) => {
     const participant = participants.find(p => p.identity === participantIdentity);
     if (participant) {
       const audioTrack = participant.getTrackPublication(Track.Source.Microphone)?.audioTrack;
       if (audioTrack && 'setVolume' in audioTrack) {
         (audioTrack as any).setVolume(volume);
         setParticipantVolumes(prev => ({ ...prev, [participantIdentity]: volume }));
       }
     }
   };

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Fetch participants from Supabase
  useEffect(() => {
    if (!roomId) return;

    const fetchSupabaseParticipants = async () => {
      try {
        const { data, error } = await supabase
          .from('room_participants')
          .select('id, display_name, user_id, is_host, audio_enabled, video_enabled, waiting_approval')
          .eq('room_id', roomId)
          .is('left_at', null);

        if (error) {
          console.error('Erro ao buscar participantes do Supabase:', error);
          return;
        }

        console.log('✅ Participantes do Supabase:', data);
        setSupabaseParticipants(data || []);
      } catch (error) {
        console.error('Erro ao buscar participantes:', error);
      }
    };

    fetchSupabaseParticipants();

    // Subscribe to realtime changes
    const channel = supabase
      .channel(`room_participants_${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_participants',
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          console.log('🔄 Atualização de participantes detectada');
          fetchSupabaseParticipants();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  // Listen for chat messages and files
  useEffect(() => {
    if (!room) {
      console.log('⚠️ Room não disponível para chat');
      return;
    }

    console.log('✅ Room disponível, configurando listener de chat');

    const handleDataReceived = (payload: Uint8Array, participant: any) => {
      try {
        const decoder = new TextDecoder();
        const data = JSON.parse(decoder.decode(payload));
        
        console.log('📩 Dados recebidos:', data.type, 'de', participant?.name);
        
        if (data.type === 'chat') {
          console.log('💬 Mensagem de chat recebida:', data.text);
          setMessages(prev => [...prev, {
            id: Date.now(),
            participant: participant?.name || participant?.identity || 'Participante',
            message: data.text,
            timestamp: new Date()
          }]);
        } else if (data.type === 'file') {
          console.log('📎 Arquivo recebido:', data.fileName);
          setMessages(prev => [...prev, {
            id: Date.now(),
            participant: participant?.name || participant?.identity || 'Participante',
            file: {
              name: data.fileName,
              size: data.fileSize,
              type: data.fileType,
              url: data.fileUrl
            },
            timestamp: new Date()
          }]);
        }
      } catch (error) {
        console.error('❌ Erro ao processar dados recebidos:', error);
      }
    };

    room.on('dataReceived', handleDataReceived);
    console.log('✅ Listener de chat configurado');
    
    return () => {
      console.log('🧹 Removendo listener de chat');
      room.off('dataReceived', handleDataReceived);
    };
  }, [room]);

  // Auto scroll chat to bottom
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) {
      console.warn('⚠️ Mensagem vazia');
      return;
    }
    
    if (!room) {
      console.error('❌ Room não disponível');
      toast({
        title: "Erro",
        description: "Sala não conectada",
        variant: "destructive"
      });
      return;
    }
    
    if (!localParticipant) {
      console.error('❌ LocalParticipant não disponível');
      toast({
        title: "Erro",
        description: "Você não está conectado à sala",
        variant: "destructive"
      });
      return;
    }

    try {
      console.log('📤 Enviando mensagem:', inputMessage);
      
      const messageData = {
        type: 'chat',
        text: inputMessage,
        timestamp: new Date().toISOString()
      };

      const encoder = new TextEncoder();
      const data = encoder.encode(JSON.stringify(messageData));
      
      if (!room.localParticipant) {
        throw new Error('LocalParticipant não disponível no room');
      }
      
      await room.localParticipant.publishData(data, { reliable: true });
      
      console.log('✅ Mensagem enviada com sucesso');
      
      const senderName = localParticipant.name || localParticipant.identity || 'Você';
      setMessages(prev => [...prev, {
        id: Date.now(),
        participant: senderName,
        message: inputMessage,
        timestamp: new Date()
      }]);
      
      setInputMessage('');
    } catch (error) {
      console.error('❌ Erro ao enviar mensagem:', error);
      toast({
        title: "Erro ao enviar mensagem",
        description: error instanceof Error ? error.message : "Não foi possível enviar a mensagem",
        variant: "destructive"
      });
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !room || !localParticipant) return;

    // Limit file size to 10MB for temporary sharing
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "O arquivo deve ter no máximo 10MB",
        variant: "destructive"
      });
      return;
    }

    try {
      // Convert file to base64 for temporary sharing via DataChannel
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64Data = reader.result as string;
          
          const fileData = {
            type: 'file',
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            fileUrl: base64Data, // Temporary base64 URL
            timestamp: new Date().toISOString()
          };

          const encoder = new TextEncoder();
          const data = encoder.encode(JSON.stringify(fileData));
          
          await room.localParticipant.publishData(data, { reliable: true });
          
          const senderName = localParticipant.name || localParticipant.identity || 'Você';
          setMessages(prev => [...prev, {
            id: Date.now(),
            participant: senderName,
            file: {
              name: file.name,
              size: file.size,
              type: file.type,
              url: base64Data
            },
            timestamp: new Date()
          }]);

          toast({
            title: "Arquivo compartilhado",
            description: `${file.name} foi compartilhado com sucesso`,
          });
        } catch (error) {
          console.error('Error sharing file:', error);
          toast({
            title: "Erro ao compartilhar",
            description: "Não foi possível compartilhar o arquivo",
            variant: "destructive"
          });
        }
      };
      
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error reading file:', error);
      toast({
        title: "Erro ao ler arquivo",
        description: "Não foi possível ler o arquivo",
        variant: "destructive"
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="h-full w-full bg-background flex flex-col">
      <Tabs value={activeTab} onValueChange={onTabChange} className="flex-1 flex flex-col h-full">
        {/* Modern Clean Header with Tabs - Light Theme */}
        <div className="flex-none border-b border-border bg-background">
          <TabsList className="grid w-full grid-cols-2 h-12 bg-muted rounded-none">
            <TabsTrigger 
              value="participants" 
              className="flex items-center gap-2 text-sm data-[state=active]:bg-background data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
            >
              <Users className="h-4 w-4" />
              <span>Participantes</span>
            </TabsTrigger>
            <TabsTrigger 
              value="chat" 
              className="flex items-center gap-2 text-sm data-[state=active]:bg-background data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
            >
              <MessageSquare className="h-4 w-4" />
              <span>Bate-papo</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab Contents */}
        <div className="flex-1 overflow-hidden">
          <TabsContent value="participants" className="h-full m-0 flex flex-col">
            <div className="flex-none p-4 border-b border-border bg-background">
              <h3 className="font-semibold text-foreground">Participantes na reunião</h3>
              <p className="text-sm text-muted-foreground">
                {supabaseParticipants.filter(p => !p.waiting_approval).length} pessoa{supabaseParticipants.filter(p => !p.waiting_approval).length !== 1 ? 's' : ''} na reunião
                {supabaseParticipants.filter(p => p.waiting_approval).length > 0 && 
                  ` • ${supabaseParticipants.filter(p => p.waiting_approval).length} aguardando`
                }
              </p>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-3">
                {supabaseParticipants.filter(p => !p.waiting_approval).length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground font-medium">Nenhum participante ainda</p>
                  </div>
                ) : (
                  supabaseParticipants
                    .filter(p => !p.waiting_approval)
                    .map((participant) => {
                      // Find matching LiveKit participant for audio/video status
                      const liveKitParticipant = participants.find(p => 
                        p.identity === participant.user_id || 
                        p.metadata === participant.display_name
                      );
                      
                       const isLocalUser = participant.user_id === localParticipant?.identity || 
                                          liveKitParticipant?.identity === localParticipant?.identity;
                       const currentVolume = isLocalUser ? localMicVolume : (participantVolumes[liveKitParticipant?.identity || ''] ?? 1);
                      
                      // Use LiveKit status if available, otherwise use Supabase status
                      const audioEnabled = liveKitParticipant?.isMicrophoneEnabled ?? participant.audio_enabled;
                      const videoEnabled = liveKitParticipant?.isCameraEnabled ?? participant.video_enabled;
                      
                      console.log('👤 [Participant Combined]', {
                        supabase: participant.display_name,
                        liveKit: liveKitParticipant?.name,
                        isLocalUser,
                        audioEnabled,
                        videoEnabled
                      });
                      
                      return (
                        <div 
                          key={participant.id} 
                          className="flex items-center justify-between p-4 rounded-xl transition-all duration-200"
                          style={{
                            background: participant.is_host || isLocalUser
                              ? 'linear-gradient(135deg, hsl(var(--primary) / 0.15), hsl(var(--primary) / 0.05))'
                              : 'hsl(var(--muted))',
                            border: participant.is_host || isLocalUser
                              ? '1px solid hsl(var(--primary) / 0.3)' 
                              : '1px solid transparent'
                          }}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            {(participant.is_host || isLocalUser) && (
                              <div className="flex-shrink-0 p-1.5 rounded-full" style={{ background: 'hsl(var(--primary) / 0.2)' }}>
                                <Crown className="h-4 w-4" style={{ color: 'hsl(var(--primary))' }} />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold truncate" style={{ color: 'hsl(var(--foreground))' }}>
                                {participant.display_name}
                                {isLocalUser && <span className="ml-2 text-xs font-normal" style={{ color: 'hsl(var(--muted-foreground))' }}>(Você)</span>}
                              </p>
                              <p className="text-xs mt-0.5 truncate" style={{ color: 'hsl(var(--muted-foreground))' }}>
                                {participant.is_host ? 'Anfitrião' : 'Participante'}
                              </p>
                            </div>
                          </div>
                          
                           <div className="flex flex-col items-end gap-2 flex-shrink-0">
                             <div className="flex items-center gap-2">
                               <div className={cn(
                                 "p-2 rounded-full transition-colors",
                              audioEnabled 
                                ? "bg-green-500/20 text-green-600 dark:bg-green-500/30 dark:text-green-400" 
                                : "bg-red-500/20 text-red-600 dark:bg-red-500/30 dark:text-red-400"
                            )}>
                              {audioEnabled ? (
                                <Mic className="h-3.5 w-3.5" />
                              ) : (
                                <MicOff className="h-3.5 w-3.5" />
                              )}
                               </div>
                               <div className={cn(
                                 "p-2 rounded-full transition-colors",
                              videoEnabled 
                                ? "bg-green-500/20 text-green-600 dark:bg-green-500/30 dark:text-green-400" 
                                : "bg-red-500/20 text-red-600 dark:bg-red-500/30 dark:text-red-400"
                            )}>
                              {videoEnabled ? (
                                <Video className="h-3.5 w-3.5" />
                              ) : (
                                <VideoOff className="h-3.5 w-3.5" />
                              )}
                               </div>
                             </div>
                             
                             {!isLocalUser && liveKitParticipant && (
                               <div className="flex items-center gap-2 w-24 px-1">
                                 {currentVolume === 0 ? <VolumeX className="h-3 w-3 text-muted-foreground" /> : <Volume2 className="h-3 w-3 text-muted-foreground" />}
                                 <Slider
                                   value={[currentVolume * 100]}
                                   max={100}
                                   step={1}
                                   onValueChange={(vals) => handleVolumeChange(liveKitParticipant.identity, vals[0] / 100)}
                                   className="w-full"
                                 />
                               </div>
                             )}
                             
                             {isLocalUser && (
                               <div className="flex items-center gap-2 w-24 px-1" title="Volume do seu microfone">
                                 <Mic className="h-3 w-3 text-primary" />
                                 <Slider
                                   value={[localMicVolume * 100]}
                                   max={100}
                                   step={1}
                                   onValueChange={(vals) => setLocalMicVolume(vals[0] / 100)}
                                   className="w-full"
                                 />
                               </div>
                             )}
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="chat" className="h-full m-0 flex flex-col">
            <div className="flex-none p-4 border-b border-border bg-background">
              <h3 className="font-semibold text-foreground">Chat da reunião</h3>
              <p className="text-sm text-muted-foreground">Converse e compartilhe arquivos</p>
            </div>
            
            <ScrollArea className="flex-1" ref={chatScrollRef}>
              <div className="p-4 space-y-4">
                {messages.length === 0 ? (
                  <div className="text-center py-8">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground font-medium">Nenhuma mensagem ainda</p>
                    <p className="text-xs text-muted-foreground mt-1">Envie uma mensagem para começar a conversa</p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div key={msg.id} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-foreground">
                          {msg.participant}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      {msg.message ? (
                        <div className="text-sm text-foreground leading-relaxed bg-primary/10 rounded-2xl px-4 py-3 border border-primary/20">
                          {msg.message}
                        </div>
                      ) : msg.file ? (
                        <div className="flex items-center gap-3 bg-accent rounded-2xl px-4 py-3 border border-border">
                          <File className="h-8 w-8 text-primary flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{msg.file.name}</p>
                            <p className="text-xs text-muted-foreground">{formatFileSize(msg.file.size)}</p>
                          </div>
                          <a
                            href={msg.file.url}
                            download={msg.file.name}
                            className="flex-shrink-0"
                          >
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-primary/10">
                              <Download className="h-4 w-4" />
                            </Button>
                          </a>
                        </div>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>

            <div className="flex-none p-4 border-t border-border bg-background">
              {!room || !localParticipant ? (
                <div className="text-center py-2">
                  <p className="text-xs text-muted-foreground">
                    {!room ? '🔌 Aguardando conexão com a sala...' : '👤 Conectando participante...'}
                  </p>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    size="sm"
                    variant="ghost"
                    className="px-3 rounded-full"
                    disabled={!room || !localParticipant}
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <Input
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Digite sua mensagem..."
                    className="flex-1 bg-background rounded-full border-border"
                    disabled={!room || !localParticipant}
                  />
                  <Button 
                    onClick={handleSendMessage}
                    disabled={!inputMessage.trim() || !room || !localParticipant}
                    size="sm"
                    className="rounded-full"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};

export default MeetingSidebar;
