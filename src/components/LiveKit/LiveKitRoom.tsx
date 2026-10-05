import React, { useEffect, useRef, useState } from 'react';
import {
  LiveKitRoom,
  GridLayout,
  ParticipantTile,
  ControlBar,
  Chat,
  useRoomContext,
  useTracks,
  useParticipants,
  RoomAudioRenderer,
} from '@livekit/components-react';
import { Track, ConnectionState } from 'livekit-client';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Copy, Users, MessageCircle, Settings, PhoneOff } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ErrorBoundary from '@/components/ErrorBoundary';
import '@/styles/livekit.css';

interface LiveKitRoomProps {
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

const LiveKitRoomComponent: React.FC<LiveKitRoomProps> = ({ 
  roomName, 
  participantName, 
  onLeave 
}) => {
  const [token, setToken] = useState<string>('');
  const [serverUrl, setServerUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const { user } = useAuth();
  const { toast } = useToast();
  const retryRef = useRef(0);
  const intentionalDisconnectRef = useRef(false);

  useEffect(() => {
    const generateToken = async () => {
      try {
        setLoading(true);
        setError('');

        console.log('Generating LiveKit token for room:', roomName);

        const { data, error } = await supabase.functions.invoke('livekit-token', {
          body: {
            roomName,
            participantName: participantName || user?.user_metadata?.full_name || 'Participante'
          }
        });

        if (error) {
          throw error;
        }

        const tokenData = data as TokenResponse;
        console.log('Token generated successfully:', tokenData);

        setToken(tokenData.token);
        setServerUrl(tokenData.url);
        
        toast({
          title: "Conectado",
          description: "Entrando na sala de reunião...",
        });

      } catch (err) {
        console.error('Error generating token:', err);
        setError(err instanceof Error ? err.message : 'Erro ao gerar token');
        toast({
          title: "Erro",
          description: "Falha ao conectar na sala de reunião",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    if (roomName) {
      generateToken();
    }
  }, [roomName, participantName, user, toast]);

  const regenerateToken = React.useCallback(async () => {
    try {
      setError('');
      const { data, error } = await supabase.functions.invoke('livekit-token', {
        body: {
          roomName,
          participantName: participantName || user?.user_metadata?.full_name || 'Participante'
        }
      });
      if (error) throw error;
      const tokenData = data as TokenResponse;
      setToken(tokenData.token);
      setServerUrl(tokenData.url);
      toast({ title: 'Reconectando...', description: 'Atualizando credenciais da chamada' });
    } catch (e) {
      console.error('Erro ao renovar token:', e);
      setError(e instanceof Error ? e.message : 'Erro ao renovar token');
    }
  }, [roomName, participantName, user, toast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-muted-foreground">Conectando à sala...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="text-destructive">Erro: {error}</p>
          <div className="flex gap-2">
            <Button onClick={() => {
              setError('');
              setLoading(true);
              regenerateToken();
            }} variant="outline">
              Tentar novamente
            </Button>
            <Button onClick={onLeave} variant="outline">
              Voltar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!token || !serverUrl) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <p className="text-muted-foreground">Preparando sala...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="h-screen w-full bg-background overflow-hidden">
        <LiveKitRoom
          key={token}
          video={true}
          audio={true}
          token={token}
          serverUrl={serverUrl}
          data-lk-theme="default"
          options={{
            adaptiveStream: true,
            dynacast: true,
            videoCaptureDefaults: {
              resolution: { width: 1280, height: 720, frameRate: 30 }
            }
          }}
          onConnected={() => {
            console.log('Connected to LiveKit room');
            retryRef.current = 0; // Reset retry counter on successful connection
            intentionalDisconnectRef.current = false;
            toast({
              title: "Conectado",
              description: "Você entrou na sala de reunião",
            });
          }}
          onDisconnected={(reason) => {
            console.log('Disconnected from LiveKit room:', reason);
            
            // Only show disconnect toast and leave if it was intentional
            if (intentionalDisconnectRef.current) {
              toast({
                title: "Desconectado",
                description: "Você saiu da sala de reunião",
              });
              onLeave();
            }
            // For unintentional disconnects, we'll handle in onError
          }}
          onError={async (error) => {
            console.error('LiveKit room error:', error);
            const msg = (error as any)?.message ? String((error as any).message) : String(error);
            
            // Handle "Client initiated disconnect" specially
            if (msg.includes('Client initiated disconnect')) {
              // This usually means the user closed the tab or navigated away
              // Don't show it as an error, just disconnect gracefully
              console.log('Client initiated disconnect - treating as normal disconnect');
              if (!intentionalDisconnectRef.current) {
                toast({
                  title: "Desconectado", 
                  description: "Conexão encerrada"
                });
                setTimeout(() => onLeave(), 1000);
              }
              return;
            }
            
            // For other token/auth errors, try to regenerate
            if (/token|expire|401|403|unauthorized/i.test(msg) && retryRef.current < 2) {
              retryRef.current += 1;
              console.log(`Retrying connection attempt ${retryRef.current}`);
              toast({
                title: "Reconectando...",
                description: `Tentativa ${retryRef.current} de reconexão`
              });
              await regenerateToken();
              return;
            }
            
            // Show other errors
            setError(msg);
            toast({
              title: "Erro na chamada",
              description: msg,
              variant: "destructive",
            });
          }}
        >
          <RoomAudioRenderer />
          
          {/* Google Meet Style Layout */}
          <div className="h-full w-full flex flex-col bg-background">
            {/* Top Bar */}
            <div className="flex items-center justify-between px-6 py-3 border-b bg-background/95 backdrop-blur-sm z-10">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-foreground">Sala {roomName}</h2>
                <ConnectionStatus />
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const url = window.location.href;
                    navigator.clipboard.writeText(url);
                    toast({ title: 'Link copiado!', description: 'Compartilhe com seus convidados' });
                  }}
                  className="gap-2"
                >
                  <Copy className="h-4 w-4" />
                  Compartilhar
                </Button>
                
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={() => {
                    intentionalDisconnectRef.current = true;
                    onLeave();
                  }} 
                  className="gap-2"
                >
                  <PhoneOff className="h-4 w-4" />
                  Sair
                </Button>
              </div>
            </div>

            <div className="flex flex-1 min-h-0">
              {/* Main Video Area */}
              <div className="flex-1 relative min-w-0 flex flex-col">
                <div className="flex-1 p-4">
                  <VideoGrid />
                </div>
                
                {/* Controls at bottom */}
                <div className="flex justify-center pb-6">
                  <ControlBar />
                </div>
              </div>

              {/* Right Sidebar */}
              <aside className="w-80 border-l bg-card flex flex-col">
                <Tabs defaultValue="chat" className="flex-1 flex flex-col">
                  <TabsList className="grid w-full grid-cols-2 m-2">
                    <TabsTrigger value="chat" className="gap-2">
                      <MessageCircle className="h-4 w-4" />
                      Chat
                    </TabsTrigger>
                    <TabsTrigger value="participants" className="gap-2">
                      <Users className="h-4 w-4" />
                      Pessoas
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="chat" className="flex-1 m-0 p-2">
                    <div className="h-full">
                      <Chat />
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="participants" className="flex-1 m-0 p-4">
                    <ParticipantsList />
                  </TabsContent>
                </Tabs>
              </aside>
            </div>
          </div>
        </LiveKitRoom>
      </div>
    </ErrorBoundary>
  );
};

const VideoGrid: React.FC = () => {
  const tracks = useTracks([
    { source: Track.Source.ScreenShare, withPlaceholder: false },
    { source: Track.Source.Camera, withPlaceholder: true },
  ]);

  return (
    <div className="h-full w-full">
      <GridLayout tracks={tracks as any} className="h-full w-full">
        {tracks.map((track) => (
          <ParticipantTile
            key={`${track.participant.identity}-${String(track.source)}`}
            trackRef={track as any}
            className="rounded-lg overflow-hidden"
          />
        ))}
      </GridLayout>
    </div>
  );
};

const ParticipantsList: React.FC = () => {
  const participants = useParticipants();
  
  return (
    <div className="space-y-2">
      <h3 className="font-medium text-sm text-muted-foreground mb-3">
        Participantes ({participants.length})
      </h3>
      {participants.map((participant) => (
        <div key={participant.identity} className="flex items-center gap-3 p-2 rounded-lg bg-background">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-sm font-medium text-primary">
              {participant.name?.charAt(0) || participant.identity.charAt(0)}
            </span>
          </div>
          <span className="text-sm font-medium">{participant.name || participant.identity}</span>
        </div>
      ))}
    </div>
  );
};

const ConnectionStatus: React.FC = () => {
  const room = useRoomContext();
  
  if (!room) return null;

  const connectionState = room.state;
  
  if (connectionState === ConnectionState.Reconnecting) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Reconectando...
      </div>
    );
  }
  
  if (connectionState === ConnectionState.Connecting) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Conectando...
      </div>
    );
  }
  
  return null;
};

const RoomControls: React.FC<{ onLeave: () => void }> = ({ onLeave }) => {
  const room = useRoomContext();
  const participants = useParticipants();
  
  const handleLeaveRoom = () => {
    room?.disconnect();
    onLeave();
  };

  return (
    <div className="absolute top-4 right-4 flex items-center gap-2 bg-background/80 backdrop-blur-sm p-2 rounded-lg">
      <span className="text-sm text-muted-foreground">
        {participants.length} participante{participants.length !== 1 ? 's' : ''}
      </span>
      <Button
        onClick={handleLeaveRoom}
        variant="destructive"
        size="sm"
        className="gap-2"
      >
        <PhoneOff className="h-4 w-4" />
        Sair
      </Button>
    </div>
  );
};

export default LiveKitRoomComponent;