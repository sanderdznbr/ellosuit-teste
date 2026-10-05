
import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';
import { addDays, addWeeks, addMonths, isBefore, parseISO, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CalendarEvent {
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
  recurrence_rule?: string;
  company_id: string;
  created_by: string;
  google_event_id?: string;
  status?: string;
  source?: string;
  meeting_data?: any;
  updated_at?: string;
  created_at?: string;
  parent_event_id?: string;
}

export interface RecurrenceConfig {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  interval: number;
  daysOfWeek: number[];
  endType: 'never' | 'after' | 'on';
  occurrences: number;
  endDate: string;
}

// Função para gerar eventos recorrentes
const generateRecurringEvents = (
  baseEvent: Omit<CalendarEvent, 'id'>,
  recurrence: RecurrenceConfig,
  maxEvents: number = 52 // Limitar a 1 ano de eventos semanais
): Omit<CalendarEvent, 'id'>[] => {
  if (!recurrence.enabled) return [baseEvent];

  const events: Omit<CalendarEvent, 'id'>[] = [];
  const startDate = parseISO(baseEvent.start_date);
  const endDate = parseISO(baseEvent.end_date);
  const duration = endDate.getTime() - startDate.getTime();

  let currentDate = startDate;
  let count = 0;
  const maxOccurrences = recurrence.endType === 'after' ? recurrence.occurrences : maxEvents;
  const untilDate = recurrence.endType === 'on' ? parseISO(recurrence.endDate) : null;

  while (count < maxOccurrences) {
    if (untilDate && isBefore(untilDate, currentDate)) break;

    // Para semanal, verificar se o dia está nos dias selecionados
    if (recurrence.frequency === 'weekly') {
      const dayOfWeek = currentDate.getDay();
      if (recurrence.daysOfWeek.includes(dayOfWeek)) {
        events.push({
          ...baseEvent,
          start_date: currentDate.toISOString(),
          end_date: new Date(currentDate.getTime() + duration).toISOString(),
          recurrence_rule: JSON.stringify(recurrence)
        });
        count++;
      }
      currentDate = addDays(currentDate, 1);
      // Resetar a cada semana * intervalo
      if (currentDate.getDay() === 0 && recurrence.interval > 1) {
        currentDate = addWeeks(currentDate, recurrence.interval - 1);
      }
    } else {
      events.push({
        ...baseEvent,
        start_date: currentDate.toISOString(),
        end_date: new Date(currentDate.getTime() + duration).toISOString(),
        recurrence_rule: JSON.stringify(recurrence)
      });
      count++;

      if (recurrence.frequency === 'daily') {
        currentDate = addDays(currentDate, recurrence.interval);
      } else if (recurrence.frequency === 'monthly') {
        currentDate = addMonths(currentDate, recurrence.interval);
      }
    }
  }

  return events;
};

export const useCalendarData = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Buscar eventos do calendário
  const { data: events = [], isLoading, error, refetch } = useQuery({
    queryKey: ['calendar-events', user?.id],
    queryFn: async () => {
      if (!user) return [];

      console.log('🔍 Buscando eventos do calendário para usuário:', user.id);

      const { data: companyData } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!companyData) {
        console.log('❌ Usuário não está associado a uma empresa');
        return [];
      }

      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('company_id', companyData.company_id)
        .order('start_date', { ascending: true });

      if (error) {
        console.error('❌ Erro ao buscar eventos:', error);
        throw error;
      }

      console.log(`✅ Encontrados ${data?.length || 0} eventos`);
      
      return data?.map(event => ({
        ...event,
        attendees: Array.isArray(event.attendees) ? 
          (event.attendees as any[]).map(a => typeof a === 'string' ? a : String(a)) : 
          [],
        status: event.status || 'pending',
        source: event.source || 'local'
      })) || [];
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutos
  });

  // Criar evento (com suporte a recorrência)
  const createEvent = async (
    eventData: Omit<CalendarEvent, 'id' | 'company_id' | 'created_by'>,
    recurrence?: RecurrenceConfig
  ) => {
    if (!user) {
      toast({
        title: "Erro",
        description: "Usuário não autenticado",
        variant: "destructive"
      });
      return;
    }

    try {
      console.log('📅 Criando evento:', eventData.title, recurrence?.enabled ? '(recorrente)' : '');

      const { data: companyData } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!companyData) {
        throw new Error('Usuário não está associado a uma empresa');
      }

      const baseEvent = {
        ...eventData,
        company_id: companyData.company_id,
        created_by: user.id,
        attendees: eventData.attendees || [],
        color: eventData.color || '#3600FF',
        status: eventData.status || 'pending',
        source: eventData.source || 'local'
      };

      // Gerar eventos recorrentes se necessário
      const eventsToCreate = recurrence?.enabled 
        ? generateRecurringEvents(baseEvent as any, recurrence)
        : [baseEvent];

      console.log(`📅 Criando ${eventsToCreate.length} evento(s)...`);

      const { data, error } = await supabase
        .from('calendar_events')
        .insert(eventsToCreate)
        .select();

      if (error) {
        console.error('❌ Erro ao criar evento:', error);
        throw error;
      }

      console.log(`✅ ${data.length} evento(s) criado(s) com sucesso`);
      
      // Invalidar e refetch dos eventos
      await queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      
      toast({
        title: "Sucesso",
        description: recurrence?.enabled 
          ? `${data.length} eventos recorrentes criados!`
          : "Evento criado com sucesso!"
      });

      // Send notification for event creation (non-blocking)
      try {
        const eventDate = format(new Date(eventData.start_date), "dd/MM 'às' HH:mm", { locale: ptBR });
        supabase.functions.invoke('send-user-notification', {
          body: {
            user_id: user.id,
            company_id: companyData.company_id,
            title: '📅 Novo evento agendado',
            message: `"${eventData.title}" agendado para ${eventDate}`,
            notification_type: 'event_created',
            category: 'calendar',
            icon: 'Calendar',
            action_url: '/dashboard/agenda',
          },
        }).catch(notifErr => console.error('Notification error:', notifErr));
      } catch (notifErr) {
        console.error('Notification error:', notifErr);
      }

      return data[0];
    } catch (error: any) {
      console.error('💥 Erro ao criar evento:', error);
      toast({
        title: "Erro",
        description: `Erro ao criar evento: ${error.message}`,
        variant: "destructive"
      });
      throw error;
    }
  };

  // Atualizar evento
  const updateEvent = async (eventId: string, updates: Partial<CalendarEvent>) => {
    if (!user) {
      toast({
        title: "Erro",
        description: "Usuário não autenticado",
        variant: "destructive"
      });
      return;
    }

    try {
      console.log('📝 Atualizando evento:', eventId, updates);

      const updateData: any = {
        ...updates,
        updated_at: new Date().toISOString()
      };

      // Converter attendees para o formato correto
      if (updates.attendees) {
        updateData.attendees = updates.attendees;
      }

      const { data, error } = await supabase
        .from('calendar_events')
        .update(updateData)
        .eq('id', eventId)
        .eq('created_by', user.id)
        .select()
        .single();

      if (error) {
        console.error('❌ Erro ao atualizar evento:', error);
        throw error;
      }

      console.log('✅ Evento atualizado com sucesso:', data.id);
      
      // Invalidar e refetch dos eventos
      await queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      
      toast({
        title: "Sucesso",
        description: "Evento atualizado com sucesso!"
      });

      return data;
    } catch (error: any) {
      console.error('💥 Erro ao atualizar evento:', error);
      toast({
        title: "Erro",
        description: `Erro ao atualizar evento: ${error.message}`,
        variant: "destructive"
      });
      throw error;
    }
  };

  // Deletar evento
  const deleteEvent = async (eventId: string) => {
    if (!user) {
      toast({
        title: "Erro",
        description: "Usuário não autenticado",
        variant: "destructive"
      });
      return;
    }

    try {
      console.log('🗑️ Deletando evento:', eventId);

      // Fetch event info before deleting for notification
      const { data: eventInfo } = await supabase
        .from('calendar_events')
        .select('title, start_date, company_id')
        .eq('id', eventId)
        .single();

      const { error } = await supabase
        .from('calendar_events')
        .delete()
        .eq('id', eventId)
        .eq('created_by', user.id);

      if (error) {
        console.error('❌ Erro ao deletar evento:', error);
        throw error;
      }

      console.log('✅ Evento deletado com sucesso');
      
      // Invalidar e refetch dos eventos
      await queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      
      // Send WhatsApp notification for event deletion
      if (eventInfo) {
        try {
          await supabase.functions.invoke('send-user-notification', {
            body: {
              user_id: user.id,
              company_id: eventInfo.company_id,
              title: '📅❌ Evento removido',
              message: `O evento "${eventInfo.title}" foi excluído da sua agenda`,
              notification_type: 'event_deleted',
              category: 'calendar',
              icon: 'Calendar',
              action_url: '/dashboard/agenda',
            },
          });
        } catch (notifErr) {
          console.error('Notification error:', notifErr);
        }
      }

      toast({
        title: "Sucesso",
        description: "Evento deletado com sucesso!"
      });
    } catch (error: any) {
      console.error('💥 Erro ao deletar evento:', error);
      toast({
        title: "Erro",
        description: `Erro ao deletar evento: ${error.message}`,
        variant: "destructive"
      });
      throw error;
    }
  };

  // Deletar múltiplos eventos em massa
  const bulkDeleteEvents = async (eventIds: string[]) => {
    if (!user) {
      toast({
        title: "Erro",
        description: "Usuário não autenticado",
        variant: "destructive"
      });
      return;
    }

    if (eventIds.length === 0) return;

    try {
      console.log(`🗑️ Deletando ${eventIds.length} eventos em massa...`);

      const { error } = await supabase
        .from('calendar_events')
        .delete()
        .in('id', eventIds)
        .eq('created_by', user.id);

      if (error) {
        console.error('❌ Erro ao deletar eventos:', error);
        throw error;
      }

      console.log(`✅ ${eventIds.length} eventos deletados com sucesso`);
      
      // Invalidar e refetch dos eventos
      await queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      
      toast({
        title: "Sucesso",
        description: `${eventIds.length} eventos excluídos com sucesso!`
      });
    } catch (error: any) {
      console.error('💥 Erro ao deletar eventos:', error);
      toast({
        title: "Erro",
        description: `Erro ao excluir eventos: ${error.message}`,
        variant: "destructive"
      });
      throw error;
    }
  };

  // Buscar eventos por data
  const getEventsByDate = (date: Date) => {
    const targetDate = date.toISOString().split('T')[0];
    return events.filter(event => {
      const eventDate = new Date(event.start_date).toISOString().split('T')[0];
      return eventDate === targetDate;
    });
  };

  // Buscar próximos eventos
  const getUpcomingEvents = (limit = 5) => {
    const now = new Date();
    return events
      .filter(event => new Date(event.start_date) >= now)
      .slice(0, limit);
  };

  // Refrescar dados
  const refreshEvents = async () => {
    console.log('🔄 Refreshing calendar events...');
    await refetch();
  };

  // Log para debug
  useEffect(() => {
    if (events?.length) {
      console.log('📅 Eventos carregados:', events.length);
    }
  }, [events]);

  return {
    events,
    isLoading,
    loading: isLoading, // Alias para compatibilidade
    error,
    selectedDate,
    setSelectedDate,
    createEvent,
    updateEvent,
    deleteEvent,
    bulkDeleteEvents,
    getEventsByDate,
    getUpcomingEvents,
    refreshEvents,
    refetch
  };
};

export { generateRecurringEvents };
