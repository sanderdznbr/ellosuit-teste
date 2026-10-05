
import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Video, Calendar, Bell, X, ArrowRight } from 'lucide-react';

interface EventTypeSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectType: (type: 'meeting' | 'appointment' | 'reminder') => void;
  selectedDate: string;
}

const EventTypeSelector: React.FC<EventTypeSelectorProps> = ({
  isOpen,
  onClose,
  onSelectType,
  selectedDate,
}) => {
  const formattedDate = selectedDate
    ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })
    : '';

  const eventTypes = [
    {
      type: 'meeting' as const,
      title: 'Reunião Online',
      description: 'Videochamada com link automático',
      icon: Video,
      gradient: 'from-[#4D7CFF] to-[#374DA4]',
      ring: 'group-hover:ring-[#4D7CFF]/40',
      glow: 'group-hover:shadow-[#4D7CFF]/30',
    },
    {
      type: 'appointment' as const,
      title: 'Compromisso',
      description: 'Encontro presencial ou pessoal',
      icon: Calendar,
      gradient: 'from-emerald-400 to-emerald-600',
      ring: 'group-hover:ring-emerald-400/40',
      glow: 'group-hover:shadow-emerald-500/30',
    },
    {
      type: 'reminder' as const,
      title: 'Lembrete',
      description: 'Alerta rápido no seu dia',
      icon: Bell,
      gradient: 'from-amber-400 to-amber-600',
      ring: 'group-hover:ring-amber-400/40',
      glow: 'group-hover:shadow-amber-500/30',
    },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-3xl p-0 border-none shadow-2xl rounded-[28px] overflow-hidden bg-background">
        {/* Decorative gradient header */}
        <div className="relative px-8 pt-8 pb-6 bg-gradient-to-br from-primary/10 via-background to-background">
          <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-10 w-56 h-56 rounded-full bg-[#4D7CFF]/10 blur-3xl pointer-events-none" />

          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted/60 transition-all hover:scale-110 z-10"
            aria-label="Fechar"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>

          <div className="relative">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-semibold tracking-wider text-primary bg-primary/10 ring-1 ring-primary/20 uppercase">
              Novo evento
            </span>
            <h2 className="mt-3 text-2xl md:text-3xl font-bold text-foreground tracking-tight">
              O que você quer agendar?
            </h2>
            {formattedDate && (
              <p className="mt-1 text-sm text-muted-foreground capitalize">
                {formattedDate}
              </p>
            )}
          </div>
        </div>

        {/* Options */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-6 md:px-8 pb-8 pt-2">
          {eventTypes.map((eventType) => {
            const Icon = eventType.icon;
            return (
              <button
                key={eventType.type}
                onClick={() => onSelectType(eventType.type)}
                className={`group relative flex flex-col items-start text-left p-5 rounded-2xl bg-background ring-1 ring-border ${eventType.ring} hover:ring-2 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${eventType.glow} focus:outline-none focus:ring-2 focus:ring-primary/40`}
              >
                <div
                  className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${eventType.gradient} flex items-center justify-center shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}
                >
                  <Icon className="h-6 w-6 text-white" strokeWidth={2} />
                </div>

                <h3 className="mt-4 text-[15px] font-semibold text-foreground">
                  {eventType.title}
                </h3>
                <p className="mt-1 text-[12px] text-muted-foreground leading-relaxed">
                  {eventType.description}
                </p>

                <div className="mt-4 inline-flex items-center gap-1 text-[12px] font-semibold text-primary opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                  Escolher
                  <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EventTypeSelector;
