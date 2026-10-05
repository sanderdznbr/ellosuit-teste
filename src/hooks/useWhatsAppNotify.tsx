import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface NotifyParams {
  title: string;
  message: string;
  notification_type: 'event_created' | 'event_upcoming' | 'event_deleted' | 'task_due' | 'email_sent' | 'dispatch_progress';
  category?: string;
  icon?: string;
  action_url?: string;
  metadata?: Record<string, any>;
}

export const useWhatsAppNotify = () => {
  const { user } = useAuth();

  const sendNotification = useCallback(async (params: NotifyParams) => {
    if (!user) return;

    try {
      const { data: companyData } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!companyData) return;

      await supabase.functions.invoke('send-user-notification', {
        body: {
          user_id: user.id,
          company_id: companyData.company_id,
          ...params,
        },
      });
    } catch (error) {
      console.error('[WhatsApp Notify] Error:', error);
    }
  }, [user]);

  return { sendNotification };
};
