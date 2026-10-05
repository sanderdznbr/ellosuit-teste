
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon, Clock, User, Mail, Phone, MessageSquare, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const BookingPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [bookingLink, setBookingLink] = useState<any>(null);
  const [availableSlots, setAvailableSlots] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [formData, setFormData] = useState({
    client_name: '',
    client_email: '',
    client_phone: '',
    notes: ''
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (slug) {
      loadBookingLink();
    }
  }, [slug]);

  useEffect(() => {
    if (selectedDate && bookingLink) {
      loadAvailableSlots();
    }
  }, [selectedDate, bookingLink]);

  const loadBookingLink = async () => {
    try {
      const { data, error } = await supabase
        .from('public_booking_links')
        .select('*')
        .eq('link_slug', slug)
        .eq('is_active', true)
        .single();

      if (error) throw error;
      
      // Check if link has expired
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        throw new Error('Link expirado');
      }
      
      setBookingLink(data);
    } catch (error) {
      console.error('Erro ao carregar link de agendamento:', error);
      navigate('/404');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableSlots = async () => {
    if (!selectedDate || !bookingLink) return;

    try {
      const selectedDateObj = selectedDate;
      const dayOfWeek = selectedDateObj.getDay();
      const dateString = format(selectedDateObj, 'yyyy-MM-dd');

      // Buscar horários de disponibilidade para o dia da semana
      const { data: schedules, error: scheduleError } = await supabase
        .from('availability_schedules')
        .select('*')
        .eq('user_id', bookingLink.user_id)
        .eq('day_of_week', dayOfWeek)
        .eq('is_active', true);

      if (scheduleError) throw scheduleError;

      // Buscar agendamentos já existentes para o dia
      const { data: existingBookings, error: bookingError } = await supabase
        .from('public_bookings')
        .select('booking_time')
        .eq('user_id', bookingLink.user_id)
        .eq('booking_date', dateString)
        .eq('status', 'confirmed');

      if (bookingError) throw bookingError;

      // Gerar slots disponíveis
      const slots: any[] = [];
      const existingTimes = existingBookings.map(b => b.booking_time);

      schedules.forEach(schedule => {
        const startTime = new Date(`2000-01-01T${schedule.start_time}`);
        const endTime = new Date(`2000-01-01T${schedule.end_time}`);
        
        while (startTime < endTime) {
          const timeString = startTime.toTimeString().substring(0, 5);
          
          if (!existingTimes.includes(timeString)) {
            slots.push({
              time: timeString,
              available: true
            });
          }
          
          // Adicionar duração do agendamento + buffer
          startTime.setMinutes(startTime.getMinutes() + bookingLink.duration_minutes + bookingLink.buffer_minutes);
        }
      });

      setAvailableSlots(slots);
    } catch (error) {
      console.error('Erro ao carregar horários disponíveis:', error);
    }
  };

  const handleSubmit = async () => {
    if (!selectedDate || !selectedTime || !formData.client_name || !formData.client_email) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha todos os campos obrigatórios",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);
    try {
      const dateString = format(selectedDate, 'yyyy-MM-dd');
      
      // Criar agendamento
      const { error } = await supabase
        .from('public_bookings')
        .insert({
          booking_link_id: bookingLink.id,
          user_id: bookingLink.user_id,
          company_id: bookingLink.company_id,
          booking_date: dateString,
          booking_time: selectedTime,
          client_name: formData.client_name,
          client_email: formData.client_email,
          client_phone: formData.client_phone,
          notes: formData.notes,
          status: 'confirmed'
        });

      if (error) throw error;

      setSuccess(true);
      toast({
        title: "Agendamento confirmado!",
        description: "Você receberá um email de confirmação em breve."
      });

    } catch (error: any) {
      console.error('Erro ao criar agendamento:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao confirmar agendamento",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Função para desabilitar datas não disponíveis
  const isDateDisabled = (date: Date) => {
    // Não permitir datas passadas
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) return true;

    // Verificar se o dia da semana tem horários disponíveis
    const dayOfWeek = date.getDay();
    // Por enquanto, vamos permitir apenas segunda a sexta (1-5)
    // Você pode ajustar isso baseado nos dados de availability_schedules
    return dayOfWeek === 0 || dayOfWeek === 6; // Desabilitar domingo e sábado
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50/30 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2F428D]"></div>
          </div>
          <p className="text-gray-600 font-light">Carregando informações do agendamento...</p>
        </div>
      </div>
    );
  }

  if (!bookingLink) {
    return (
      <div className="min-h-screen bg-gray-50/30 flex items-center justify-center px-4">
        <Card className="max-w-md mx-auto shadow-sm border-0 bg-white/90 backdrop-blur-sm rounded-3xl overflow-hidden">
          <CardContent className="p-12 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CalendarIcon className="h-10 w-10 text-gray-400" />
            </div>
            <h2 className="text-2xl font-light text-gray-900 mb-4">Link não encontrado</h2>
            <p className="text-gray-600 leading-relaxed">Este link de agendamento não existe ou foi desativado.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50/30 flex items-center justify-center px-4">
        <Card className="max-w-md mx-auto shadow-sm border-0 bg-white/90 backdrop-blur-sm rounded-3xl overflow-hidden">
          <CardContent className="p-12 text-center">
            <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-light text-gray-900 mb-4">Agendamento Confirmado!</h2>
            <p className="text-gray-600 mb-4 leading-relaxed">
              Seu agendamento para {selectedDate ? format(selectedDate, "d 'de' MMMM 'de' yyyy", { locale: ptBR }) : ''} às {selectedTime} foi confirmado.
            </p>
            <p className="text-sm text-gray-500">
              Em breve você receberá um email de confirmação com todos os detalhes.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/30 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-light text-gray-900 mb-3">{bookingLink.title}</h1>
          <div className="flex items-center justify-center space-x-2 text-gray-500 mb-2">
            <Clock className="h-4 w-4" />
            <span className="text-sm">{bookingLink.duration_minutes} minutos</span>
          </div>
          {bookingLink.description && (
            <p className="text-gray-600 text-sm max-w-md mx-auto leading-relaxed">{bookingLink.description}</p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Calendar Section - Takes 3 columns */}
          <div className="lg:col-span-3">
            <Card className="shadow-sm border-0 bg-white/80 backdrop-blur-sm rounded-3xl overflow-hidden">
              <CardHeader className="bg-white border-b border-gray-100 px-8 py-6">
                <CardTitle className="text-lg font-medium text-gray-900 flex items-center gap-3">
                  <div className="w-8 h-8 bg-[#F0F2FE] rounded-full flex items-center justify-center">
                    <CalendarIcon className="h-4 w-4 text-[#2F428D]" />
                  </div>
                  Selecione uma data
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8">
                <div className="flex justify-center mb-8">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    disabled={isDateDisabled}
                    locale={ptBR}
                    className={cn("rounded-2xl border-0 bg-transparent pointer-events-auto")}
                    classNames={{
                      months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                      month: "space-y-4",
                      caption: "flex justify-center pt-1 relative items-center mb-4",
                      caption_label: "text-lg font-medium text-gray-900",
                      nav: "space-x-1 flex items-center",
                      nav_button: "h-8 w-8 bg-transparent hover:bg-gray-100 rounded-full flex items-center justify-center transition-colors",
                      nav_button_previous: "absolute left-1",
                      nav_button_next: "absolute right-1",
                      table: "w-full border-collapse space-y-1",
                      head_row: "flex mb-2",
                      head_cell: "text-gray-500 rounded-lg w-10 font-normal text-sm flex items-center justify-center",
                      row: "flex w-full mt-2",
                      cell: "h-10 w-10 text-center text-sm relative p-0 [&:has([aria-selected])]:bg-[#F0F2FE] [&:has([aria-selected])]:rounded-xl first:[&:has([aria-selected])]:rounded-l-xl last:[&:has([aria-selected])]:rounded-r-xl focus-within:relative focus-within:z-20",
                      day: "h-10 w-10 p-0 font-normal aria-selected:opacity-100 hover:bg-gray-100 hover:rounded-xl transition-all duration-200",
                      day_selected: "bg-[#2F428D] text-white hover:bg-[#253573] hover:text-white focus:bg-[#2F428D] focus:text-white rounded-xl",
                      day_today: "bg-gray-100 text-gray-900 rounded-xl",
                      day_outside: "text-gray-400 opacity-40",
                      day_disabled: "text-gray-400 opacity-40 cursor-not-allowed",
                      day_range_middle: "aria-selected:bg-[#F0F2FE] aria-selected:text-[#0F1631]",
                      day_hidden: "invisible",
                    }}
                  />
                </div>

                {/* Time Slots */}
                {selectedDate && (
                  <div className="space-y-4">
                    <div className="text-center">
                      <h3 className="text-lg font-medium text-gray-900 mb-1">
                        Horários disponíveis
                      </h3>
                      <p className="text-sm text-gray-500">
                        {format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-3">
                      {availableSlots.length > 0 ? (
                        availableSlots.map((slot) => (
                          <button
                            key={slot.time}
                            onClick={() => setSelectedTime(slot.time)}
                            className={`p-4 text-sm font-medium rounded-2xl border-2 transition-all duration-200 ${
                              selectedTime === slot.time
                                ? 'bg-[#2F428D] text-white border-[#2F428D] shadow-lg shadow-[#2F428D]/25'
                                : 'bg-white text-gray-700 border-gray-200 hover:border-[#879CE0] hover:shadow-md'
                            }`}
                          >
                            {slot.time}
                          </button>
                        ))
                      ) : (
                        <div className="col-span-3 text-center py-12">
                          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Clock className="h-6 w-6 text-gray-400" />
                          </div>
                          <p className="text-gray-500 text-sm">
                            Nenhum horário disponível para esta data
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Form Section - Takes 2 columns */}
          <div className="lg:col-span-2">
            <Card className="shadow-sm border-0 bg-white/80 backdrop-blur-sm rounded-3xl overflow-hidden">
              <CardHeader className="bg-white border-b border-gray-100 px-8 py-6">
                <CardTitle className="text-lg font-medium text-gray-900 flex items-center gap-3">
                  <div className="w-8 h-8 bg-purple-50 rounded-full flex items-center justify-center">
                    <User className="h-4 w-4 text-purple-600" />
                  </div>
                  Seus dados
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nome completo *
                  </label>
                  <Input
                    value={formData.client_name}
                    onChange={(e) => setFormData({...formData, client_name: e.target.value})}
                    placeholder="Seu nome completo"
                    className="rounded-2xl border-gray-200 focus:border-[#5A74D1] focus:ring-[#5A74D1]/20 h-12"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email *
                  </label>
                  <Input
                    type="email"
                    value={formData.client_email}
                    onChange={(e) => setFormData({...formData, client_email: e.target.value})}
                    placeholder="seu@email.com"
                    className="rounded-2xl border-gray-200 focus:border-[#5A74D1] focus:ring-[#5A74D1]/20 h-12"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Telefone
                  </label>
                  <Input
                    value={formData.client_phone}
                    onChange={(e) => setFormData({...formData, client_phone: e.target.value})}
                    placeholder="(11) 99999-9999"
                    className="rounded-2xl border-gray-200 focus:border-[#5A74D1] focus:ring-[#5A74D1]/20 h-12"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Observações
                  </label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    placeholder="Alguma informação adicional..."
                    rows={3}
                    className="rounded-2xl border-gray-200 focus:border-[#5A74D1] focus:ring-[#5A74D1]/20 resize-none"
                  />
                </div>

                <Button
                  onClick={handleSubmit}
                  disabled={submitting || !selectedDate || !selectedTime}
                  className="w-full h-14 text-base font-medium rounded-2xl bg-[#2F428D] hover:bg-[#253573] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#2F428D]/25 transition-all duration-200"
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                      Confirmando...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-5 w-5 mr-3" />
                      Confirmar Agendamento
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookingPage;
