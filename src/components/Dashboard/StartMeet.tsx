
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Video, Users, Clock, Loader2, AlertCircle, Settings as SettingsIcon } from 'lucide-react';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface Client {
  id: string;
  name: string;
  email: string;
}

interface StartMeetProps {
  onNavigate?: (page: string) => void;
}

const StartMeet = ({ onNavigate }: StartMeetProps) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [manualEmails, setManualEmails] = useState('');
  const [duration, setDuration] = useState('60');
  const [isLoading, setIsLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  
  const { 
    isConnected: googleConnected, 
    loading: googleLoading, 
    processingOAuth,
    createGoogleMeetEvent 
  } = useGoogleCalendar();
  const { user } = useAuth();
  const { toast } = useToast();

  const loadClients = async () => {
    if (!user) return;
    
    setClientsLoading(true);
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, email')
        .not('email', 'is', null)
        .order('name');

      if (error) {
        console.error('Erro ao carregar clientes:', error);
        return;
      }

      setClients(data || []);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    } finally {
      setClientsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadClients();
    }
  }, [user]);

  const handleStartMeeting = async () => {
    if (!title.trim()) {
      toast({
        title: "Erro",
        description: "Por favor, insira um título para a reunião",
        variant: "destructive"
      });
      return;
    }

    if (!googleConnected) {
      toast({
        title: "Google Meet não conectado",
        description: "Conecte-se ao Google Meet para criar reuniões",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const now = new Date();
      const endTime = new Date(now.getTime() + (parseInt(duration) * 60 * 1000));
      
      const startDateTime = now.toISOString();
      const endDateTime = endTime.toISOString();

      let attendees: any[] = [];

      selectedClients.forEach(clientId => {
        const client = clients.find(c => c.id === clientId);
        if (client) {
          attendees.push({ email: client.email, displayName: client.name });
        }
      });

      if (manualEmails.trim()) {
        const emails = manualEmails.split(',').map(email => email.trim()).filter(email => email);
        emails.forEach(email => {
          attendees.push({ email });
        });
      }

      const result = await createGoogleMeetEvent({
        title,
        description,
        start_date: startDateTime,
        end_date: endDateTime,
        attendees
      });

      if (result?.success && result?.meetLink) {
        const { data: companyUser } = await supabase
          .from('company_users')
          .select('company_id')
          .eq('user_id', user!.id)
          .single();

        if (companyUser) {
          await supabase
            .from('calendar_events')
            .insert({
              title,
              description,
              start_date: startDateTime,
              end_date: endDateTime,
              event_type: 'meeting',
              meeting_provider: 'google_meet',
              meeting_link: result.meetLink,
              attendees,
              created_by: user!.id,
              company_id: companyUser.company_id,
              is_all_day: false
            });
        }

        toast({
          title: "✅ Reunião Criada!",
          description: "Reunião criada com sucesso! Link copiado para área de transferência.",
        });

        navigator.clipboard.writeText(result.meetLink);
        window.open(result.meetLink, '_blank');

        setTitle('');
        setDescription('');
        setSelectedClients([]);
        setManualEmails('');
        setDuration('60');
      }

    } catch (error: any) {
      console.error('💥 Erro ao iniciar reunião:', error);
      toast({
        title: "❌ Erro ao Criar Reunião",
        description: error.message || 'Erro inesperado ao criar reunião',
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoToSettings = () => {
    if (onNavigate) {
      onNavigate('settings');
    }
  };

  const canStartMeeting = googleConnected && !googleLoading && !processingOAuth && !isLoading;

  return (
    <div className="p-8 min-h-screen bg-gradient-to-br from-gray-50 to-white">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Start Meet</h1>
            <p className="text-gray-500 mt-1">Inicie uma reunião rapidamente</p>
          </div>
        </div>

        {!googleConnected && !processingOAuth && (
          <Card className="border-2 border-[#DFE4FB] bg-[#F0F2FE]">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <AlertCircle className="h-6 w-6 text-[#253573]" />
                  <div>
                    <h3 className="font-semibold text-blue-950">Google Meet não conectado</h3>
                    <p className="text-[#1A2551]">Conecte-se ao Google Meet para criar reuniões automaticamente</p>
                  </div>
                </div>
                <Button
                  onClick={handleGoToSettings}
                  className="bg-[#253573] hover:bg-[#1A2551] text-white"
                >
                  <SettingsIcon className="h-4 w-4 mr-2" />
                  Realizar Conexão
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="shadow-xl border-0 rounded-2xl">
            <CardHeader className="bg-gradient-to-r from-[#3600FF] to-[#4F46E5] text-white rounded-t-2xl">
              <CardTitle className="flex items-center space-x-2">
                <Video className="h-6 w-6" />
                <span>Configurar Reunião</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title" className="text-sm font-medium">
                  Título da Reunião *
                </Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Digite o título da reunião"
                  className="rounded-xl h-12"
                  disabled={!canStartMeeting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-medium">
                  Descrição (Opcional)
                </Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descrição da reunião"
                  rows={3}
                  className="rounded-xl resize-none"
                  disabled={!canStartMeeting}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Duração
                </Label>
                <Select value={duration} onValueChange={setDuration} disabled={!canStartMeeting}>
                  <SelectTrigger className="rounded-xl h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 minutos</SelectItem>
                    <SelectItem value="60">1 hora</SelectItem>
                    <SelectItem value="90">1h 30min</SelectItem>
                    <SelectItem value="120">2 horas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-xl border-0 rounded-2xl">
            <CardHeader className="bg-gradient-to-r from-green-500 to-green-600 text-white rounded-t-2xl">
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-6 w-6" />
                <span>Participantes</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Selecionar Clientes
                  </Label>
                  <div className="max-h-48 overflow-y-auto space-y-2 border rounded-xl p-3">
                    {clientsLoading ? (
                      <p className="text-sm text-gray-500">Carregando clientes...</p>
                    ) : clients.length > 0 ? (
                      clients.map((client) => (
                        <div key={client.id} className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            id={`client-${client.id}`}
                            checked={selectedClients.includes(client.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedClients([...selectedClients, client.id]);
                              } else {
                                setSelectedClients(selectedClients.filter(id => id !== client.id));
                              }
                            }}
                            disabled={!canStartMeeting}
                            className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                          />
                          <Label htmlFor={`client-${client.id}`} className="text-sm">
                            {client.name} ({client.email})
                          </Label>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500">Nenhum cliente encontrado</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="manualEmails" className="text-sm font-medium">
                    Emails Adicionais
                  </Label>
                  <Textarea
                    id="manualEmails"
                    value={manualEmails}
                    onChange={(e) => setManualEmails(e.target.value)}
                    placeholder="email1@exemplo.com, email2@exemplo.com"
                    rows={3}
                    className="rounded-xl resize-none"
                    disabled={!canStartMeeting}
                  />
                  <p className="text-xs text-gray-500">
                    Separe múltiplos emails com vírgula
                  </p>
                </div>
              </div>

              <div className="pt-6 border-t">
                <Button
                  onClick={handleStartMeeting}
                  disabled={!canStartMeeting}
                  className="w-full h-14 text-lg font-semibold rounded-xl bg-gradient-to-r from-[#3600FF] to-[#4F46E5] hover:from-[#3600FF]/90 hover:to-[#4F46E5]/90 disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Iniciando Reunião...
                    </>
                  ) : (
                    <>
                      <Video className="h-5 w-5 mr-2" />
                      Iniciar Reunião Agora
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default StartMeet;
