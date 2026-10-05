import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ALL_SKILLS } from '@/constants/skills';
import { Sparkles, Brain, X, MessageCircle, Bot, Send, Loader2, Volume2, UserPlus, Sun, Moon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTheme } from '@/hooks/useTheme';
import { Badge } from '@/components/ui/badge';
import EllosuitMark from '@/components/shared/EllosuitMark';
import ZoomParticipantGrid from './ZoomParticipantGrid';
import NewMeetingControls from './NewMeetingControls';
import MeetingChatSidebar from './MeetingChatSidebar';
import InviteUsersModal from './InviteUsersModal';

interface MeetingLayoutProps {
  roomName: string;
  companyId: string;
  participantName: string;
  activeTab: 'chat' | 'participants' | null;
  transcriptionMessages: any[];
  isTranscribing: boolean;
  isHost: boolean;
   activeSkillId?: string | null;
   skillActivationIdentity?: string | null;
   advisorMessage?: { skill: string, text: string } | null;
   onCloseAdvisor?: () => void;
  onTabChange: (tab: 'chat' | 'participants' | null) => void;
  onTranscriptionMessagesUpdate: (messages: any[]) => void;
  onLeave: () => void;
  onDeviceSettings: () => void;
  onTranscriptionToggle: () => void;
  onShareMeeting: () => void;
  onVolumeChange?: (participantIdentity: string, volume: number) => void;
  onLocalMicVolumeChange?: (volume: number) => void;
  participantVolumes?: Record<string, number>;
  localMicVolume?: number;
   onTranscriptionClick: () => void;
   onToggleSkills: () => void;
  meetingControlsRef: React.RefObject<any>;
  onToggleRecording: () => void;
  isRecording: boolean;
  recordingStatus?: 'idle' | 'recording' | 'finalizing' | 'processing';
}

const MeetingLayout: React.FC<MeetingLayoutProps> = ({
  roomName,
  companyId,
  participantName,
  activeTab,
  transcriptionMessages,
  isTranscribing,
  isHost,
  onTabChange,
  onTranscriptionMessagesUpdate,
  onLeave,
  onDeviceSettings,
  onTranscriptionToggle,
    onShareMeeting,
    onVolumeChange,
    onLocalMicVolumeChange,
    participantVolumes = {},
    localMicVolume = 1,
  onTranscriptionClick,
   onToggleSkills,
  meetingControlsRef,
  onToggleRecording,
  isRecording,
   activeSkillId,
   skillActivationIdentity,
   advisorMessage,
   onCloseAdvisor,
}) => {
  const navigate = useNavigate();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const activeSkill = ALL_SKILLS.find(s => s.id === activeSkillId);

   const [isPlayingTTS, setIsPlayingTTS] = useState<boolean | null>(false);
 
   const playAdvisorTTS = async (text: string) => {
     if (isPlayingTTS) return;
     setIsPlayingTTS(true);
     try {
       const { data, error } = await supabase.functions.invoke('elevenlabs-tts', {
         body: { text },
       });
       if (error) throw error;
       
       const blob = await data.blob();
       const url = URL.createObjectURL(blob);
       const audio = new Audio(url);
       audio.onended = () => {
         setIsPlayingTTS(null);
         URL.revokeObjectURL(url);
       };
       await audio.play();
     } catch (e) {
       console.error('TTS Error:', e);
       setIsPlayingTTS(false);
     }
   };
 
  const shellBg = isDark ? '#101010' : '#faf9f7';
  const stageBg = isDark ? '#090909' : '#ffffff';

  return (
    <div className="h-screen w-full flex flex-col transition-colors duration-300" style={{ backgroundColor: shellBg }}>
      {/* Header com Logo e Botão Convidar */}
      <div className="flex items-center justify-between px-6 py-5 transition-colors duration-300" style={{ backgroundColor: shellBg }}>
        {/* Lado Esquerdo: Botão Convidar clean */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowInviteModal(true)}
            className={cn(
              "group inline-flex items-center gap-2 pl-4 pr-5 py-2.5 rounded-full border border-[#374DA4]/60 text-[#374DA4] text-sm font-medium",
              "transition-all duration-200 hover:bg-[#374DA4] hover:text-white hover:border-[#374DA4] hover:shadow-[0_6px_18px_-6px_rgba(55,77,164,0.6)] active:scale-[0.98]",
              isDark && "bg-[#374DA4]/10"
            )}
          >
            <UserPlus className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
            Convidar usuários
          </button>
        </div>

        {/* Logo Centro */}
        <div className="flex items-center">
          <EllosuitMark className="h-7 w-auto" />
        </div>

        {/* Lado Direito: Alternar tema */}
        <div className="w-[186px] flex justify-end">
          <button
            onClick={toggleTheme}
            title={isDark ? 'Modo claro' : 'Modo escuro'}
            aria-label={isDark ? 'Ativar modo claro' : 'Ativar modo escuro'}
            className={cn(
              "h-10 w-10 inline-flex items-center justify-center rounded-full transition-all duration-200 active:scale-95",
              isDark
                ? "border border-white/15 text-white/80 bg-white/5 hover:bg-white/10"
                : "border border-[#374DA4]/25 text-[#374DA4] bg-white hover:bg-[#374DA4]/5"
            )}
          >
            {isDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
          </button>
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Área de Vídeo - Fundo Escuro */}
        <div className="flex-1 p-6 transition-colors duration-300" style={{ backgroundColor: shellBg }}>
          <div
            className={cn("h-full rounded-3xl overflow-hidden transition-colors duration-300", !isDark && "border border-[#eae7e1] shadow-sm")}
            style={{ backgroundColor: stageBg }}
          >
          <ZoomParticipantGrid
            activeSkillId={activeSkillId}
            skillActivationIdentity={skillActivationIdentity}
            isTranscribing={isTranscribing}
            allTranscriptionMessages={transcriptionMessages}
          />
          </div>
        </div>

        {/* Sidebar Chat à Direita */}
          <div className="h-full">
            <MeetingChatSidebar
              roomCode={roomName}
              transcriptionMessages={transcriptionMessages}
              isHost={isHost}
              activeSkillId={activeSkillId}
              onTranscriptionClick={onTranscriptionClick}
              advisorMessage={advisorMessage}
              skillMessages={[]} // Will be managed inside
              onVolumeChange={onVolumeChange}
              onLocalMicVolumeChange={onLocalMicVolumeChange}
              participantVolumes={participantVolumes}
              localMicVolume={localMicVolume}
            />
          </div>
      </div>

       {/* Advisor Whisper - Only for Host, appears at top center */}
       {isHost && advisorMessage && (
         <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-top-4 duration-500 max-w-[90%] md:max-w-md">
           <div className="bg-[#1A1A1A]/90 backdrop-blur-md border-2 border-[#3600FF]/50 shadow-[0_0_20px_rgba(54,0,255,0.3)] rounded-2xl p-4 flex items-start gap-4">
             <div className="bg-[#3600FF] p-2 rounded-full shrink-0 shadow-lg">
               <Brain className="h-5 w-5 text-white" />
             </div>
             <div className="flex-1">
               <div className="flex items-center justify-between gap-2 mb-1">
                 <div className="flex items-center gap-2">
                   <span className="text-[10px] font-bold text-[#3600FF] uppercase tracking-wider">{advisorMessage.skill}</span>
                   <Badge className="bg-[#3600FF]/10 text-[#3600FF] text-[8px] border-[#3600FF]/20 h-4 uppercase font-bold">Insight Estratégico</Badge>
                 </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => playAdvisorTTS(advisorMessage.text)}
                      disabled={isPlayingTTS === true}
                      className="text-gray-500 hover:text-[#3600FF] transition-colors p-1"
                      title="Ouvir insight"
                    >
                      {isPlayingTTS === true ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Volume2 className="h-4 w-4" />
                      )}
                    </button>
                    <button 
                      onClick={onCloseAdvisor}
                      className="text-gray-500 hover:text-white transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
               </div>
               <p className="text-sm font-medium text-white/90 leading-relaxed italic">
                 "{advisorMessage.text}"
               </p>
             </div>
           </div>
         </div>
       )}
 
       {/* Controles Inferiores */}
      <div className="px-6 pb-6 flex items-center justify-center transition-colors duration-300" style={{ backgroundColor: shellBg }}>
        <NewMeetingControls
          ref={meetingControlsRef}
          onLeave={onLeave}
          onSettingsClick={() => {
            console.log('🎛️ [MeetingLayout] Abrindo configurações de dispositivos');
            onDeviceSettings();
          }}
          onTranscriptionClick={onTranscriptionClick}
           onToggleSkills={onToggleSkills}
           activeSkillId={activeSkillId}
          isHost={isHost}
          onToggleRecording={onToggleRecording}
          isRecording={isRecording}
        />
      </div>

      {/* Modals */}
      <InviteUsersModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        roomCode={roomName}
        onNavigateSameTab={(url) => navigate(url)}
      />
    </div>
  );
};

export default MeetingLayout;
