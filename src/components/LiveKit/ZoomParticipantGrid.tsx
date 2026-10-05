import React, { useEffect, useState } from 'react';
 import { 
   useTracks, 
   TrackReference, 
   VideoTrack,
   useParticipants,
   useLocalParticipant
 } from '@livekit/components-react';
import { Track, Participant } from 'livekit-client';
import { cn } from '@/lib/utils';
import { MicOff, Wifi, Video, Sparkles, Brain, Clock, X } from 'lucide-react';
import { ALL_SKILLS } from '@/constants/skills';
import { supabase } from '@/integrations/supabase/client';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { Maximize2, Minimize2, Pin, PinOff } from 'lucide-react';

interface ZoomParticipantGridProps {
  activeSkillId?: string | null;
  skillActivationIdentity?: string | null;
  isTranscribing?: boolean;
  allTranscriptionMessages?: any[];
}

const ZoomParticipantGrid: React.FC<ZoomParticipantGridProps> = ({ 
  activeSkillId: propActiveSkillId,
  skillActivationIdentity: propSkillActivationIdentity,
  isTranscribing,
  allTranscriptionMessages
}) => {
   const participants = useParticipants();
   const { localParticipant } = useLocalParticipant();
  const [dbActiveSkillId, setDbActiveSkillId] = useState<string | null>(null);
   const [dbSkillActivationIdentity, setDbSkillActivationIdentity] = useState<string | null>(null);
  const [mirrorLocal, setMirrorLocal] = useState(true);
  const [pinnedScreenIndex, setPinnedScreenIndex] = useState<number>(0);
  const [fullscreenScreen, setFullscreenScreen] = useState(false);
  const [hideParticipantsPanel, setHideParticipantsPanel] = useState(false);
  const [meetingStartTime] = useState<number>(Date.now());
  const [elapsedTime, setElapsedTime] = useState('00:00');
  const [showSkillInfo, setShowSkillInfo] = useState(false);

  // Timer para tempo decorrido
  useEffect(() => {
    const interval = setInterval(() => {
      const seconds = Math.floor((Date.now() - meetingStartTime) / 1000);
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = seconds % 60;
      
      if (h > 0) {
        setElapsedTime(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
      } else {
        setElapsedTime(`${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [meetingStartTime]);

   const [gimbalEnabled, setGimbalEnabled] = useState(false);

   useEffect(() => {
     const syncSettings = () => {
       const savedMirror = localStorage.getItem('meeting_mirror_webcam');
       if (savedMirror !== null) setMirrorLocal(savedMirror === 'true');
       
       const savedGimbal = localStorage.getItem('meeting_gimbal_enabled');
       setGimbalEnabled(savedGimbal === 'true');
     };

     syncSettings();
     window.addEventListener('storage', syncSettings);
     const interval = setInterval(syncSettings, 1000);
     return () => {
       window.removeEventListener('storage', syncSettings);
       clearInterval(interval);
     };
   }, []);
  // Sync active skill from DB to show tile for all participants
  useEffect(() => {
    const roomCode = window.location.pathname.split('/').pop();
    if (!roomCode) return;

    const fetchActiveSkill = async () => {
      const { data: room } = await supabase.from('meeting_rooms').select('id').eq('room_code', roomCode).single();
      if (!room) return;

       const { data } = await (supabase as any).from('room_active_skills').select('skill_id, activated_by').eq('room_id', room.id);
       if (data && (data as any[]).length > 0) {
         setDbActiveSkillId((data as any[])[0].skill_id);
         setDbSkillActivationIdentity((data as any[])[0].activated_by);
       }

      const channel = supabase.channel(`skill_grid_${room.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'room_active_skills', filter: `room_id=eq.${room.id}` }, 
         (p: any) => {
           if (p.eventType === 'DELETE') {
             setDbActiveSkillId(null);
             setDbSkillActivationIdentity(null);
           } else if (p.new && p.new.skill_id) {
             setDbActiveSkillId(p.new.skill_id);
             setDbSkillActivationIdentity(p.new.activated_by);
           }
         }).subscribe();
      return () => { supabase.removeChannel(channel); };
    };
    fetchActiveSkill();
  }, []);

  const activeSkillId = propActiveSkillId !== undefined ? propActiveSkillId : dbActiveSkillId;
  const activeSkill = ALL_SKILLS.find(s => s.id === activeSkillId);
  const skillActivationIdentity = propSkillActivationIdentity !== undefined ? propSkillActivationIdentity : dbSkillActivationIdentity;
  
  // Log para debug no mobile
  console.log('[ZoomParticipantGrid] Total de participantes:', participants.length);
  participants.forEach(p => {
    console.log('[ZoomParticipantGrid] Participante:', p.identity, 'Câmera:', p.isCameraEnabled);
  });
  
  const tracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: true },
    { source: Track.Source.ScreenShare, withPlaceholder: false },
  ]);

  const screenShareTracks = tracks.filter(t => t.source === Track.Source.ScreenShare);
  const cameraTracks = tracks.filter(t => t.source === Track.Source.Camera);
  const totalItems = cameraTracks.length;
  const hasScreenShare = screenShareTracks.length > 0;
  
  // Log tracks no mobile
  console.log('[ZoomParticipantGrid] Total de tracks de câmera:', cameraTracks.length);
  console.log('[ZoomParticipantGrid] Total de tracks de screen share:', screenShareTracks.length);

  // Grid dinâmico responsivo - NUNCA corta participantes
  const getGridClass = (count: number) => {
    if (count === 1) return 'grid-cols-1';
    if (count === 2) return 'grid-cols-1 sm:grid-cols-2';
    if (count <= 4) return 'grid-cols-2 sm:grid-cols-2';
    if (count <= 6) return 'grid-cols-2 sm:grid-cols-3';
    if (count <= 9) return 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-3';
    if (count <= 12) return 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4';
    return 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5';
  };

  const getParticipantName = (participant: Participant) => {
    return participant.name || participant.identity || 'Participante';
  };

  const isParticipantMuted = (participant: Participant) => {
    const audioTrack = participant.audioTrackPublications.values().next().value;
    return !audioTrack || audioTrack.isMuted;
  };

  const isVideoEnabled = (participant: Participant) => {
    const videoTrack = participant.videoTrackPublications.values().next().value;
    return videoTrack && !videoTrack.isMuted;
  };

  // Get the most recent transcription for the live "hearing" state
  const latestTranscript = allTranscriptionMessages && allTranscriptionMessages.length > 0 
    ? allTranscriptionMessages[allTranscriptionMessages.length - 1]
    : null;

  const renderAISkillTile = () => {
    return null; // Removido tile da skill como participante
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#101010]">
      {/* Screen Share Area - Layout Responsivo para múltiplas telas */}
      {hasScreenShare && (
        (() => {
          const safeIndex = Math.min(pinnedScreenIndex, screenShareTracks.length - 1);
          const mainScreen = screenShareTracks[safeIndex];
          const otherScreens = screenShareTracks.filter((_, i) => i !== safeIndex);
          const showSidebar = !fullscreenScreen && !hideParticipantsPanel && (cameraTracks.length > 0 || otherScreens.length > 0);

          const ScreenTile = ({ trackRef, big }: { trackRef: any; big?: boolean }) => (
            <div className="relative w-full h-full bg-black rounded-xl overflow-hidden group/screen">
              <VideoTrack trackRef={trackRef} className="w-full h-full object-contain" />
              <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm px-3 py-1 rounded-full flex items-center gap-2">
                <span className="text-white text-xs font-medium">
                  {getParticipantName(trackRef.participant)} · Compartilhando
                </span>
              </div>
              {big && (
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover/screen:opacity-100 transition-opacity">
                  <button
                    onClick={() => setFullscreenScreen(v => !v)}
                    className="bg-black/70 hover:bg-black/90 backdrop-blur-sm p-2 rounded-full text-white"
                    title={fullscreenScreen ? 'Mostrar participantes' : 'Tela cheia'}
                  >
                    {fullscreenScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              )}
            </div>
          );

          return (
            <div className="flex-1 min-h-0 p-3">
              <ResizablePanelGroup direction="horizontal" className="h-full w-full rounded-lg">
                <ResizablePanel defaultSize={showSidebar ? 78 : 100} minSize={40}>
                  <div className="h-full w-full">
                    <ScreenTile trackRef={mainScreen} big />
                  </div>
                </ResizablePanel>
                {showSidebar && (
                  <>
                    <ResizableHandle withHandle className="bg-transparent mx-1" />
                    <ResizablePanel defaultSize={22} minSize={14} maxSize={45}>
                      <div className="h-full flex flex-col gap-2 overflow-y-auto pr-1">
                        {/* Outras telas compartilhadas como miniaturas clicáveis */}
                        {otherScreens.map((trackRef: any, idx: number) => {
                          const realIndex = screenShareTracks.indexOf(trackRef);
                          return (
                            <button
                              key={`screen-thumb-${trackRef.participant.identity}-${idx}`}
                              onClick={() => setPinnedScreenIndex(realIndex)}
                              className="relative w-full aspect-video rounded-xl overflow-hidden border-2 border-primary/40 hover:border-primary transition-all bg-black flex-shrink-0"
                            >
                              <VideoTrack trackRef={trackRef} className="w-full h-full object-contain" />
                              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                                <Pin className="w-5 h-5 text-white" />
                              </div>
                              <div className="absolute bottom-1 left-1 bg-black/70 px-2 py-0.5 rounded text-[10px] text-white truncate max-w-[90%]">
                                {getParticipantName(trackRef.participant)}
                              </div>
                            </button>
                          );
                        })}
                        {cameraTracks.map((trackRef: any, index: number) => {
                          const isSpeaking = trackRef.participant?.isSpeaking;
                          return (
                            <div
                              key={`camera-side-${trackRef.participant.identity}-${index}`}
                              className={cn(
                                "relative w-full aspect-video rounded-xl overflow-hidden border-2 transition-all flex-shrink-0",
                                isSpeaking ? "border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)] scale-[0.98]" : "border-transparent hover:border-primary"
                              )}
                              style={{ backgroundColor: '#1a1a1a' }}
                            >
                           {isVideoEnabled(trackRef.participant) ? (
                             <VideoTrack
                               trackRef={trackRef}
                               className={cn(
                                 "w-full h-full object-cover",
                                  trackRef.participant.isLocal && gimbalEnabled && "scale-110"
                               )}
                               style={{ 
                                 backgroundColor: '#000', 
                                 transform: (trackRef.participant.isLocal && mirrorLocal) ? 'scaleX(-1)' : 'none',
                                  transition: trackRef.participant.isLocal && gimbalEnabled ? 'transform 3s ease-in-out' : 'transform 0.3s ease-in-out'
                               }}
                             />
                           ) : (
                              <div className="w-full h-full flex items-center justify-center bg-muted">
                                <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold text-base">
                                  {getParticipantName(trackRef.participant).charAt(0).toUpperCase()}
                                </div>
                              </div>
                            )}
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1.5">
                              <div className="flex items-center justify-between gap-1">
                                 <span className="text-white text-xs font-medium truncate max-w-[120px]">
                                  {getParticipantName(trackRef.participant)}
                                </span>
                                {isParticipantMuted(trackRef.participant) && (
                                  <div className="bg-destructive rounded-full p-0.5 flex-shrink-0">
                                    <MicOff className="h-2.5 w-2.5 text-destructive-foreground" />
                                  </div>
                                )}
                              </div>
                            </div>
                            </div>
                          );
                        })}
                      </div>
                    </ResizablePanel>
                  </>
                )}
              </ResizablePanelGroup>
              {/* Toggle button para esconder/mostrar painel lateral */}
              {!fullscreenScreen && cameraTracks.length > 0 && (
                <button
                  onClick={() => setHideParticipantsPanel(v => !v)}
                  className="absolute top-4 right-4 z-30 bg-black/70 hover:bg-black/90 backdrop-blur-sm p-2 rounded-full text-white border border-white/10"
                  title={hideParticipantsPanel ? 'Mostrar participantes' : 'Esconder participantes'}
                >
                  {hideParticipantsPanel ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
          );
        })()
      )}

      {/* Camera Grid - sem compartilhamento de tela */}
      {!hasScreenShare && (
        <div className="flex-1 flex items-center justify-center p-4 overflow-y-auto">
          {cameraTracks.length === 0 ? (
            <div className="text-center">
              <Wifi className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-xl font-medium text-foreground">Aguardando participantes...</p>
              <p className="text-sm text-muted-foreground mt-2">Convide pessoas para se juntar à reunião</p>
            </div>
          ) : (
          <div className={cn(
            "grid gap-4 w-full h-full",
            totalItems === 1 && "max-w-4xl max-h-[600px] mx-auto",
            getGridClass(totalItems)
          )}
          style={{
            gridAutoRows: totalItems === 1 ? 'auto' : 'minmax(180px, 1fr)'
          }}>
            {cameraTracks.map((trackRef: any, index: number) => {
                const isSpeaking = trackRef.participant?.isSpeaking;
                return (
                  <div
                    key={`camera-${trackRef.participant.identity}-${index}`}
                    className={cn(
                      "relative rounded-3xl overflow-hidden border-2 transition-all group w-full h-full flex items-center justify-center",
                      isSpeaking ? "border-emerald-500 ring-4 ring-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.3)]" : "border-[#2a2a2a] hover:border-primary"
                    )}
                    style={{ 
                      backgroundColor: '#1a1a1a',
                      minHeight: cameraTracks.length === 1 ? '400px' : '180px',
                      aspectRatio: cameraTracks.length === 1 ? '16/9' : 'auto'
                    }}
                  >
                   {isVideoEnabled(trackRef.participant) ? (
                     <div className="w-full h-full bg-black rounded-3xl flex items-center justify-center overflow-hidden">
                       <VideoTrack
                         trackRef={trackRef}
                         className={cn(
                           "w-full h-full object-contain rounded-3xl",
                            trackRef.participant.isLocal && gimbalEnabled && "scale-150"
                         )}
                         style={{ 
                           backgroundColor: '#000',
                           transform: (trackRef.participant.isLocal && mirrorLocal) ? 'scaleX(-1)' : 'none',
                            transition: trackRef.participant.isLocal && gimbalEnabled ? 'transform 4s ease-in-out' : 'transform 0.3s ease-in-out'
                         }}
                       />
                     </div>
                   ) : (
                    <div className="w-full h-full flex items-center justify-center bg-muted rounded-3xl">
                      <div className="w-24 h-24 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold text-3xl">
                        {getParticipantName(trackRef.participant).charAt(0).toUpperCase()}
                      </div>
                    </div>
                  )}
                  
                  {/* Skill Badge Overlay on Participant Tile (Show always on the activator) */}
                  {activeSkill && trackRef.participant?.identity === skillActivationIdentity && (
                    <div className="absolute top-4 left-4 z-30">
                      <button
                        onClick={() => setShowSkillInfo(!showSkillInfo)}
                        className="bg-black/60 backdrop-blur-md border border-[#374DA4]/50 px-3 py-1.5 rounded-full flex items-center gap-2 shadow-2xl animate-in fade-in zoom-in duration-500"
                      >
                        <div className="w-2 h-2 rounded-full bg-[#374DA4] animate-pulse" />
                        <span className="text-[10px] font-bold text-white uppercase tracking-[0.2em]">Ello Skill {activeSkill.name}</span>
                      </button>

                      {showSkillInfo && (
                        <div className="absolute top-12 left-0 w-64 bg-[#1a1a1a] border border-white/10 rounded-2xl p-4 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <Sparkles className="w-4 h-4 text-[#374DA4]" />
                              <span className="text-xs font-bold text-white uppercase tracking-wider">{activeSkill.name}</span>
                            </div>
                            <button onClick={() => setShowSkillInfo(false)}>
                              <X className="w-4 h-4 text-white/40 hover:text-white transition-colors" />
                            </button>
                          </div>
                          <p className="text-[11px] text-white/70 leading-relaxed mb-3">{activeSkill.description}</p>
                          <div className="text-[9px] text-[#374DA4] font-medium uppercase tracking-widest pt-2 border-t border-white/5">Ativada por este usuário</div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Participant info overlay */}
                  <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent rounded-b-3xl">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                         <span className="text-white text-sm font-medium drop-shadow-lg whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]">
                          {getParticipantName(trackRef.participant)}
                        </span>
                        {/* Cronômetro pequeno ao lado do nome */}
                      </div>
                      {isParticipantMuted(trackRef.participant) && (
                        <div className="bg-destructive rounded-full p-1.5">
                          <MicOff className="h-3.5 w-3.5 text-destructive-foreground" />
         </div>
       )}

       {/* Cronômetro da Reunião - Only show on the first participant tile to avoid duplication */}
       {index === 0 && (
         <div className="flex-none pb-2 flex justify-center">
           <div className="bg-black/40 backdrop-blur-md border border-white/10 px-3 py-1 rounded-full flex items-center gap-2 shadow-sm">
             <Clock className="w-3 h-3 text-white/60" />
             <span className="text-white/80 text-[10px] font-bold tabular-nums tracking-wider">{elapsedTime}</span>
           </div>
         </div>
       )}
     </div>
                  </div>

                  {/* Speaking indicator */}
                  {!isParticipantMuted(trackRef.participant) && (
                    <div className="absolute top-3 left-3 bg-green-500 rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    </div>
                  )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ZoomParticipantGrid;