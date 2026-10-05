
import { useState, useEffect } from 'react';
import { useCalendarData } from './useCalendarData';
import { useToast } from './use-toast';

interface TarefaItem {
  id: string;
  title: string;
  description?: string;
  start_date: string;
  end_date: string;
  event_type: 'meeting' | 'appointment' | 'reminder';
  meeting_link?: string;
  meeting_provider?: 'google_meet' | 'zoom' | 'teams' | 'ellosuit';
  attendees?: string[];
  is_all_day?: boolean;
  color?: string;
  status?: 'pending' | 'completed' | 'deleted';
  google_event_id?: string;
  source?: string;
  location?: string;
  notes?: string;
}

export const useTarefas = () => {
  const { events, isLoading, createEvent, updateEvent, deleteEvent, refreshEvents } = useCalendarData();
  const { toast } = useToast();
  const [tarefas, setTarefas] = useState<TarefaItem[]>([]);
  const [deletedTarefas, setDeletedTarefas] = useState<TarefaItem[]>([]);

  useEffect(() => {
    const tarefasFormatted: TarefaItem[] = events.map(event => ({
      id: event.id,
      title: event.title,
      description: event.description,
      start_date: event.start_date,
      end_date: event.end_date,
      event_type: event.event_type,
      meeting_link: event.meeting_link,
      meeting_provider: event.meeting_provider,
      attendees: Array.isArray(event.attendees) ? 
        event.attendees.map(a => typeof a === 'string' ? a : String(a)) : 
        [],
      is_all_day: event.is_all_day,
      color: event.color,
      status: (event.status as 'pending' | 'completed' | 'deleted') || 'pending',
      google_event_id: event.google_event_id,
      source: event.source || 'local',
      location: event.description?.includes('Local:') ? 
        event.description.split('Local:')[1]?.split('\n')[0]?.trim() : '',
      notes: event.description
    }));
    
    setTarefas(tarefasFormatted);
    setDeletedTarefas([]);
  }, [events]);

  const createTarefa = async (tarefaData: any) => {
    try {
      console.log('🔵 useTarefas - createTarefa chamado com:', tarefaData);
      
      const eventData = {
        ...tarefaData,
        source: 'local',
        status: 'pending'
      };
      
      console.log('🔵 useTarefas - dados finais para createEvent:', eventData);
      
      await createEvent(eventData);
      
      toast({
        title: "Lembrete criado",
        description: "Seu lembrete foi adicionado com sucesso!",
      });
    } catch (error) {
      console.error('❌ useTarefas - Error creating tarefa:', error);
      toast({
        title: "Erro",
        description: "Não foi possível criar o lembrete",
        variant: "destructive"
      });
      throw error; // Re-throw para o modal saber que falhou
    }
  };

  const updateTarefa = async (id: string, updates: any) => {
    try {
      console.log('Updating tarefa with:', { id, updates });
      
      await updateEvent(id, updates);
      
      setTarefas(prev => 
        prev.map(tarefa => 
          tarefa.id === id ? { ...tarefa, ...updates } : tarefa
        )
      );
      
      if (updates.status === 'completed') {
        toast({
          title: "Concluído",
          description: "Tarefa marcada como concluída!",
        });
      }
    } catch (error) {
      console.error('Error updating tarefa:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a tarefa",
        variant: "destructive"
      });
    }
  };

  const deleteTarefa = async (id: string) => {
    try {
      await deleteEvent(id);
      
      setTarefas(prev => prev.filter(tarefa => tarefa.id !== id));
      
      toast({
        title: "Lembrete excluído",
        description: "O lembrete foi excluído permanentemente",
      });
    } catch (error) {
      console.error('Error deleting tarefa:', error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir o lembrete",
        variant: "destructive"
      });
    }
  };

  const restoreTarefa = async (id: string) => {
    toast({
      title: "Erro",
      description: "Não é possível restaurar lembretes excluídos",
      variant: "destructive"
    });
  };

  return {
    tarefas,
    deletedTarefas,
    loading: isLoading,
    createTarefa,
    updateTarefa,
    deleteTarefa,
    restoreTarefa,
    refreshEvents
  };
};
