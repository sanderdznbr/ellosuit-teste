import { useEffect, useRef, useState } from 'react';
import { useParticipants, useRoomContext } from '@livekit/components-react';
import { RemoteTrack, Track } from 'livekit-client';

interface LiveKitTranscriptionProps {
  onTranscript: (data: { speaker: string; text: string; is_final: boolean; timestamp: string }) => void;
  isActive: boolean;
}

export const LiveKitTranscription = ({ onTranscript, isActive }: LiveKitTranscriptionProps) => {
  const room = useRoomContext();
  const participants = useParticipants();
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorNodesRef = useRef<Map<string, ScriptProcessorNode>>(new Map());

  useEffect(() => {
    if (!isActive || !room) return;

    console.log('🎤 Starting LiveKit transcription...');

    // Initialize WebSocket connection
    const projectId = window.location.hostname.split('.')[0];
    const wsUrl = `wss://${projectId}.supabase.co/functions/v1/realtime-transcription`;
    
    const websocket = new WebSocket(wsUrl);
    
    websocket.onopen = () => {
      console.log('✅ WebSocket connected');
      websocket.send(JSON.stringify({
        type: 'start_transcription',
        roomId: room.name
      }));
      setIsTranscribing(true);
    };

    websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'transcript_update') {
          console.log('📝 Transcript received:', data.text);
          onTranscript({
            speaker: 'Participante',
            text: data.text,
            is_final: data.is_final,
            timestamp: data.timestamp
          });
        } else if (data.type === 'error') {
          console.error('❌ Transcription error:', data.error);
        }
      } catch (error) {
        console.error('Error parsing transcript:', error);
      }
    };

    websocket.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
    };

    websocket.onclose = () => {
      console.log('WebSocket closed');
      setIsTranscribing(false);
    };

    setWs(websocket);

    return () => {
      if (websocket && websocket.readyState === WebSocket.OPEN) {
        websocket.send(JSON.stringify({ type: 'stop_transcription' }));
        websocket.close();
      }
    };
  }, [isActive, room, onTranscript]);

  // Subscribe to all participant audio tracks
  useEffect(() => {
    if (!isTranscribing || !ws || ws.readyState !== WebSocket.OPEN) return;

    const setupAudioCapture = async () => {
      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContext({ sampleRate: 24000 });
        }

        const audioContext = audioContextRef.current;

        // Process audio from all participants
        for (const participant of participants) {
          const participantId = participant.identity;
          
          // Skip if already processing this participant
          if (processorNodesRef.current.has(participantId)) continue;

          // Get audio track - find first audio track publication
          let audioTrack = null;
          participant.audioTrackPublications.forEach((pub) => {
            if (!audioTrack && pub.track) {
              audioTrack = pub;
            }
          });
          
          if (!audioTrack || !audioTrack.track) continue;

          const mediaStreamTrack = audioTrack.track.mediaStreamTrack;
          if (!mediaStreamTrack) continue;

          console.log('🎧 Capturing audio from:', participant.name || participantId);

          const mediaStream = new MediaStream([mediaStreamTrack]);
          const source = audioContext.createMediaStreamSource(mediaStream);
          const processor = audioContext.createScriptProcessor(4096, 1, 1);

          processor.onaudioprocess = (e) => {
            if (!isTranscribing || !ws || ws.readyState !== WebSocket.OPEN) return;

            const inputData = e.inputBuffer.getChannelData(0);
            const int16Array = new Int16Array(inputData.length);
            
            // Convert Float32 to Int16
            for (let i = 0; i < inputData.length; i++) {
              const s = Math.max(-1, Math.min(1, inputData[i]));
              int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }

            // Convert to base64
            const uint8Array = new Uint8Array(int16Array.buffer);
            let binary = '';
            const chunkSize = 0x8000;
            
            for (let i = 0; i < uint8Array.length; i += chunkSize) {
              const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
              binary += String.fromCharCode.apply(null, Array.from(chunk));
            }
            
            const base64Audio = btoa(binary);

            // Send to transcription service
            ws.send(JSON.stringify({
              type: 'audio_data',
              audio: base64Audio,
              speaker: participant.name || participantId
            }));
          };

          source.connect(processor);
          processor.connect(audioContext.destination);
          
          processorNodesRef.current.set(participantId, processor);
        }
      } catch (error) {
        console.error('Error setting up audio capture:', error);
      }
    };

    setupAudioCapture();

    // Cleanup on unmount or dependency change
    return () => {
      console.log('🎤 Cleaning up all transcription processor nodes...');
      processorNodesRef.current.forEach((processor) => {
        try {
          processor.disconnect();
        } catch (e) {
          console.warn('Error disconnecting processor:', e);
        }
      });
      processorNodesRef.current.clear();

      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        console.log('🎤 Closing transcription AudioContext...');
        audioContextRef.current.close().catch(console.error);
        audioContextRef.current = null;
      }
    };
  }, [participants, isTranscribing, ws]);

  return null;
};
