import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Upload, Trash2, Volume2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface MeetingAudioSettingsProps {
  companyId: string;
}

const MeetingAudioSettings: React.FC<MeetingAudioSettingsProps> = ({ companyId }) => {
  const [audioFiles, setAudioFiles] = useState<{
    joined: File | null;
    waiting: File | null;
    left: File | null;
  }>({
    joined: null,
    waiting: null,
    left: null,
  });
  const { toast } = useToast();

  const handleFileUpload = (type: 'joined' | 'waiting' | 'left', file: File | null) => {
    if (file && file.size > 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "O áudio deve ter no máximo 1MB",
        variant: "destructive"
      });
      return;
    }
    
    setAudioFiles(prev => ({ ...prev, [type]: file }));
    
    if (file) {
      // Save to localStorage for now (in production, upload to Supabase Storage)
      const reader = new FileReader();
      reader.onload = () => {
        localStorage.setItem(`meeting_audio_${type}_${companyId}`, reader.result as string);
        toast({
          title: "Áudio salvo",
          description: `Áudio de ${type === 'joined' ? 'entrada' : type === 'waiting' ? 'solicitação' : 'saída'} atualizado`,
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveAudio = (type: 'joined' | 'waiting' | 'left') => {
    setAudioFiles(prev => ({ ...prev, [type]: null }));
    localStorage.removeItem(`meeting_audio_${type}_${companyId}`);
    toast({
      title: "Áudio removido",
      description: "O áudio personalizado foi removido",
    });
  };

  const handleTestAudio = (type: 'joined' | 'waiting' | 'left') => {
    const savedAudio = localStorage.getItem(`meeting_audio_${type}_${companyId}`);
    if (savedAudio) {
      const audio = new Audio(savedAudio);
      audio.play().catch(console.error);
    } else {
      toast({
        title: "Nenhum áudio",
        description: "Carregue um áudio primeiro",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Áudios Personalizados da Reunião</h3>
        <p className="text-sm text-muted-foreground mb-6">
          Carregue áudios personalizados para eventos da reunião (máximo 1MB cada)
        </p>
      </div>

      {/* Entrada de Usuário */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Entrada de Usuário</Label>
        <div className="flex items-center gap-2">
          <input
            type="file"
            accept="audio/*"
            id="audio-joined"
            className="hidden"
            onChange={(e) => handleFileUpload('joined', e.target.files?.[0] || null)}
          />
          <Button
            onClick={() => document.getElementById('audio-joined')?.click()}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            {audioFiles.joined?.name || 'Carregar Áudio'}
          </Button>
          {audioFiles.joined && (
            <>
              <Button
                onClick={() => handleTestAudio('joined')}
                variant="ghost"
                size="sm"
              >
                <Volume2 className="h-4 w-4" />
              </Button>
              <Button
                onClick={() => handleRemoveAudio('joined')}
                variant="ghost"
                size="sm"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Solicitação de Entrada */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Solicitação de Entrada</Label>
        <div className="flex items-center gap-2">
          <input
            type="file"
            accept="audio/*"
            id="audio-waiting"
            className="hidden"
            onChange={(e) => handleFileUpload('waiting', e.target.files?.[0] || null)}
          />
          <Button
            onClick={() => document.getElementById('audio-waiting')?.click()}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            {audioFiles.waiting?.name || 'Carregar Áudio'}
          </Button>
          {audioFiles.waiting && (
            <>
              <Button
                onClick={() => handleTestAudio('waiting')}
                variant="ghost"
                size="sm"
              >
                <Volume2 className="h-4 w-4" />
              </Button>
              <Button
                onClick={() => handleRemoveAudio('waiting')}
                variant="ghost"
                size="sm"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Saída de Usuário */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Saída de Usuário</Label>
        <div className="flex items-center gap-2">
          <input
            type="file"
            accept="audio/*"
            id="audio-left"
            className="hidden"
            onChange={(e) => handleFileUpload('left', e.target.files?.[0] || null)}
          />
          <Button
            onClick={() => document.getElementById('audio-left')?.click()}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            {audioFiles.left?.name || 'Carregar Áudio'}
          </Button>
          {audioFiles.left && (
            <>
              <Button
                onClick={() => handleTestAudio('left')}
                variant="ghost"
                size="sm"
              >
                <Volume2 className="h-4 w-4" />
              </Button>
              <Button
                onClick={() => handleRemoveAudio('left')}
                variant="ghost"
                size="sm"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MeetingAudioSettings;
