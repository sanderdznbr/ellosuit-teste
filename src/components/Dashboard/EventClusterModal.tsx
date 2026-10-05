
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Video, Users, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface EventClusterModalProps {
  isOpen: boolean;
  onClose: () => void;
  events: any[];
  date: string;
  onEventClick: (event: any) => void;
}

const EventClusterModal: React.FC<EventClusterModalProps> = ({
  isOpen,
  onClose,
  events,
  date,
  onEventClick
}) => {
  const getEventColor = (eventType: string) => {
    const colors: Record<string, string> = {
      'meeting': '#007DE3',
      'appointment': '#10B981',
      'reminder': '#F59E0B',
      'task': '#EF4444',
      'google_meet': '#4285F4'
    };
    return colors[eventType] || '#6B7280';
  };

  const getTypeLabel = (eventType: string) => {
    const labels: Record<string, string> = {
      'meeting': 'Reunião',
      'appointment': 'Compromisso',
      'reminder': 'Lembrete',
      'task': 'Tarefa',
      'google_meet': 'Google Meet'
    };
    return labels[eventType] || 'Evento';
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "EEEE, d 'de' MMMM", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  const sortedEvents = [...events].sort((a, b) => 
    new Date(a.start).getTime() - new Date(b.start).getTime()
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-sm mx-auto max-h-[80vh] overflow-hidden flex flex-col p-0 gap-0 rounded-2xl">
        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-border bg-muted/30">
          <DialogHeader className="space-y-1">
            <DialogTitle className="flex items-center gap-2 text-base">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <Calendar className="h-4 w-4 text-primary" />
              </div>
              <span>{sortedEvents.length} eventos</span>
            </DialogTitle>
            <p className="text-xs text-muted-foreground capitalize pl-9">
              {date && formatDate(date)}
            </p>
          </DialogHeader>
        </div>

        {/* Event List */}
        <div className="overflow-y-auto flex-1 px-3 py-3 space-y-2">
          {sortedEvents.map((event) => {
            const color = getEventColor(event.extendedProps?.event_type);
            return (
              <button
                key={event.id}
                className="w-full text-left rounded-xl border border-border bg-card p-3 cursor-pointer transition-all hover:shadow-md hover:border-primary/20 hover:bg-accent/50 active:scale-[0.98] flex items-start gap-3 group"
                onClick={() => onEventClick(event)}
              >
                {/* Color bar */}
                <div
                  className="w-1 rounded-full self-stretch shrink-0 mt-0.5"
                  style={{ backgroundColor: color }}
                />

                <div className="flex-1 min-w-0 space-y-1.5">
                  {/* Title + time */}
                  <div>
                    <h3 className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                      {event.title}
                    </h3>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {formatTime(event.start)}
                        {event.end && ` – ${formatTime(event.end)}`}
                      </span>
                    </div>
                  </div>

                  {/* Tags row */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge
                      variant="secondary"
                      className="text-[10px] px-1.5 py-0 h-5 font-medium"
                      style={{ backgroundColor: `${color}15`, color }}
                    >
                      {getTypeLabel(event.extendedProps?.event_type)}
                    </Badge>

                    {event.extendedProps?.meeting_link && (
                      <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                        <Video className="h-3 w-3" />
                        <span>Online</span>
                      </div>
                    )}

                    {event.extendedProps?.attendees?.length > 0 && (
                      <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                        <Users className="h-3 w-3" />
                        <span>{event.extendedProps.attendees.length}</span>
                      </div>
                    )}

                    {event.extendedProps?.source === 'google' && (
                      <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        <span>Google</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Arrow */}
                <svg className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary shrink-0 mt-1 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EventClusterModal;
