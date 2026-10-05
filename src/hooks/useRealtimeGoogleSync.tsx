
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';

export const useRealtimeGoogleSync = () => {
  const [syncing, setSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncStats, setSyncStats] = useState({
    synced: 0,
    updated: 0,
    deleted: 0,
    total_processed: 0
  });
  const { user } = useAuth();
  const { toast } = useToast();

  // Função para executar sincronização
  const syncGoogleCalendar = useCallback(async (showToast = true) => {
    if (!user || syncing) return;

    setSyncing(true);
    
    try {
      console.log('🔄 Iniciando sincronização em tempo real...');
      
      const { data, error } = await supabase.functions.invoke('sync-google-calendar', {
        body: {}
      });

      if (error) {
        throw error;
      }

      if (data?.success) {
        const stats = {
          synced: data.synced || 0,
          updated: data.updated || 0,
          deleted: data.deleted || 0,
          total_processed: data.total_processed || 0
        };
        
        setSyncStats(stats);
        setLastSyncTime(new Date());
        
        console.log('✅ Sincronização concluída:', stats);
        
        if (showToast) {
          const totalChanges = stats.synced + stats.updated + stats.deleted;
          
          if (totalChanges > 0) {
            toast({
              title: "✅ Calendário Sincronizado",
              description: `${stats.synced} novos, ${stats.updated} atualizados, ${stats.deleted} removidos`,
              duration: 5000
            });
          } else {
            toast({
              title: "✅ Calendário Atualizado",
              description: "Nenhuma alteração detectada",
              duration: 3000
            });
          }
        }

        return stats;
      } else {
        throw new Error(data?.error || 'Erro na sincronização');
      }
    } catch (error: any) {
      console.error('❌ Erro na sincronização:', error);
      
      if (showToast) {
        toast({
          title: "❌ Erro na Sincronização",
          description: error.message || 'Erro ao sincronizar Google Calendar',
          variant: "destructive"
        });
      }
      
      throw error;
    } finally {
      setSyncing(false);
    }
  }, [user, syncing, toast]);

  // Sincronização automática ao conectar
  useEffect(() => {
    if (user) {
      // Verificar se tem Google Calendar conectado
      const checkAndSync = async () => {
        try {
          const { data: integration } = await supabase
            .from('meeting_integrations')
            .select('id')
            .eq('user_id', user.id)
            .eq('provider', 'google_meet')
            .single();

          if (integration) {
            console.log('🔄 Google Calendar conectado, iniciando sync automático...');
            await syncGoogleCalendar(false); // Não mostrar toast na sincronização automática
          }
        } catch (error) {
          console.log('ℹ️ Google Calendar não conectado ou erro na verificação');
        }
      };

      checkAndSync();
    }
  }, [user, syncGoogleCalendar]);

  // Sincronização periódica a cada 5 minutos
  useEffect(() => {
    if (!user) return;

    const syncInterval = setInterval(async () => {
      try {
        // Verificar se ainda tem Google Calendar conectado
        const { data: integration } = await supabase
          .from('meeting_integrations')
          .select('id')
          .eq('user_id', user.id)
          .eq('provider', 'google_meet')
          .single();

        if (integration) {
          console.log('⏰ Executando sincronização periódica...');
          await syncGoogleCalendar(false); // Não mostrar toast na sincronização automática
        }
      } catch (error) {
        console.log('ℹ️ Pulando sincronização periódica - Google Calendar não conectado');
      }
    }, 5 * 60 * 1000); // 5 minutos

    return () => {
      clearInterval(syncInterval);
    };
  }, [user, syncGoogleCalendar]);

  // Sincronização ao focar na janela (quando usuário volta para a aplicação)
  useEffect(() => {
    const handleFocus = async () => {
      if (!user || syncing) return;

      try {
        // Verificar se tem Google Calendar conectado
        const { data: integration } = await supabase
          .from('meeting_integrations')
          .select('id')
          .eq('user_id', user.id)
          .eq('provider', 'google_meet')
          .single();

        if (integration) {
          console.log('👁️ Aplicação focada, sincronizando...');
          await syncGoogleCalendar(false);
        }
      } catch (error) {
        console.log('ℹ️ Google Calendar não conectado');
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [user, syncing, syncGoogleCalendar]);

  return {
    syncing,
    lastSyncTime,
    syncStats,
    syncGoogleCalendar
  };
};
