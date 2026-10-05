import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Plus, 
  Copy, 
  ExternalLink,
  Settings,
  Users,
  Link as LinkIcon,
  CheckCircle,
  X,
  Save,
  ArrowLeft
} from 'lucide-react';
import { useAgendaAberta } from '@/hooks/useAgendaAberta';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const weekDays = [
  { id: 0, name: 'Domingo', short: 'Dom' },
  { id: 1, name: 'Segunda-feira', short: 'Seg' },
  { id: 2, name: 'Terça-feira', short: 'Ter' },
  { id: 3, name: 'Quarta-feira', short: 'Qua' },
  { id: 4, name: 'Quinta-feira', short: 'Qui' },
  { id: 5, name: 'Sexta-feira', short: 'Sex' },
  { id: 6, name: 'Sábado', short: 'Sáb' }
];

const MobileAgendaAberta = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { 
    bookingLinks, 
    availability, 
    bookings, 
    loading, 
    createBookingLink, 
    updateAvailability, 
    toggleLinkStatus 
  } = useAgendaAberta();

  const [activeView, setActiveView] = useState<'main' | 'create' | 'availability'>('main');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    duration_minutes: 30,
    buffer_minutes: 0
  });

  const [availabilityData, setAvailabilityData] = useState<{[key: number]: {enabled: boolean, start: string, end: string}}>({});

  // Initialize availability data
  useEffect(() => {
    const initialData: {[key: number]: {enabled: boolean, start: string, end: string}} = {};
    
    weekDays.forEach(day => {
      const existingAvailability = availability.find(av => av.day_of_week === day.id);
      initialData[day.id] = {
        enabled: !!existingAvailability,
        start: existingAvailability?.start_time || '09:00',
        end: existingAvailability?.end_time || '17:00'
      };
    });
    
    setAvailabilityData(initialData);
  }, [availability]);

  const handleCreateLink = async () => {
    const success = await createBookingLink(formData);
    if (success) {
      setFormData({ title: '', description: '', duration_minutes: 30, buffer_minutes: 0 });
      setActiveView('main');
    }
  };

  const handleSaveAvailability = async () => {
    for (const dayId of Object.keys(availabilityData)) {
      const dayData = availabilityData[parseInt(dayId)];
      if (dayData.enabled) {
        await updateAvailability({
          day_of_week: parseInt(dayId),
          start_time: dayData.start,
          end_time: dayData.end,
          is_active: true
        });
      }
    }
    
    toast({
      title: 'Sucesso',
      description: 'Horários salvos!'
    });
    
    setActiveView('main');
  };

  const copyLinkToClipboard = (linkSlug: string) => {
    const fullUrl = `https://www.ellosuit.online/agendamentos/${linkSlug}`;
    navigator.clipboard.writeText(fullUrl);
    toast({
      title: 'Link copiado!',
      description: 'Link foi copiado'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Create Link View
  if (activeView === 'create') {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setActiveView('main')}
            className="rounded-full"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Criar Link</h1>
        </div>

        <Card className="shadow-lg">
          <CardContent className="p-6 space-y-4">
            <div>
              <Label className="text-sm font-medium">Título do Serviço *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                placeholder="Ex: Consulta de 30 minutos"
                className="mt-1"
              />
            </div>
            
            <div>
              <Label className="text-sm font-medium">Descrição</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Descreva o serviço..."
                rows={3}
                className="mt-1"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Duração</Label>
                <select 
                  value={formData.duration_minutes} 
                  onChange={(e) => setFormData({...formData, duration_minutes: parseInt(e.target.value)})}
                  className="mt-1 w-full p-2 border rounded-lg"
                >
                  <option value={15}>15 min</option>
                  <option value={30}>30 min</option>
                  <option value={45}>45 min</option>
                  <option value={60}>1 hora</option>
                  <option value={90}>1h30</option>
                  <option value={120}>2 horas</option>
                </select>
              </div>
              
              <div>
                <Label className="text-sm font-medium">Intervalo</Label>
                <select 
                  value={formData.buffer_minutes} 
                  onChange={(e) => setFormData({...formData, buffer_minutes: parseInt(e.target.value)})}
                  className="mt-1 w-full p-2 border rounded-lg"
                >
                  <option value={0}>Sem intervalo</option>
                  <option value={5}>5 min</option>
                  <option value={10}>10 min</option>
                  <option value={15}>15 min</option>
                  <option value={30}>30 min</option>
                </select>
              </div>
            </div>
            
            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => setActiveView('main')} className="flex-1">
                Cancelar
              </Button>
              <Button onClick={handleCreateLink} disabled={!formData.title} className="flex-1">
                <CheckCircle className="h-4 w-4 mr-2" />
                Criar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Availability View
  if (activeView === 'availability') {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setActiveView('main')}
            className="rounded-full"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Horários</h1>
        </div>

        <div className="space-y-4">
          {weekDays.map((day) => (
            <Card key={day.id} className="shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={availabilityData[day.id]?.enabled || false}
                      onCheckedChange={(enabled) => 
                        setAvailabilityData(prev => ({
                          ...prev,
                          [day.id]: { ...prev[day.id], enabled }
                        }))
                      }
                    />
                    <div>
                      <p className="font-medium text-gray-900">{day.short}</p>
                    </div>
                  </div>
                </div>
                
                {availabilityData[day.id]?.enabled && (
                  <div className="flex items-center gap-3 text-sm">
                    <div className="flex-1">
                      <Label className="text-xs text-gray-500">Início</Label>
                      <Input
                        type="time"
                        value={availabilityData[day.id]?.start || '09:00'}
                        onChange={(e) => 
                          setAvailabilityData(prev => ({
                            ...prev,
                            [day.id]: { ...prev[day.id], start: e.target.value }
                          }))
                        }
                        className="text-center"
                      />
                    </div>
                    <span className="text-gray-400 pt-4">até</span>
                    <div className="flex-1">
                      <Label className="text-xs text-gray-500">Fim</Label>
                      <Input
                        type="time"
                        value={availabilityData[day.id]?.end || '17:00'}
                        onChange={(e) => 
                          setAvailabilityData(prev => ({
                            ...prev,
                            [day.id]: { ...prev[day.id], end: e.target.value }
                          }))
                        }
                        className="text-center"
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
        
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t">
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setActiveView('main')} className="flex-1">
              Cancelar
            </Button>
            <Button onClick={handleSaveAvailability} className="flex-1">
              <Save className="h-4 w-4 mr-2" />
              Salvar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Main View
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b p-4">
        <h1 className="text-2xl font-bold text-center">📅 Agenda Aberta</h1>
        <p className="text-sm text-gray-600 text-center mt-1">
          Links públicos para agendamentos
        </p>
      </div>

      {/* Action Buttons */}
      <div className="p-4 space-y-3">
        <Button 
          onClick={() => setActiveView('availability')} 
          variant="outline" 
          className="w-full justify-start"
        >
          <Clock className="h-4 w-4 mr-3" />
          Configurar Horários
        </Button>
        
        <Button 
          onClick={() => setActiveView('create')} 
          className="w-full justify-start"
        >
          <Plus className="h-4 w-4 mr-3" />
          Novo Link de Agendamento
        </Button>
      </div>

      {/* Links List */}
      <div className="p-4 space-y-4">
        {bookingLinks.length === 0 ? (
          <Card className="border-dashed border-2">
            <CardContent className="text-center py-8">
              <CalendarIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="font-medium text-gray-900 mb-2">
                Nenhum link criado
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                Crie seu primeiro link de agendamento
              </p>
              <Button onClick={() => setActiveView('create')} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Criar Link
              </Button>
            </CardContent>
          </Card>
        ) : (
          bookingLinks.map((link) => (
            <Card key={link.id} className="shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-gray-900">{link.title}</h3>
                      <Badge variant={link.is_active ? "default" : "secondary"} className="text-xs">
                        {link.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>
                    {link.description && (
                      <p className="text-sm text-gray-600 mb-2">{link.description}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {link.duration_minutes}min
                      </span>
                      {link.buffer_minutes > 0 && (
                        <span>+{link.buffer_minutes}min</span>
                      )}
                    </div>
                  </div>
                  
                  <Switch
                    checked={link.is_active}
                    onCheckedChange={() => toggleLinkStatus(link.id, link.is_active)}
                  />
                </div>
                
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyLinkToClipboard(link.link_slug)}
                    className="flex-1"
                  >
                    <Copy className="h-3 w-3 mr-2" />
                    Copiar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(`https://www.ellosuit.online/agendamentos/${link.link_slug}`, '_blank')}
                    className="flex-1"
                  >
                    <ExternalLink className="h-3 w-3 mr-2" />
                    Abrir
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Bookings Section */}
      {bookings.length > 0 && (
        <div className="p-4">
          <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
            <Users className="h-5 w-5" />
            Próximos Agendamentos
          </h2>
          
          <div className="space-y-3">
            {bookings.slice(0, 3).map((booking) => (
              <Card key={booking.id} className="shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{booking.client_name}</h4>
                      <p className="text-sm text-gray-600">{booking.client_email}</p>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                        <span>📅 {new Date(booking.booking_date).toLocaleDateString('pt-BR')}</span>
                        <span>⏰ {booking.booking_time}</span>
                      </div>
                    </div>
                    <Badge variant="default" className="text-xs">
                      ✅ Confirmado
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileAgendaAberta;