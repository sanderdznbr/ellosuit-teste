import React, { forwardRef, useImperativeHandle } from 'react';
import { useLocalParticipant } from '@livekit/components-react';
import { useToast } from '@/hooks/use-toast';

interface SimpleMeetingControlsProps {
  onToggleChat: () => void;
  onToggleParticipants: () => void;
  onShareMeeting: () => void;
  onLeave: () => void;
  onSettingsClick: () => void;
  onShowTranscription: () => void;
  onShowSkills?: () => void;
  isChatOpen: boolean;
  isParticipantsOpen: boolean;
   onToggleRecording: () => void;
   isRecording: boolean;
   recordingStatus?: 'idle' | 'recording' | 'finalizing' | 'processing';
 }
 
 import { Settings } from 'lucide-react';
 
 const SimpleMeetingControls = forwardRef<any, SimpleMeetingControlsProps>(({
  onToggleChat,
  onToggleParticipants,
  onShareMeeting,
  onLeave,
  onSettingsClick,
  onShowTranscription,
  onShowSkills,
  isChatOpen,
  isParticipantsOpen,
  onToggleRecording,
  isRecording,
  recordingStatus = 'idle'
}, ref) => {
  const { localParticipant } = useLocalParticipant();
  const { toast } = useToast();

  useImperativeHandle(ref, () => ({}));

  const toggleMic = async () => {
    if (localParticipant) {
      const isMuted = localParticipant.isMicrophoneEnabled;
      await localParticipant.setMicrophoneEnabled(!isMuted);
    }
  };

  const toggleCamera = async () => {
    if (localParticipant) {
      const isEnabled = localParticipant.isCameraEnabled;
      await localParticipant.setCameraEnabled(!isEnabled);
    }
  };

  const handleScreenShare = async () => {
    if (localParticipant) {
      try {
        const isSharing = localParticipant.isScreenShareEnabled;
        await localParticipant.setScreenShareEnabled(!isSharing, {
          suppressLocalAudioPlayback: true
        });
      } catch (error) {
        console.error('Screen share error:', error);
        console.error("Erro no compartilhamento");
      }
    }
  };

  const isMicEnabled = localParticipant?.isMicrophoneEnabled ?? true;
  const isCameraEnabled = localParticipant?.isCameraEnabled ?? true;

  return (
    <div className="flex items-center justify-center gap-3">
      {/* Camera */}
      <button
        onClick={toggleCamera}
        className="flex items-center justify-center rounded-full transition-all hover:scale-105"
        style={{ width: '57px', height: '57px', backgroundColor: isCameraEnabled ? '#161616' : '#EF4444' }}
        title={isCameraEnabled ? "Desativar câmera" : "Ativar câmera"}
      >
        <svg width="19" height="19" viewBox="0 0 19 19" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M1.58333 0C0.709333 0 0 0.7093 0 1.58333V13.4583C0 14.3323 0.709333 15.0417 1.58333 15.0417H17.4167C18.2907 15.0417 19 14.3323 19 13.4583V1.58333C19 0.7093 18.2907 0 17.4167 0H1.58333ZM17.4167 11.0833H1.58333V1.58333H17.4167V11.0833ZM12.1925 16.625C12.1925 17.8917 13.5733 18.7031 14.25 19H4.75C5.49267 18.7364 6.8075 17.9574 6.8075 16.625H12.1925Z" fill="white"/>
        </svg>
      </button>

      {/* Microphone - Blue */}
      <button
        onClick={toggleMic}
        className="flex items-center justify-center rounded-full transition-all hover:scale-105"
        style={{ width: '57px', height: '57px', backgroundColor: '#374DA4' }}
        title={isMicEnabled ? "Desativar microfone" : "Ativar microfone"}
      >
        <svg width="21" height="25" viewBox="0 0 21 25" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M13 9C13 11.209 11.209 13 9 13C6.791 13 5 11.209 5 9V2C5 -0.209 6.791 -2 9 -2C11.209 -2 13 -0.209 13 2V9ZM17 7V9C17 13.418 13.418 17 9 17C4.582 17 1 13.418 1 9V7H3V9C3 12.309 5.691 15 9 15C12.309 15 15 12.309 15 9V7H17ZM10 20V18H8V20H4V22H14V20H10Z" fill="white"/>
        </svg>
      </button>

      {/* Recording Button */}
      <div className="relative group">
        <button
          onClick={onToggleRecording}
          disabled={recordingStatus === 'finalizing' || recordingStatus === 'processing'}
          className="flex items-center justify-center rounded-full transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ 
            width: '57px', 
            height: '57px', 
            backgroundColor: isRecording ? '#DC2626' : '#161616',
            animation: isRecording ? 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' : 'none'
          }}
          title={isRecording ? "Parar gravação" : "Iniciar gravação"}
        >
          {recordingStatus === 'finalizing' || recordingStatus === 'processing' ? (
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
          ) : isRecording ? (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="10" cy="10" r="8" fill="white"/>
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="10" cy="10" r="8" stroke="white" strokeWidth="2" fill="none"/>
            </svg>
          )}
        </button>
        
        {recordingStatus !== 'idle' && (
          <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black/80 text-white text-[10px] font-bold px-2 py-1 rounded whitespace-nowrap uppercase tracking-wider">
            {recordingStatus === 'recording' && <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> Gravando</span>}
            {recordingStatus === 'finalizing' && <span>Finalizando...</span>}
            {recordingStatus === 'processing' && <span>Processando...</span>}
          </div>
        )}
      </div>

      {/* Emoji */}
      <button
        className="flex items-center justify-center rounded-full transition-all hover:scale-105"
        style={{ width: '57px', height: '57px', backgroundColor: '#161616' }}
        title="Reações"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M10 0C5.029 0 1 4.03 1 9C1 13.971 5.029 18 10 18C14.971 18 19 13.97 19 9C19 4.03 14.971 0 10 0ZM10 13C7.791 13 6 11.209 6 9C6 6.791 7.791 5 10 5C12.209 5 14 6.791 14 9C14 11.209 12.209 13 10 13ZM12 9C12 10.103 11.104 11 10 11C8.897 11 8 10.103 8 9C8 7.897 8.897 7 10 7C11.104 7 12 7.897 12 9Z" fill="white"/>
        </svg>
      </button>

       {/* Settings */}
       <button
         onClick={onSettingsClick}
         className="flex items-center justify-center rounded-full transition-all hover:scale-105"
         style={{ width: '57px', height: '57px', backgroundColor: '#161616' }}
         title="Configurações"
       >
         <Settings className="w-6 h-6 text-white" />
       </button>

      {/* Leave - Red */}
      <button
        onClick={onLeave}
        className="flex items-center justify-center rounded-full transition-all hover:scale-105"
        style={{ width: '57px', height: '57px', backgroundColor: '#EF4444' }}
        title="Sair da reunião"
      >
        <svg width="21" height="23" viewBox="0 0 21 23" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M21 22.621L17.479 15.826C17.471 15.83 15.505 16.796 15.415 16.837C13.175 17.923 8.616 9.017 10.806 7.843L12.889 6.817L9.396 0L7.29 1.039C0.088 4.794 11.523 27.021 18.89 23.654C19.011 23.599 20.992 22.625 21 22.621Z" fill="white"/>
        </svg>
      </button>
    </div>
  );
});

SimpleMeetingControls.displayName = 'SimpleMeetingControls';

export default SimpleMeetingControls;
