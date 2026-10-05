 import { useEffect, useRef } from 'react';
 import { useRoomContext, useLocalParticipant } from '@livekit/components-react';
 import { BackgroundBlur, VirtualBackground } from '@livekit/track-processors';
 import { Track } from 'livekit-client';

interface RoomContextCaptureProps {
  onRoomReady: (room: any) => void;
}

 export const RoomContextCapture: React.FC<RoomContextCaptureProps> = ({ onRoomReady }) => {
   const room = useRoomContext();
   const { localParticipant } = useLocalParticipant();
   const activeProcessorRef = useRef<any>(null);
   const lastEffectRef = useRef<string>('');

   useEffect(() => {
     if (room) {
       onRoomReady(room);
     }
   }, [room, onRoomReady]);

   // Background Effects Logic
   useEffect(() => {
     if (!localParticipant) return;

     const applyEffect = async () => {
       const effect = localStorage.getItem('meeting_background_effect') || 'none';
       if (effect === lastEffectRef.current) return;
       
       const videoTrack = localParticipant.getTrackPublication(Track.Source.Camera)?.videoTrack;
       if (!videoTrack) return;

       try {
         // Cleanup existing processor
         if (activeProcessorRef.current) {
           await videoTrack.stopProcessor();
           activeProcessorRef.current = null;
         }

         if (effect === 'blur') {
           const processor = BackgroundBlur(10);
           activeProcessorRef.current = processor;
           await videoTrack.setProcessor(processor);
         } else if (effect === 'image') {
           // Using a default nice office background
           const processor = VirtualBackground('https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80');
           activeProcessorRef.current = processor;
           await videoTrack.setProcessor(processor);
         }
         
         lastEffectRef.current = effect;
       } catch (error) {
         console.error('❌ Erro ao aplicar efeito de vídeo:', error);
       }
     };

     // Polling for storage changes as it's modified in DeviceSettingsModal
     const interval = setInterval(applyEffect, 2000);
     applyEffect();

     return () => {
       clearInterval(interval);
       if (activeProcessorRef.current) {
         // videoTrack might be gone, but we try cleanup if we can find it
         localParticipant.getTrackPublication(Track.Source.Camera)?.videoTrack?.stopProcessor();
       }
     };
   }, [localParticipant]);

  return null;
};
