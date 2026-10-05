import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Video, Palette, Link2, Loader2, UserPlus, Mail, Phone, Search, X, Users, MessageSquare, Send } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ColorPicker from './ColorPicker';
import RecurrenceSelector, { RecurrenceConfig } from './RecurrenceSelector';
import { APP_CONFIG, sanitizeMeetingUrl, isAllowedMeetingUrl } from '@/config/app';
import { useAuth } from '@/hooks/useAuth';

interface ImprovedEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string | null;
  selectedRange?: { start: string; end: string } | null;
  onCreateEvent: (eventData: any, recurrence?: RecurrenceConfig) => Promise<any>;
  onNavigateToSettings?: () => void;
}

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

const ImprovedEventModal = ({ 
  isOpen, 
  onClose, 
  selectedDate, 
  selectedRange,
  onCreateEvent,
  onNavigateToSettings 
}: ImprovedEventModalProps) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isAllDay, setIsAllDay] = useState(false);
  const [createMeetingLink, setCreateMeetingLink] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [selectedColor, setSelectedColor] = useState('#3600FF');
  const [recurrence, setRecurrence] = useState<RecurrenceConfig>(defaultRecurrence);

  // Participant management
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [participantInput, setParticipantInput] = useState('');
  const [participantTab, setParticipantTab] = useState<'manual' | 'contacts'>('manual');
  const [registeredUsers, setRegisteredUsers] = useState<RegisteredUser[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [sendInvites, setSendInvites] = useState(true);

  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (selectedDate) {
      setStartDate(selectedDate);
      setEndDate(selectedDate);
    }

    if (selectedRange) {
      const startDateTime = new Date(selectedRange.start);
      const endDateTime = new Date(selectedRange.end);
      
      setStartDate(startDateTime.toISOString().split('T')[0]);
      setStartTime(startDateTime.toTimeString().slice(0, 5));
      setEndDate(endDateTime.toISOString().split('T')[0]);
      setEndTime(endDateTime.toTimeString().slice(0, 5));
      setIsAllDay(false);
    } else if (selectedDate && !startTime) {
      setStartTime('09:00');
      setEndTime('10:00');
    }
  }, [selectedDate, selectedRange]);

  // Load registered users/clients for contact search
  useEffect(() => {
    if (isOpen && user) {
      loadRegisteredContacts();
    }
  }, [isOpen, user]);

  const loadRegisteredContacts = async () => {
    if (!user) return;
    setLoadingUsers(true);
    try {
      const { data: companyData } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!companyData) return;

      // Load clients from CRM
      const { data: clients } = await supabase
        .from('clients')
        .select('id, name, email, phone, whatsapp')
        .eq('company_id', companyData.company_id)
        .limit(200);

      if (clients) {
        setRegisteredUsers(clients.map(c => ({
          id: c.id,
          email: c.email || '',
          name: c.name,
          phone: c.whatsapp || c.phone || '',
        })));
      }
    } catch (err) {
      console.error('Error loading contacts:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setStartDate('');
    setStartTime('');
    setEndDate('');
    setEndTime('');
    setParticipants([]);
    setParticipantInput('');
    setIsAllDay(false);
    setCreateMeetingLink(false);
    setSelectedColor('#3600FF');
    setRecurrence(defaultRecurrence);
    setSendInvites(true);
  };

  const addParticipant = (type: 'email' | 'phone', value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (participants.some(p => p.value === trimmed)) return;
    setParticipants(prev => [...prev, { type, value: trimmed }]);
    setParticipantInput('');
  };

  const addRegisteredUser = (contact: RegisteredUser) => {
    if (participants.some(p => p.userId === contact.id || p.value === contact.email)) return;
    setParticipants(prev => [...prev, {
      type: 'user',
      value: contact.email || contact.phone || contact.name,
      name: contact.name,
      userId: contact.id,
    }]);
  };

  const removeParticipant = (index: number) => {
    setParticipants(prev => prev.filter((_, i) => i !== index));
  };

  const [inputMode, setInputMode] = useState<'email' | 'phone'>('phone');

  const formatPhone = (value: string): string => {
    const digits = value.replace(/\D/g, '').slice(0, 13);
    if (digits.length === 0) return '';
    if (digits.length <= 2) return `+${digits}`;
    if (digits.length <= 4) return `+${digits.slice(0, 2)} (${digits.slice(2)}`;
    if (digits.length <= 9) return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4)}`;
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  };

  const handleParticipantInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (inputMode === 'phone') {
      setParticipantInput(formatPhone(val));
    } else {
      setParticipantInput(val);
    }
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
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      submitParticipant();
    }
  };

  const filteredUsers = registeredUsers.filter(u => {
    if (!userSearch) return true;
    const search = userSearch.toLowerCase();
    return u.name.toLowerCase().includes(search) || 
           u.email?.toLowerCase().includes(search) ||
           u.phone?.includes(search);
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      toast({ title: "Erro", description: "Título é obrigatório", variant: "destructive" });
      return;
    }

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

      // Include ALL participants (email + phone) in attendees
      const attendeesList = participants.map(p => p.value);

      let meetingLink = '';
      let finalMeetingProvider: 'google_meet' | 'zoom' | 'teams' | 'ellosuit' | null = null;
      let resolvedCompanyId = '';

      // Get company info early (needed for both room creation and invites)
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error('Usuário não autenticado');

      const { data: companyUser } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', authUser.id)
        .single();

      if (!companyUser) throw new Error('Empresa não encontrada');
      resolvedCompanyId = companyUser.company_id;

      // Create Ellomeeting room if requested
      if (createMeetingLink) {
        const roomCode = Math.random().toString(36).substring(2, 10).toUpperCase();
        
        console.log('🔧 Creating meeting room with:', { title, roomCode, company_id: resolvedCompanyId, created_by: authUser.id });
        
        const { data: roomData, error: roomError } = await supabase
          .from('meeting_rooms')
          .insert({
            title,
            room_code: roomCode,
            max_participants: 50,
            recording_enabled: false,
            chat_enabled: true,
            screen_sharing_enabled: true,
            company_id: resolvedCompanyId,
            created_by: authUser.id,
          })
          .select('id')
          .single();

        if (roomError) {
          console.error('❌ Error creating meeting room:', roomError.code, roomError.message, roomError.details, roomError.hint);
          toast({
            title: "Aviso",
            description: "Evento será criado sem link de reunião: " + roomError.message,
            variant: "destructive"
          });
        } else {
          meetingLink = APP_CONFIG.getMeetingUrl(roomCode);
          finalMeetingProvider = 'ellosuit';
          console.log('✅ Ellomeeting room created:', roomCode, meetingLink, roomData);
        }
      }

      // Validação rigorosa: bloqueia salvar/enviar qualquer link fora do domínio canônico.
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
        description: meetingLink 
          ? `${description}\n\n🔗 Link da reunião: ${meetingLink}`.trim()
          : description,
        start_date: finalStartDate,
        end_date: finalEndDate,
        event_type: 'meeting' as const,
        attendees: attendeesList,
        is_all_day: isAllDay,
        meeting_link: meetingLink || undefined,
        meeting_provider: finalMeetingProvider || undefined,
        color: selectedColor
      };

      const createdEvent = await onCreateEvent(eventData, recurrence.enabled ? recurrence : undefined);
      
      // Send invites via edge function (non-blocking)
      if (sendInvites && participants.length > 0) {
        const eventDateFormatted = new Date(finalStartDate).toLocaleDateString('pt-BR');
        const eventTimeFormatted = !isAllDay 
          ? `${startTime} - ${endTime}` 
          : 'Dia inteiro';
        
        supabase.functions.invoke('send-meeting-invite', {
          body: {
            event_title: title,
            event_date: eventDateFormatted,
            event_time: eventTimeFormatted,
            meeting_link: meetingLink || null,
            participants: participants.map(p => ({
              type: p.type === 'user' ? (p.value.includes('@') ? 'email' : 'phone') : p.type,
              value: p.value,
              name: p.name,
            })),
            company_id: resolvedCompanyId,
            event_id: createdEvent?.id || null,
          }
        }).then(res => {
          if (res.error) {
            console.error('Invite error:', res.error);
          } else {
            const data = res.data;
            console.log(`✅ Convites: ${data.sent}/${data.total} enviados`);
            if (data.sent > 0) {
              toast({
                title: "Convites enviados",
                description: `${data.sent} convite(s) enviado(s) com sucesso!`,
              });
            }
          }
        }).catch(err => console.error('Invite error:', err));
      }

      resetForm();
      onClose();
    } catch (error: any) {
      console.error('Error creating event:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar reunião",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };



  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Video className="h-5 w-5 text-primary" />
            Nova Reunião
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left column */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Título da Reunião *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Digite o título da reunião"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Adicione uma descrição (opcional)"
                  rows={2}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="allDay"
                  checked={isAllDay}
                  onCheckedChange={(checked) => setIsAllDay(checked as boolean)}
                />
                <Label htmlFor="allDay" className="text-sm">Evento de dia inteiro</Label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Data de Início</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
                </div>
                {!isAllDay && (
                  <div className="space-y-1">
                    <Label className="text-xs">Hora de Início</Label>
                    <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Data de Término</Label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
                </div>
                {!isAllDay && (
                  <div className="space-y-1">
                    <Label className="text-xs">Hora de Término</Label>
                    <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
                  </div>
                )}
              </div>

              {/* Color & Meeting */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-7 h-7 rounded-full border-2 border-border cursor-pointer"
                    style={{ backgroundColor: selectedColor }}
                    onClick={() => setShowColorPicker(!showColorPicker)}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowColorPicker(!showColorPicker)}>
                    <Palette className="h-3.5 w-3.5 mr-1" /> Cor
                  </Button>
                </div>
              </div>
              {showColorPicker && (
                <ColorPicker selectedColor={selectedColor} onColorChange={setSelectedColor} onClose={() => setShowColorPicker(false)} />
              )}
            </div>

            {/* Right column - Participants & Meeting Link */}
            <div className="space-y-4">
              {/* Meeting Link */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <Link2 className="h-4 w-4" /> Link de Reunião
                </Label>
                <Button
                  type="button"
                  variant={createMeetingLink ? 'default' : 'outline'}
                  onClick={() => setCreateMeetingLink(!createMeetingLink)}
                  className={`w-full h-10 flex items-center justify-center gap-2 ${createMeetingLink ? 'bg-gradient-to-r from-primary to-primary/80 text-primary-foreground' : ''}`}
                >
                  <Video className="h-4 w-4" />
                  {createMeetingLink ? 'Ellomeeting ativado ✓' : 'Criar link Ellomeeting'}
                </Button>
              </div>

              {/* Participants Section */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <Users className="h-4 w-4" /> Participantes
                </Label>

                {/* Participant tags */}
                {participants.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {participants.map((p, i) => (
                      <Badge key={i} variant="secondary" className="flex items-center gap-1 px-2 py-0.5 text-xs">
                        {p.type === 'phone' ? <Phone className="h-3 w-3" /> : <Mail className="h-3 w-3" />}
                        <span className="max-w-[140px] truncate">{p.name || p.value}</span>
                        <button type="button" onClick={() => removeParticipant(i)} className="ml-0.5 hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}

                <Tabs value={participantTab} onValueChange={(v) => setParticipantTab(v as any)} className="w-full">
                  <TabsList className="grid w-full grid-cols-2 h-8">
                    <TabsTrigger value="manual" className="text-xs">
                      <Mail className="h-3 w-3 mr-1" /> Email / Telefone
                    </TabsTrigger>
                    <TabsTrigger value="contacts" className="text-xs">
                      <UserPlus className="h-3 w-3 mr-1" /> Contatos
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="manual" className="mt-2 space-y-2">
                    <div className="flex gap-1 mb-1">
                      <Button
                        type="button"
                        variant={inputMode === 'phone' ? 'default' : 'outline'}
                        size="sm"
                        className="h-7 text-xs px-2"
                        onClick={() => { setInputMode('phone'); setParticipantInput(''); }}
                      >
                        <Phone className="h-3 w-3 mr-1" /> Telefone
                      </Button>
                      <Button
                        type="button"
                        variant={inputMode === 'email' ? 'default' : 'outline'}
                        size="sm"
                        className="h-7 text-xs px-2"
                        onClick={() => { setInputMode('email'); setParticipantInput(''); }}
                      >
                        <Mail className="h-3 w-3 mr-1" /> Email
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={participantInput}
                        onChange={handleParticipantInputChange}
                        onKeyDown={handleParticipantKeyDown}
                        placeholder={inputMode === 'phone' ? '+55 (41) 98535-0504' : 'email@exemplo.com'}
                        className="text-sm h-9"
                        type={inputMode === 'email' ? 'email' : 'tel'}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 px-3"
                        onClick={submitParticipant}
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {inputMode === 'phone' ? 'Digite o número com DDD e pressione Enter' : 'Digite o email e pressione Enter'}
                    </p>
                  </TabsContent>

                  <TabsContent value="contacts" className="mt-2 space-y-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        placeholder="Buscar contato..."
                        className="pl-8 text-sm h-9"
                      />
                    </div>
                    <ScrollArea className="h-[120px] border rounded-md">
                      {loadingUsers ? (
                        <div className="flex items-center justify-center h-full p-4">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      ) : filteredUsers.length === 0 ? (
                        <div className="text-xs text-muted-foreground text-center p-4">
                          Nenhum contato encontrado
                        </div>
                      ) : (
                        <div className="p-1">
                          {filteredUsers.slice(0, 20).map(contact => {
                            const isAdded = participants.some(p => p.userId === contact.id || p.value === contact.email);
                            return (
                              <button
                                key={contact.id}
                                type="button"
                                disabled={isAdded}
                                onClick={() => addRegisteredUser(contact)}
                                className={`w-full text-left px-2 py-1.5 rounded text-xs hover:bg-accent transition-colors flex items-center justify-between ${isAdded ? 'opacity-50' : ''}`}
                              >
                                <div>
                                  <p className="font-medium">{contact.name}</p>
                                  <p className="text-muted-foreground">
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
              </div>

              {/* Send invites toggle */}
              {participants.length > 0 && (
                <div className="flex items-center space-x-2 p-2 rounded-md bg-accent/50">
                  <Checkbox
                    id="sendInvites"
                    checked={sendInvites}
                    onCheckedChange={(checked) => setSendInvites(checked as boolean)}
                  />
                  <Label htmlFor="sendInvites" className="text-xs flex items-center gap-1.5 cursor-pointer">
                    <Send className="h-3 w-3" />
                    Enviar convites aos participantes
                  </Label>
                </div>
              )}
            </div>
          </div>

          {/* Recurrence */}
          <RecurrenceSelector config={recurrence} onChange={setRecurrence} />

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="flex-1 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground"
            >
              {isLoading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Criando...</>
              ) : (
                'Criar Reunião'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ImprovedEventModal;
