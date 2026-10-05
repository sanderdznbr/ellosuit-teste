
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

interface AvailabilitySchedule {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

interface Holiday {
  id: string;
  name: string;
  date: string;
  is_active: boolean;
}

interface PublicBookingLink {
  id: string;
  link_slug: string;
  title: string;
  description?: string;
  duration_minutes: number;
  buffer_minutes: number;
  is_active: boolean;
}

export const useMyMeetings = () => {
  const [schedules, setSchedules] = useState<AvailabilitySchedule[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [bookingLinks, setBookingLinks] = useState<PublicBookingLink[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchSchedules = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('availability_schedules')
        .select('*')
        .eq('user_id', user.id)
        .order('day_of_week');

      if (error) throw error;
      setSchedules(data || []);
    } catch (error) {
      console.error('Error fetching schedules:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar horários disponíveis",
        variant: "destructive"
      });
    }
  };

  const fetchHolidays = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('holidays')
        .select('*')
        .eq('user_id', user.id)
        .order('date');

      if (error) throw error;
      setHolidays(data || []);
    } catch (error) {
      console.error('Error fetching holidays:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar feriados",
        variant: "destructive"
      });
    }
  };

  const fetchBookingLinks = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('public_booking_links')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;
      setBookingLinks(data || []);
    } catch (error) {
      console.error('Error fetching booking links:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar links de agendamento",
        variant: "destructive"
      });
    }
  };

  const createSchedule = async (schedule: Omit<AvailabilitySchedule, 'id'>) => {
    if (!user) return;

    try {
      // Buscar company_id do usuário
      const { data: companyUser } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!companyUser) throw new Error('Usuário não associado a empresa');

      const { error } = await supabase
        .from('availability_schedules')
        .insert({
          ...schedule,
          user_id: user.id,
          company_id: companyUser.company_id
        });

      if (error) throw error;
      
      toast({
        title: "Sucesso",
        description: "Horário disponível criado com sucesso"
      });

      fetchSchedules();
    } catch (error) {
      console.error('Error creating schedule:', error);
      toast({
        title: "Erro",
        description: "Erro ao criar horário disponível",
        variant: "destructive"
      });
    }
  };

  const updateSchedule = async (id: string, updates: Partial<AvailabilitySchedule>) => {
    try {
      const { error } = await supabase
        .from('availability_schedules')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      
      toast({
        title: "Sucesso",
        description: "Horário atualizado com sucesso"
      });

      fetchSchedules();
    } catch (error) {
      console.error('Error updating schedule:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar horário",
        variant: "destructive"
      });
    }
  };

  const createBookingLink = async (linkData: Omit<PublicBookingLink, 'id'>) => {
    if (!user) return;

    try {
      // Buscar company_id do usuário
      const { data: companyUser } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!companyUser) throw new Error('Usuário não associado a empresa');

      const { error } = await supabase
        .from('public_booking_links')
        .insert({
          ...linkData,
          user_id: user.id,
          company_id: companyUser.company_id
        });

      if (error) throw error;
      
      toast({
        title: "Sucesso",
        description: "Link de agendamento criado com sucesso"
      });

      fetchBookingLinks();
    } catch (error) {
      console.error('Error creating booking link:', error);
      toast({
        title: "Erro",
        description: "Erro ao criar link de agendamento",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    if (user) {
      Promise.all([
        fetchSchedules(),
        fetchHolidays(),
        fetchBookingLinks()
      ]).finally(() => setLoading(false));
    }
  }, [user]);

  return {
    schedules,
    holidays,
    bookingLinks,
    loading,
    createSchedule,
    updateSchedule,
    createBookingLink,
    refreshData: () => {
      fetchSchedules();
      fetchHolidays();
      fetchBookingLinks();
    }
  };
};
