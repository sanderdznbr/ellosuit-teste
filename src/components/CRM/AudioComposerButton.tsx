import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Mic, Sparkles, Loader2, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import AudioRecorderButton from './AudioRecorderButton';

const DEFAULT_VOICES = [
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', desc: 'Feminina - Suave' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', desc: 'Feminina - Suave' },
  { id: 'FGY2WhTYpPnrIDTdsKH5', name: 'Laura', desc: 'Feminina - Expressiva' },
  { id: 'cgSgspJ2msm6clMCkdW9', name: 'Jessica', desc: 'Feminina - Natural' },
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', desc: 'Masculina - Narrador' },
];

interface AudioComposerButtonProps {
  onAudioReady: (blob: Blob) => void;
  onRecordingStart?: () => void;
  onRecordingEnd?: () => void;
  disabled?: boolean;
  recording?: boolean;
  className?: string;
}

const AudioComposerButton: React.FC<AudioComposerButtonProps> = ({
  onAudioReady,
  onRecordingStart,
  onRecordingEnd,
  disabled,
  recording,
  className,
}) => {
  const { toast } = useToast();
  const [startSignal, setStartSignal] = useState(0);
  const [open, setOpen] = useState(false);
  const [script, setScript] = useState('');
  const [voiceId, setVoiceId] = useState(DEFAULT_VOICES[0].id);
  const [customVoices, setCustomVoices] = useState<{ voice_id: string; name: string }[]>([]);
  const [generating, setGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);

  const authHeaders = async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    return {
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
      Authorization: `Bearer ${token}`,
    };
  };

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-voice-clone`, {
          method: 'POST',
          headers: await authHeaders(),
          body: JSON.stringify({ action: 'list' }),
        });
        if (!res.ok) return;
        const data = await res.json();
        setCustomVoices(data.voices || []);
      } catch (e) {
        console.error('Erro ao listar vozes personalizadas:', e);
      }
    })();
  }, [open]);

  const generate = async () => {
    if (!script.trim()) return;
    setGenerating(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ text: script.trim(), voiceId }),
      });
      if (!res.ok) {
        const errText = await res.text();
        let msg = 'Falha ao gerar áudio';
        try { msg = JSON.parse(errText).error || msg; } catch {}
        throw new Error(msg);
      }
      const blob = new Blob([await res.blob()], { type: 'audio/mpeg' });
      if (!blob.size) throw new Error('Áudio vazio retornado pela ElevenLabs');
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewBlob(blob);
      setPreviewUrl(URL.createObjectURL(blob));
    } catch (e: any) {
      toast({ title: 'Erro ao gerar áudio', description: e.message, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const sendGenerated = () => {
    if (!previewBlob) return;
    onAudioReady(previewBlob);
    setOpen(false);
    setScript('');
    setPreviewBlob(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  };

  const voices = [
    ...DEFAULT_VOICES,
    ...customVoices.map(v => ({ id: v.voice_id, name: v.name, desc: 'Minha voz' })),
  ];

  return (
    <>
      <AudioRecorderButton
        hideIdleTrigger
        startSignal={startSignal}
        onRecordingStart={onRecordingStart}
        onRecordingComplete={(blob) => { onRecordingEnd?.(); onAudioReady(blob); }}
        className={recording ? 'flex-1' : undefined}
      />

      {!recording && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              disabled={disabled}
              className={cn('h-10 w-10 flex-shrink-0 hover:bg-accent', className)}
              title="Áudio"
            >
              <Mic className="h-5 w-5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => setStartSignal(s => s + 1)}>
              <Mic className="h-4 w-4 mr-2" />
              Gravar áudio
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setOpen(true)}>
              <Sparkles className="h-4 w-4 mr-2" />
              Criar áudio (Voz IA)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle className="text-[#374DA4]">Criar áudio com Voz IA</DialogTitle>
            <DialogDescription>Digite o roteiro, escolha a voz e envie o áudio gerado.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder="Digite o roteiro que será falado..."
              className="min-h-[110px] rounded-xl"
            />

            <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
              {voices.map(v => (
                <button
                  type="button"
                  key={v.id}
                  onClick={() => setVoiceId(v.id)}
                  className={cn(
                    'w-full flex items-center justify-between p-3 rounded-xl border text-left transition-colors',
                    voiceId === v.id ? 'border-[#374DA4] bg-blue-50/60' : 'border-border/60 hover:border-border'
                  )}
                >
                  <span className="text-sm font-medium text-foreground">{v.name}</span>
                  <span className="text-[11px] text-muted-foreground">{v.desc}</span>
                </button>
              ))}
            </div>

            {previewUrl && (
              <audio src={previewUrl} controls className="w-full h-10" />
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={generate} disabled={generating || !script.trim()}>
                {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                {previewUrl ? 'Gerar novamente' : 'Gerar áudio'}
              </Button>
              <Button onClick={sendGenerated} disabled={!previewBlob} className="bg-[#374DA4] hover:bg-[#2e3f88]">
                <Send className="h-4 w-4 mr-2" /> Enviar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AudioComposerButton;
