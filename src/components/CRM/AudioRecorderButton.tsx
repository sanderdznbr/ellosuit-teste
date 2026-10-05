import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AudioRecorderButtonProps {
  onRecordingComplete: (audioBlob: Blob) => void;
  onRecordingStart?: () => void;
  disabled?: boolean;
  className?: string;
  /** Incrementar para iniciar a gravação por fora (menu) */
  startSignal?: number;
  /** Não renderizar o botão de microfone quando ocioso */
  hideIdleTrigger?: boolean;
}

const AudioRecorderButton: React.FC<AudioRecorderButtonProps> = ({
  onRecordingComplete,
  onRecordingStart,
  disabled,
  className,
  startSignal = 0,
  hideIdleTrigger = false
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [visualizerData, setVisualizerData] = useState<number[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = useCallback(async () => {
    try {
      if (onRecordingStart) onRecordingStart();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      });

      streamRef.current = stream;
      chunksRef.current = [];

      // Setup Analyser for visualizer
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateVisualizer = () => {
        if (!isRecording) return;
        analyser.getByteFrequencyData(dataArray);
        // Calculate simple levels for visualization
        const levels = Array.from(dataArray).slice(0, 15).map(v => Math.max(4, (v / 255) * 20));
        setVisualizerData(levels);
        animationFrameRef.current = requestAnimationFrame(updateVisualizer);
      };

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

      const recorder = new MediaRecorder(stream, { mimeType });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];
        
        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        
        onRecordingComplete(blob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start(100);
      setIsRecording(true);
      setRecordingDuration(0);
      updateVisualizer();

      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

    } catch (error: any) {
      console.error('Error starting recording:', error);
      if (error.name === 'NotAllowedError') {
        alert('Permissão para microfone negada. Verifique as configurações do navegador.');
      } else {
        alert('Erro ao iniciar gravação: ' + error.message);
      }
    }
  }, [onRecordingComplete]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    setIsRecording(false);
    setRecordingDuration(0);
    setVisualizerData([]);
  }, []);

  const handleClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  useEffect(() => {
    if (startSignal > 0 && !isRecording) startRecording();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startSignal]);

  if (isRecording) {
    return (
      <div className={cn("flex items-center gap-2 flex-1 bg-muted/50 rounded-full px-3 py-1 animate-in fade-in slide-in-from-right-2", className)}>
        <div className="flex items-center gap-1.5 px-2 py-1 bg-red-100 dark:bg-red-900/30 rounded-full">
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-xs font-mono font-medium text-red-600 dark:text-red-400 min-w-[35px]">
            {formatDuration(recordingDuration)}
          </span>
        </div>
        
        {/* Simple Audio Waveform Visualizer */}
        <div className="flex-1 flex items-center justify-center gap-[2px] h-6 px-2">
          {visualizerData.length > 0 ? visualizerData.map((h, i) => (
            <div 
              key={i} 
              className="w-[2px] bg-red-400 rounded-full transition-all duration-75"
              style={{ height: `${h}px` }}
            />
          )) : (
            Array.from({ length: 15 }).map((_, i) => (
              <div key={i} className="w-[2px] h-1 bg-red-200 dark:bg-red-800 rounded-full" />
            ))
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleClick}
          className="h-8 w-8 rounded-full text-red-500 hover:text-red-600 hover:bg-red-50"
        >
          <Square className="h-4 w-4 fill-current" />
        </Button>
      </div>
    );
  }

  if (hideIdleTrigger) return null;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleClick}
      disabled={disabled}
      className={cn("h-10 w-10 flex-shrink-0 hover:bg-accent", className)}
      title="Gravar áudio"
    >
      <Mic className="h-5 w-5 text-muted-foreground" />
    </Button>
  );
};

export default AudioRecorderButton;
