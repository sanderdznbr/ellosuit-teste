import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, Pause, Send, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AudioRecorderProps {
  onSend: (audioBlob: Blob, duration: number) => void;
  onCancel: () => void;
}

const AudioRecorder: React.FC<AudioRecorderProps> = ({ onSend, onCancel }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [audioUrl]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setDuration(0);
      
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error accessing microphone:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const cancelRecording = () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setIsRecording(false);
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
    onCancel();
  };

  const playAudio = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const handleSend = () => {
    if (audioBlob) {
      onSend(audioBlob, duration);
      cancelRecording();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
      {/* Recording State */}
      {isRecording && !audioBlob && (
        <>
          <Button
            variant="ghost"
            size="icon"
            onClick={cancelRecording}
            className="h-8 w-8 text-red-500"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          
          <div className="flex items-center gap-2 flex-1">
            <div className={cn(
              "w-3 h-3 rounded-full bg-red-500",
              "animate-pulse"
            )} />
            <span className="text-sm font-medium text-foreground">
              Gravando... {formatTime(duration)}
            </span>
          </div>
          
          <Button
            onClick={stopRecording}
            className="bg-red-500 hover:bg-red-600 h-10 w-10 rounded-full p-0"
          >
            <Square className="h-4 w-4 fill-white" />
          </Button>
        </>
      )}

      {/* Preview State */}
      {audioBlob && audioUrl && (
        <>
          <Button
            variant="ghost"
            size="icon"
            onClick={cancelRecording}
            className="h-8 w-8 text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
          
          <div className="flex items-center gap-2 flex-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={playAudio}
              className="h-8 w-8"
            >
              {isPlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>
            
            <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all"
                style={{ width: isPlaying ? '100%' : '0%' }}
              />
            </div>
            
            <span className="text-xs text-muted-foreground">
              {formatTime(duration)}
            </span>
            
            <audio
              ref={audioRef}
              src={audioUrl}
              onEnded={() => setIsPlaying(false)}
              className="hidden"
            />
          </div>
          
          <Button
            onClick={handleSend}
            className="bg-green-600 hover:bg-green-700 h-10 w-10 rounded-full p-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </>
      )}

      {/* Initial State - Start Recording */}
      {!isRecording && !audioBlob && (
        <>
          <Button
            variant="ghost"
            size="icon"
            onClick={onCancel}
            className="h-8 w-8 text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
          
          <span className="text-sm text-muted-foreground flex-1">
            Toque para gravar
          </span>
          
          <Button
            onClick={startRecording}
            className="bg-green-600 hover:bg-green-700 h-12 w-12 rounded-full p-0"
          >
            <Mic className="h-5 w-5" />
          </Button>
        </>
      )}
    </div>
  );
};

export default AudioRecorder;
