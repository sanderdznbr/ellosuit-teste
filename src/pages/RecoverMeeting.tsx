import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, Save, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';

const RecoverMeeting = () => {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [transcriptionData, setTranscriptionData] = useState<any>(null);
  const [title, setTitle] = useState('');
  const [companyId, setCompanyId] = useState<string>('');

  useEffect(() => {
    const getCompanyId = async () => {
      if (user) {
        const { data: companyUsers } = await supabase
          .from('company_users')
          .select('company_id')
          .eq('user_id', user.id)
          .limit(1);
        
        if (companyUsers && companyUsers.length > 0) {
          setCompanyId(companyUsers[0].company_id);
        }
      }
    };
    
    getCompanyId();
  }, [user]);

  useEffect(() => {
    const fetchTranscription = async () => {
      if (!roomCode) return;

      try {
        setLoading(true);

        // Try to fetch from in_person_meetings first (most common)
        const { data: inPersonMeeting, error: inPersonError } = await supabase
          .from('in_person_meetings')
          .select('*')
          .ilike('title', `%${roomCode}%`)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (inPersonMeeting && inPersonMeeting.transcript) {
          setTranscriptionData({
            transcript: inPersonMeeting.transcript,
            title: inPersonMeeting.title,
            date: inPersonMeeting.created_at,
            source: 'in_person_meeting'
          });
          setTitle(inPersonMeeting.title);
          return;
        }

        // Try to fetch from calendar_events
        const { data: event, error: eventError } = await supabase
          .from('calendar_events')
          .select('*')
          .eq('meeting_link', roomCode)
          .or(`meeting_data->roomCode.eq.${roomCode}`)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (event && event.transcript) {
          setTranscriptionData({
            transcript: event.transcript,
            title: event.title,
            date: event.start_date,
            source: 'calendar_event'
          });
          setTitle(event.title);
          return;
        }

        // Try to fetch from meeting_recordings
        const { data: recording, error: recordingError } = await supabase
          .from('meeting_recordings')
          .select('*')
          .ilike('title', `%${roomCode}%`)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (recording && recording.transcript) {
          setTranscriptionData({
            transcript: recording.transcript,
            title: recording.title,
            date: recording.created_at,
            source: 'meeting_recording'
          });
          setTitle(recording.title);
          return;
        }

        // If not found anywhere, show message
        setTranscriptionData({
          message: 'Reunião não encontrada no banco de dados',
          suggestion: 'As transcrições dessa reunião podem ter se perdido. Certifique-se de que a reunião foi salva antes de sair.',
          roomCode: roomCode
        });
        setTitle(`Reunião ${roomCode} - ${new Date().toLocaleDateString('pt-BR')}`);
        
      } catch (error) {
        console.error('Error fetching transcription:', error);
        toast({
          title: "Erro",
          description: "Não foi possível recuperar a transcrição",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchTranscription();
  }, [roomCode, toast]);

  const handleSave = async () => {
    if (!transcriptionData || !companyId || !user?.id) return;

    try {
      setSaving(true);

      const { data, error } = await supabase
        .from('in_person_meetings')
        .insert({
          title: title || `Reunião ${roomCode} - ${new Date().toLocaleDateString('pt-BR')}`,
          transcript: transcriptionData.transcript || 'Transcrição não disponível',
          company_id: companyId,
          created_by: user.id,
          duration_seconds: 0
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Reunião salva!",
        description: "A reunião foi salva com sucesso no histórico.",
      });

      navigate('/dashboard/reunioes');
    } catch (error) {
      console.error('Error saving meeting:', error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar a reunião",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-foreground">Buscando transcrição...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-4">
        <Button
          onClick={() => navigate('/dashboard/reunioes')}
          variant="ghost"
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>

        <Card className="p-6">
          <h1 className="text-2xl font-bold mb-4">Recuperar Reunião</h1>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Título da Reunião</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Digite o título da reunião"
              />
            </div>

            {transcriptionData?.transcript ? (
              <div>
                <label className="block text-sm font-medium mb-2">Transcrição</label>
                <div className="bg-muted p-4 rounded-lg max-h-96 overflow-y-auto">
                  <pre className="whitespace-pre-wrap text-sm">{transcriptionData.transcript}</pre>
                </div>
              </div>
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm font-medium text-yellow-800 mb-2">
                  {transcriptionData?.message}
                </p>
                <p className="text-sm text-yellow-700">
                  {transcriptionData?.suggestion}
                </p>
                {transcriptionData?.roomCode && (
                  <p className="text-sm text-yellow-700 mt-2">
                    Código da sala: <strong>{transcriptionData.roomCode}</strong>
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                disabled={saving || !transcriptionData?.transcript}
                className="flex-1"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Salvar no Histórico
                  </>
                )}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default RecoverMeeting;
