import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface BookingLink {
  id: string;
  title: string;
  description?: string;
  duration_minutes: number;
  buffer_minutes: number;
  link_slug: string;
  is_active: boolean;
  expires_at?: string;
  created_at: string;
}

interface UserAvailability {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

interface ScheduledBooking {
  id: string;
  client_name: string;
  client_email: string;
  booking_date: string;
  booking_time: string;
  status: string;
  notes?: string;
}

export const useAgendaAberta = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [bookingLinks, setBookingLinks] = useState<BookingLink[]>([]);
  const [availability, setAvailability] = useState<UserAvailability[]>([]);
  const [bookings, setBookings] = useState<ScheduledBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);

  // Get company ID
  useEffect(() => {
    const fetchCompanyId = async () => {
      if (!user?.id) return;
      
      const { data, error } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user.id)
        .single();
      
      if (!error && data?.company_id) {
        setCompanyId(data.company_id);
      }
    };
    
    fetchCompanyId();
  }, [user?.id]);

  const loadBookingLinks = async () => {
    if (!user?.id) return;
    
    const { data, error } = await supabase
      .from('booking_links')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (!error) {
      setBookingLinks(data || []);
    }
    setLoading(false);
  };

  const loadAvailability = async () => {
    if (!user?.id) return;
    
    const { data, error } = await supabase
      .from('user_availability')
      .select('*')
      .eq('user_id', user.id)
      .order('day_of_week');
    
    if (!error) {
      setAvailability(data || []);
    }
  };

  const loadBookings = async () => {
    if (!user?.id) return;
    
    const { data, error } = await supabase
      .from('scheduled_bookings')
      .select(`
        *,
        booking_links!inner(title)
      `)
      .eq('user_id', user.id)
      .order('booking_date', { ascending: true })
      .order('booking_time', { ascending: true });
    
    if (!error) {
      setBookings(data || []);
    }
  };

  const createBookingLink = async (linkData: Omit<BookingLink, 'id' | 'user_id' | 'link_slug' | 'is_active' | 'created_at'>) => {
    if (!user?.id || !companyId) return;
    
    const linkSlug = `${user.email?.split('@')[0]}-${Date.now().toString(36)}`;
    
    const { error } = await supabase
      .from('booking_links')
      .insert({
        ...linkData,
        link_slug: linkSlug,
        user_id: user.id,
        company_id: companyId,
        is_active: true
      });
    
    if (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao criar link de agendamento',
        variant: 'destructive'
      });
      return false;
    }
    
    toast({
      title: 'Sucesso',
      description: 'Link de agendamento criado!'
    });
    
    loadBookingLinks();
    return true;
  };

  const updateAvailability = async (availabilityData: Omit<UserAvailability, 'id'>) => {
    if (!user?.id || !companyId) return;
    
    // Delete existing availability for this day
    await supabase
      .from('user_availability')
      .delete()
      .eq('user_id', user.id)
      .eq('day_of_week', availabilityData.day_of_week);
    
    // Insert new availability
    const { error } = await supabase
      .from('user_availability')
      .insert({
        ...availabilityData,
        user_id: user.id,
        company_id: companyId
      });
    
    if (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao salvar disponibilidade',
        variant: 'destructive'
      });
      return false;
    }
    
    loadAvailability();
    return true;
  };

  const toggleLinkStatus = async (linkId: string, isActive: boolean) => {
    const { error } = await supabase
      .from('booking_links')
      .update({ is_active: !isActive })
      .eq('id', linkId);
    
    if (!error) {
      loadBookingLinks();
      toast({
        title: 'Status atualizado',
        description: `Link ${!isActive ? 'ativado' : 'desativado'} com sucesso`
      });
      return true;
    }
    return false;
  };

  // Load data when component mounts
  useEffect(() => {
    if (companyId && user?.id) {
      loadBookingLinks();
      loadAvailability();
      loadBookings();
    }
  }, [companyId, user?.id]);

  return {
    bookingLinks,
    availability,
    bookings,
    loading,
    createBookingLink,
    updateAvailability,
    toggleLinkStatus,
    refetch: () => {
      loadBookingLinks();
      loadAvailability(); 
      loadBookings();
    }
  };
};