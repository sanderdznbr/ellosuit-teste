import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import ptBrLocale from '@fullcalendar/core/locales/pt-br';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Video, Calendar, ChevronLeft, ChevronRight, MoreHorizontal, Link2, LayoutGrid, List, Plug } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

import { useToast } from '@/hooks/use-toast';

import AppointmentModal from './AppointmentModal';
import ReminderModal from './ReminderModal';
import EnhancedEventDetailsModal from './EnhancedEventDetailsModal';
import EventTypeSelector from './EventTypeSelector';
import EventClusterModal from './EventClusterModal';
import CalendarSkeleton from './CalendarSkeleton';
import BulkDeleteModal from './BulkDeleteModal';
import CalendarIntegrationsModal from './CalendarIntegrationsModal';
import { useCalendarData } from '@/hooks/useCalendarData';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';
import { useRealtimeGoogleSync } from '@/hooks/useRealtimeGoogleSync';
import { RecurrenceConfig } from './RecurrenceSelector';
import './calendar-styles.css';

interface MyCalendarProps {
  onNavigate?: (page: string) => void;
}

const FLOW_COLOR = "#4D7CFF";
const KOMMO_BLUE = "#2E7CF6";

const MyCalendar = ({ onNavigate }: MyCalendarProps) => {
  const navigate = useNavigate();
  const [showEventModal, setShowEventModal] = useState(false);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [showClusterModal, setShowClusterModal] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showIntegrationsModal, setShowIntegrationsModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [clusterEvents, setClusterEvents] = useState<any[]>([]);
  const [currentView, setCurrentView] = useState('dayGridMonth');
  const [currentTitle, setCurrentTitle] = useState('');
  const [selectedRange, setSelectedRange] = useState<{ start: string; end: string } | null>(null);
  const calendarRef = useRef<any>(null);

  const { events, loading, createEvent, bulkDeleteEvents, refreshEvents } = useCalendarData();
  const { isConnected, connectGoogle, loading: googleLoading } = useGoogleCalendar();
  const { lastSyncTime } = useRealtimeGoogleSync();
  const { toast } = useToast();

  const handleDateClick = (arg: any) => {
    setSelectedDate(arg.dateStr);
    setSelectedRange(null);
    setShowTypeSelector(true);
  };

  const handleDateSelect = (selectInfo: any) => {
    const start = selectInfo.start;
    const end = selectInfo.end;
    if (start.getTime() !== end.getTime()) {
      setSelectedRange({ start: start.toISOString(), end: end.toISOString() });
      setSelectedDate(start.toISOString().split('T')[0]);
      setShowEventModal(true);
    }
  };

  const handleEventClick = (clickInfo: any) => {
    const eventData = clickInfo.event;
    setSelectedEvent({
      id: eventData.id, title: eventData.title,
      start: eventData.start, end: eventData.end,
      extendedProps: eventData.extendedProps
    });
    setShowDetailsModal(true);
  };

  const handleMoreClick = (info: any) => {
    info.jsEvent?.preventDefault?.();
    const dayEvents = info.allSegs.map((seg: any) => ({
      id: seg.event.id, title: seg.event.title,
      start: seg.event.start, end: seg.event.end,
      extendedProps: seg.event.extendedProps
    }));
    setClusterEvents(dayEvents);
    setSelectedDate(info.date.toISOString().split('T')[0]);
    setShowClusterModal(true);
    return 'popover';
  };

  const handleTypeSelect = (type: 'meeting' | 'appointment' | 'reminder') => {
    setShowTypeSelector(false);
    if (type === 'meeting') {
      const params = new URLSearchParams();
      if (selectedDate) params.set('date', selectedDate);
      if (selectedRange) {
        params.set('start', selectedRange.start);
        params.set('end', selectedRange.end);
      }
      navigate(`/dashboard/agenda/nova-reuniao?${params.toString()}`);
    }
    else if (type === 'appointment') setShowAppointmentModal(true);
    else if (type === 'reminder') setShowReminderModal(true);
  };

  const handleCreateEvent = async (eventData: any, recurrence?: RecurrenceConfig) => {
    try {
      const result = await createEvent(eventData, recurrence);
      await refreshEvents();
      handleCloseAllModals();
      return result;
    } catch (error) {
      console.error('Error creating event:', error);
    }
  };

  const handleBulkDelete = async (eventIds: string[]) => {
    try {
      await bulkDeleteEvents(eventIds);
      await refreshEvents();
    } catch (error) {
      console.error('Error bulk deleting events:', error);
    }
  };

  const handleCloseAllModals = () => {
    setShowEventModal(false);
    setShowAppointmentModal(false);
    setShowReminderModal(false);
    setShowTypeSelector(false);
    setSelectedDate(null);
    setSelectedRange(null);
  };

  useEffect(() => {
    if (lastSyncTime) refreshEvents();
  }, [lastSyncTime, refreshEvents]);

  const getEventColor = (eventType: string) => {
    const colors: Record<string, string> = {
      'meeting': FLOW_COLOR, 'appointment': '#10B981',
      'reminder': '#F59E0B', 'task': '#EF4444', 'google_meet': '#4285F4'
    };
    return colors[eventType] || '#6B7280';
  };

  const calendarEvents = useMemo(() => {
    return events.map((event) => {
      const startDate = event.start_date || (event as any).start;
      const endDate = event.end_date || (event as any).end;
      if (!startDate) return null;
      return {
        id: event.id, title: event.title || 'Evento sem título',
        start: startDate, end: endDate || startDate,
        backgroundColor: event.color || getEventColor(event.event_type),
        borderColor: 'transparent',
        textColor: '#ffffff', classNames: ['modern-event'],
        extendedProps: {
          description: event.description || '', event_type: event.event_type || 'meeting',
          meeting_link: event.meeting_link, meeting_provider: event.meeting_provider,
          attendees: event.attendees || [], is_all_day: event.is_all_day || false,
          source: event.source || (event.google_event_id ? 'google' : 'local'),
          google_event_id: event.google_event_id, meeting_data: event.meeting_data || {},
          meeting_status: (event as any).meeting_status, meeting_notes: (event as any).meeting_notes,
          recording_link: (event as any).recording_link, color: event.color
        }
      };
    }).filter(Boolean);
  }, [events]);

  // Dynamic height based on view
  const calendarHeight = currentView === 'dayGridMonth' ? 'auto' : '600px';

  if (loading) {
    return (
      <div className="p-4 md:p-6">
        <CalendarSkeleton />
      </div>
    );
  }

  const viewLabels: Array<{ key: string; label: string }> = [
    { key: 'timeGridDay', label: 'DIA' },
    { key: 'timeGridWeek', label: 'SEMANA' },
    { key: 'dayGridMonth', label: 'MÊS' },
    { key: 'listWeek', label: 'LISTA' },
  ];

  const switchView = (view: string) => {
    setCurrentView(view);
    calendarRef.current?.getApi()?.changeView(view);
  };

  return (
    <div className="kommo-calendar flex flex-col min-h-full bg-[#faf9f7] dark:bg-background text-foreground transition-colors duration-300">
      {/* Header matching /disparos pattern */}
      <div className="px-4 md:px-6 pt-6 bg-[#faf9f7]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-2 border-b border-border/40">
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-[#374DA4]">Agenda</h1>
            <p className="text-xs text-muted-foreground">
              Gerencie seus compromissos e reuniões
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowIntegrationsModal(true)}
              className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full bg-white/60 text-[12px] font-semibold text-foreground hover:bg-white transition-all shadow-sm"
            >
              <Plug className="h-4 w-4" />
              Integrações
            </button>
            <Button
              onClick={() => setShowTypeSelector(true)}
              className="rounded-full bg-[#374DA4] hover:bg-[#2e418a] text-white shadow-lg shadow-[#374DA4]/20"
            >
              <Plus className="h-4 w-4 mr-2" />
              Novo Evento
            </Button>
          </div>
        </div>
      </div>

      {/* Top toolbar - Simplified view switcher */}
      <div className="flex items-center gap-2 px-3 md:px-6 h-14 bg-[#faf9f7]">
        <div className="flex items-center gap-1 bg-[#ecebe4] dark:bg-white/5 rounded-full p-1">
          <button
            onClick={() => switchView('listWeek')}
            className={`p-2 rounded-full transition-all ${currentView === 'listWeek' ? 'bg-white text-[#374DA4] shadow-sm' : 'text-muted-foreground'}`}
          >
            <List className="h-4 w-4" />
          </button>
          <button
            onClick={() => switchView('dayGridMonth')}
            className={`p-2 rounded-full transition-all ${currentView === 'dayGridMonth' ? 'bg-white text-[#374DA4] shadow-sm' : 'text-muted-foreground'}`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>

        {/* Right actions */}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => navigate('/dashboard/agenda-aberta')}
            className="inline-flex items-center gap-1.5 h-8 px-4 rounded-full bg-white/60 text-[11px] font-semibold text-foreground hover:bg-white transition-all shadow-sm"
          >
            <Link2 className="h-3.5 w-3.5" />
            LINKS
          </button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-2 rounded-full hover:bg-white/80 text-muted-foreground transition-all" aria-label="Mais">
                <MoreHorizontal className="h-5 w-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-2xl">
              {!isConnected && (
                <DropdownMenuItem onClick={() => connectGoogle()} disabled={googleLoading}>
                  <Video className="h-4 w-4 mr-2 text-primary" />
                  Conectar Google Calendar
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => setShowBulkDeleteModal(true)} className="text-destructive focus:text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir em Massa
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Date navigation strip */}
      <div className="flex items-center h-10 bg-white/30 dark:bg-white/5 px-3 mx-3 md:mx-6 my-1 rounded-xl backdrop-blur-sm border border-border/30">
        <button
          onClick={() => calendarRef.current?.getApi()?.prev()}
          className="p-2 rounded-full hover:bg-muted text-muted-foreground transition-all hover:scale-110"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 text-center text-[14px] text-foreground font-semibold truncate capitalize tracking-tight">
          {currentTitle}
        </div>
        <button
          onClick={() => calendarRef.current?.getApi()?.next()}
          className="p-2 rounded-full hover:bg-muted text-muted-foreground transition-all hover:scale-110"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Calendar area */}
      <div className={`flex-1 px-3 md:px-5 pb-3 min-h-0 ${currentView.startsWith('timeGrid') ? 'overflow-hidden flex' : 'overflow-auto'}`}>
        <div className={`calendar-container-v2 kommo-fc bg-white dark:bg-black rounded-3xl border border-border/40 overflow-hidden p-2 md:p-3 shadow-sm ${currentView.startsWith('timeGrid') ? 'flex-1 h-full min-h-0 flex flex-col' : ''}`}>
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
              initialView={currentView}
              headerToolbar={false}
              height={currentView.startsWith('timeGrid') ? '100%' : 'auto'}
              expandRows={true}
              scrollTime={`${String(Math.max(0, new Date().getHours() - 1)).padStart(2, '0')}:00:00`}
              scrollTimeReset={false}
              events={calendarEvents}
              dateClick={handleDateClick}
              select={handleDateSelect}
              eventClick={handleEventClick}
              moreLinkClick={handleMoreClick}
              editable={true}
              selectable={true}
              selectMirror={true}
              dayMaxEvents={3}
              weekends={true}
              locale={ptBrLocale}
              eventDisplay="block"
              eventTextColor="#ffffff"
              selectLongPressDelay={0}
              selectMinDistance={5}
              slotMinTime="08:00:00"
              slotMaxTime="22:00:00"
              slotDuration="00:30:00"
              slotLabelInterval="01:00"
              slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
              dayHeaderFormat={
                currentView === 'timeGridWeek'
                  ? { weekday: 'short', day: 'numeric', month: 'short', omitCommas: true }
                  : { weekday: 'short' }
              }
              allDaySlot={true}
              allDayText="Dia todo"
              nowIndicator={true}
              firstDay={1}
              viewDidMount={(view) => {
                setCurrentView(view.view.type);
                setCurrentTitle(view.view.title);
                if (view.view.type.startsWith('timeGrid')) {
                  const h = Math.max(0, new Date().getHours() - 1);
                  setTimeout(() => calendarRef.current?.getApi()?.scrollToTime(`${String(h).padStart(2, '0')}:00:00`), 0);
                }
              }}
              datesSet={(dateInfo) => {
                if (dateInfo.view.type !== currentView) setCurrentView(dateInfo.view.type);
                setCurrentTitle(dateInfo.view.title);
                if (dateInfo.view.type.startsWith('timeGrid')) {
                  const h = Math.max(0, new Date().getHours() - 1);
                  setTimeout(() => calendarRef.current?.getApi()?.scrollToTime(`${String(h).padStart(2, '0')}:00:00`), 0);
                }
              }}
              eventContent={(eventInfo) => {
                const isTimeGrid = currentView.startsWith('timeGrid');
                return (
                  <div className={`modern-event-content ${isTimeGrid ? 'p-1.5' : 'px-1.5 py-0.5'}`}>
                    <div className="event-title text-xs font-semibold truncate">
                      {!isTimeGrid && eventInfo.timeText && (
                        <span className="font-normal opacity-80 mr-1">{eventInfo.timeText}</span>
                      )}
                      {eventInfo.event.title}
                    </div>
                    {isTimeGrid && eventInfo.event.extendedProps.description && (
                      <div className="text-[10px] opacity-75 truncate mt-0.5">
                        {eventInfo.event.extendedProps.description}
                      </div>
                    )}
                  </div>
                );
              }}
              moreLinkContent={(args) => (
                <span className="text-xs font-semibold" style={{ color: KOMMO_BLUE }}>
                  +{args.num} mais
                </span>
              )}
            />
        </div>
      </div>

      {/* Footer status bar */}
      <div className="flex items-center gap-4 px-4 md:px-5 h-12 bg-background/60 backdrop-blur-sm mx-3 md:mx-5 mb-3 rounded-2xl">
        <button
          onClick={() => calendarRef.current?.getApi()?.today()}
          className="inline-flex items-center gap-1.5 h-8 px-4 rounded-full text-[12px] font-semibold text-primary bg-primary/10 hover:bg-primary/15 transition-all hover:scale-105"
        >
          <Calendar className="h-3.5 w-3.5" />
          Hoje
        </button>

        {/* Legend */}
        <div className="hidden md:flex items-center gap-4 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: FLOW_COLOR }} />
            Reunião
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Compromisso
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Lembrete
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#4285F4]" />
            Google Meet
          </span>
        </div>

        <div className="ml-auto flex items-center gap-3 text-[11px] text-muted-foreground">
          <span>{calendarEvents.length} evento{calendarEvents.length === 1 ? '' : 's'}</span>
          {isConnected && (
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Google sincronizado
            </span>
          )}
        </div>
      </div>

      {/* All modals */}
      <EventTypeSelector
        isOpen={showTypeSelector}
        onClose={() => { setShowTypeSelector(false); setSelectedDate(null); setSelectedRange(null); }}
        onSelectType={handleTypeSelect}
        selectedDate={selectedDate || ''}
      />
      <AppointmentModal
        isOpen={showAppointmentModal} onClose={handleCloseAllModals}
        selectedDate={selectedDate || ''} selectedRange={selectedRange}
        onCreateEvent={handleCreateEvent}
      />
      <ReminderModal
        isOpen={showReminderModal} onClose={handleCloseAllModals}
        selectedDate={selectedDate || ''} selectedRange={selectedRange}
        onCreateEvent={handleCreateEvent}
      />
      <EnhancedEventDetailsModal
        isOpen={showDetailsModal}
        onClose={() => { setShowDetailsModal(false); setSelectedEvent(null); }}
        event={selectedEvent} onEventUpdate={refreshEvents}
      />
      <EventClusterModal
        isOpen={showClusterModal}
        onClose={() => { setShowClusterModal(false); setClusterEvents([]); }}
        events={clusterEvents} date={selectedDate || ''}
        onEventClick={(event) => { setSelectedEvent(event); setShowClusterModal(false); setShowDetailsModal(true); }}
      />
      <BulkDeleteModal
        isOpen={showBulkDeleteModal} onClose={() => setShowBulkDeleteModal(false)}
        events={events} onDelete={handleBulkDelete}
      />
      <CalendarIntegrationsModal
        open={showIntegrationsModal}
        onOpenChange={setShowIntegrationsModal}
      />
    </div>
  );
};

export default MyCalendar;
