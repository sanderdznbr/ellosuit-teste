import React from 'react';
import { Clock, Video, Users, MapPin, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface MobileCalendarCardProps {
  event: {
    id: string;
    title: string;
    start: string;
    end: string;
    type: 'meeting' | 'appointment' | 'reminder';
    meeting_link?: string;
    attendees?: any[];
    location?: string;
  };
  onClick?: () => void;
}

const MobileCalendarCard: React.FC<MobileCalendarCardProps> = ({ event, onClick }) => {
  const getEventColor = (type: string) => {
    switch (type) {
      case 'meeting':
        return 'bg-[#374DA4]';
      case 'appointment':
        return 'bg-green-500';
      case 'reminder':
        return 'bg-purple-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getEventBgColor = (type: string) => {
    switch (type) {
      case 'meeting':
        return 'bg-[#F0F2FE] border-[#B3BFF0]';
      case 'appointment':
        return 'bg-green-50 border-green-200';
      case 'reminder':
        return 'bg-purple-50 border-purple-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short'
    });
  };

  return (
    <div 
      className={cn(
        "bg-white rounded-2xl border-2 p-4 mb-3 shadow-sm active:scale-[0.98] transition-all",
        getEventBgColor(event.type)
      )}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div className={cn("w-3 h-3 rounded-full", getEventColor(event.type))} />
          <div>
            <h3 className="font-semibold text-gray-900 text-base leading-tight">
              {event.title}
            </h3>
            <div className="flex items-center space-x-1 mt-1">
              <Clock className="h-3 w-3 text-gray-400" />
              <span className="text-sm text-gray-500">
                {formatTime(event.start)} - {formatTime(event.end)}
              </span>
            </div>
          </div>
        </div>
        
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="space-y-2">
        {/* Date Badge */}
        <Badge variant="secondary" className="text-xs">
          {formatDate(event.start)}
        </Badge>

        {/* Meeting Link */}
        {event.meeting_link && (
          <div className="flex items-center space-x-2">
            <Video className="h-4 w-4 text-[#374DA4]" />
            <span className="text-sm text-gray-600">Reunião online</span>
          </div>
        )}

        {/* Attendees */}
        {event.attendees && event.attendees.length > 0 && (
          <div className="flex items-center space-x-2">
            <Users className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-600">
              {event.attendees.length} participante{event.attendees.length > 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* Location */}
        {event.location && (
          <div className="flex items-center space-x-2">
            <MapPin className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-600">{event.location}</span>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      {event.meeting_link && (
        <div className="mt-4 pt-3 border-t border-gray-100">
          <Button 
            size="sm" 
            className="w-full bg-[#374DA4] hover:bg-[#2F428D] text-white rounded-xl"
            onClick={(e) => {
              e.stopPropagation();
              window.open(event.meeting_link, '_blank');
            }}
          >
            <Video className="h-4 w-4 mr-2" />
            Entrar na Reunião
          </Button>
        </div>
      )}
    </div>
  );
};

export default MobileCalendarCard;