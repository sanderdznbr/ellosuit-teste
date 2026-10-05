import { useEffect } from 'react';
import { useRoomContext, useConnectionState, useParticipants } from '@livekit/components-react';
import { ConnectionState, Track, TrackPublication } from 'livekit-client';
import { useToast } from '@/hooks/use-toast';

interface TranscriptionMessage {
  text: string;
  is_final: boolean;
  timestamp: string;
  speaker?: string;
  participantId?: string;
}

interface LiveKitTranscriptionListenerProps {
  onTranscriptionUpdate: (message: TranscriptionMessage) => void;
  roomName: string;
}

export const LiveKitTranscriptionListener: React.FC<LiveKitTranscriptionListenerProps> = ({
  onTranscriptionUpdate,
  roomName
}) => {
  const room = useRoomContext();
  const connectionState = useConnectionState();
  const participants = useParticipants();
  const { toast } = useToast();

  useEffect(() => {
    if (!room || connectionState !== ConnectionState.Connected) {
      console.log('⏸️ Room not ready for transcription');
      return;
    }

    console.log('🎤 Setting up LiveKit transcription listeners');
    console.log('👥 Participants:', participants.length);

    // Listen to transcription data from all participants
    const handleTranscription = (
      transcription: any,
      participant: any,
      publication?: TrackPublication
    ) => {
      console.log('📝 Transcription received:', {
        participantId: participant?.identity,
        participantName: participant?.name,
        text: transcription?.text?.substring(0, 50),
        isFinal: transcription?.final
      });

      if (transcription && transcription.text) {
        const message: TranscriptionMessage = {
          text: transcription.text,
          is_final: transcription.final || false,
          timestamp: new Date().toISOString(),
          speaker: participant?.name || participant?.identity || 'Participante',
          participantId: participant?.identity
        };

        onTranscriptionUpdate(message);
      }
    };

    // Listen to all participants' transcriptions
    const trackHandlers = new Map();

    participants.forEach((participant) => {
      console.log(`👤 Setting up listener for: ${participant.name || participant.identity}`);
      
      participant.trackPublications.forEach((publication) => {
        if (publication.kind === Track.Kind.Audio && publication.track) {
          const handler = (transcription: any) => {
            handleTranscription(transcription, participant, publication);
          };
          
          // @ts-ignore - LiveKit SDK has transcription events
          publication.track.on('transcription', handler);
          trackHandlers.set(publication.trackSid, { track: publication.track, handler });
        }
      });

      // Also listen for new tracks
      participant.on('trackSubscribed', (track, publication) => {
        if (track.kind === Track.Kind.Audio) {
          const handler = (transcription: any) => {
            handleTranscription(transcription, participant, publication);
          };
          // @ts-ignore
          track.on('transcription', handler);
          trackHandlers.set(publication.trackSid, { track, handler });
        }
      });
    });

    console.log('✅ Transcription listeners set up for', trackHandlers.size, 'audio tracks');

    if (trackHandlers.size === 0) {
      console.warn('⚠️ No audio tracks found for transcription');
      console.warn('⚠️ Nenhuma faixa de áudio detectada para transcrição');
    }

    // Cleanup
    return () => {
      console.log('🧹 Cleaning up transcription listeners');
      trackHandlers.forEach(({ track, handler }) => {
        // @ts-ignore
        track.off('transcription', handler);
      });
      trackHandlers.clear();
    };
  }, [room, connectionState, participants, onTranscriptionUpdate]);

  return null;
};
