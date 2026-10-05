import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useEffect, useCallback } from 'react';

export interface Notification {
  id: string;
  user_id: string;
  company_id: string;
  title: string;
  message: string;
  type: string;
  category: string;
  icon: string | null;
  action_url: string | null;
  is_read: boolean;
  whatsapp_sent: boolean;
  metadata: any;
  created_at: string;
  read_at: string | null;
  archived_at: string | null;
}

export function useNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .is('archived_at', null)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as Notification[];
    },
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  // Auto-archive: check for read notifications older than 30 minutes
  useEffect(() => {
    if (!user?.id || notifications.length === 0) return;

    const archiveCutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const toArchive = notifications.filter(
      n => n.is_read && n.read_at && n.read_at < archiveCutoff && !n.archived_at
    );

    if (toArchive.length > 0) {
      const ids = toArchive.map(n => n.id);
      supabase
        .from('notifications')
        .update({ archived_at: new Date().toISOString() })
        .in('id', ids)
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
        });
    }
  }, [notifications, user?.id, queryClient]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const markAsRead = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
    },
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      if (!user?.id) return;
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('is_read', false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
    },
  });

  const deleteNotification = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
    },
  });

  const archiveNotification = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', notificationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
    },
  });

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead: markAsRead.mutate,
    markAllAsRead: markAllAsRead.mutate,
    deleteNotification: deleteNotification.mutate,
    archiveNotification: archiveNotification.mutate,
  };
}

// Helper to send a notification from client-side (calls edge function)
export async function sendNotification(params: {
  user_id: string;
  company_id: string;
  title: string;
  message: string;
  type?: string;
  category?: string;
  icon?: string;
  action_url?: string;
  metadata?: any;
  send_whatsapp?: boolean;
}) {
  try {
    const { data, error } = await supabase.functions.invoke('send-user-notification', {
      body: params,
    });
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Failed to send notification:', err);
    return null;
  }
}
