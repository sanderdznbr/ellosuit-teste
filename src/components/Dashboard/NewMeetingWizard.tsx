import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCalendarData } from '@/hooks/useCalendarData';
import { APP_CONFIG, sanitizeMeetingUrl, isAllowedMeetingUrl } from '@/config/app';
import ColorPicker from './ColorPicker';
import RecurrenceSelector, { RecurrenceConfig } from './RecurrenceSelector';
import {
  Video, ArrowLeft, ArrowRight, Check, Loader2, UserPlus, Mail, Phone,
  Search, X, Users, Send, Link2, Palette, Calendar, Clock, FileText,
  Repeat, ChevronRight, Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

const FLOW_BLUE = '#4D7CFF';

interface RegisteredUser {
  id: string;
  email: string;
  name: string;
  phone?: string;
}

interface Participant {
  type: 'email' | 'phone' | 'user';
  value: string;
  name?: string;
  userId?: string;
}

const defaultRecurrence: RecurrenceConfig = {
  enabled: false,
  frequency: 'weekly',
  interval: 1,
  daysOfWeek: [],
  endType: 'after',
  occurrences: 10,
  endDate: ''
};

const STEPS = [
  { id: 1, label: 'Informações', icon: FileText, description: 'Nome e objetivo da reunião' },
  { id: 2, label: 'Data e Hora', icon: Calendar, description: 'Quando a reunião acontecerá' },
  { id: 3, label: 'Opções', icon: Sparkles, description: 'Link, cor e recorrência' },
  { id: 4, label: 'Participantes', icon: Users, description: 'Convidar participantes' },
];

const NewMeetingWizard = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { user } = useAuth();
  const { createEvent, refreshEvents } = useCalendarData();

  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  // Step 1
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  // Step 2
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('10:00');
  const [isAllDay, setIsAllDay] = useState(false);

  // Step 3
  const [createMeetingLink, setCreateMeetingLink] = useState(true);
  const [selectedColor, setSelectedColor] = useState('#3600FF');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [recurrence, setRecurrence] = useState<RecurrenceConfig>(defaultRecurrence);

  // Step 4
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [participantInput, setParticipantInput] = useState('');
  const [inputMode, setInputMode] = useState<'email' | 'phone'>('phone');
  const [participantTab, setParticipantTab] = useState<'manual' | 'contacts'>('manual');
  const [registeredUsers, setRegisteredUsers] = useState<RegisteredUser[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [sendInvites, setSendInvites] = useState(true);

  // Init dates from URL params
  useEffect(() => {
    const date = searchParams.get('date');
    const rangeStart = searchParams.get('start');
    const rangeEnd = searchParams.get('end');

    if (rangeStart && rangeEnd) {
      const s = new Date(rangeStart);
      const e = new Date(rangeEnd);
      setStartDate(s.toISOString().split('T')[0]);
      setStartTime(s.toTimeString().slice(0, 5));
      setEndDate(e.toISOString().split('T')[0]);
      setEndTime(e.toTimeString().slice(0, 5));
      setIsAllDay(false);
    } else if (date) {
      setStartDate(date);
      setEndDate(date);
    } else {
      const today = new Date().toISOString().split('T')[0];
      setStartDate(today);
      setEndDate(today);
    }
  }, [searchParams]);

  useEffect(() => {
    if (user) loadRegisteredContacts();
  }, [user]);

  const loadRegisteredContacts = async () => {
    if (!user) return;
    setLoadingUsers(true);
    try {
      const { data: companyData } = await supabase
        .from('company_users').select('company_id').eq('user_id', user.id).single();
      if (!companyData) return;
      const { data: clients } = await supabase
        .from('clients').select('id, name, email, phone, whatsapp')
        .eq('company_id', companyData.company_id).limit(200);
      if (clients) {
        setRegisteredUsers(clients.map(c => ({
          id: c.id, email: c.email || '', name: c.name,
          phone: c.whatsapp || c.phone || '',
        })));
      }
    } catch (err) {
      console.error('Error loading contacts:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  // Phone mask - auto-adds 55 prefix for Brazilian numbers
  const formatPhone = (value: string): string => {
    let digits = value.replace(/\D/g, '').slice(0, 13);
    // Auto-prepend 55 if user starts typing DDD directly (2 digit area code)
    if (digits.length >= 2 && !digits.startsWith('55') && !digits.startsWith('1')) {
      digits = '55' + digits;
    }
    digits = digits.slice(0, 13);
    if (digits.length === 0) return '';
    if (digits.length <= 2) return `+${digits}`;
    if (digits.length <= 4) return `+${digits.slice(0, 2)} (${digits.slice(2)}`;
    if (digits.length <= 9) return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4)}`;
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  };

  const handleParticipantInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setParticipantInput(inputMode === 'phone' ? formatPhone(e.target.value) : e.target.value);
  };

  const addParticipant = (type: 'email' | 'phone', value: string) => {
    const trimmed = value.trim();
    if (!trimmed || participants.some(p => p.value === trimmed)) return;
    setParticipants(prev => [...prev, { type, value: trimmed }]);
    setParticipantInput('');
  };

  const addRegisteredUser = (contact: RegisteredUser) => {
    if (participants.some(p => p.userId === contact.id || p.value === contact.email)) return;
    setParticipants(prev => [...prev, {
      type: 'user', value: contact.email || contact.phone || contact.name,
      name: contact.name, userId: contact.id,
    }]);
  };

  const removeParticipant = (index: number) => {
    setParticipants(prev => prev.filter((_, i) => i !== index));
  };

  const submitParticipant = () => {
    const val = participantInput.trim();
    if (!val) return;
    if (inputMode === 'email') {
      if (val.includes('@')) addParticipant('email', val);
    } else {
      const digits = val.replace(/\D/g, '');
      if (digits.length >= 10) addParticipant('phone', digits);
    }
  };

  const handleParticipantKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); submitParticipant(); }
  };

  const filteredUsers = registeredUsers.filter(u => {
    if (!userSearch) return true;
    const search = userSearch.toLowerCase();
    return u.name.toLowerCase().includes(search) || u.email?.toLowerCase().includes(search) || u.phone?.includes(search);
  });

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 1: return title.trim().length > 0;
      case 2: return !!startDate && !!endDate && (isAllDay || (!!startTime && !!endTime));
      case 3: return true;
      case 4: return true;
      default: return false;
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setIsLoading(true);
    try {
      let finalStartDate: string, finalEndDate: string;
      if (isAllDay) {
        finalStartDate = new Date(startDate + 'T00:00:00').toISOString();
        finalEndDate = new Date(endDate + 'T23:59:59').toISOString();
      } else {
        finalStartDate = new Date(startDate + 'T' + startTime).toISOString();
        finalEndDate = new Date(endDate + 'T' + endTime).toISOString();
      }

      const attendeesList = participants.map(p => p.value);
      let meetingLink = '';
      let finalMeetingProvider: 'google_meet' | 'zoom' | 'teams' | 'ellosuit' | null = null;
      let resolvedCompanyId = '';

      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error('Usuário não autenticado');
      const { data: companyUser } = await supabase
        .from('company_users').select('company_id').eq('user_id', authUser.id).single();
      if (!companyUser) throw new Error('Empresa não encontrada');
      resolvedCompanyId = companyUser.company_id;

      if (createMeetingLink) {
        const roomCode = Math.random().toString(36).substring(2, 10).toUpperCase();
        const { data: roomData, error: roomError } = await supabase
          .from('meeting_rooms').insert({
            title, room_code: roomCode, max_participants: 50,
            recording_enabled: false, chat_enabled: true, screen_sharing_enabled: true,
            company_id: resolvedCompanyId, created_by: authUser.id,
          }).select('id').single();

        if (roomError) {
          toast({ title: "Aviso", description: "Evento criado sem link de reunião: " + roomError.message, variant: "destructive" });
        } else {
          meetingLink = APP_CONFIG.getMeetingUrl(roomCode);
          finalMeetingProvider = 'ellosuit';
        }
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
          description: 'O link da reunião precisa começar com https://www.ellosuit.app',
          variant: 'destructive',
        });
        return;
      }

      const eventData = {
        title,
        description: meetingLink ? `${description}\n\n🔗 Link da reunião: ${meetingLink}`.trim() : description,
        start_date: finalStartDate, end_date: finalEndDate,
        event_type: 'meeting' as const, attendees: attendeesList,
        is_all_day: isAllDay, meeting_link: meetingLink || undefined,
        meeting_provider: finalMeetingProvider || undefined, color: selectedColor
      };

      const createdEvent = await createEvent(eventData, recurrence.enabled ? recurrence : undefined);

      if (sendInvites && participants.length > 0) {
        const eventDateFormatted = new Date(finalStartDate).toLocaleDateString('pt-BR');
        const eventTimeFormatted = !isAllDay ? `${startTime} - ${endTime}` : 'Dia inteiro';
        supabase.functions.invoke('send-meeting-invite', {
          body: {
            event_title: title, event_date: eventDateFormatted, event_time: eventTimeFormatted,
            meeting_link: meetingLink || null,
            participants: participants.map(p => ({
              type: p.type === 'user' ? (p.value.includes('@') ? 'email' : 'phone') : p.type,
              value: p.value, name: p.name,
            })),
            company_id: resolvedCompanyId, event_id: createdEvent?.id || null,
          }
        }).then(res => {
          if (!res.error && res.data?.sent > 0) {
            toast({ title: "Convites enviados", description: `${res.data.sent} convite(s) enviado(s)!` });
          }
        }).catch(err => console.error('Invite error:', err));
      }

      await refreshEvents();
      toast({ title: "Reunião criada!", description: `"${title}" foi agendada com sucesso.` });
      navigate('/dashboard/agenda');
    } catch (error: any) {
      toast({ title: "Erro", description: error.message || "Erro ao criar reunião", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const nextStep = () => { if (canProceed() && currentStep < 4) setCurrentStep(s => s + 1); };
  const prevStep = () => { if (currentStep > 1) setCurrentStep(s => s - 1); };

  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/agenda')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg md:text-xl font-bold flex items-center gap-2">
              <Video className="h-5 w-5" style={{ color: FLOW_BLUE }} /> Nova Reunião
            </h1>
            <p className="text-xs text-muted-foreground hidden sm:block">
              {STEPS[currentStep - 1].description}
            </p>
          </div>
          <span className="text-sm text-muted-foreground font-medium">
            {currentStep} de {STEPS.length}
          </span>
        </div>
      </div>

      {/* Progress steps */}
      <div className="max-w-5xl mx-auto px-4 md:px-8 pt-6">
        <div className="flex items-center justify-between mb-8">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            const isActive = currentStep === step.id;
            const isDone = currentStep > step.id;
            return (
              <React.Fragment key={step.id}>
                <button
                  onClick={() => { if (isDone || isActive) setCurrentStep(step.id); }}
                  className={cn(
                    'flex flex-col items-center gap-1.5 transition-all cursor-pointer group',
                    isActive && 'scale-105',
                    !isDone && !isActive && 'opacity-40 cursor-default'
                  )}
                >
                  <div className={cn(
                    'w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center border-2 transition-all',
                    !isDone && !isActive && 'border-muted-foreground/30 text-muted-foreground'
                  )}
                  style={{
                    ...(isActive ? { borderColor: FLOW_BLUE, backgroundColor: FLOW_BLUE, color: 'white', boxShadow: `0 8px 24px ${FLOW_BLUE}40` } : {}),
                    ...(isDone ? { borderColor: FLOW_BLUE, backgroundColor: `${FLOW_BLUE}15`, color: FLOW_BLUE } : {}),
                  }}>
                    {isDone ? <Check className="h-5 w-5" /> : <Icon className="h-4 w-4 md:h-5 md:w-5" />}
                  </div>
                  <span className={cn(
                    'text-[10px] md:text-xs font-medium hidden sm:block',
                    !isDone && !isActive && 'text-muted-foreground'
                  )}
                  style={{ color: (isActive || isDone) ? FLOW_BLUE : undefined }}>
                    {step.label}
                  </span>
                </button>
                {i < STEPS.length - 1 && (
                  <div
                    className={cn('flex-1 h-0.5 mx-1 md:mx-2 rounded-full transition-all', currentStep <= step.id && 'bg-muted')}
                    style={currentStep > step.id ? { backgroundColor: FLOW_BLUE } : undefined}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Step content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="max-w-3xl mx-auto"
          >
            {currentStep === 1 && (
              <div className="space-y-6">
                <div className="bg-card rounded-2xl border p-6 md:p-8 space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="title" className="text-sm font-semibold">
                      Título da Reunião *
                    </Label>
                    <Input
                      id="title" value={title} onChange={(e) => setTitle(e.target.value)}
                      placeholder="Ex: Alinhamento semanal do time"
                      className="h-12 text-base"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description" className="text-sm font-semibold">
                      Objetivo / Descrição
                    </Label>
                    <Textarea
                      id="description" value={description} onChange={(e) => setDescription(e.target.value)}
                      placeholder="Descreva o objetivo da reunião, tópicos a discutir..."
                      rows={4} className="text-sm"
                    />
                  </div>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="bg-card rounded-2xl border p-6 md:p-8 space-y-5">
                  <div className="flex items-center space-x-3 p-3 rounded-lg bg-accent/50">
                    <Checkbox
                      id="allDay" checked={isAllDay}
                      onCheckedChange={(v) => setIsAllDay(v as boolean)}
                    />
                    <Label htmlFor="allDay" className="text-sm font-medium cursor-pointer">
                      Evento de dia inteiro
                    </Label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Data de Início
                      </Label>
                      <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                        className="h-11" required />
                    </div>
                    {!isAllDay && (
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Hora de Início
                        </Label>
                        <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
                          className="h-11" required />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Data de Término
                      </Label>
                      <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                        className="h-11" required />
                    </div>
                    {!isAllDay && (
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Hora de Término
                        </Label>
                        <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
                          className="h-11" required />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-6">
                {/* Meeting link */}
                <div className="bg-card rounded-2xl border p-6 md:p-8 space-y-4">
                  <Label className="flex items-center gap-2 text-sm font-semibold">
                    <Link2 className="h-4 w-4" style={{ color: FLOW_BLUE }} /> Link de Reunião Online
                  </Label>
                  <Button
                    type="button"
                    variant={createMeetingLink ? 'default' : 'outline'}
                    onClick={() => setCreateMeetingLink(!createMeetingLink)}
                    className={cn('w-full h-12 flex items-center justify-center gap-2 text-sm')}
                    style={createMeetingLink ? { background: `linear-gradient(to right, ${FLOW_BLUE}, ${FLOW_BLUE}cc)`, color: 'white' } : undefined}
                  >
                    <Video className="h-4 w-4" />
                    {createMeetingLink ? 'Ellomeeting ativado ✓' : 'Criar link Ellomeeting'}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    O link será enviado automaticamente aos participantes convidados.
                  </p>
                </div>

                {/* Color */}
                <div className="bg-card rounded-2xl border p-6 md:p-8 space-y-4">
                  <Label className="flex items-center gap-2 text-sm font-semibold">
                    <Palette className="h-4 w-4" /> Cor do Evento
                  </Label>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full border-2 border-border cursor-pointer shadow-sm"
                      style={{ backgroundColor: selectedColor }}
                      onClick={() => setShowColorPicker(!showColorPicker)}
                    />
                    <Button type="button" variant="outline" size="sm" onClick={() => setShowColorPicker(!showColorPicker)}>
                      Alterar cor
                    </Button>
                  </div>
                  {showColorPicker && (
                    <ColorPicker selectedColor={selectedColor} onColorChange={setSelectedColor}
                      onClose={() => setShowColorPicker(false)} />
                  )}
                </div>

                {/* Recurrence */}
                <div className="bg-card rounded-2xl border p-6 md:p-8">
                  <RecurrenceSelector config={recurrence} onChange={setRecurrence} />
                </div>
              </div>
            )}

            {currentStep === 4 && (
              <div className="space-y-6">
                <div className="bg-card rounded-2xl border p-6 md:p-8 space-y-4">
                  <Label className="flex items-center gap-2 text-sm font-semibold">
                    <Users className="h-4 w-4" /> Convidar Participantes
                  </Label>

                  {/* Tags */}
                  {participants.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {participants.map((p, i) => (
                        <Badge key={i} variant="secondary" className="flex items-center gap-1 px-2.5 py-1 text-xs">
                          {p.type === 'phone' ? <Phone className="h-3 w-3" /> : <Mail className="h-3 w-3" />}
                          <span className="max-w-[160px] truncate">{p.name || p.value}</span>
                          <button type="button" onClick={() => removeParticipant(i)} className="ml-1 hover:text-destructive">
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}

                  <Tabs value={participantTab} onValueChange={(v) => setParticipantTab(v as any)} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 h-9">
                      <TabsTrigger value="manual" className="text-xs">
                        <Mail className="h-3 w-3 mr-1" /> Email / Telefone
                      </TabsTrigger>
                      <TabsTrigger value="contacts" className="text-xs">
                        <UserPlus className="h-3 w-3 mr-1" /> Contatos
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="manual" className="mt-3 space-y-3">
                      <div className="flex gap-1 mb-1">
                        <Button type="button" variant={inputMode === 'phone' ? 'default' : 'outline'}
                          size="sm" className="h-8 text-xs px-3"
                          onClick={() => { setInputMode('phone'); setParticipantInput(''); }}>
                          <Phone className="h-3 w-3 mr-1" /> Telefone
                        </Button>
                        <Button type="button" variant={inputMode === 'email' ? 'default' : 'outline'}
                          size="sm" className="h-8 text-xs px-3"
                          onClick={() => { setInputMode('email'); setParticipantInput(''); }}>
                          <Mail className="h-3 w-3 mr-1" /> Email
                        </Button>
                      </div>
                      <div className="flex gap-2">
                        <Input
                          value={participantInput} onChange={handleParticipantInputChange}
                          onKeyDown={handleParticipantKeyDown}
                          placeholder={inputMode === 'phone' ? '(41) 98535-0504' : 'email@exemplo.com'}
                          className="text-sm h-11" type={inputMode === 'email' ? 'email' : 'tel'}
                        />
                        <Button type="button" variant="outline" size="icon" className="h-11 w-11 shrink-0"
                          onClick={submitParticipant}>
                          <UserPlus className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {inputMode === 'phone' ? 'Digite o número com DDD e pressione Enter' : 'Digite o email e pressione Enter'}
                      </p>
                    </TabsContent>

                    <TabsContent value="contacts" className="mt-3 space-y-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input value={userSearch} onChange={(e) => setUserSearch(e.target.value)}
                          placeholder="Buscar contato..." className="pl-9 text-sm h-11" />
                      </div>
                      <ScrollArea className="h-[180px] border rounded-lg">
                        {loadingUsers ? (
                          <div className="flex items-center justify-center h-full p-4">
                            <Loader2 className="h-4 w-4 animate-spin" />
                          </div>
                        ) : filteredUsers.length === 0 ? (
                          <div className="text-xs text-muted-foreground text-center p-6">
                            Nenhum contato encontrado
                          </div>
                        ) : (
                          <div className="p-1.5 space-y-0.5">
                            {filteredUsers.slice(0, 30).map(contact => {
                              const isAdded = participants.some(p => p.userId === contact.id || p.value === contact.email);
                              return (
                                <button key={contact.id} type="button" disabled={isAdded}
                                  onClick={() => addRegisteredUser(contact)}
                                  className={cn(
                                    'w-full text-left px-3 py-2.5 rounded-lg text-sm hover:bg-accent transition-colors flex items-center justify-between',
                                    isAdded && 'opacity-40'
                                  )}>
                                  <div>
                                    <p className="font-medium text-sm">{contact.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {contact.email || contact.phone || 'Sem contato'}
                                    </p>
                                  </div>
                                  {isAdded && <Badge variant="outline" className="text-[10px]">Adicionado</Badge>}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </ScrollArea>
                    </TabsContent>
                  </Tabs>

                  {/* Send invites */}
                  {participants.length > 0 && (
                    <div className="flex items-center space-x-2 p-3 rounded-lg bg-accent/50">
                      <Checkbox id="sendInvites" checked={sendInvites}
                        onCheckedChange={(v) => setSendInvites(v as boolean)} />
                      <Label htmlFor="sendInvites" className="text-xs flex items-center gap-1.5 cursor-pointer">
                        <Send className="h-3 w-3" /> Enviar convites automaticamente
                      </Label>
                    </div>
                  )}
                </div>

                {/* Summary */}
                <div className="bg-card rounded-2xl border p-6 md:p-8 space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Check className="h-4 w-4" style={{ color: FLOW_BLUE }} /> Resumo
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Título</p>
                      <p className="font-medium truncate">{title || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Data</p>
                      <p className="font-medium">
                        {startDate ? new Date(startDate + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Horário</p>
                      <p className="font-medium">{isAllDay ? 'Dia inteiro' : `${startTime} - ${endTime}`}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Participantes</p>
                      <p className="font-medium">{participants.length} convidado(s)</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Link Ellomeeting</p>
                      <p className="font-medium">{createMeetingLink ? 'Sim ✓' : 'Não'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Cor</p>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: selectedColor }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation buttons */}
        <div className="max-w-3xl mx-auto flex gap-3 pt-6 pb-8">
          {currentStep > 1 ? (
            <Button variant="outline" onClick={prevStep} className="flex-1 h-12 rounded-xl">
              <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
            </Button>
          ) : (
            <Button variant="outline" onClick={() => navigate('/dashboard/agenda')} className="flex-1 h-12 rounded-xl">
              Cancelar
            </Button>
          )}

          {currentStep < 4 ? (
            <Button onClick={nextStep} disabled={!canProceed()}
              className="flex-1 h-12 text-white rounded-xl"
              style={{ background: `linear-gradient(to right, ${FLOW_BLUE}, ${FLOW_BLUE}cc)` }}>
              Próximo <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={isLoading}
              className="flex-1 h-12 text-white rounded-xl"
              style={{ background: `linear-gradient(to right, ${FLOW_BLUE}, ${FLOW_BLUE}cc)` }}>
              {isLoading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Criando...</>
              ) : (
                <><Check className="h-4 w-4 mr-2" /> Criar Reunião</>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default NewMeetingWizard;
