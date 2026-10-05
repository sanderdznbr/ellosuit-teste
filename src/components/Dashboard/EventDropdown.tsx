
import React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, Video, Calendar, Bell } from 'lucide-react';

interface EventDropdownProps {
  onSelectType: (type: 'meeting' | 'appointment' | 'reminder') => void;
}

const EventDropdown: React.FC<EventDropdownProps> = ({ onSelectType }) => {
  const eventTypes = [
    {
      type: 'meeting' as const,
      title: 'Reunião Online',
      description: 'Agendar uma reunião virtual com Google Meet ou Zoom',
      icon: Video,
    },
    {
      type: 'appointment' as const,
      title: 'Compromisso Presencial',
      description: 'Marcar um compromisso presencial ou visita',
      icon: Calendar,
    },
    {
      type: 'reminder' as const,
      title: 'Lembrete',
      description: 'Definir um lembrete com notificações',
      icon: Bell,
    }
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="bg-[#3600FF] hover:bg-[#3600FF]/90 text-white px-6 py-3 rounded-xl font-medium flex items-center space-x-2 shadow-lg hover:shadow-xl transition-all duration-200">
          <Plus className="h-4 w-4" />
          <span>Novo Evento</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80 p-2" align="end">
        {eventTypes.map((eventType) => {
          const Icon = eventType.icon;
          return (
            <DropdownMenuItem
              key={eventType.type}
              onClick={() => onSelectType(eventType.type)}
              className="p-4 cursor-pointer rounded-lg hover:bg-[#3600FF] hover:text-white group transition-all duration-200"
            >
              <div className="flex items-center space-x-3 w-full">
                <div className="w-10 h-10 bg-[#3600FF]/10 group-hover:bg-white/20 rounded-lg flex items-center justify-center transition-colors duration-200">
                  <Icon className="h-5 w-5 text-[#3600FF] group-hover:text-white transition-colors duration-200" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900 group-hover:text-white mb-1 transition-colors duration-200">
                    {eventType.title}
                  </h3>
                  <p className="text-sm text-gray-500 group-hover:text-white/80 transition-colors duration-200">
                    {eventType.description}
                  </p>
                </div>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default EventDropdown;
