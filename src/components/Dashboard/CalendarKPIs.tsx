import React, { useMemo } from 'react';
import { CalendarDays, Clock, CalendarCheck, TrendingUp, Users, Video, Bell } from 'lucide-react';
import { format, isToday, isThisWeek, isThisMonth, isFuture, differenceInMinutes, startOfDay, endOfDay, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CalendarEvent {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  event_type: string;
  status?: string;
  description?: string;
  meeting_link?: string;
  attendees?: string[];
}

interface CalendarKPIsProps {
  events: CalendarEvent[];
}

const FLOW_COLOR = "#4D7CFF";

const CalendarKPIs = ({ events }: CalendarKPIsProps) => {
  const stats = useMemo(() => {
    const now = new Date();

    const todayEvents = events.filter(e => {
      const d = new Date(e.start_date);
      return isToday(d);
    });

    const weekEvents = events.filter(e => {
      const d = new Date(e.start_date);
      return isThisWeek(d, { weekStartsOn: 1 });
    });

    const monthEvents = events.filter(e => {
      const d = new Date(e.start_date);
      return isThisMonth(d);
    });

    // Next upcoming event
    const futureEvents = events
      .filter(e => new Date(e.start_date) > now)
      .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());

    const nextEvent = futureEvents[0] || null;

    // Time until next event
    let timeUntilNext = '';
    if (nextEvent) {
      const mins = differenceInMinutes(new Date(nextEvent.start_date), now);
      if (mins < 60) {
        timeUntilNext = `em ${mins}min`;
      } else if (mins < 1440) {
        const hours = Math.floor(mins / 60);
        timeUntilNext = `em ${hours}h`;
      } else {
        const days = Math.floor(mins / 1440);
        timeUntilNext = `em ${days} dia${days > 1 ? 's' : ''}`;
      }
    }

    // Events by type
    const meetings = monthEvents.filter(e => e.event_type === 'meeting').length;
    const appointments = monthEvents.filter(e => e.event_type === 'appointment').length;
    const reminders = monthEvents.filter(e => e.event_type === 'reminder').length;

    // Tomorrow events
    const tomorrow = addDays(startOfDay(now), 1);
    const tomorrowEnd = endOfDay(tomorrow);
    const tomorrowEvents = events.filter(e => {
      const d = new Date(e.start_date);
      return d >= tomorrow && d <= tomorrowEnd;
    });

    return {
      today: todayEvents.length,
      week: weekEvents.length,
      month: monthEvents.length,
      nextEvent,
      timeUntilNext,
      meetings,
      appointments,
      reminders,
      tomorrowCount: tomorrowEvents.length,
    };
  }, [events]);

  const kpiCards = [
    {
      label: 'Hoje',
      value: stats.today,
      icon: CalendarDays,
      color: FLOW_COLOR,
      bg: `${FLOW_COLOR}12`,
    },
    {
      label: 'Esta Semana',
      value: stats.week,
      icon: CalendarCheck,
      color: '#10B981',
      bg: '#10B98112',
    },
    {
      label: 'Este Mês',
      value: stats.month,
      icon: TrendingUp,
      color: '#8B5CF6',
      bg: '#8B5CF612',
    },
    {
      label: 'Amanhã',
      value: stats.tomorrowCount,
      icon: Clock,
      color: '#F59E0B',
      bg: '#F59E0B12',
    },
  ];

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpiCards.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className="bg-card rounded-2xl border border-border p-4 flex items-center gap-3 transition-shadow hover:shadow-md"
            >
              <div
                className="p-2.5 rounded-xl shrink-0"
                style={{ backgroundColor: kpi.bg }}
              >
                <Icon className="h-5 w-5" style={{ color: kpi.color }} />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold text-foreground leading-none">{kpi.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{kpi.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Next Event + Summary Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Next Event */}
        <div className="md:col-span-2 bg-card rounded-2xl border border-border p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Próximo Compromisso</p>
          {stats.nextEvent ? (
            <div className="flex items-start gap-3">
              <div
                className="mt-0.5 w-1 h-10 rounded-full shrink-0"
                style={{ backgroundColor: FLOW_COLOR }}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground truncate">{stats.nextEvent.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {format(new Date(stats.nextEvent.start_date), "EEEE, d 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                </p>
                {stats.nextEvent.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{stats.nextEvent.description}</p>
                )}
              </div>
              <span
                className="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0"
                style={{ backgroundColor: `${FLOW_COLOR}15`, color: FLOW_COLOR }}
              >
                {stats.timeUntilNext}
              </span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum compromisso agendado</p>
          )}
        </div>

        {/* Monthly Breakdown */}
        <div className="bg-card rounded-2xl border border-border p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Resumo do Mês</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Video className="h-3.5 w-3.5" style={{ color: FLOW_COLOR }} />
                <span className="text-xs text-muted-foreground">Reuniões</span>
              </div>
              <span className="text-sm font-semibold text-foreground">{stats.meetings}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-xs text-muted-foreground">Compromissos</span>
              </div>
              <span className="text-sm font-semibold text-foreground">{stats.appointments}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-xs text-muted-foreground">Lembretes</span>
              </div>
              <span className="text-sm font-semibold text-foreground">{stats.reminders}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarKPIs;
