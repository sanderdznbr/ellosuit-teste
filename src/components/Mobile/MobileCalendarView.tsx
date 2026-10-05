
import React, { useState, useMemo } from 'react';
import { Calendar, Plus, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCalendarData } from '@/hooks/useCalendarData';
import MobileCalendarCard from './MobileCalendarCard';
import CalendarSkeleton from '../Dashboard/CalendarSkeleton';
import { cn } from '@/lib/utils';

const MobileCalendarView = React.memo(() => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');
  const { events, isLoading } = useCalendarData();

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('pt-BR', {
      month: 'long',
      year: 'numeric'
    });
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  const getDaysInMonth = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }
    
    return days;
  }, [currentDate]);

  const getEventsForDay = (day: number) => {
    if (!day) return [];
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter(event => event.start_date.startsWith(dateStr));
  };

  const isToday = (day: number) => {
    if (!day) return false;
    const today = new Date();
    return (
      day === today.getDate() &&
      currentDate.getMonth() === today.getMonth() &&
      currentDate.getFullYear() === today.getFullYear()
    );
  };

  const todayEvents = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return events.filter(event => event.start_date.startsWith(today));
  }, [events]);

  const upcomingEvents = useMemo(() => {
    return events.slice(0, 5);
  }, [events]);

  if (isLoading) {
    return (
      <div className="p-4">
        <CalendarSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      {/* Header with Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigateMonth('prev')}
            className="h-9 w-9 p-0"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-xl font-bold text-gray-900 capitalize">
            {formatDate(currentDate)}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigateMonth('next')}
            className="h-9 w-9 p-0"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
        <Button variant="outline" size="sm">
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      {/* View Mode Selector */}
      <div className="flex space-x-2">
        {(['month', 'week', 'day'] as const).map((mode) => (
          <Button
            key={mode}
            variant={viewMode === mode ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode(mode)}
            className="flex-1 rounded-xl"
          >
            {mode === 'month' ? 'Mês' : mode === 'week' ? 'Semana' : 'Dia'}
          </Button>
        ))}
      </div>

      {/* Today's Events */}
      {todayEvents.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-[#374DA4] rounded-full" />
            <h3 className="font-semibold text-gray-900">Hoje</h3>
            <Badge variant="secondary" className="text-xs">
              {todayEvents.length}
            </Badge>
          </div>
          {todayEvents.map(event => (
            <MobileCalendarCard
              key={event.id}
              event={{
                ...event,
                start: event.start_date,
                end: event.end_date,
                type: event.event_type as any
              }}
            />
          ))}
        </div>
      )}

      {/* Mini Calendar Grid */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
        <div className="grid grid-cols-7 gap-1 mb-3">
          {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, index) => (
            <div key={index} className="text-center text-xs font-medium text-gray-500 py-2">
              {day}
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-7 gap-1">
          {getDaysInMonth.map((day, index) => {
            const dayEvents = day ? getEventsForDay(day) : [];
            return (
              <div
                key={index}
                className={cn(
                  "aspect-square flex flex-col items-center justify-center text-sm relative rounded-lg transition-colors",
                  day ? "hover:bg-gray-50 cursor-pointer" : "",
                  isToday(day || 0) ? "bg-[#374DA4] text-white font-bold" : "text-gray-700"
                )}
              >
                {day && (
                  <>
                    <span>{day}</span>
                    {dayEvents.length > 0 && (
                      <div className="absolute bottom-1 flex space-x-1">
                        {dayEvents.slice(0, 3).map((event, i) => (
                          <div
                            key={i}
                            className={cn(
                              "w-1 h-1 rounded-full",
                              isToday(day) ? "bg-white" : ""
                            )}
                            style={{ 
                              backgroundColor: isToday(day) ? 'white' : (event.color || '#3600FF')
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Upcoming Events */}
      <div className="space-y-3">
        <h3 className="font-semibold text-gray-900">Próximos Eventos</h3>
        {upcomingEvents.map(event => (
          <MobileCalendarCard
            key={event.id}
            event={{
              ...event,
              start: event.start_date,
              end: event.end_date,
              type: event.event_type as any
            }}
          />
        ))}
      </div>
    </div>
  );
});

MobileCalendarView.displayName = 'MobileCalendarView';

export default MobileCalendarView;
