import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Video, MapPin, CalendarDays, Clock, Users, ArrowLeft, ArrowRight, Check, Loader2, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import APP_CONFIG, { sanitizeMeetingUrl, isAllowedMeetingUrl } from '@/config/app';
import AddressAutocomplete from './AddressAutocomplete';

interface ScheduleMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  contactName?: string;
  contactPhone?: string;
  sessionId?: string;
  onSendMessage?: (message: string) => Promise<void>;
  callApi?: (action: string, data: Record<string, unknown>) => Promise<any>;
}

const ScheduleMeetingModal: React.FC<ScheduleMeetingModalProps> = ({
  isOpen,
  onClose,
  contactName,
  contactPhone,
  sessionId,
  onSendMessage,
  callApi,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [step, setStep] = useState(0);
  const [type, setType] = useState<'online' | 'presencial' | null>(null);
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [time, setTime] = useState('');
  const [title, setTitle] = useState('');
  const [participantInput, setParticipantInput] = useState('');
  const [participants, setParticipants] = useState<string[]>([]);
  const [location, setLocation] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }));

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  const today = startOfDay(new Date());

  const reset = () => {
    setStep(0);
    setType(null);
    setDate(undefined);
    setTime('');
    setTitle('');
    setParticipantInput('');
    setParticipants([]);
    setLocation('');
    setConfirming(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const addParticipant = () => {
    const val = participantInput.trim();
    if (val && !participants.includes(val)) {
      setParticipants(prev => [...prev, val]);
      setParticipantInput('');
    }
  };

  const removeParticipant = (p: string) => {
    setParticipants(prev => prev.filter(x => x !== p));
  };

  const handleConfirm = async () => {
    if (!type || !date || !time || !title.trim() || !user) return;
    setConfirming(true);

    try {
      const { data: companyUser } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!companyUser) throw new Error('Empresa não encontrada');

      const [hours, minutes] = time.split(':').map(Number);
      const startDate = new Date(date);
      startDate.setHours(hours, minutes, 0, 0);
      const endDate = new Date(startDate);
      endDate.setMinutes(endDate.getMinutes() + 60);

      let meetingLink = '';

      if (type === 'online') {
        // Create meeting room
        const roomCode = Math.random().toString(36).substring(2, 12).toUpperCase();
        const { error: roomError } = await supabase
          .from('meeting_rooms')
          .insert({
            title,
            room_code: roomCode,
            max_participants: 50,
            recording_enabled: false,
            chat_enabled: true,
            screen_sharing_enabled: true,
            company_id: companyUser.company_id,
            created_by: user.id,
          });
        if (roomError) throw roomError;
        meetingLink = APP_CONFIG.getMeetingUrl(roomCode);
      }

      try {
        meetingLink = sanitizeMeetingUrl(meetingLink);
      } catch (err: any) {
        toast({ title: 'Link inválido', description: err.message, variant: 'destructive' });
        return;
      }
      if (meetingLink && !isAllowedMeetingUrl(meetingLink)) {
        toast({
          title: 'Link inválido',
          description: 'O link precisa começar com https://www.ellosuit.app',
          variant: 'destructive',
        });
        return;
      }

      // Create calendar event
      const { data: eventData, error: eventError } = await supabase
        .from('calendar_events')
        .insert({
          title,
          description: `Reunião ${type === 'online' ? 'online' : 'presencial'} agendada via CRM\nContato: ${contactName || 'N/A'}\nTelefone: ${contactPhone || 'N/A'}${meetingLink ? `\n\nLink: ${meetingLink}` : ''}${location ? `\n\n📍 Local: ${location}` : ''}${participants.length > 0 ? `\nParticipantes adicionais: ${participants.join(', ')}` : ''}`,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          event_type: 'meeting' as const,
          meeting_link: meetingLink || null,
          company_id: companyUser.company_id,
          created_by: user.id,
          color: '#374DA4',
          attendees: [
            { name: contactName || contactPhone, phone: contactPhone, status: 'pending' },
            ...participants.map(p => ({ name: p, phone: p.includes('@') ? undefined : p, email: p.includes('@') ? p : undefined, status: 'pending' }))
          ] as any,
        })
        .select('id')
        .single();

      if (eventError) throw eventError;

      // Create RSVP record for tracking
      if (eventData?.id && contactPhone) {
        const normalizedPhone = contactPhone.replace(/\D/g, '');
        await supabase.from('meeting_rsvp').insert({
          event_id: eventData.id,
          company_id: companyUser.company_id,
          attendee_phone: normalizedPhone,
          attendee_name: contactName || null,
          status: 'pending',
        });
      }

      // Send WhatsApp invite with interactive buttons
      const formattedDate = format(startDate, "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR });
      const inviteBody = `📅 *Convite de Reunião*\n\n*${title}*\n📆 ${formattedDate}\n📍 ${type === 'online' ? 'Online (videoconferência)' : 'Presencial'}${meetingLink ? `\n\n🔗 *Link da reunião:*\n${meetingLink}` : ''}${location && type === 'presencial' ? `\n\n📍 *Local:*\n${location}` : ''}\n\nConfirme sua presença:`;

      if (callApi && sessionId) {
        // Send as interactive button message
        await callApi('send_message', {
          session_id: sessionId,
          to: contactPhone!,
          message: inviteBody,
          message_type: 'interactive',
          interactive: {
            type: 'button',
            body: { text: inviteBody },
            action: {
              buttons: [
                { type: 'reply', reply: { id: 'rsvp_yes', title: '✅ Sim, confirmo' } },
                { type: 'reply', reply: { id: 'rsvp_no', title: '❌ Não posso' } },
              ],
            },
          },
        });
      } else if (onSendMessage) {
        await onSendMessage(inviteBody);
      }

      toast({
        title: 'Reunião agendada!',
        description: `Convite enviado para ${contactName || contactPhone}`,
      });

      handleClose();
    } catch (error: any) {
      console.error('Error scheduling meeting:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível agendar a reunião',
        variant: 'destructive',
      });
    } finally {
      setConfirming(false);
    }
  };

  const canNext = () => {
    if (step === 0) return !!type;
    if (step === 1) return !!date;
    if (step === 2) return !!time;
    if (step === 3) return !!title.trim();
    return true;
  };

  const timeSlots = [
    '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
    '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
    '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
    '17:00', '17:30', '18:00', '18:30', '19:00', '19:30',
    '20:00', '20:30', '21:00',
  ];

  const stepIcons = [Video, CalendarDays, Clock, Users, Check];

  return (
    <Dialog open={isOpen} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden rounded-2xl">
        {/* Progress */}
        <div className="flex items-center gap-0 px-6 pt-5 pb-3">
          {stepIcons.map((Icon, i) => (
            <React.Fragment key={i}>
              <div className={cn(
                "h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shrink-0",
                i < step ? "bg-[#374DA4] text-white" :
                i === step ? "bg-[#374DA4] text-white scale-110 shadow-lg" :
                "bg-muted text-muted-foreground"
              )}>
                {i < step ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </div>
              {i < stepIcons.length - 1 && (
                <div className={cn("flex-1 h-0.5 mx-1", i < step ? "bg-[#374DA4]" : "bg-muted")} />
              )}
            </React.Fragment>
          ))}
        </div>

        <DialogHeader className="px-6 pb-2">
          <DialogTitle className="text-lg">
            {step === 0 && 'Tipo de reunião'}
            {step === 1 && 'Escolha a data'}
            {step === 2 && 'Escolha o horário'}
            {step === 3 && 'Detalhes da reunião'}
            {step === 4 && 'Confirmar agendamento'}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Agendamento com <span className="font-medium text-foreground">{contactName || contactPhone}</span>
          </p>
        </DialogHeader>

        <div className="px-6 py-4 min-h-[280px]">
          {/* Step 0: Type */}
          {step === 0 && (
            <div className="grid grid-cols-2 gap-4">
              {([
                { value: 'online' as const, icon: Video, label: 'Online', desc: 'Reunião por vídeo' },
                { value: 'presencial' as const, icon: MapPin, label: 'Presencial', desc: 'Encontro pessoal' },
              ]).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setType(opt.value)}
                  className={cn(
                    "flex flex-col items-center gap-3 p-6 rounded-2xl border-2 transition-all hover:shadow-md",
                    type === opt.value
                      ? "border-[#374DA4] bg-[#374DA4]/5 shadow-md"
                      : "border-muted hover:border-[#374DA4]/40"
                  )}
                >
                  <div className={cn(
                    "h-14 w-14 rounded-2xl flex items-center justify-center",
                    type === opt.value ? "bg-[#374DA4] text-white" : "bg-muted text-muted-foreground"
                  )}>
                    <opt.icon className="h-7 w-7" />
                  </div>
                  <span className="font-semibold text-sm">{opt.label}</span>
                  <span className="text-xs text-muted-foreground text-center">{opt.desc}</span>
                </button>
              ))}
            </div>
          )}

          {/* Step 1: Date */}
          {step === 1 && (
            <div className="space-y-4">
              {/* Week navigation */}
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={() => setWeekStart(s => subWeeks(s, 1))}>
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <span className="text-sm font-semibold text-foreground capitalize">
                  {format(weekDays[0], "dd MMM", { locale: ptBR })} — {format(weekDays[6], "dd MMM yyyy", { locale: ptBR })}
                </span>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={() => setWeekStart(s => addWeeks(s, 1))}>
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>

              {/* Week days grid */}
              <div className="grid grid-cols-7 gap-2">
                {weekDays.map((day) => {
                  const isPast = isBefore(day, today);
                  const isSelected = date ? isSameDay(day, date) : false;
                  const isCurrentDay = isSameDay(day, today);
                  return (
                    <button
                      key={day.toISOString()}
                      disabled={isPast}
                      onClick={() => setDate(day)}
                      className={cn(
                        "flex flex-col items-center gap-1 py-3 px-1 rounded-2xl transition-all text-center",
                        isPast && "opacity-30 cursor-not-allowed",
                        !isPast && !isSelected && "hover:bg-muted cursor-pointer",
                        isSelected && "bg-[#374DA4] text-white shadow-lg scale-105",
                        isCurrentDay && !isSelected && "ring-2 ring-[#374DA4]/40"
                      )}
                    >
                      <span className={cn("text-[10px] font-semibold uppercase", isSelected ? "text-white/80" : "text-muted-foreground")}>
                        {format(day, 'EEE', { locale: ptBR })}
                      </span>
                      <span className={cn("text-lg font-bold", isSelected ? "text-white" : "text-foreground")}>
                        {format(day, 'dd')}
                      </span>
                      <span className={cn("text-[10px]", isSelected ? "text-white/70" : "text-muted-foreground")}>
                        {format(day, 'MMM', { locale: ptBR })}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2: Time */}
          {step === 2 && (
            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-2 max-h-[240px] overflow-y-auto pr-1">
                {timeSlots.map(t => (
                  <button
                    key={t}
                    onClick={() => setTime(t)}
                    className={cn(
                      "px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                      time === t
                        ? "bg-[#374DA4] text-white shadow-md"
                        : "bg-muted hover:bg-[#374DA4]/10 hover:text-[#374DA4]"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Label className="text-xs text-muted-foreground shrink-0">Ou digite:</Label>
                <Input type="time" value={time} onChange={e => setTime(e.target.value)} className="w-32" />
              </div>
            </div>
          )}

          {/* Step 3: Details */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium mb-1.5 block">Título da reunião</Label>
                <Input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Ex: Reunião de alinhamento"
                  className="rounded-xl"
                />
              </div>
              {type === 'presencial' && (
                <div>
                  <Label className="text-sm font-medium mb-1.5 block">
                    📍 Localização
                  </Label>
                  <AddressAutocomplete
                    value={location}
                    onChange={setLocation}
                    placeholder="Buscar endereço..."
                  />
                </div>
              )}
              <div>
                <Label className="text-sm font-medium mb-1.5 block">
                  Participantes adicionais <span className="text-muted-foreground font-normal">(opcional)</span>
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={participantInput}
                    onChange={e => setParticipantInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addParticipant())}
                    placeholder="Número ou e-mail"
                    className="flex-1 rounded-xl"
                  />
                  <Button variant="outline" size="sm" onClick={addParticipant} className="rounded-xl shrink-0">
                    <Users className="h-4 w-4" />
                  </Button>
                </div>
                {participants.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {participants.map(p => (
                      <span key={p} className="inline-flex items-center gap-1 bg-muted px-2.5 py-1 rounded-full text-xs">
                        {p}
                        <button onClick={() => removeParticipant(p)} className="hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Confirm */}
          {step === 4 && (
            <div className="space-y-3">
              <div className="bg-muted/50 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center",
                    type === 'online' ? "bg-[#DFE4FB] text-[#2F428D] dark:bg-[#0F1631]/30 dark:text-[#5A74D1]" : "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                  )}>
                    {type === 'online' ? <Video className="h-5 w-5" /> : <MapPin className="h-5 w-5" />}
                  </div>
                  <div>
                    <p className="font-semibold">{title}</p>
                    <p className="text-xs text-muted-foreground">{type === 'online' ? 'Reunião online' : 'Reunião presencial'}</p>
                  </div>
                </div>
                <div className="border-t pt-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    <span>{date ? format(date, "EEEE, dd 'de' MMMM", { locale: ptBR }) : ''}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{time}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>{contactName || contactPhone}{participants.length > 0 ? `, +${participants.length}` : ''}</span>
                  </div>
                  {type === 'presencial' && location && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{location}</span>
                    </div>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Ao confirmar, um convite será enviado automaticamente via WhatsApp para <strong>{contactName || contactPhone}</strong> e salvo na agenda.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 pb-5 pt-2">
          {step > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => setStep(s => s - 1)} className="gap-1.5 rounded-xl">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={handleClose} className="rounded-xl text-muted-foreground">
              Cancelar
            </Button>
          )}

          {step < 4 ? (
            <Button
              onClick={() => setStep(s => s + 1)}
              disabled={!canNext()}
              className="gap-1.5 bg-[#374DA4] hover:bg-[#374DA4]/90 rounded-xl"
            >
              Próximo <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleConfirm}
              disabled={confirming}
              className="gap-1.5 bg-[#374DA4] hover:bg-[#374DA4]/90 rounded-xl"
            >
              {confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Confirmar e Enviar
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ScheduleMeetingModal;
