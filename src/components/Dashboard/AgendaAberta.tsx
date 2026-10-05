import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Calendar, 
  Clock, 
  Plus, 
  Share2, 
  Copy, 
  ExternalLink,
  Settings,
  Users,
  Link as LinkIcon,
  Eye,
  Edit,
  Trash2
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface BookingLink {
  id: string;
  title: string;
  description?: string;
  duration_minutes: number;
  buffer_minutes: number;
  link_slug: string;
  is_active: boolean;
  expires_at?: string;
  created_at: string;
}

interface UserAvailability {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

interface ScheduledBooking {
  id: string;
  client_name: string;
  client_email: string;
  booking_date: string;
  booking_time: string;
  status: string;
  notes?: string;
  booking_links: {
    title: string;
  };
}

const AgendaAberta = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [bookingLinks, setBookingLinks] = useState<BookingLink[]>([]);
  const [availability, setAvailability] = useState<UserAvailability[]>([]);
  const [bookings, setBookings] = useState<ScheduledBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);

  // Form states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAvailabilityDialog, setShowAvailabilityDialog] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    duration_minutes: 30,
    buffer_minutes: 0
  });

  const weekdays = [
    'Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'
  ];

  // Get company ID
  useEffect(() => {
    const fetchCompanyId = async () => {
      if (!user?.id) return;
      
      const { data, error } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user.id)
        .single();
      
      if (!error && data?.company_id) {
        setCompanyId(data.company_id);
      }
    };
    
    fetchCompanyId();
  }, [user?.id]);

  // Load data
  useEffect(() => {
    if (companyId) {
      loadBookingLinks();
      loadAvailability();
      loadBookings();
    }
  }, [companyId]);

  const loadBookingLinks = async () => {
    const { data, error } = await supabase
      .from('booking_links')
      .select('*')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false });
    
    if (!error) setBookingLinks(data || []);
    setLoading(false);
  };

  const loadAvailability = async () => {
    const { data, error } = await supabase
      .from('user_availability')
      .select('*')
      .eq('user_id', user?.id)
      .order('day_of_week');
    
    if (!error) setAvailability(data || []);
  };

  const loadBookings = async () => {
    const { data, error } = await supabase
      .from('scheduled_bookings')
      .select(`
        *,
        booking_links!inner(title)
      `)
      .eq('user_id', user?.id)
      .order('booking_date', { ascending: true })
      .order('booking_time', { ascending: true });
    
    if (!error) setBookings(data || []);
  };

  const createBookingLink = async () => {
    if (!user?.id || !companyId) return;
    
    const linkSlug = `${user.email?.split('@')[0]}-${Date.now().toString(36)}`;
    
    const { error } = await supabase
      .from('booking_links')
      .insert({
        ...formData,
        link_slug: linkSlug,
        user_id: user.id,
        company_id: companyId,
        is_active: true
      });
    
    if (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao criar link de agendamento',
        variant: 'destructive'
      });
      return;
    }
    
    toast({
      title: 'Sucesso',
      description: 'Link de agendamento criado!'
    });
    
    setFormData({ title: '', description: '', duration_minutes: 30, buffer_minutes: 0 });
    setShowCreateDialog(false);
    loadBookingLinks();
  };

  const toggleLinkStatus = async (linkId: string, isActive: boolean) => {
    const { error } = await supabase
      .from('booking_links')
      .update({ is_active: !isActive })
      .eq('id', linkId);
    
    if (!error) {
      loadBookingLinks();
      toast({
        title: 'Status atualizado',
        description: `Link ${!isActive ? 'ativado' : 'desativado'} com sucesso`
      });
    }
  };

  const copyLinkToClipboard = (linkSlug: string) => {
    const fullUrl = `https://www.ellosuit.online/booking/${linkSlug}`;
    navigator.clipboard.writeText(fullUrl);
    toast({
      title: 'Link copiado!',
      description: 'O link foi copiado para a área de transferência'
    });
  };

  const getPublicUrl = (linkSlug: string) => {
    return `https://www.ellosuit.online/booking/${linkSlug}`;
  };

  if (loading) {
    return (
      <div className="p-6 space-y-8 bg-gray-50 min-h-screen">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Calendar className="h-8 w-8 text-[#2F428D]" />
            Agenda Aberta
          </h1>
          <p className="text-base text-gray-600 mt-2">
            Crie links públicos para que clientes possam agendar compromissos com você
          </p>
        </div>
        
        <div className="flex gap-2">
          <Dialog open={showAvailabilityDialog} onOpenChange={setShowAvailabilityDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" className="rounded-xl">
                <Clock className="h-4 w-4 mr-2" />
                Horários
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Configurar Disponibilidade</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Configure os dias e horários em que você está disponível para agendamentos.
                </p>
                {/* Availability configuration would go here */}
                <div className="grid gap-4">
                  {weekdays.map((day, index) => (
                    <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Switch />
                        <span className="font-medium">{day}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input type="time" className="w-24" defaultValue="09:00" />
                        <span>até</span>
                        <Input type="time" className="w-24" defaultValue="17:00" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="rounded-xl">
                <Plus className="h-4 w-4 mr-2" />
                Novo Link
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Link de Agendamento</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Título do Serviço</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    placeholder="Ex: Consulta de 30 minutos"
                  />
                </div>
                
                <div>
                  <Label>Descrição (opcional)</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder="Descreva o que será feito neste agendamento..."
                    rows={3}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Duração (minutos)</Label>
                    <Select 
                      value={formData.duration_minutes.toString()} 
                      onValueChange={(value) => setFormData({...formData, duration_minutes: parseInt(value)})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15">15 minutos</SelectItem>
                        <SelectItem value="30">30 minutos</SelectItem>
                        <SelectItem value="45">45 minutos</SelectItem>
                        <SelectItem value="60">1 hora</SelectItem>
                        <SelectItem value="90">1h30</SelectItem>
                        <SelectItem value="120">2 horas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label>Intervalo (minutos)</Label>
                    <Select 
                      value={formData.buffer_minutes.toString()} 
                      onValueChange={(value) => setFormData({...formData, buffer_minutes: parseInt(value)})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">Sem intervalo</SelectItem>
                        <SelectItem value="5">5 minutos</SelectItem>
                        <SelectItem value="10">10 minutos</SelectItem>
                        <SelectItem value="15">15 minutos</SelectItem>
                        <SelectItem value="30">30 minutos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="flex gap-2 pt-4">
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={createBookingLink} disabled={!formData.title}>
                    Criar Link
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="links" className="space-y-6">
        <TabsList>
          <TabsTrigger value="links">Meus Links</TabsTrigger>
          <TabsTrigger value="bookings">Agendamentos</TabsTrigger>
          <TabsTrigger value="calendar">Calendário</TabsTrigger>
        </TabsList>

        <TabsContent value="links" className="space-y-6">
          {bookingLinks.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Nenhum link de agendamento
                </h3>
                <p className="text-gray-500 mb-4">
                  Crie seu primeiro link público para que clientes possam agendar com você
                </p>
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeiro Link
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6">
              {bookingLinks.map((link) => (
                <Card key={link.id} className="border-none shadow-lg rounded-2xl">
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-xl">{link.title}</CardTitle>
                          <Badge variant={link.is_active ? "default" : "secondary"}>
                            {link.is_active ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </div>
                        {link.description && (
                          <p className="text-gray-600">{link.description}</p>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => copyLinkToClipboard(link.link_slug)}
                          className="rounded-xl"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => window.open(getPublicUrl(link.link_slug), '_blank')}
                          className="rounded-xl"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Switch
                          checked={link.is_active}
                          onCheckedChange={() => toggleLinkStatus(link.id, link.is_active)}
                        />
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          <span>{link.duration_minutes} min</span>
                        </div>
                        {link.buffer_minutes > 0 && (
                          <div className="flex items-center gap-1">
                            <span>+{link.buffer_minutes}min intervalo</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <LinkIcon className="h-3 w-3" />
                        <span className="font-mono">{link.link_slug}</span>
                      </div>
                    </div>
                    
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Link público:</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyLinkToClipboard(link.link_slug)}
                          className="text-primary"
                        >
                          Copiar Link
                        </Button>
                      </div>
                      <code className="text-xs text-gray-600 break-all">
                        {getPublicUrl(link.link_slug)}
                      </code>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="bookings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Próximos Agendamentos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {bookings.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Nenhum agendamento ainda</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {bookings.map((booking) => (
                    <div key={booking.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">{booking.client_name}</h4>
                          <p className="text-sm text-gray-600">{booking.client_email}</p>
                          <p className="text-sm text-gray-500">
                            {new Date(booking.booking_date).toLocaleDateString('pt-BR')} às {booking.booking_time}
                          </p>
                        </div>
                        <Badge>{booking.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calendar" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Visualização do Calendário</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Visualização do calendário em breve...</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AgendaAberta;