
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, MapPin, Users, Video, ExternalLink, AlertCircle } from 'lucide-react';
import { sanitizeMeetingUrl, isAllowedMeetingUrl } from '@/config/app';

interface EventDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: any;
}

const EventDetailsModal: React.FC<EventDetailsModalProps> = ({
  isOpen,
  onClose,
  event
}) => {
  if (!event) return null;

  // Função para calcular tempo restante/status do evento
  const getEventStatus = () => {
    const now = new Date();
    const startDate = new Date(event.start);
    const endDate = new Date(event.end);
    
    if (now < startDate) {
      // Evento futuro
      const diffMs = startDate.getTime() - now.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      
      let timeText = '';
      if (diffDays > 0) {
        timeText = `Em ${diffDays} dia${diffDays > 1 ? 's' : ''}`;
      } else if (diffHours > 0) {
        timeText = `Em ${diffHours}h ${diffMinutes}min`;
      } else {
        timeText = `Em ${diffMinutes} minuto${diffMinutes > 1 ? 's' : ''}`;
      }
      
      return {
        status: 'upcoming',
        color: 'bg-[#DFE4FB] text-[#1A2551]',
        icon: Clock,
        text: timeText
      };
    } else if (now >= startDate && now <= endDate) {
      // Evento em andamento
      return {
        status: 'ongoing',
        color: 'bg-green-100 text-green-800',
        icon: Clock,
        text: 'Em andamento'
      };
    } else {
      // Evento passado
      const diffMs = now.getTime() - endDate.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      
      let timeText = '';
      if (diffDays > 0) {
        timeText = `Há ${diffDays} dia${diffDays > 1 ? 's' : ''}`;
      } else if (diffHours > 0) {
        timeText = `Há ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
      } else {
        timeText = 'Há poucos minutos';
      }
      
      return {
        status: 'past',
        color: 'bg-gray-100 text-gray-800',
        icon: AlertCircle,
        text: timeText
      };
    }
  };

  const eventStatus = getEventStatus();
  const StatusIcon = eventStatus.icon;

  // Formatação de data e hora
  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return {
      date: date.toLocaleDateString('pt-BR'),
      time: date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };
  };

  const startDateTime = formatDateTime(event.start);
  const endDateTime = formatDateTime(event.end);

  // Extrair dados do evento
  const eventData = event.extendedProps || {};
  // Sanitiza links legados/preview para o domínio canônico antes de exibir.
  let meetingLink: string | null = null;
  try {
    const safe = sanitizeMeetingUrl(eventData.meeting_link);
    meetingLink = safe && isAllowedMeetingUrl(safe) ? safe : null;
  } catch {
    meetingLink = null;
  }
  const eventType = eventData.event_type || 'meeting';
  const attendees = eventData.attendees || [];

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'meeting':
        return 'bg-[#DFE4FB] text-[#1A2551]';
      case 'appointment':
        return 'bg-purple-100 text-purple-800';
      case 'reminder':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getEventTypeLabel = (type: string) => {
    switch (type) {
      case 'meeting':
        return 'Reunião';
      case 'appointment':
        return 'Compromisso';
      case 'reminder':
        return 'Lembrete';
      default:
        return 'Evento';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] bg-white rounded-2xl shadow-2xl border-0">
        <DialogHeader className="pb-6 border-b border-gray-100">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <DialogTitle className="text-xl font-semibold text-gray-900 pr-8">
                {event.title}
              </DialogTitle>
              <div className="flex items-center space-x-2">
                <Badge className={getEventTypeColor(eventType)}>
                  {getEventTypeLabel(eventType)}
                </Badge>
                <Badge className={eventStatus.color}>
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {eventStatus.text}
                </Badge>
              </div>
            </div>
          </div>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Data e Hora */}
          <div className="flex items-start space-x-3">
            <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
            <div>
              <p className="font-medium text-gray-900">Data e Horário</p>
              <p className="text-sm text-gray-600">
                {startDateTime.date} das {startDateTime.time} às {endDateTime.time}
              </p>
              {startDateTime.date !== endDateTime.date && (
                <p className="text-sm text-gray-500">
                  Termina em {endDateTime.date}
                </p>
              )}
            </div>
          </div>

          {/* Descrição */}
          {eventData.description && (
            <div className="flex items-start space-x-3">
              <div className="h-5 w-5 flex items-center justify-center mt-0.5">
                <div className="h-2 w-2 bg-gray-400 rounded-full"></div>
              </div>
              <div>
                <p className="font-medium text-gray-900">Descrição</p>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">
                  {eventData.description}
                </p>
              </div>
            </div>
          )}

          {/* Link da Reunião */}
          {meetingLink && (
            <div className="flex items-start space-x-3">
              <Video className="h-5 w-5 text-gray-400 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-gray-900">Link da Reunião</p>
                <div className="flex items-center space-x-2 mt-1">
                  <p className="text-sm text-[#2F428D] break-all">{meetingLink}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(meetingLink, '_blank')}
                    className="h-8 px-3 text-xs"
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Abrir
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Participantes */}
          {attendees.length > 0 && (
            <div className="flex items-start space-x-3">
              <Users className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900">Participantes</p>
                <div className="space-y-1 mt-1">
                  {attendees.map((attendee: any, index: number) => (
                    <p key={index} className="text-sm text-gray-600">
                      {attendee.displayName ? `${attendee.displayName} (${attendee.email})` : attendee.email}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Contador Regressivo para Eventos Próximos */}
          {eventStatus.status === 'upcoming' && (
            <div className="bg-[#F0F2FE] border border-[#B3BFF0] rounded-xl p-4">
              <div className="flex items-center space-x-3">
                <Clock className="h-5 w-5 text-[#2F428D]" />
                <div>
                  <p className="font-medium text-[#0F1631]">Evento Próximo</p>
                  <p className="text-sm text-[#253573]">{eventStatus.text}</p>
                </div>
              </div>
            </div>
          )}

          {/* Evento em Andamento */}
          {eventStatus.status === 'ongoing' && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <div>
                  <p className="font-medium text-green-900">Evento em Andamento</p>
                  <p className="text-sm text-green-700">Este evento está acontecendo agora</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-3 pt-6 border-t border-gray-100">
          <Button 
            variant="outline" 
            onClick={onClose}
            className="rounded-xl"
          >
            Fechar
          </Button>
          {meetingLink && eventStatus.status !== 'past' && (
            <Button 
              onClick={() => window.open(meetingLink, '_blank')}
              className="rounded-xl bg-[#3600FF] hover:bg-[#3600FF]/90"
            >
              <Video className="h-4 w-4 mr-2" />
              Entrar na Reunião
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EventDetailsModal;
