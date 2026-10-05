import { useCallback, useEffect, useRef, useState } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface TranscriptionMessage {
  text: string;
  is_final: boolean;
  timestamp: string;
  speaker?: string;
}

interface LiveKitAudioCaptureProps {
  isActive: boolean;
  roomName: string;
  onTranscriptionUpdate: (message: TranscriptionMessage) => void;
}

type ParticipantRecorder = {
  key: string;
  participantId: string;
  participantName: string;
  audioContext: AudioContext;
  source: MediaStreamAudioSourceNode;
  destination: MediaStreamAudioDestinationNode;
  recorder: MediaRecorder | null;
  chunks: Blob[];
  segmentStartedAt: number;
  segmentTimer: ReturnType<typeof setTimeout> | null;
  mimeType: string;
  lastChunkAt: number;
  stopped: boolean;
  audioEl?: HTMLAudioElement | null;
  analyser?: AnalyserNode;
  vadBuf?: Float32Array;
  voicedSamples?: number;
  totalSamples?: number;
  vadInterval?: ReturnType<typeof setInterval> | null;
};

type QueueItem = {
  blob: Blob;
  participantId: string;
  participantName: string;
  startedAt: number;
  mimeType: string;
};

const CHUNK_MS = 4500;
const TRACK_SYNC_MS = 1000;
const STALL_RESTART_MS = 25000;
const REQUEST_TIMEOUT_MS = 18000;
const MAX_QUEUE_CHUNKS = 12;
const MIN_BLOB_BYTES = 1500;
// VAD: minimum % of frames with voice energy above threshold during a chunk
const VAD_RMS_THRESHOLD = 0.012; // ~ -38 dBFS
const VAD_MIN_VOICED_RATIO = 0.12; // at least 12% of analyzed frames must be voiced

const blobToBase64 = async (blob: Blob) => {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
};

const getSupportedMimeType = () => {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/mp4',
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || '';
};

export const LiveKitAudioCapture: React.FC<LiveKitAudioCaptureProps> = ({
  isActive,
  roomName,
  onTranscriptionUpdate,
}) => {
  const room = useRoomContext();
  const { toast } = useToast();
  const [activeRecorders, setActiveRecorders] = useState(0);

  const isActiveRef = useRef(isActive);
  const recordersRef = useRef<Map<string, ParticipantRecorder>>(new Map());
  const queueRef = useRef<QueueItem[]>([]);
  const sendingRef = useRef(false);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const watchdogRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastRequestStartedAtRef = useRef(0);
  const lastTranscriptBySpeakerRef = useRef<Map<string, string>>(new Map());
  const hasShownActiveToastRef = useRef(false);

  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  const pushTranscript = useCallback((text: string, speaker: string, timestamp: string) => {
    const cleanText = text.trim();
    if (cleanText.length < 3) return;

    const normalized = cleanText.toLowerCase().replace(/\s+/g, ' ');
    const last = lastTranscriptBySpeakerRef.current.get(speaker);
    if (normalized === last) return;
    lastTranscriptBySpeakerRef.current.set(speaker, normalized);

    onTranscriptionUpdate({
      text: cleanText,
      is_final: true,
      timestamp,
      speaker,
    });
  }, [onTranscriptionUpdate]);

  const processQueue = useCallback(async () => {
    if (sendingRef.current || queueRef.current.length === 0 || !isActiveRef.current) return;

    const item = queueRef.current.shift();
    if (!item || item.blob.size < MIN_BLOB_BYTES) {
      setTimeout(processQueue, 0);
      return;
    }

    sendingRef.current = true;
    lastRequestStartedAtRef.current = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const audio = await blobToBase64(item.blob);
      const invokePromise = supabase.functions.invoke('realtime-transcription', {
        body: {
          audio,
          roomId: roomName,
          audioMimeType: item.mimeType || 'audio/webm',
          speaker: item.participantName,
          participantId: item.participantId,
          startedAt: new Date(item.startedAt).toISOString(),
        },
        signal: controller.signal,
      } as any);

      const { data, error } = await Promise.race([
        invokePromise,
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Tempo limite da transcrição excedido')), REQUEST_TIMEOUT_MS + 500);
        }),
      ]);

      if (error) {
        console.error('❌ [MeetingTranscription] Erro Whisper:', error.message);
      } else if (data?.text && !data.filtered) {
        pushTranscript(data.text, item.participantName, new Date(item.startedAt).toISOString());
      }
    } catch (error) {
      console.error('❌ [MeetingTranscription] Falha ao processar chunk:', error);
    } finally {
      clearTimeout(timeoutId);
      sendingRef.current = false;
      lastRequestStartedAtRef.current = 0;
      if (queueRef.current.length > 0) {
        setTimeout(processQueue, 50);
      }
    }
  }, [pushTranscript, roomName]);

  const enqueueChunk = useCallback((rec: ParticipantRecorder, chunks: Blob[]) => {
    if (chunks.length === 0) return;
    const type = rec.mimeType || chunks[0]?.type || 'audio/webm';
    const blob = new Blob(chunks, { type });
    if (blob.size < MIN_BLOB_BYTES) return;

    queueRef.current.push({
      blob,
      participantId: rec.participantId,
      participantName: rec.participantName,
      startedAt: rec.segmentStartedAt,
      mimeType: type,
    });
    if (queueRef.current.length > MAX_QUEUE_CHUNKS) {
      queueRef.current = queueRef.current.slice(-MAX_QUEUE_CHUNKS);
    }
    processQueue();
  }, [processQueue]);

  const startRecorderFor = useCallback((rec: ParticipantRecorder) => {
    if (rec.stopped) return;
    try {
      const mimeType = getSupportedMimeType();
      const recorder = new MediaRecorder(
        rec.destination.stream,
        mimeType ? { mimeType, audioBitsPerSecond: 96000 } : { audioBitsPerSecond: 96000 },
      );
      rec.recorder = recorder;
      rec.mimeType = mimeType || 'audio/webm';
      rec.chunks = [];
      rec.segmentStartedAt = Date.now();
      rec.lastChunkAt = Date.now();

      recorder.ondataavailable = (event) => {
        if (!isActiveRef.current || !event.data || event.data.size < 500) return;
        rec.lastChunkAt = Date.now();
        rec.chunks.push(event.data);
      };

      recorder.onerror = (event) => {
        console.error('❌ [MeetingTranscription] Recorder erro:', rec.participantName, event);
        setTimeout(() => startRecorderFor(rec), 800);
      };

      recorder.onstop = () => {
        const chunks = rec.chunks;
        rec.chunks = [];
        const total = rec.totalSamples || 0;
        const voiced = rec.voicedSamples || 0;
        const voicedRatio = total > 0 ? voiced / total : 0;
        rec.totalSamples = 0;
        rec.voicedSamples = 0;
        if (isActiveRef.current && !rec.stopped) {
          // Drop chunk if there was no real voice activity (Whisper hallucinates on silence)
          if (voicedRatio >= VAD_MIN_VOICED_RATIO) {
            enqueueChunk(rec, chunks);
          } else {
            console.log(`🤫 [VAD] Chunk de ${rec.participantName} descartado (sem fala detectada, voiced=${(voicedRatio * 100).toFixed(1)}%)`);
          }
          setTimeout(() => startRecorderFor(rec), 200);
        }
      };

      recorder.start();
      rec.segmentTimer = setTimeout(() => {
        if (rec.recorder === recorder && recorder.state === 'recording') {
          try { recorder.stop(); } catch {}
        }
      }, CHUNK_MS);
    } catch (error) {
      console.error('❌ [MeetingTranscription] Falha ao iniciar recorder:', rec.participantName, error);
    }
  }, [enqueueChunk]);

  const stopRecorderFor = useCallback((rec: ParticipantRecorder) => {
    rec.stopped = true;
    if (rec.segmentTimer) { clearTimeout(rec.segmentTimer); rec.segmentTimer = null; }
    if (rec.vadInterval) { clearInterval(rec.vadInterval); rec.vadInterval = null; }
    try { rec.recorder?.state !== 'inactive' && rec.recorder?.stop(); } catch {}
    try { rec.source.disconnect(); } catch {}
    try { rec.destination.disconnect(); } catch {}
    try { rec.analyser?.disconnect(); } catch {}
    try { rec.audioContext.close(); } catch {}
    if (rec.audioEl) {
      try { rec.audioEl.pause(); } catch {}
      try { rec.audioEl.srcObject = null; } catch {}
      try { rec.audioEl.remove(); } catch {}
      rec.audioEl = null;
    }
  }, []);

  const cleanupAll = useCallback(() => {
    if (syncIntervalRef.current) { clearInterval(syncIntervalRef.current); syncIntervalRef.current = null; }
    if (watchdogRef.current) { clearInterval(watchdogRef.current); watchdogRef.current = null; }
    recordersRef.current.forEach(stopRecorderFor);
    recordersRef.current.clear();
    queueRef.current = [];
    sendingRef.current = false;
    setActiveRecorders(0);
  }, [stopRecorderFor]);

  const syncParticipants = useCallback(async () => {
    if (!room || !isActiveRef.current) return;

    const participants = [room.localParticipant, ...Array.from(room.remoteParticipants.values())];
    const nextKeys = new Set<string>();

    participants.forEach((participant: any) => {
      const displayName = participant.name || participant.identity || 'Participante';
      const isLocal = participant === room.localParticipant;
      participant.audioTrackPublications?.forEach((publication: any) => {
        const audioTrack = publication.audioTrack ?? publication.track;
        const mediaStreamTrack: MediaStreamTrack | undefined = audioTrack?.mediaStreamTrack;
        if (!mediaStreamTrack || mediaStreamTrack.readyState === 'ended') return;

        const trackKey = publication.trackSid || publication.sid || mediaStreamTrack.id;
        const key = `${participant.identity}:${trackKey}`;
        nextKeys.add(key);

        if (recordersRef.current.has(key)) return;

        try {
          const audioContext = new AudioContext();
          const stream = new MediaStream([mediaStreamTrack]);

          // CRÍTICO: faixas REMOTAS no LiveKit só entregam samples ao Web Audio
          // se estiverem anexadas a um <audio> sendo reproduzido pelo navegador.
          // Sem isso, o MediaStreamAudioSourceNode fica mudo (só capta a sua voz).
          let audioEl: HTMLAudioElement | null = null;
          if (!isLocal) {
            audioEl = document.createElement('audio');
            audioEl.autoplay = true;
            // NÃO use muted=true — em alguns navegadores isso para de bombar samples
            // para o Web Audio API. Use volume=0 para silenciar sem duplicar o som
            // (o LiveKit/RoomAudioRenderer já reproduz o áudio para o usuário).
            audioEl.volume = 0;
            (audioEl as any).playsInline = true;
            audioEl.srcObject = stream;
            audioEl.style.display = 'none';
            document.body.appendChild(audioEl);
            audioEl.play().catch(() => {});
          }

          const source = audioContext.createMediaStreamSource(stream);
          const destination = audioContext.createMediaStreamDestination();
          source.connect(destination);
          // VAD analyser — measures real audio energy from this participant
          const analyser = audioContext.createAnalyser();
          analyser.fftSize = 2048;
          analyser.smoothingTimeConstant = 0.2;
          source.connect(analyser);
          const vadBuf = new Float32Array(new ArrayBuffer(analyser.fftSize * 4));

          const rec: ParticipantRecorder = {
            key,
            participantId: participant.identity,
            participantName: displayName,
            audioContext,
            source,
            destination,
            recorder: null,
            chunks: [],
            segmentStartedAt: Date.now(),
            segmentTimer: null,
            mimeType: 'audio/webm',
            lastChunkAt: Date.now(),
            stopped: false,
            audioEl,
            analyser,
            vadBuf,
            voicedSamples: 0,
            totalSamples: 0,
            vadInterval: null,
          };
          // Sample RMS ~50x/sec to detect actual voice activity
          rec.vadInterval = setInterval(() => {
            if (!rec.analyser || !rec.vadBuf) return;
            rec.analyser.getFloatTimeDomainData(rec.vadBuf as Float32Array<ArrayBuffer>);
            let sum = 0;
            for (let i = 0; i < rec.vadBuf.length; i++) {
              sum += rec.vadBuf[i] * rec.vadBuf[i];
            }
            const rms = Math.sqrt(sum / rec.vadBuf.length);
            rec.totalSamples = (rec.totalSamples || 0) + 1;
            if (rms > VAD_RMS_THRESHOLD) {
              rec.voicedSamples = (rec.voicedSamples || 0) + 1;
            }
          }, 20);
          recordersRef.current.set(key, rec);
          startRecorderFor(rec);
          console.log('🎧 [MeetingTranscription] Captando:', displayName, isLocal ? '(local)' : '(remoto)');

          hasShownActiveToastRef.current = true;
        } catch (error) {
          console.error('❌ [MeetingTranscription] Falha ao montar pipeline:', displayName, error);
        }
      });
    });

    recordersRef.current.forEach((rec, key) => {
      if (nextKeys.has(key)) return;
      stopRecorderFor(rec);
      recordersRef.current.delete(key);
      console.log('🔇 [MeetingTranscription] Removido:', rec.participantName);
    });

    setActiveRecorders(recordersRef.current.size);
  }, [room, startRecorderFor, stopRecorderFor, toast]);

  useEffect(() => {
    if (!isActive || !room) {
      cleanupAll();
      return;
    }

    syncParticipants();
    syncIntervalRef.current = setInterval(syncParticipants, TRACK_SYNC_MS);
    watchdogRef.current = setInterval(() => {
      // Restart any stalled recorders
      recordersRef.current.forEach((rec) => {
        if (rec.stopped) return;
        const stalled = Date.now() - rec.lastChunkAt > STALL_RESTART_MS;
        const noRecorder = !rec.recorder || rec.recorder.state === 'inactive';
        if (noRecorder || stalled) {
          console.warn('🐶 [MeetingTranscription] Reiniciando recorder de', rec.participantName);
          if (rec.segmentTimer) { clearTimeout(rec.segmentTimer); rec.segmentTimer = null; }
          try { rec.recorder?.state === 'recording' && rec.recorder?.stop(); } catch {}
          startRecorderFor(rec);
        }
      });

      // Unblock hung request
      if (sendingRef.current && Date.now() - lastRequestStartedAtRef.current > REQUEST_TIMEOUT_MS + 3000) {
        console.warn('🐶 [MeetingTranscription] Destravando fila');
        sendingRef.current = false;
        lastRequestStartedAtRef.current = 0;
        processQueue();
      }
    }, 6000);

    return cleanupAll;
  }, [cleanupAll, isActive, room, startRecorderFor, syncParticipants, processQueue]);

  useEffect(() => {
    console.log('📊 [MeetingTranscription] Recorders ativos:', activeRecorders, '| fila:', queueRef.current.length);
  }, [activeRecorders]);

  return null;
};
