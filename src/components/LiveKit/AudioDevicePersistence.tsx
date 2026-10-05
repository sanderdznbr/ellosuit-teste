import { useEffect } from 'react';
import { useLocalParticipant } from '@livekit/components-react';

/**
 * Component to persist audio device selection
 * Monitors and logs device changes to help prevent automatic device switching
 */
const AudioDevicePersistence: React.FC = () => {
  const { localParticipant } = useLocalParticipant();

  useEffect(() => {
    if (!localParticipant) return;

    // Store device selections in localStorage for future sessions
    const handleDeviceChange = async () => {
      try {
        const audioTracks = Array.from(localParticipant.audioTrackPublications.values());
        const videoTracks = Array.from(localParticipant.videoTrackPublications.values());

        if (audioTracks.length > 0 && audioTracks[0].track) {
          const settings = audioTracks[0].track.mediaStreamTrack.getSettings();
          if (settings.deviceId) {
            localStorage.setItem('livekit_preferred_audio_device', settings.deviceId);
            console.log('📱 Dispositivo de áudio salvo:', settings.deviceId);
          }
        }

        if (videoTracks.length > 0 && videoTracks[0].track) {
          const settings = videoTracks[0].track.mediaStreamTrack.getSettings();
          if (settings.deviceId) {
            localStorage.setItem('livekit_preferred_video_device', settings.deviceId);
            console.log('📹 Dispositivo de vídeo salvo:', settings.deviceId);
          }
        }
      } catch (error) {
        console.error('Erro ao salvar dispositivos:', error);
      }
    };

    // Log initial devices
    const logInitialDevices = () => {
      const savedAudio = localStorage.getItem('livekit_preferred_audio_device');
      const savedVideo = localStorage.getItem('livekit_preferred_video_device');
      
      if (savedAudio) console.log('✅ Dispositivo de áudio preferido:', savedAudio);
      if (savedVideo) console.log('✅ Dispositivo de vídeo preferido:', savedVideo);
    };

    logInitialDevices();

    // Listen for track changes
    localParticipant.on('localTrackPublished', handleDeviceChange);

    return () => {
      localParticipant.off('localTrackPublished', handleDeviceChange);
    };
  }, [localParticipant]);

  return null;
};

export default AudioDevicePersistence;