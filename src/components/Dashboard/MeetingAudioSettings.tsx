import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Upload, Music, Play, Trash2, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface AudioSetting {
  id: string;
  audio_type: 'user_joined' | 'user_left' | 'user_waiting';
  audio_url: string;
}

const MeetingAudioSettings: React.FC = () => {
  const [audioSettings, setAudioSettings] = useState<AudioSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string>('');
  const { user } = useAuth();
  const { toast } = useToast();

  const audioTypes = [
    { key: 'user_joined', label: 'Participante entrou', description: 'Toca quando alguém entra na reunião' },
    { key: 'user_left', label: 'Participante saiu', description: 'Toca quando alguém sai da reunião' },
    { key: 'user_waiting', label: 'Participante aguardando', description: 'Toca quando alguém está na sala de espera' },
  ];

  useEffect(() => {
    loadCompanyId();
  }, [user]);

  useEffect(() => {
    if (companyId) {
      loadAudioSettings();
    }
  }, [companyId]);

  const loadCompanyId = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', user.id)
      .single();

    if (error) {
      console.error('Error loading company:', error);
      return;
    }

    if (data) {
      setCompanyId(data.company_id);
    }
  };

  const loadAudioSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('meeting_audio_settings')
        .select('*')
        .eq('company_id', companyId);

      if (error) throw error;

      setAudioSettings(data as AudioSetting[] || []);
    } catch (error) {
      console.error('Error loading audio settings:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as configurações de áudio",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (audioType: string, file: File) => {
    if (!companyId) {
      toast({
        title: "Erro",
        description: "Company ID não encontrado",
        variant: "destructive",
      });
      return;
    }

    // Validate file type
    if (!file.type.startsWith('audio/')) {
      toast({
        title: "Erro",
        description: "Por favor, selecione um arquivo de áudio válido",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Erro",
        description: "O arquivo deve ter no máximo 5MB",
        variant: "destructive",
      });
      return;
    }

    setUploading(audioType);

    try {
      // Upload file to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${companyId}/${audioType}_${Date.now()}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('meeting-audios')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('meeting-audios')
        .getPublicUrl(fileName);

      // Save to database
      const existingSetting = audioSettings.find(s => s.audio_type === audioType);

      if (existingSetting) {
        // Update existing
        const { error: updateError } = await supabase
          .from('meeting_audio_settings')
          .update({ audio_url: publicUrl })
          .eq('id', existingSetting.id);

        if (updateError) throw updateError;

        // Delete old file from storage
        const oldFileName = existingSetting.audio_url.split('/').pop();
        if (oldFileName) {
          await supabase.storage
            .from('meeting-audios')
            .remove([`${companyId}/${oldFileName}`]);
        }
      } else {
        // Insert new
        const { error: insertError } = await supabase
          .from('meeting_audio_settings')
          .insert({
            company_id: companyId,
            audio_type: audioType,
            audio_url: publicUrl,
          });

        if (insertError) throw insertError;
      }

      toast({
        title: "Sucesso!",
        description: "Áudio carregado com sucesso",
      });

      loadAudioSettings();
    } catch (error) {
      console.error('Error uploading audio:', error);
      toast({
        title: "Erro",
        description: "Não foi possível fazer upload do áudio",
        variant: "destructive",
      });
    } finally {
      setUploading(null);
    }
  };

  const handleDeleteAudio = async (audioType: string) => {
    const setting = audioSettings.find(s => s.audio_type === audioType);
    if (!setting) return;

    try {
      // Delete from database
      const { error: deleteError } = await supabase
        .from('meeting_audio_settings')
        .delete()
        .eq('id', setting.id);

      if (deleteError) throw deleteError;

      // Delete from storage
      const fileName = setting.audio_url.split('/').pop();
      if (fileName) {
        await supabase.storage
          .from('meeting-audios')
          .remove([`${companyId}/${fileName}`]);
      }

      toast({
        title: "Sucesso!",
        description: "Áudio removido com sucesso",
      });

      loadAudioSettings();
    } catch (error) {
      console.error('Error deleting audio:', error);
      toast({
        title: "Erro",
        description: "Não foi possível remover o áudio",
        variant: "destructive",
      });
    }
  };

  const playAudio = (url: string) => {
    const audio = new Audio(url);
    audio.play().catch(err => {
      console.error('Error playing audio:', err);
      toast({
        title: "Erro",
        description: "Não foi possível reproduzir o áudio",
        variant: "destructive",
      });
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Áudios de Reunião</h2>
        <p className="text-muted-foreground mt-1">
          Configure os áudios personalizados que serão tocados durante as reuniões
        </p>
      </div>

      <div className="grid gap-6">
        {audioTypes.map((type) => {
          const currentSetting = audioSettings.find(s => s.audio_type === type.key);
          const isUploading = uploading === type.key;

          return (
            <Card key={type.key}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Music className="h-5 w-5" />
                  {type.label}
                </CardTitle>
                <CardDescription>{type.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {currentSetting ? (
                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => playAudio(currentSetting.audio_url)}
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Testar Áudio
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteAudio(type.key)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Remover
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Áudio configurado
                      </span>
                    </div>
                  ) : null}

                  <div>
                    <Label htmlFor={`audio-${type.key}`} className="mb-2 block">
                      {currentSetting ? 'Substituir áudio' : 'Upload de áudio'}
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id={`audio-${type.key}`}
                        type="file"
                        accept="audio/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleFileUpload(type.key, file);
                          }
                        }}
                        disabled={isUploading}
                        className="flex-1"
                      />
                      {isUploading && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-sm">Enviando...</span>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Formatos aceitos: MP3, WAV, OGG. Tamanho máximo: 5MB
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default MeetingAudioSettings;
