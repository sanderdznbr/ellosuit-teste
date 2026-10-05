
import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';

interface NotificationSettings {
  id?: string;
  user_id: string;
  company_id: string;
  calendar_notifications_enabled: boolean;
  event_start_notifications: boolean;
  reminder_notifications_enabled: boolean;
  default_reminder_minutes: number;
  created_at?: string;
  updated_at?: string;
}

interface EventNotificationSettings {
  id?: string;
  event_id: string;
  user_id: string;
  company_id: string;
  notifications_enabled: boolean;
  reminder_minutes: number[];
  notification_at_start: boolean;
  created_at?: string;
  updated_at?: string;
}

export const useNotificationSettings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Buscar configurações gerais de notificação
  const { data: settings, isLoading: settingsLoading, error: settingsError } = useQuery({
    queryKey: ['notification-settings', user?.id],
    queryFn: async () => {
      if (!user) return null;

      console.log('🔍 Buscando configurações de notificação para usuário:', user.id);

      const { data, error } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('❌ Erro ao buscar configurações:', error);
        throw error;
      }

      console.log('✅ Configurações carregadas:', data);
      return data;
    },
    enabled: !!user,
  });

  // Criar ou atualizar configurações gerais
  const updateNotificationSettings = async (newSettings: Partial<NotificationSettings>) => {
    if (!user) {
      toast({
        title: "Erro",
        description: "Usuário não autenticado",
        variant: "destructive"
      });
      return;
    }

    try {
      console.log('⚙️ Atualizando configurações de notificação:', newSettings);

      // Buscar company_id do usuário
      const { data: companyData } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!companyData) {
        throw new Error('Usuário não está associado a uma empresa');
      }

      const settingsData = {
        user_id: user.id,
        company_id: companyData.company_id,
        ...newSettings
      };

      let result;
      if (settings?.id) {
        // Atualizar configurações existentes
        const { data, error } = await supabase
          .from('notification_settings')
          .update(settingsData)
          .eq('id', settings.id)
          .select()
          .single();

        if (error) throw error;
        result = data;
      } else {
        // Criar novas configurações
        const { data, error } = await supabase
          .from('notification_settings')
          .insert(settingsData)
          .select()
          .single();

        if (error) throw error;
        result = data;
      }

      console.log('✅ Configurações atualizadas com sucesso');
      
      // Invalidar cache
      await queryClient.invalidateQueries({ queryKey: ['notification-settings'] });
      
      toast({
        title: "Sucesso",
        description: "Configurações de notificação atualizadas!"
      });

      return result;
    } catch (error: any) {
      console.error('💥 Erro ao atualizar configurações:', error);
      toast({
        title: "Erro",
        description: `Erro ao atualizar configurações: ${error.message}`,
        variant: "destructive"
      });
      throw error;
    }
  };

  // Buscar configurações de notificação por evento
  const getEventNotificationSettings = async (eventId: string) => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('event_notification_settings')
        .select('*')
        .eq('event_id', eventId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data;
    } catch (error: any) {
      console.error('❌ Erro ao buscar configurações do evento:', error);
      return null;
    }
  };

  // Atualizar configurações de notificação por evento
  const updateEventNotificationSettings = async (
    eventId: string, 
    eventSettings: Partial<EventNotificationSettings>
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
      console.log('⚙️ Atualizando configurações do evento:', eventId, eventSettings);

      // Buscar company_id do usuário
      const { data: companyData } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!companyData) {
        throw new Error('Usuário não está associado a uma empresa');
      }

      // Verificar se já existe configuração para este evento
      const existingSettings = await getEventNotificationSettings(eventId);

      const settingsData = {
        event_id: eventId,
        user_id: user.id,
        company_id: companyData.company_id,
        ...eventSettings
      };

      let result;
      if (existingSettings?.id) {
        // Atualizar configurações existentes
        const { data, error } = await supabase
          .from('event_notification_settings')
          .update(settingsData)
          .eq('id', existingSettings.id)
          .select()
          .single();

        if (error) throw error;
        result = data;
      } else {
        // Criar novas configurações
        const { data, error } = await supabase
          .from('event_notification_settings')
          .insert(settingsData)
          .select()
          .single();

        if (error) throw error;
        result = data;
      }

      console.log('✅ Configurações do evento atualizadas com sucesso');
      
      toast({
        title: "Sucesso",
        description: "Configurações do evento atualizadas!"
      });

      return result;
    } catch (error: any) {
      console.error('💥 Erro ao atualizar configurações do evento:', error);
      toast({
        title: "Erro",
        description: `Erro ao atualizar configurações: ${error.message}`,
        variant: "destructive"
      });
      throw error;
    }
  };

  // Criar configurações padrão se não existirem
  const createDefaultSettings = async () => {
    if (!user || settings) return;

    try {
      const { data: companyData } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!companyData) return;

      const defaultSettings = {
        user_id: user.id,
        company_id: companyData.company_id,
        calendar_notifications_enabled: true,
        event_start_notifications: true,
        reminder_notifications_enabled: true,
        default_reminder_minutes: 15
      };

      await updateNotificationSettings(defaultSettings);
    } catch (error) {
      console.error('Erro ao criar configurações padrão:', error);
    }
  };

  // Executar quando o usuário estiver disponível
  useEffect(() => {
    if (user && !settings && !settingsLoading) {
      createDefaultSettings();
    }
  }, [user, settings, settingsLoading]);

  return {
    settings,
    settingsLoading,
    isLoading: settingsLoading,
    settingsError,
    updateNotificationSettings,
    updateSettings: updateNotificationSettings,
    getEventNotificationSettings,
    updateEventNotificationSettings
  };
};
