
import React, { useState } from 'react';
import { Calendar, Clock, MapPin, Users, Video } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { vibrate } from '@/utils/mobile-helpers';
import MobileModal from '@/components/ui/mobile-modal';
import { getServerTodayString } from '@/utils/date-server';

interface NovoLembreteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (tarefa: any) => Promise<void>;
}

const NovoLembreteModal: React.FC<NovoLembreteModalProps> = ({ isOpen, onClose, onSave }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedDate, setSelectedDate] = useState(getServerTodayString());
  const [selectedTime, setSelectedTime] = useState('09:00');
  const [eventType, setEventType] = useState<'reminder' | 'meeting' | 'appointment'>('reminder');
  const [location, setLocation] = useState('');
  const [attendees, setAttendees] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) {
      vibrate(100);
      return;
    }

    setIsLoading(true);
    vibrate(30);

    try {
      // Criar a data/hora exata que o usuário selecionou no fuso horário local
      const localDateTime = new Date(`${selectedDate}T${selectedTime}:00`);
      
      // Converter corretamente para UTC - o JavaScript fará a conversão automática
      const startDateTime = localDateTime.toISOString();
      
      // Criar fim do evento (1 hora depois)
      const endDateTime = new Date(localDateTime.getTime() + (60 * 60 * 1000)).toISOString();

      console.log('📅 Criando lembrete:');
      console.log('- Data selecionada:', selectedDate);
      console.log('- Hora selecionada:', selectedTime);
      console.log('- DateTime local:', localDateTime);
      console.log('- Start DateTime:', startDateTime);
      console.log('- End DateTime:', endDateTime);
      console.log('- Event Type:', eventType);
      console.log('- Location:', location);
      console.log('- Attendees:', attendees);

      let finalDescription = description.trim();
      let meetingLink = '';
      
      // Gerar link do Google Meet para reuniões
      if (eventType === 'meeting') {
        // Gerar código de reunião mais realista
        const meetingCode = Math.random().toString(36).substring(2, 5) + '-' + 
                           Math.random().toString(36).substring(2, 6) + '-' + 
                           Math.random().toString(36).substring(2, 5);
        meetingLink = `https://meet.google.com/${meetingCode}`;
        
        if (attendees.trim()) {
          finalDescription += `\n\nParticipantes: ${attendees.trim()}`;
        }
        finalDescription += `\n\nLink da reunião: ${meetingLink}`;
      }
      
      // Adicionar endereço para compromissos
      if (eventType === 'appointment' && location.trim()) {
        finalDescription += `\n\nLocal: ${location.trim()}`;
      }

      const tarefaData = {
        title: title.trim(),
        description: finalDescription,
        start_date: startDateTime,
        end_date: endDateTime,
        event_type: eventType,
        is_all_day: false,
        status: 'pending',
        meeting_link: eventType === 'meeting' ? meetingLink : undefined,
        attendees: eventType === 'meeting' && attendees.trim() ? attendees.split(',').map(email => email.trim()) : undefined
      };

      await onSave(tarefaData);
      
      // Reset form
      setTitle('');
      setDescription('');
      setSelectedDate(getServerTodayString());
      setSelectedTime('09:00');
      setEventType('reminder');
      setLocation('');
      setAttendees('');
      
      onClose();
    } catch (error) {
      console.error('Error saving reminder:', error);
      vibrate([100, 50, 100]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
    vibrate(30);
  };

  // Função para exibir a data/hora corretamente no preview
  const getPreviewDateTime = () => {
    const localDateTime = new Date(selectedDate + 'T' + selectedTime + ':00');
    
    return localDateTime.toLocaleDateString('pt-BR', {
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <MobileModal
      isOpen={isOpen}
      onClose={handleClose}
      title="Novo Lembrete"
      size="lg"
    >
      <div className="px-6 pb-6 space-y-6">
        {/* Form Fields */}
        <div className="space-y-4">
          <div>
              <Input
                placeholder="Título do lembrete"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="text-lg font-medium border-0 bg-gray-50 rounded-xl px-4 py-3 placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-[#374DA4] transition-all"
                style={{ fontSize: '16px' }}
              />
          </div>

          <div>
            <Textarea
              placeholder="Adicione uma descrição..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="border-0 bg-gray-50 rounded-xl px-4 py-3 resize-none placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-[#374DA4] transition-all"
              rows={4}
              style={{ fontSize: '16px' }}
            />
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center space-x-2 mb-3">
                <Calendar className="h-5 w-5 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">Data</span>
              </div>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="border-0 bg-transparent text-sm p-0 focus:ring-0"
                style={{ fontSize: '16px' }}
              />
            </div>

            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center space-x-2 mb-3">
                <Clock className="h-5 w-5 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">Hora</span>
              </div>
              <Input
                type="time"
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                className="border-0 bg-transparent text-sm p-0 focus:ring-0"
                style={{ fontSize: '16px' }}
              />
            </div>
          </div>

          {/* Event Type Selection */}
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center space-x-2 mb-3">
              <span className="text-sm font-medium text-gray-700">Tipo do evento</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setEventType('reminder')}
                className={cn(
                  "flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all",
                  eventType === 'reminder'
                    ? "border-[#2F428D] bg-[#F0F2FE] text-[#1A2551]"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                )}
              >
                <Clock className="h-5 w-5 mb-1" />
                <span className="text-xs font-medium">Lembrete</span>
              </button>
              
              <button
                type="button"
                onClick={() => setEventType('meeting')}
                className={cn(
                  "flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all",
                  eventType === 'meeting'
                    ? "border-[#374DA4] bg-[#F0F2FE] text-[#253573]"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                )}
              >
                <Video className="h-5 w-5 mb-1" />
                <span className="text-xs font-medium">Reunião</span>
              </button>
              
              <button
                type="button"
                onClick={() => setEventType('appointment')}
                className={cn(
                  "flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all",
                  eventType === 'appointment'
                    ? "border-green-500 bg-green-50 text-green-700"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                )}
              >
                <MapPin className="h-5 w-5 mb-1" />
                <span className="text-xs font-medium">Compromisso</span>
              </button>
            </div>
          </div>

          {/* Conditional Fields */}
          {eventType === 'appointment' && (
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center space-x-2 mb-3">
                <MapPin className="h-5 w-5 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">Endereço</span>
              </div>
              <Input
                placeholder="Digite o endereço do compromisso"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="border-0 bg-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 transition-all"
                style={{ fontSize: '16px' }}
              />
            </div>
          )}

          {eventType === 'meeting' && (
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center space-x-2 mb-3">
                <Users className="h-5 w-5 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">Participantes</span>
              </div>
              <Input
                placeholder="Digite os emails separados por vírgula"
                value={attendees}
                onChange={(e) => setAttendees(e.target.value)}
                className="border-0 bg-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#374DA4] transition-all"
                style={{ fontSize: '16px' }}
              />
              <p className="text-xs text-gray-500 mt-2">
                Link do Google Meet será gerado automaticamente
              </p>
            </div>
          )}
        </div>

        {/* Preview */}
        {title && (
          <div className="bg-[#F0F2FE] border border-[#B3BFF0] rounded-xl p-4">
            <div className="flex items-start space-x-3">
              <div className={cn(
                "w-3 h-3 rounded-full mt-2 flex-shrink-0",
                eventType === 'reminder' && "bg-[#2F428D]",
                eventType === 'meeting' && "bg-[#374DA4]",
                eventType === 'appointment' && "bg-green-500"
              )}></div>
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <h3 className="font-medium text-gray-900 mb-1">{title}</h3>
                  <span className={cn(
                    "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ml-3 flex-shrink-0",
                    eventType === 'reminder' && "bg-[#DFE4FB] text-[#0F1631]",
                    eventType === 'meeting' && "bg-[#DFE4FB] text-[#1A2551]",
                    eventType === 'appointment' && "bg-green-100 text-green-800"
                  )}>
                    {eventType === 'reminder' && 'Lembrete'}
                    {eventType === 'meeting' && 'Reunião'}
                    {eventType === 'appointment' && 'Compromisso'}
                  </span>
                </div>
                {description && (
                  <p className="text-sm text-gray-600 mb-2">{description}</p>
                )}
                {eventType === 'appointment' && location && (
                  <p className="text-sm text-gray-600 mb-2">📍 {location}</p>
                )}
                {eventType === 'meeting' && attendees && (
                  <p className="text-sm text-gray-600 mb-2">👥 {attendees}</p>
                )}
                <p className="text-sm text-[#2F428D] font-medium">
                  {getPreviewDateTime()}
                </p>
                {eventType === 'meeting' && (
                  <p className="text-sm text-green-600 font-medium mt-1">
                    🎥 Link do Meet será gerado
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <Button
            variant="outline"
            onClick={handleClose}
            className="flex-1 py-3 rounded-xl"
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={!title.trim() || isLoading}
            className={cn(
              "flex-1 py-3 rounded-xl font-medium transition-all",
              title.trim() 
                ? "bg-[#374DA4] hover:bg-[#2F428D] text-white" 
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            )}
          >
            {isLoading ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </div>
    </MobileModal>
  );
};

export default NovoLembreteModal;
