
import React from 'react';
import { Clock, Calendar as CalendarIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface CalendarEvent {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  event_type: 'meeting' | 'appointment' | 'reminder';
}

interface MobileCalendarPreviewProps {
  todayEvents: CalendarEvent[];
  upcomingEvents: CalendarEvent[];
  onNavigate: (item: string) => void;
}

const MobileCalendarPreview: React.FC<MobileCalendarPreviewProps> = ({
  todayEvents,
  upcomingEvents,
  onNavigate
}) => {
  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <CalendarIcon className="h-5 w-5 text-[#2F428D]" />
          <h3 className="font-semibold text-gray-900">Calendário</h3>
        </div>
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => onNavigate('calendar')}
        >
          Ver todos
        </Button>
      </div>

      <div className="space-y-4">
        {/* Eventos de Hoje */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Hoje</h4>
          {todayEvents.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum evento hoje</p>
          ) : (
            <div className="space-y-2">
              {todayEvents.slice(0, 3).map((event) => (
                <div key={event.id} className="flex items-center space-x-3 p-2 bg-gray-50 rounded-lg">
                  <div className="w-2 h-2 bg-[#374DA4] rounded-full" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{event.title}</p>
                    <div className="flex items-center space-x-1">
                      <Clock className="h-3 w-3 text-gray-400" />
                      <span className="text-xs text-gray-500">
                        {formatTime(event.start_date)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Próximos Eventos */}
        {upcomingEvents.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Próximos</h4>
            <div className="space-y-2">
              {upcomingEvents.slice(0, 2).map((event) => (
                <div key={event.id} className="flex items-center space-x-3 p-2 bg-gray-50 rounded-lg">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{event.title}</p>
                    <span className="text-xs text-gray-500">
                      {new Date(event.start_date).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: 'short'
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

export default MobileCalendarPreview;
