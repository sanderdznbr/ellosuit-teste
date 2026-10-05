import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, User, Mail, Phone, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import ellosuitLogo from '@/assets/ellosuit-logo.png';

interface BookingLink {
  id: string;
  title: string;
  description?: string;
  duration_minutes: number;
  user_id: string;
  is_active: boolean;
}

interface UserAvailability {
  day_of_week: number;
  start_time: string;
  end_time: string;
}

const BookingPublic = () => {
  const { slug } = useParams();
  const { toast } = useToast();
  
  const [bookingLink, setBookingLink] = useState<BookingLink | null>(null);
  const [availability, setAvailability] = useState<UserAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const [formData, setFormData] = useState({
    client_name: '',
    client_email: '',
    client_phone: '',
    booking_date: '',
    booking_time: '',
    notes: ''
  });

  const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  useEffect(() => {
    if (slug) {
      loadBookingLink();
    }
  }, [slug]);

  const loadBookingLink = async () => {
    try {
      const { data: linkData, error: linkError } = await supabase
        .from('booking_links')
        .select('*')
        .eq('link_slug', slug)
        .eq('is_active', true)
        .single();

      if (linkError || !linkData) {
        toast({
          title: 'Link não encontrado',
          description: 'Este link de agendamento não existe ou não está ativo.',
          variant: 'destructive'
        });
        return;
      }

      setBookingLink(linkData);

      // Load availability
      const { data: availabilityData, error: availabilityError } = await supabase
        .from('user_availability')
        .select('*')
        .eq('user_id', linkData.user_id)
        .eq('is_active', true)
        .order('day_of_week');

      if (!availabilityError) {
        setAvailability(availabilityData || []);
      }

    } catch (error) {
      console.error('Error loading booking link:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 9; hour < 18; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        slots.push(timeString);
      }
    }
    return slots;
  };

  const getAvailableDates = () => {
    const dates = [];
    const today = new Date();
    
    for (let i = 1; i <= 30; i++) { // Next 30 days
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      
      const dayOfWeek = date.getDay();
      const hasAvailability = availability.some(av => av.day_of_week === dayOfWeek);
      
      if (hasAvailability) {
        dates.push({
          value: date.toISOString().split('T')[0],
          label: date.toLocaleDateString('pt-BR', { 
            weekday: 'short', 
            day: '2-digit', 
            month: '2-digit' 
          })
        });
      }
    }
    
    return dates;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!bookingLink || !formData.client_name || !formData.client_email || !formData.booking_date || !formData.booking_time) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Por favor, preencha todos os campos obrigatórios.',
        variant: 'destructive'
      });
      return;
    }

    setSubmitting(true);

    try {
      const { error } = await supabase
        .from('scheduled_bookings')
        .insert({
          booking_link_id: bookingLink.id,
          user_id: bookingLink.user_id,
          company_id: bookingLink.user_id, // We'll need to get proper company_id
          client_name: formData.client_name,
          client_email: formData.client_email,
          client_phone: formData.client_phone,
          booking_date: formData.booking_date,
          booking_time: formData.booking_time,
          notes: formData.notes,
          status: 'confirmed'
        });

      if (error) {
        throw error;
      }

      setSuccess(true);
      toast({
        title: 'Agendamento confirmado!',
        description: 'Seu agendamento foi criado com sucesso. Você receberá uma confirmação por email.'
      });

    } catch (error) {
      console.error('Error creating booking:', error);
      toast({
        title: 'Erro ao agendar',
        description: 'Ocorreu um erro ao criar seu agendamento. Tente novamente.',
        variant: 'destructive'
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!bookingLink) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="text-center py-12">
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Link não encontrado
            </h3>
            <p className="text-gray-500">
              Este link de agendamento não existe ou não está mais ativo.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="text-center py-12">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Agendamento Confirmado!
            </h2>
            <div className="space-y-3 text-gray-600 mb-6">
              <div className="flex items-center justify-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>{new Date(formData.booking_date).toLocaleDateString('pt-BR')}</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <Clock className="h-4 w-4" />
                <span>{formData.booking_time}</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <User className="h-4 w-4" />
                <span>{formData.client_name}</span>
              </div>
            </div>
            <p className="text-sm text-gray-500">
              Uma confirmação foi enviada para {formData.client_email}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-24 h-12 mx-auto mb-4">
            <img 
              src={ellosuitLogo} 
              alt="ELLOsuit" 
              className="h-full w-auto object-contain mx-auto"
            />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {bookingLink.title}
          </h1>
          {bookingLink.description && (
            <p className="text-gray-600">{bookingLink.description}</p>
          )}
          <div className="flex items-center justify-center gap-4 mt-4">
            <Badge variant="outline" className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {bookingLink.duration_minutes} minutos
            </Badge>
          </div>
        </div>

        {/* Booking Form */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">Agendar Horário</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Personal Information */}
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Suas Informações
                </h3>
                
                <div className="grid gap-4">
                  <div>
                    <Label htmlFor="name">Nome completo *</Label>
                    <Input
                      id="name"
                      value={formData.client_name}
                      onChange={(e) => setFormData({...formData, client_name: e.target.value})}
                      placeholder="Seu nome completo"
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.client_email}
                      onChange={(e) => setFormData({...formData, client_email: e.target.value})}
                      placeholder="seu@email.com"
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="phone">Telefone</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.client_phone}
                      onChange={(e) => setFormData({...formData, client_phone: e.target.value})}
                      placeholder="(11) 99999-9999"
                    />
                  </div>
                </div>
              </div>

              {/* Date and Time Selection */}
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Escolher Data e Horário
                </h3>
                
                <div className="grid gap-4">
                  <div>
                    <Label htmlFor="date">Data *</Label>
                    <select
                      id="date"
                      className="w-full p-2 border border-gray-300 rounded-md"
                      value={formData.booking_date}
                      onChange={(e) => setFormData({...formData, booking_date: e.target.value})}
                      required
                    >
                      <option value="">Selecione uma data</option>
                      {getAvailableDates().map((date) => (
                        <option key={date.value} value={date.value}>
                          {date.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <Label htmlFor="time">Horário *</Label>
                    <select
                      id="time"
                      className="w-full p-2 border border-gray-300 rounded-md"
                      value={formData.booking_time}
                      onChange={(e) => setFormData({...formData, booking_time: e.target.value})}
                      required
                    >
                      <option value="">Selecione um horário</option>
                      {generateTimeSlots().map((time) => (
                        <option key={time} value={time}>
                          {time}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Additional Notes */}
              <div>
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  placeholder="Alguma informação adicional..."
                  rows={3}
                />
              </div>

              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? 'Agendando...' : 'Confirmar Agendamento'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BookingPublic;