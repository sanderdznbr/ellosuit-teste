import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Calendar, Clock, Video, ExternalLink, AlertCircle, FileText, Edit3, Save, X, Check, 
  Pause, Calendar as CalendarIcon, Link, Trash2, Users, CheckCircle, XCircle, HelpCircle, 
  Send, RefreshCw, UserPlus, UserMinus, Copy, MapPin, Bell
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';
import { format, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { sanitizeMeetingUrl, isAllowedMeetingUrl } from '@/config/app';

interface EnhancedEventDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: any;
  onEventUpdate?: () => void;
}

const EnhancedEventDetailsModal: React.FC<EnhancedEventDetailsModalProps> = ({
  isOpen, onClose, event, onEventUpdate
}) => {
  const [activeTab, setActiveTab] = useState('details');
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editData, setEditData] = useState({
    notes: '', recording_link: '', status: 'pending', title: '', description: '',
  });
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [rescheduleData, setRescheduleData] = useState({ newDate: '', newStartTime: '', newEndTime: '' });
  const [showReschedule, setShowReschedule] = useState(false);
  const [rsvpList, setRsvpList] = useState<any[]>([]);
  const [sendingRsvpFor, setSendingRsvpFor] = useState<string | null>(null);
  const [rescheduleRequests, setRescheduleRequests] = useState<any[]>([]);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [newParticipantPhone, setNewParticipantPhone] = useState('');
  const [newParticipantName, setNewParticipantName] = useState('');
  const [isAddingParticipant, setIsAddingParticipant] = useState(false);
  const [showAddParticipant, setShowAddParticipant] = useState(false);

  const { user } = useAuth();
  const { toast } = useToast();
  const { deleteGoogleCalendarEvent, isConnected: googleConnected } = useGoogleCalendar();

  const fetchRsvpData = useCallback((eventId: string) => {
    supabase.from('meeting_rsvp').select('*').eq('event_id', eventId)
      .order('invited_at', { ascending: true }).then(({ data }) => setRsvpList(data || []));
    supabase.from('meeting_reschedule_requests').select('*').eq('event_id', eventId)
      .in('status', ['reschedule_proposed', 'cancelled', 'awaiting_response'])
      .order('created_at', { ascending: false }).then(({ data }) => setRescheduleRequests(data || []));
  }, []);

  useEffect(() => {
    if (event && isOpen) {
      const meetingData = event.extendedProps?.meeting_data || {};
      setEditData({
        notes: meetingData.notes || '', recording_link: meetingData.recording_link || '',
        status: meetingData.status || 'pending', title: event.title || '',
        description: event.extendedProps?.description || '',
      });
      setIsEditingDetails(false);
      setActiveTab('details');
      setShowAddParticipant(false);
      
      const eventId = event.id || event.extendedProps?.id;
      if (eventId) {
        fetchRsvpData(eventId);
        const channel = supabase
          .channel(`rsvp-reschedule-${eventId}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'meeting_rsvp', filter: `event_id=eq.${eventId}` }, () => fetchRsvpData(eventId))
          .on('postgres_changes', { event: '*', schema: 'public', table: 'meeting_reschedule_requests', filter: `event_id=eq.${eventId}` }, () => fetchRsvpData(eventId))
          .subscribe();
        return () => { supabase.removeChannel(channel); };
      }
    }
  }, [event, isOpen, fetchRsvpData]);

  if (!event) return null;

  const getEventStatus = () => {
    const now = new Date();
    const startDate = new Date(event.start);
    const endDate = new Date(event.end);
    if (now < startDate) {
      const diffMs = startDate.getTime() - now.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      let timeText = diffDays > 0 ? `Em ${diffDays} dia${diffDays > 1 ? 's' : ''}` : diffHours > 0 ? `Em ${diffHours}h ${diffMinutes}min` : `Em ${diffMinutes}min`;
      return { status: 'upcoming', color: 'bg-primary/10 text-primary border-primary/20', text: timeText };
    } else if (now >= startDate && now <= endDate) {
      return { status: 'ongoing', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200', text: 'Ao vivo' };
    }
    return { status: 'past', color: 'bg-muted text-muted-foreground border-border', text: 'Finalizado' };
  };

  const eventStatus = getEventStatus();
  const eventData = event.extendedProps || {};
  // Sanitiza defensivamente qualquer link legado (.online / preview lovable)
  // para o domínio canônico https://www.ellosuit.app antes de exibir/enviar.
  const rawMeetingLink = eventData.meeting_link;
  let meetingLink: string | null = null;
  try {
    const safe = sanitizeMeetingUrl(rawMeetingLink);
    meetingLink = safe && isAllowedMeetingUrl(safe) ? safe : null;
  } catch {
    meetingLink = null;
  }
  const eventStartDate = new Date(event.start);
  const eventEndDate = new Date(event.end);
  const canReschedule = !isPast(eventStartDate);
  const attendees: string[] = eventData.attendees || [];

  const startDateTime = { date: format(eventStartDate, 'dd/MM/yyyy', { locale: ptBR }), time: format(eventStartDate, 'HH:mm', { locale: ptBR }) };
  const endDateTime = { date: format(eventEndDate, 'dd/MM/yyyy', { locale: ptBR }), time: format(eventEndDate, 'HH:mm', { locale: ptBR }) };

  const confirmedCount = rsvpList.filter(r => r.status === 'confirmed').length;
  const declinedCount = rsvpList.filter(r => r.status === 'declined').length;
  const pendingCount = rsvpList.filter(r => r.status === 'pending' || r.status === 'reminded').length;
  const totalParticipants = rsvpList.length || attendees.length;

  const handleRequestConfirmation = async (rsvp: any) => {
    setSendingRsvpFor(rsvp.id);
    try {
      const phone = rsvp.attendee_phone;
      if (!phone) { toast({ title: "Erro", description: "Sem telefone", variant: "destructive" }); return; }
      const companyId = eventData.company_id;
      const confirmMsg = `📋 *Solicitação de Confirmação*\\n\\nGostaríamos de confirmar sua presença na reunião:\\n\\n📌 *${event.title}*\\n📆 ${startDateTime.date} às ${startDateTime.time}\\n${meetingLink ? `🔗 ${meetingLink}\\n` : ''}\\nResponda *Sim* para confirmar ou *Não* para recusar.`;
      await supabase.from('meeting_rsvp').update({ status: 'pending', responded_at: null }).eq('id', rsvp.id);
      await supabase.functions.invoke('notify-event-change', {
        body: { change_type: 'confirmation_request', event_title: event.title, event_date: startDateTime.date, event_time: `${startDateTime.time} - ${endDateTime.time}`, meeting_link: meetingLink || null, attendees: [phone], company_id: companyId, event_id: event.id || event.extendedProps?.id || null, custom_message: confirmMsg }
      });
      toast({ title: "✅ Enviado", description: `Solicitação enviada para ${rsvp.attendee_name || phone}` });
    } catch { toast({ title: "Erro", description: "Falha ao enviar", variant: "destructive" }); }
    finally { setSendingRsvpFor(null); }
  };

  const handleRescheduleResponse = async (requestId: string, response: 'confirm' | 'deny') => {
    setRespondingTo(requestId);
    try {
      const action = response === 'confirm' ? 'confirm_reschedule' : 'deny_reschedule';
      const res = await supabase.functions.invoke('handle-meeting-reschedule', { body: { action, reschedule_request_id: requestId } });
      if (res.error) throw res.error;
      toast({ title: response === 'confirm' ? '✅ Remarcação confirmada' : '❌ Remarcação negada', description: response === 'confirm' ? 'Evento remarcado e participante notificado' : 'Participante notificado' });
      const eventId = event?.id || event?.extendedProps?.id;
      if (eventId) fetchRsvpData(eventId);
      onEventUpdate?.();
    } catch { toast({ title: 'Erro', description: 'Falha ao processar', variant: 'destructive' }); }
    finally { setRespondingTo(null); }
  };

  const notifyAttendeesChange = (changeType: string, extra: Record<string, any> = {}) => {
    if (attendees.length === 0) return;
    supabase.functions.invoke('notify-event-change', {
      body: { change_type: changeType, event_title: event.title, event_date: startDateTime.date, event_time: `${startDateTime.time} - ${endDateTime.time}`, meeting_link: meetingLink || null, attendees, company_id: eventData.company_id, ...extra }
    }).catch(err => console.error('Notify error:', err));
  };

  const handleDeleteEvent = async () => {
    if (!event?.id || !user) return;
    setIsLoading(true);
    try {
      if (eventData.google_event_id && googleConnected) {
        try { await deleteGoogleCalendarEvent(eventData.google_event_id); } catch {}
      }
      const { error } = await supabase.from('calendar_events').delete().eq('id', event.id);
      if (error) throw error;
      notifyAttendeesChange('cancelled');
      toast({ title: "Sucesso", description: "Evento excluído com sucesso!" });
      onEventUpdate?.();
      onClose();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message || "Erro ao excluir", variant: "destructive" });
    } finally { setIsLoading(false); setShowDeleteConfirm(false); }
  };

  const handleSaveNotes = async () => {
    if (!event?.id || !user) return;
    setIsLoading(true);
    try {
      const { error } = await supabase.from('calendar_events').update({
        meeting_data: { ...eventData.meeting_data, notes: editData.notes, recording_link: editData.recording_link, status: editData.status, updated_at: new Date().toISOString() }
      }).eq('id', event.id);
      if (error) throw error;
      toast({ title: "Sucesso", description: "Anotações salvas!" });
      setIsEditing(false);
      onEventUpdate?.();
    } catch (error: any) { toast({ title: "Erro", description: error.message, variant: "destructive" }); }
    finally { setIsLoading(false); }
  };

  const handleSaveDetails = async () => {
    if (!event?.id || !user) return;
    setIsLoading(true);
    try {
      const dateVal = rescheduleData.newDate || format(eventStartDate, 'yyyy-MM-dd');
      const startTime = rescheduleData.newStartTime || format(eventStartDate, 'HH:mm');
      const endTime = rescheduleData.newEndTime || format(eventEndDate, 'HH:mm');
      const { error } = await supabase.from('calendar_events').update({
        title: editData.title, description: editData.description,
        start_date: new Date(`${dateVal}T${startTime}`).toISOString(),
        end_date: new Date(`${dateVal}T${endTime}`).toISOString(),
      }).eq('id', event.id);
      if (error) throw error;
      toast({ title: "Sucesso", description: "Evento atualizado!" });
      setIsEditingDetails(false);
      onEventUpdate?.();
    } catch (error: any) { toast({ title: "Erro", description: error.message, variant: "destructive" }); }
    finally { setIsLoading(false); }
  };

  const handleRescheduleEvent = async () => {
    if (!event?.id || !user || !rescheduleData.newDate || !rescheduleData.newStartTime || !rescheduleData.newEndTime) return;
    setIsLoading(true);
    try {
      const newStart = new Date(`${rescheduleData.newDate}T${rescheduleData.newStartTime}`);
      const newEnd = new Date(`${rescheduleData.newDate}T${rescheduleData.newEndTime}`);
      const { error } = await supabase.from('calendar_events').update({
        start_date: newStart.toISOString(), end_date: newEnd.toISOString(),
        meeting_data: { ...eventData.meeting_data, rescheduled: true, original_date: event.start, updated_at: new Date().toISOString() }
      }).eq('id', event.id);
      if (error) throw error;
      notifyAttendeesChange('rescheduled', { new_date: format(newStart, 'dd/MM/yyyy', { locale: ptBR }), new_time: `${rescheduleData.newStartTime} - ${rescheduleData.newEndTime}` });
      toast({ title: "Sucesso", description: "Reunião reagendada!" });
      setShowReschedule(false); onEventUpdate?.(); onClose();
    } catch (error: any) { toast({ title: "Erro", description: error.message, variant: "destructive" }); }
    finally { setIsLoading(false); }
  };

  const updateEventStatus = async (status: string, successMessage: string) => {
    if (!event?.id || !user) return;
    setIsLoading(true);
    try {
      const { error } = await supabase.from('calendar_events').update({
        meeting_data: { ...eventData.meeting_data, status, updated_at: new Date().toISOString() }
      }).eq('id', event.id);
      if (error) throw error;
      toast({ title: "Sucesso", description: successMessage });
      onEventUpdate?.(); onClose();
    } catch (error: any) { toast({ title: "Erro", description: error.message, variant: "destructive" }); }
    finally { setIsLoading(false); }
  };

  const handleAddParticipant = async () => {
    if (!newParticipantPhone.trim() || !event?.id) return;
    setIsAddingParticipant(true);
    try {
      const phone = newParticipantPhone.replace(/\D/g, '');
      const eventId = event.id || event.extendedProps?.id;
      const companyId = eventData.company_id;

      await supabase.from('meeting_rsvp').insert({
        event_id: eventId, company_id: companyId,
        attendee_phone: phone, attendee_name: newParticipantName || null,
        status: 'pending',
      });

      const currentAttendees = eventData.attendees || [];
      if (!currentAttendees.includes(phone)) {
        await supabase.from('calendar_events').update({
          attendees: [...currentAttendees, phone]
        }).eq('id', eventId);
      }

      const confirmMsg = `📋 *Convite de Reunião*\\n\\n*${event.title}*\\n📆 Data: ${startDateTime.date}\\n🕐 Horário: ${startDateTime.time} - ${endDateTime.time}\\n${meetingLink ? `🔗 Link da reunião: ${meetingLink}\\n` : ''}\\n📝 Confirme sua presença:\\nResponda *Sim* para confirmar ou *Não* para recusar.\\n\\n_Enviado via Ellosuit_`;
      await supabase.functions.invoke('notify-event-change', {
        body: { change_type: 'confirmation_request', event_title: event.title, event_date: startDateTime.date, event_time: `${startDateTime.time} - ${endDateTime.time}`, meeting_link: meetingLink || null, attendees: [phone], company_id: companyId, event_id: eventId, custom_message: confirmMsg }
      });

      toast({ title: "✅ Participante adicionado", description: `Convite enviado para ${newParticipantName || phone}` });
      setNewParticipantPhone(''); setNewParticipantName(''); setShowAddParticipant(false);
      fetchRsvpData(eventId);
      onEventUpdate?.();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message || "Falha ao adicionar", variant: "destructive" });
    } finally { setIsAddingParticipant(false); }
  };

  const handleRemoveParticipant = async (rsvpId: string, phone: string) => {
    try {
      const eventId = event.id || event.extendedProps?.id;
      await supabase.from('meeting_rsvp').delete().eq('id', rsvpId);
      
      const currentAttendees = eventData.attendees || [];
      const updated = currentAttendees.filter((a: string) => a !== phone);
      await supabase.from('calendar_events').update({ attendees: updated }).eq('id', eventId);

      toast({ title: "Participante removido" });
      fetchRsvpData(eventId);
      onEventUpdate?.();
    } catch { toast({ title: "Erro", description: "Falha ao remover", variant: "destructive" }); }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return 'Concluída';
      case 'postponed': return 'Adiada';
      case 'cancelled': return 'Cancelada';
      default: return 'Pendente';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-emerald-500/10 text-emerald-600 border-emerald-200';
      case 'postponed': return 'bg-amber-500/10 text-amber-600 border-amber-200';
      case 'cancelled': return 'bg-destructive/10 text-destructive border-destructive/20';
      default: return 'bg-primary/10 text-primary border-primary/20';
    }
  };

  const copyLink = () => {
    if (meetingLink) {
      navigator.clipboard.writeText(meetingLink);
      toast({ title: "Link copiado!" });
    }
  };

  const eventTypeLabel = eventData.event_type === 'meeting' ? 'Reunião' : eventData.event_type === 'appointment' ? 'Compromisso' : 'Lembrete';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[680px] max-h-[92vh] overflow-hidden p-0 rounded-3xl border-0 shadow-2xl bg-background gap-0 [&>button.absolute]:hidden">
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-primary/4 to-transparent" />
          <div className="relative px-6 pt-6 pb-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 pr-8">
                <h2 className="text-xl font-bold text-foreground leading-tight mb-2">
                  {event.title}
                </h2>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="rounded-full text-xs font-medium border-primary/30 text-primary bg-primary/5">
                    {eventTypeLabel}
                  </Badge>
                  <Badge variant="outline" className={`rounded-full text-xs font-medium ${eventStatus.color}`}>
                    <Clock className="h-3 w-3 mr-1" />
                    {eventStatus.text}
                  </Badge>
                  {editData.status && editData.status !== 'pending' && (
                    <Badge variant="outline" className={`rounded-full text-xs font-medium ${getStatusColor(editData.status)}`}>
                      {getStatusLabel(editData.status)}
                    </Badge>
                  )}
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full h-8 w-8 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-3 bg-muted/50 rounded-2xl p-3">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-primary" />
                <span className="font-medium text-foreground">{startDateTime.date}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-primary" />
                <span className="font-medium text-foreground">{startDateTime.time} - {endDateTime.time}</span>
              </div>
              {totalParticipants > 0 && (
                <div className="flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-primary" />
                  <span className="font-medium text-foreground">{totalParticipants}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6">
            <TabsList className="grid w-full grid-cols-4 h-11 rounded-2xl bg-muted/70 p-1">
              <TabsTrigger value="details" className="rounded-xl text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">
                Detalhes
              </TabsTrigger>
              <TabsTrigger value="participants" className="rounded-xl text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">
                Participantes
                {totalParticipants > 0 && (
                  <span className="ml-1 bg-primary/10 text-primary text-[10px] px-1.5 py-0.5 rounded-full">{totalParticipants}</span>
                )}
              </TabsTrigger>
              <TabsTrigger value="notes" className="rounded-xl text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">
                Anotações
              </TabsTrigger>
              <TabsTrigger value="actions" className="rounded-xl text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">
                Ações
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto px-6 pb-6">
            <TabsContent value="details" className="mt-4 space-y-4 focus-visible:outline-none">
              {isEditingDetails ? (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Título</label>
                    <Input value={editData.title} onChange={(e) => setEditData({...editData, title: e.target.value})} className="mt-1 rounded-xl" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Descrição</label>
                    <Textarea value={editData.description} onChange={(e) => setEditData({...editData, description: e.target.value})} rows={3} className="mt-1 rounded-xl resize-none" />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Data</label>
                      <Input type="date" value={rescheduleData.newDate || format(eventStartDate, 'yyyy-MM-dd')} onChange={(e) => setRescheduleData({...rescheduleData, newDate: e.target.value})} className="mt-1 rounded-xl" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Início</label>
                      <Input type="time" value={rescheduleData.newStartTime || format(eventStartDate, 'HH:mm')} onChange={(e) => setRescheduleData({...rescheduleData, newStartTime: e.target.value})} className="mt-1 rounded-xl" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fim</label>
                      <Input type="time" value={rescheduleData.newEndTime || format(eventEndDate, 'HH:mm')} onChange={(e) => setRescheduleData({...rescheduleData, newEndTime: e.target.value})} className="mt-1 rounded-xl" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleSaveDetails} disabled={isLoading} className="flex-1 rounded-xl">
                      <Save className="h-4 w-4 mr-2" />{isLoading ? 'Salvando...' : 'Salvar'}
                    </Button>
                    <Button variant="outline" onClick={() => setIsEditingDetails(false)} className="rounded-xl">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </motion.div>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-end">
                    <Button variant="ghost" size="sm" onClick={() => setIsEditingDetails(true)} className="rounded-xl text-xs text-muted-foreground hover:text-foreground">
                      <Edit3 className="h-3.5 w-3.5 mr-1" /> Editar
                    </Button>
                  </div>

                  {eventData.description && (
                    <div className="bg-muted/40 rounded-2xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Descrição</span>
                      </div>
                      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{eventData.description}</p>
                    </div>
                  )}

                  {meetingLink && (
                    <div className="bg-primary/5 rounded-2xl p-4 border border-primary/10">
                      <div className="flex items-center gap-2 mb-2">
                        <Video className="h-4 w-4 text-primary" />
                        <span className="text-xs font-semibold text-primary uppercase tracking-wider">Link da Reunião</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-primary font-medium truncate flex-1">{meetingLink}</p>
                        <Button size="sm" variant="ghost" onClick={copyLink} className="rounded-xl h-8 px-2">
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" onClick={() => window.open(meetingLink, '_blank')} disabled={eventStatus.status === 'past'} className="rounded-xl h-8 px-3 text-xs">
                          <ExternalLink className="h-3.5 w-3.5 mr-1" /> Abrir
                        </Button>
                      </div>
                    </div>
                  )}

                  {editData.recording_link && (
                    <div className="bg-muted/40 rounded-2xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Video className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Gravação</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-primary truncate flex-1">{editData.recording_link}</p>
                        <Button size="sm" variant="outline" onClick={() => window.open(editData.recording_link, '_blank')} className="rounded-xl h-8 px-3 text-xs">
                          <ExternalLink className="h-3.5 w-3.5 mr-1" /> Assistir
                        </Button>
                      </div>
                    </div>
                  )}

                  {rescheduleRequests.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Bell className="h-4 w-4 text-amber-500" />
                        <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider">
                          Solicitações de Remarcação ({rescheduleRequests.filter(r => r.status === 'reschedule_proposed').length} pendente(s))
                        </span>
                      </div>
                      {rescheduleRequests.map((req) => (
                        <motion.div key={req.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                          className={`rounded-2xl p-4 border ${
                            req.status === 'reschedule_proposed' ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800' :
                            req.status === 'cancelled' ? 'bg-destructive/5 border-destructive/20' : 'bg-muted/40 border-border'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-semibold text-foreground">{req.attendee_name || req.attendee_phone}</span>
                            <Badge variant="outline" className={`rounded-full text-[10px] ${
                              req.status === 'reschedule_proposed' ? 'border-amber-300 text-amber-700 bg-amber-100' :
                              req.status === 'cancelled' ? 'border-destructive/30 text-destructive bg-destructive/10' :
                              'border-primary/30 text-primary bg-primary/10'
                            }`}>
                              {req.status === 'reschedule_proposed' && '📅 Quer remarcar'}
                              {req.status === 'cancelled' && '❌ Cancelou'}
                              {req.status === 'awaiting_response' && '⏳ Aguardando'}
                            </Badge>
                          </div>
                          {req.ai_interpretation && <p className="text-sm text-muted-foreground italic mb-1">"{req.ai_interpretation}"</p>}
                          {req.suggested_text && <p className="text-xs text-muted-foreground mb-2">Mensagem: "{req.suggested_text}"</p>}
                          {req.ai_interpreted_date && (
                            <p className="text-sm font-semibold text-foreground mb-2">
                              📆 {new Date(req.ai_interpreted_date).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}
                            </p>
                          )}
                          {req.status === 'reschedule_proposed' && (
                            <div className="flex gap-2 mt-3">
                              <Button size="sm" className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white" disabled={respondingTo === req.id} onClick={() => handleRescheduleResponse(req.id, 'confirm')}>
                                {respondingTo === req.id ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />} Confirmar
                              </Button>
                              <Button size="sm" variant="outline" className="rounded-xl border-destructive/30 text-destructive hover:bg-destructive/5" disabled={respondingTo === req.id} onClick={() => handleRescheduleResponse(req.id, 'deny')}>
                                <X className="h-3 w-3 mr-1" /> Negar
                              </Button>
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="participants" className="mt-4 space-y-4 focus-visible:outline-none">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-emerald-500/10 rounded-2xl p-3 text-center border border-emerald-200/50">
                  <p className="text-2xl font-bold text-emerald-600">{confirmedCount}</p>
                  <p className="text-[10px] font-medium text-emerald-600/70 uppercase tracking-wider">Confirmados</p>
                </div>
                <div className="bg-amber-500/10 rounded-2xl p-3 text-center border border-amber-200/50">
                  <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
                  <p className="text-[10px] font-medium text-amber-600/70 uppercase tracking-wider">Pendentes</p>
                </div>
                <div className="bg-destructive/10 rounded-2xl p-3 text-center border border-destructive/20">
                  <p className="text-2xl font-bold text-destructive">{declinedCount}</p>
                  <p className="text-[10px] font-medium text-destructive/70 uppercase tracking-wider">Recusados</p>
                </div>
              </div>

              <AnimatePresence>
                {showAddParticipant ? (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    className="bg-primary/5 rounded-2xl p-4 border border-primary/10 space-y-3"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <UserPlus className="h-4 w-4 text-primary" />
                      <span className="text-xs font-semibold text-primary uppercase tracking-wider">Novo Participante</span>
                    </div>
                    <Input placeholder="Nome (opcional)" value={newParticipantName} onChange={(e) => setNewParticipantName(e.target.value)} className="rounded-xl" />
                    <Input placeholder="Telefone (WhatsApp)" value={newParticipantPhone} onChange={(e) => setNewParticipantPhone(e.target.value)} className="rounded-xl" />
                    <div className="flex gap-2">
                      <Button onClick={handleAddParticipant} disabled={!newParticipantPhone.trim() || isAddingParticipant} className="flex-1 rounded-xl" size="sm">
                        {isAddingParticipant ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : <Send className="h-3 w-3 mr-1" />}
                        Convidar
                      </Button>
                      <Button variant="ghost" onClick={() => setShowAddParticipant(false)} className="rounded-xl" size="sm">
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </motion.div>
                ) : (
                  <Button variant="outline" onClick={() => setShowAddParticipant(true)} className="w-full rounded-2xl border-dashed border-2 h-12 text-muted-foreground hover:text-primary hover:border-primary/30">
                    <UserPlus className="h-4 w-4 mr-2" /> Adicionar Participante
                  </Button>
                )}
              </AnimatePresence>

              <div className="space-y-2">
                {rsvpList.length > 0 ? rsvpList.map((rsvp) => (
                  <motion.div key={rsvp.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className={`flex items-center justify-between p-3 rounded-2xl border transition-colors ${
                      rsvp.status === 'confirmed' ? 'bg-emerald-500/5 border-emerald-200/50' :
                      rsvp.status === 'declined' ? 'bg-destructive/5 border-destructive/20' :
                      'bg-muted/30 border-border'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${
                        rsvp.status === 'confirmed' ? 'bg-emerald-500/15 text-emerald-600' :
                        rsvp.status === 'declined' ? 'bg-destructive/15 text-destructive' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {(rsvp.attendee_name || rsvp.attendee_phone || '?')[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{rsvp.attendee_name || rsvp.attendee_phone}</p>
                        {rsvp.attendee_name && rsvp.attendee_phone && (
                          <p className="text-[11px] text-muted-foreground">{rsvp.attendee_phone}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className={`rounded-full text-[10px] ${
                        rsvp.status === 'confirmed' ? 'border-emerald-300 text-emerald-700 bg-emerald-100' :
                        rsvp.status === 'declined' ? 'border-destructive/30 text-destructive bg-destructive/10' :
                        rsvp.status === 'reminded' ? 'border-amber-300 text-amber-700 bg-amber-100' :
                        'border-border text-muted-foreground bg-muted'
                      }`}>
                        {rsvp.status === 'confirmed' && <><CheckCircle className="h-2.5 w-2.5 mr-0.5" /> Confirmado</>}
                        {rsvp.status === 'declined' && <><XCircle className="h-2.5 w-2.5 mr-0.5" /> Recusado</>}
                        {rsvp.status === 'reminded' && <><HelpCircle className="h-2.5 w-2.5 mr-0.5" /> Lembrado</>}
                        {rsvp.status === 'pending' && <><HelpCircle className="h-2.5 w-2.5 mr-0.5" /> Pendente</>}
                      </Badge>
                      {rsvp.attendee_phone && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" disabled={sendingRsvpFor === rsvp.id} onClick={() => handleRequestConfirmation(rsvp)} title="Reenviar convite">
                          {sendingRsvpFor === rsvp.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-destructive/60 hover:text-destructive hover:bg-destructive/10" onClick={() => handleRemoveParticipant(rsvp.id, rsvp.attendee_phone)} title="Remover participante">
                        <UserMinus className="h-3 w-3" />
                      </Button>
                    </div>
                  </motion.div>
                )) : attendees.length > 0 ? attendees.map((att: string, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-2xl bg-muted/30 border border-border">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground">{att[0]}</div>
                      <span className="text-sm font-medium text-foreground">{att}</span>
                    </div>
                    <Badge variant="outline" className="rounded-full text-[10px] border-border text-muted-foreground">Sem RSVP</Badge>
                  </div>
                )) : (
                  <div className="text-center py-8">
                    <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Nenhum participante adicionado</p>
                    <p className="text-xs text-muted-foreground/60">Clique no botão acima para convidar</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="notes" className="mt-4 space-y-4 focus-visible:outline-none">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Anotações</span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setIsEditing(!isEditing)} className="rounded-xl text-xs">
                  {isEditing ? <X className="h-3.5 w-3.5 mr-1" /> : <Edit3 className="h-3.5 w-3.5 mr-1" />}
                  {isEditing ? 'Cancelar' : 'Editar'}
                </Button>
              </div>

              {isEditing ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                  <Textarea value={editData.notes} onChange={(e) => setEditData({...editData, notes: e.target.value})} rows={5} placeholder="Suas anotações..." className="rounded-xl resize-none" />
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Link da Gravação</label>
                    <Input value={editData.recording_link} onChange={(e) => setEditData({...editData, recording_link: e.target.value})} placeholder="https://..." className="mt-1 rounded-xl" />
                  </div>
                  <Button onClick={handleSaveNotes} disabled={isLoading} className="w-full rounded-xl">
                    <Save className="h-4 w-4 mr-2" />{isLoading ? 'Salvando...' : 'Salvar'}
                  </Button>
                </motion.div>
              ) : (
                <div className="bg-muted/40 rounded-2xl p-5 min-h-[120px]">
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                    {editData.notes || <span className="text-muted-foreground italic">Nenhuma anotação. Clique em "Editar" para adicionar.</span>}
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="actions" className="mt-4 space-y-4 focus-visible:outline-none">
              {showReschedule ? (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-primary/5 rounded-2xl p-5 border border-primary/10 space-y-4">
                  <h4 className="font-semibold text-foreground flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-primary" /> Reagendar Reunião
                  </h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Data</label>
                      <Input type="date" value={rescheduleData.newDate} onChange={(e) => setRescheduleData({...rescheduleData, newDate: e.target.value})} min={format(new Date(), 'yyyy-MM-dd')} className="mt-1 rounded-xl" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Início</label>
                      <Input type="time" value={rescheduleData.newStartTime} onChange={(e) => setRescheduleData({...rescheduleData, newStartTime: e.target.value})} className="mt-1 rounded-xl" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fim</label>
                      <Input type="time" value={rescheduleData.newEndTime} onChange={(e) => setRescheduleData({...rescheduleData, newEndTime: e.target.value})} className="mt-1 rounded-xl" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleRescheduleEvent} disabled={isLoading || !rescheduleData.newDate || !rescheduleData.newStartTime || !rescheduleData.newEndTime} className="flex-1 rounded-xl">
                      <CalendarIcon className="h-4 w-4 mr-2" /> Confirmar
                    </Button>
                    <Button variant="outline" onClick={() => setShowReschedule(false)} className="rounded-xl">Cancelar</Button>
                  </div>
                </motion.div>
              ) : showDeleteConfirm ? (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-destructive/5 rounded-2xl p-5 border border-destructive/20 space-y-4">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-destructive" />
                    <h4 className="font-semibold text-destructive">Confirmar Exclusão</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">Esta ação não pode ser desfeita. O evento será removido permanentemente.</p>
                  <div className="flex gap-2">
                    <Button onClick={handleDeleteEvent} disabled={isLoading} variant="destructive" className="flex-1 rounded-xl">
                      <Trash2 className="h-4 w-4 mr-2" />{isLoading ? 'Excluindo...' : 'Excluir'}
                    </Button>
                    <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} className="rounded-xl">Cancelar</Button>
                  </div>
                </motion.div>
              ) : (
                <div className="space-y-2">
                  {canReschedule && (
                    <Button variant="outline" onClick={() => setShowReschedule(true)} className="w-full justify-start rounded-2xl h-12 text-foreground hover:bg-primary/5 hover:border-primary/20">
                      <CalendarIcon className="h-4 w-4 mr-3 text-primary" /> Reagendar Reunião
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => { updateEventStatus('completed', 'Reunião concluída'); notifyAttendeesChange('completed'); }} disabled={isLoading} className="w-full justify-start rounded-2xl h-12 text-foreground hover:bg-emerald-500/5 hover:border-emerald-200">
                    <Check className="h-4 w-4 mr-3 text-emerald-600" /> Marcar como Concluída
                  </Button>
                  <Button variant="outline" onClick={() => updateEventStatus('postponed', 'Reunião adiada')} disabled={isLoading} className="w-full justify-start rounded-2xl h-12 text-foreground hover:bg-amber-500/5 hover:border-amber-200">
                    <Pause className="h-4 w-4 mr-3 text-amber-600" /> Marcar como Adiada
                  </Button>
                  <Button variant="outline" onClick={() => { setActiveTab('notes'); setIsEditing(true); }} className="w-full justify-start rounded-2xl h-12 text-foreground hover:bg-muted">
                    <Link className="h-4 w-4 mr-3 text-muted-foreground" /> Adicionar Gravação
                  </Button>
                  <div className="pt-2">
                    <Button variant="outline" onClick={() => setShowDeleteConfirm(true)} className="w-full justify-start rounded-2xl h-12 text-destructive border-destructive/20 hover:bg-destructive/5 hover:border-destructive/30">
                      <Trash2 className="h-4 w-4 mr-3" /> Excluir Evento
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>

        {meetingLink && eventStatus.status === 'ongoing' && (
          <div className="px-6 pb-5 pt-2 border-t border-border/50">
            <Button onClick={() => window.open(meetingLink, '_blank')} className="w-full rounded-2xl h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm shadow-lg shadow-primary/20">
              <Video className="h-4 w-4 mr-2" /> Entrar na Reunião
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default EnhancedEventDetailsModal;
