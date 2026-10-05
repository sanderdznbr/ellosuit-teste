import React, { useState, useRef, useCallback } from 'react';
import { Mic, Square, Play, Trash2, Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const OMNI_COLOR = '#374DA4';

interface AudioRecorderProps {
  onAudioUrl: (url: string) => void;
  disabled?: boolean;
}

export default function AudioRecorder({ onAudioUrl, disabled }: AudioRecorderProps) {
  const { toast } = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      setDuration(0);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        stream.getTracks().forEach(t => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);
      };

      mediaRecorder.start(250);
      setIsRecording(true);

      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    } catch {
      toast({ title: 'Erro ao acessar microfone', description: 'Verifique as permissões do navegador', variant: 'destructive' });
    }
  }, [toast]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const discardAudio = useCallback(() => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
  }, [audioUrl]);

  const uploadAudio = useCallback(async () => {
    if (!audioBlob) return;
    setIsUploading(true);
    try {
      const fileName = `audio_${Date.now()}.webm`;
      const filePath = `audios/${fileName}`;

      const { error } = await supabase.storage
        .from('disparos-media')
        .upload(filePath, audioBlob, { contentType: 'audio/webm' });

      if (error) throw error;

      const { data: publicData } = supabase.storage
        .from('disparos-media')
        .getPublicUrl(filePath);

      onAudioUrl(publicData.publicUrl);
      toast({ title: 'Áudio enviado com sucesso!' });
    } catch (err: any) {
      toast({ title: 'Erro no upload', description: err.message, variant: 'destructive' });
    } finally {
      setIsUploading(false);
    }
  }, [audioBlob, onAudioUrl, toast]);

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="space-y-3">
      {!audioBlob ? (
        <div className="flex flex-col items-center gap-3 py-6 border-2 border-dashed border-gray-200 dark:border-white/15 rounded-xl">
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={disabled}
            className="h-16 w-16 rounded-full flex items-center justify-center transition-all"
            style={{ backgroundColor: isRecording ? '#ef4444' : OMNI_COLOR }}
          >
            {isRecording ? (
              <Square className="h-6 w-6 text-white" />
            ) : (
              <Mic className="h-6 w-6 text-white" />
            )}
          </button>
          <span className="text-sm text-gray-500 dark:text-muted-foreground">
            {isRecording ? (
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                Gravando... {formatTime(duration)}
              </span>
            ) : (
              'Toque para gravar'
            )}
          </span>
        </div>
      ) : (
        <div className="space-y-3 p-4 bg-gray-50 dark:bg-white/5 rounded-xl">
          <div className="flex items-center gap-3">
            <audio ref={audioRef} src={audioUrl!} controls className="flex-1 h-10" />
            <span className="text-xs text-gray-500 dark:text-muted-foreground whitespace-nowrap">{formatTime(duration)}</span>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={discardAudio}
              disabled={isUploading}
              className="text-red-500 hover:text-red-600 hover:bg-red-50 flex-1"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Descartar
            </Button>
            <Button
              size="sm"
              onClick={uploadAudio}
              disabled={isUploading}
              className="text-white flex-1"
              style={{ backgroundColor: OMNI_COLOR }}
            >
              {isUploading ? (
                <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Enviando...</>
              ) : (
                <><Upload className="h-3.5 w-3.5 mr-1" /> Usar este áudio</>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
