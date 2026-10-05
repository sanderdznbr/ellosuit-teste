
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Bell, Clock, Palette } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import ColorPicker from './ColorPicker';

interface ReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string;
  selectedRange?: { start: string; end: string } | null;
  onCreateEvent: (eventData: any) => Promise<any>;
}

const ReminderModal = ({ 
  isOpen, 
  onClose, 
  selectedDate, 
  selectedRange,
  onCreateEvent 
}: ReminderModalProps) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isAllDay, setIsAllDay] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [selectedColor, setSelectedColor] = useState('#F59E0B');

  const { toast } = useToast();

  useEffect(() => {
    if (selectedDate) {
      setStartDate(selectedDate);
      setEndDate(selectedDate);
    }

    // Se há um range selecionado (arrastar), usar essas datas
    if (selectedRange) {
      const startDateTime = new Date(selectedRange.start);
      const endDateTime = new Date(selectedRange.end);
      
      setStartDate(startDateTime.toISOString().split('T')[0]);
      setStartTime(startDateTime.toTimeString().slice(0, 5));
      setEndDate(endDateTime.toISOString().split('T')[0]);
      setEndTime(endDateTime.toTimeString().slice(0, 5));
      setIsAllDay(false);
    } else if (selectedDate && !startTime) {
      // Se não há range, definir horários padrão
      setStartTime('09:00');
      setEndTime('09:30');
    }
  }, [selectedDate, selectedRange]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setStartDate('');
    setStartTime('');
    setEndDate('');
    setEndTime('');
    setIsAllDay(false);
    setSelectedColor('#F59E0B');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      toast({
        title: "Erro",
        description: "Título é obrigatório",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      let finalStartDate, finalEndDate;

      if (isAllDay) {
        finalStartDate = new Date(startDate + 'T00:00:00').toISOString();
        finalEndDate = new Date(endDate + 'T23:59:59').toISOString();
      } else {
        finalStartDate = new Date(startDate + 'T' + startTime).toISOString();
        finalEndDate = new Date(endDate + 'T' + endTime).toISOString();
      }

      const eventData = {
        title,
        description,
        start_date: finalStartDate,
        end_date: finalEndDate,
        event_type: 'reminder' as const,
        is_all_day: isAllDay,
        color: selectedColor
      };

      await onCreateEvent(eventData);
      
      toast({
        title: "Sucesso",
        description: "Lembrete criado com sucesso!"
      });
      
      resetForm();
      onClose();
    } catch (error) {
      console.error('Error creating reminder:', error);
      toast({
        title: "Erro",
        description: "Erro ao criar lembrete",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Bell className="h-5 w-5 text-[#F59E0B]" />
            Novo Lembrete
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Título do Lembrete *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Digite o título do lembrete"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Adicione uma descrição (opcional)"
              rows={3}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="allDay"
              checked={isAllDay}
              onCheckedChange={(checked) => setIsAllDay(checked as boolean)}
            />
            <Label htmlFor="allDay" className="text-sm">Lembrete de dia inteiro</Label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Data de Início</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            
            {!isAllDay && (
              <div className="space-y-2">
                <Label htmlFor="startTime">Hora de Início</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="endDate">Data de Término</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
            
            {!isAllDay && (
              <div className="space-y-2">
                <Label htmlFor="endTime">Hora de Término</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Cor do Evento
            </Label>
            <div className="flex items-center gap-2">
              <div 
                className="w-8 h-8 rounded-full border-2 border-gray-300 cursor-pointer"
                style={{ backgroundColor: selectedColor }}
                onClick={() => setShowColorPicker(!showColorPicker)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowColorPicker(!showColorPicker)}
              >
                Escolher Cor
              </Button>
            </div>
            {showColorPicker && (
              <ColorPicker
                selectedColor={selectedColor}
                onColorChange={setSelectedColor}
                onClose={() => setShowColorPicker(false)}
              />
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="flex-1 bg-gradient-to-r from-[#F59E0B] to-[#D97706]"
            >
              {isLoading ? 'Criando...' : 'Criar Lembrete'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ReminderModal;
