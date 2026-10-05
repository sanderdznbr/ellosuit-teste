
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';

interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
  hangoutLink?: string;
  attendees?: { email: string }[];
}

interface GoogleCalendarResponse {
  events: GoogleCalendarEvent[];
}

export const useGoogleCalendar = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [integration, setIntegration] = useState<any>(null);
  const [processingOAuth, setProcessingOAuth] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const checkConnection = async () => {
    if (!user) return;

    try {
      console.log('🔍 Verificando conexão Google Calendar para usuário:', user.id);
      
      const { data, error } = await supabase
        .from('meeting_integrations')
        .select('*')
        .eq('user_id', user.id)
        .eq('provider', 'google_meet')
        .maybeSingle();

      if (error) {
        console.error('❌ Erro ao verificar integração Google Calendar:', error);
        setError('Erro ao verificar conexão com Google Calendar');
        setIsConnected(false);
        setIntegration(null);
        return;
      }

      if (data) {
        console.log('✅ Integração Google Calendar encontrada:', data.id);
        setIntegration(data);
        setIsConnected(true);
        setError(null);
        
        // Sincronizar automaticamente quando conectado
        await autoSyncCalendar();
      } else {
        console.log('⚠️ Nenhuma integração Google Calendar encontrada');
        setIsConnected(false);
        setError(null);
      }
    } catch (error) {
      console.error('💥 Erro ao verificar conexão Google Calendar:', error);
      setError('Erro ao verificar conexão');
    }
  };

  // Função de sincronização automática
  const autoSyncCalendar = async () => {
    if (!user) return;
    
    try {
      console.log('🔄 Sincronização automática iniciada...');
      
      // Obter company_id do usuário
      const { data: companyData } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!companyData?.company_id) {
        console.log('❌ Usuário não está associado a uma empresa');
        return;
      }

      // Buscar eventos do Google Calendar dos últimos 3 meses até próximos 6 meses
      const timeMin = new Date();
      timeMin.setMonth(timeMin.getMonth() - 3);
      
      const timeMax = new Date();
      timeMax.setMonth(timeMax.getMonth() + 6);

      console.log('📅 Buscando eventos do Google Calendar...', {
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString()
      });

      const { data: googleEvents, error: fetchError } = await supabase.functions.invoke('google-calendar', {
        body: {
          action: 'list_events',
          timeMin: timeMin.toISOString(),
          timeMax: timeMax.toISOString()
        }
      });

      if (fetchError) {
        console.error('❌ Erro ao buscar eventos:', fetchError);
        return;
      }

      if (!googleEvents?.events || googleEvents.events.length === 0) {
        console.log('📅 Nenhum evento encontrado no Google Calendar');
        return;
      }

      console.log(`📅 Encontrados ${googleEvents.events.length} eventos no Google Calendar`);

      // Obter eventos existentes do banco
      const { data: existingEvents } = await supabase
        .from('calendar_events')
        .select('google_event_id')
        .eq('company_id', companyData.company_id)
        .not('google_event_id', 'is', null);

      const existingEventIds = new Set(existingEvents?.map(e => e.google_event_id) || []);

      // Filtrar apenas eventos novos
      const newEvents = googleEvents.events.filter((event: any) => 
        !existingEventIds.has(event.id)
      );

      if (newEvents.length === 0) {
        console.log('✅ Todos os eventos já estão sincronizados');
        return;
      }

      console.log(`📅 Inserindo ${newEvents.length} novos eventos...`);

      // Criar eventos localmente em lotes
      const eventsToCreate = newEvents.map((event: any) => ({
        title: event.summary || 'Evento sem título',
        description: event.description || '',
        start_date: event.start?.dateTime || event.start?.date,
        end_date: event.end?.dateTime || event.end?.date,
        event_type: 'meeting' as const,
        meeting_link: event.hangoutLink || '',
        meeting_provider: event.hangoutLink ? 'google_meet' : '',
        attendees: event.attendees ? event.attendees.map((a: any) => a.email) : [],
        is_all_day: !event.start?.dateTime,
        google_event_id: event.id,
        company_id: companyData.company_id,
        created_by: user.id,
        color: '#4285F4' // Cor do Google
      }));

      // Inserir em lotes para evitar timeouts
      const batchSize = 10;
      let totalCreated = 0;
      for (let i = 0; i < eventsToCreate.length; i += batchSize) {
        const batch = eventsToCreate.slice(i, i + batchSize);
        
        const { error: insertError } = await supabase
          .from('calendar_events')
          .insert(batch);

        if (insertError) {
          console.error('❌ Erro ao inserir lote de eventos:', insertError);
        } else {
          totalCreated += batch.length;
        }
      }

      if (totalCreated > 0) {
        console.log(`✅ ${totalCreated} novos eventos sincronizados`);
      }

    } catch (error: any) {
      console.error('💥 Erro na sincronização automática:', error);
    }
  };

  const processGoogleCallback = async () => {
    // Read OAuth callback params stashed (and pre-validated) by the
    // interceptor in index.html. Additionally verify that the intent
    // belongs to the currently-logged-in user before proceeding.
    let code: string | null = null;
    let state: string | null = null;
    let error: string | null = null;
    try {
      const raw = sessionStorage.getItem('__ellosuit_oauth_pending__');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.flow === 'google_calendar_auth') {
          if (user?.id && parsed.userId && parsed.userId !== user.id) {
            console.warn('🚫 OAuth intent user mismatch — descartando callback');
            sessionStorage.removeItem('__ellosuit_oauth_pending__');
            sessionStorage.removeItem('__ellosuit_oauth_intent__');
            return;
          }
          code = parsed.code ?? null;
          state = parsed.state ?? null;
          error = parsed.error ?? null;
          sessionStorage.removeItem('__ellosuit_oauth_pending__');
          sessionStorage.removeItem('__ellosuit_oauth_intent__');
        }
      }
    } catch {}

    if (!code && !error) return;

    console.log('🔍 Verificando callback:', { code: !!code, state, error });

    if (error) {
      console.error('❌ Erro OAuth Google:', error);
      
      let errorMessage = `Erro: ${error}`;
      if (error === 'access_denied') {
        errorMessage = 'Acesso negado. Você precisa autorizar o aplicativo para conectar o Google Calendar.';
      } else if (error.includes('redirect_uri_mismatch')) {
        errorMessage = 'Erro de configuração: Adicione https://www.ellosuit.online/dashboard nas "Redirect URLs" do Google Cloud Console.';
      }
      
      setError(errorMessage);
      toast({
        title: "Erro de Autorização Google Calendar",
        description: errorMessage,
        variant: "destructive"
      });
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }
    
    if (code && state && state.startsWith('google_calendar_auth.') && user) {
      console.log('🔄 Processando callback do Google Calendar...');
      setLoading(true);
      setProcessingOAuth(true);
      
      try {
        const { data, error } = await supabase.functions.invoke('google-calendar', {
          body: {
            action: 'exchange_code',
            code: code,
            user_id: user.id
          }
        });

        if (error) {
          throw error;
        }

        if (data?.success) {
          console.log('✅ Google Calendar conectado com sucesso');
          
          // Limpar parâmetros da URL
          window.history.replaceState({}, document.title, '/dashboard');
          
          // Aguardar um momento para garantir que a integração foi salva
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Verificar conexão
          await checkConnection();
          
          // Mostrar página de sucesso
          const successModal = document.createElement('div');
          successModal.className = 'fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4';
          successModal.innerHTML = `
            <div class="bg-white rounded-2xl p-8 max-w-md w-full mx-4 text-center">
              <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
              </div>
              <h2 class="text-2xl font-bold text-gray-900 mb-2">
                Conexão Realizada com Sucesso!
              </h2>
              <p class="text-gray-600 mb-6">
                Seu Google Calendar foi conectado com sucesso. Agora você pode criar reuniões com Google Meet automaticamente.
              </p>
              <button id="closeSuccessModal" class="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition-colors">
                Continuar
              </button>
            </div>
          `;
          
          document.body.appendChild(successModal);
          
          // Fechar modal ao clicar no botão
          successModal.querySelector('#closeSuccessModal')?.addEventListener('click', () => {
            document.body.removeChild(successModal);
          });
          
          // Também fechar ao clicar fora do modal
          successModal.addEventListener('click', (e) => {
            if (e.target === successModal) {
              document.body.removeChild(successModal);
            }
          });
          
        } else {
          throw new Error('Falha na conexão com Google Calendar');
        }
      } catch (error: any) {
        console.error('💥 Erro ao processar callback Google Calendar:', error);
        setError(error.message);
        toast({
          title: "Erro",
          description: `Erro ao conectar Google Calendar: ${error.message}`,
          variant: "destructive"
        });
        
        window.history.replaceState({}, document.title, '/dashboard');
      } finally {
        setLoading(false);
        setProcessingOAuth(false);
      }
    }
  };

  const connectGoogleCalendar = async () => {
    if (!user) {
      toast({
        title: "Erro",
        description: "Usuário não autenticado",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      console.log('🔗 Iniciando conexão com Google Calendar...');

      // Generate a per-attempt nonce, bind it to the current user, and
      // append it to `state` so the callback can be verified strictly.
      const nonceBytes = new Uint8Array(24);
      crypto.getRandomValues(nonceBytes);
      const nonce = Array.from(nonceBytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      sessionStorage.setItem(
        '__ellosuit_oauth_intent__',
        JSON.stringify({
          flow: 'google_calendar_auth',
          nonce,
          userId: user.id,
          createdAt: Date.now(),
        })
      );

      const { data, error } = await supabase.functions.invoke('google-calendar', {
        body: { action: 'get_auth_url', user_id: user.id }
      });

      if (error) {
        throw error;
      }

      if (data?.authUrl) {
        // Replace the fixed `state=google_calendar_auth` from the edge
        // function with our nonce-bound state so the interceptor can
        // validate this specific attempt.
        const boundUrl = data.authUrl.replace(
          /state=google_calendar_auth(?![.\w])/,
          `state=google_calendar_auth.${nonce}`
        );
        console.log('🔗 Redirecionando para Google OAuth...');
        window.location.href = boundUrl;
      }
    } catch (error: any) {
      console.error('💥 Erro ao conectar Google Calendar:', error);
      setError(error.message);
      toast({
        title: "Erro",
        description: `Erro ao conectar com Google Calendar: ${error.message}`,
        variant: "destructive"
      });
      setLoading(false);
    }
  };

  const connectGoogle = connectGoogleCalendar;

  const createGoogleMeetEvent = async ({ title, description, start_date, end_date, attendees }: { title: string; description: string; start_date: string; end_date: string; attendees: string[] }) => {
    if (!integration?.access_token) {
      throw new Error('Google Calendar not connected');
    }

    try {
      console.log('📅 Criando evento no Google Calendar...');
      
      const { data, error } = await supabase.functions.invoke('google-calendar', {
        body: {
          action: 'create_event',
          accessToken: integration.access_token,
          eventData: {
            title,
            description,
            start_date,
            end_date,
            attendees
          }
        }
      });

      if (error) {
        throw error;
      }

      return {
        success: true,
        meetLink: data.meetLink,
        googleEventId: data.googleEventId
      };
    } catch (error) {
      console.error('💥 Erro ao criar evento no Google Calendar:', error);
      throw error;
    }
  };

  const deleteGoogleCalendarEvent = async (googleEventId: string) => {
    if (!integration?.access_token) {
      throw new Error('Google Calendar not connected');
    }

    try {
      console.log('🗑️ Deletando evento do Google Calendar...');
      
      const { data, error } = await supabase.functions.invoke('google-calendar', {
        body: {
          action: 'delete_event',
          googleEventId: googleEventId,
          userId: user?.id
        }
      });

      if (error) {
        throw error;
      }

      return { success: true };
    } catch (error) {
      console.error('💥 Erro ao deletar evento do Google Calendar:', error);
      throw error;
    }
  };

  const disconnectGoogleCalendar = async () => {
    if (!user || !integration) return;

    setLoading(true);
    
    try {
      console.log('🔌 Desconectando Google Calendar...');
      
      const { error } = await supabase
        .from('meeting_integrations')
        .delete()
        .eq('id', integration.id);

      if (error) {
        throw error;
      }

      setIsConnected(false);
      setIntegration(null);
      setError(null);
      
      console.log('✅ Google Calendar desconectado');
      toast({
        title: "Sucesso",
        description: "Google Calendar desconectado com sucesso"
      });
    } catch (error: any) {
      console.error('💥 Erro ao desconectar Google Calendar:', error);
      setError(error.message);
      toast({
        title: "Erro",
        description: "Erro ao desconectar Google Calendar",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const disconnectGoogle = disconnectGoogleCalendar;

  const syncGoogleCalendarEvents = async () => {
    return await fullResyncCalendar();
  };

  const fullResyncCalendar = async () => {
    if (!user) {
      toast({
        title: "Erro",
        description: "Usuário não autenticado",
        variant: "destructive"
      });
      return { created: 0, updated: 0 };
    }

    setLoading(true);
    
    try {
      console.log('🔄 Iniciando ressincronização completa...');
      
      // 1. Obter company_id do usuário
      const { data: companyData } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!companyData?.company_id) {
        throw new Error('Usuário não está associado a uma empresa');
      }

      // 2. Deletar todos os eventos do Google Calendar existentes
      console.log('🗑️ Removendo eventos existentes do Google Calendar...');
      const { error: deleteError } = await supabase
        .from('calendar_events')
        .delete()
        .eq('company_id', companyData.company_id)
        .not('google_event_id', 'is', null);

      if (deleteError) {
        console.error('Erro ao deletar eventos:', deleteError);
      }

      // 3. Buscar todos os eventos do Google Calendar
      console.log('📅 Buscando eventos do Google Calendar...');
      
      const timeMin = new Date();
      timeMin.setMonth(timeMin.getMonth() - 6);
      
      const timeMax = new Date();
      timeMax.setMonth(timeMax.getMonth() + 12); // Aumentar período para 12 meses

      const { data: googleEvents, error: fetchError } = await supabase.functions.invoke('google-calendar', {
        body: {
          action: 'list_events',
          timeMin: timeMin.toISOString(),
          timeMax: timeMax.toISOString()
        }
      });

      if (fetchError) {
        throw fetchError;
      }

      if (!googleEvents?.events || googleEvents.events.length === 0) {
        console.log('📅 Nenhum evento encontrado no Google Calendar');
        toast({
          title: "Sincronização Completa",
          description: "Nenhum evento encontrado no Google Calendar",
        });
        return { created: 0, updated: 0 };
      }

      console.log(`📅 Encontrados ${googleEvents.events.length} eventos no Google Calendar`);

      // 4. Criar eventos localmente
      const eventsToCreate = googleEvents.events.map((event: any) => ({
        title: event.summary || 'Evento sem título',
        description: event.description || '',
        start_date: event.start?.dateTime || event.start?.date,
        end_date: event.end?.dateTime || event.end?.date,
        event_type: 'meeting' as const,
        meeting_link: event.hangoutLink || '',
        meeting_provider: event.hangoutLink ? 'google_meet' : '',
        attendees: event.attendees ? event.attendees.map((a: any) => a.email) : [],
        is_all_day: !event.start?.dateTime,
        google_event_id: event.id,
        company_id: companyData.company_id,
        created_by: user.id,
        color: '#4285F4'
      }));

      // Inserir em lotes
      const batchSize = 10;
      let totalCreated = 0;
      for (let i = 0; i < eventsToCreate.length; i += batchSize) {
        const batch = eventsToCreate.slice(i, i + batchSize);
        
        const { error: insertError } = await supabase
          .from('calendar_events')
          .insert(batch);

        if (insertError) {
          console.error('Erro ao inserir lote de eventos:', insertError);
        } else {
          totalCreated += batch.length;
        }
      }

      console.log('✅ Ressincronização completa finalizada');
      
      toast({
        title: "✅ Sincronização Completa!",
        description: `${totalCreated} eventos foram sincronizados do Google Calendar`,
        duration: 5000,
      });

      return { created: totalCreated, updated: 0 };

    } catch (error: any) {
      console.error('💥 Erro na ressincronização:', error);
      toast({
        title: "Erro na Sincronização",
        description: `Erro: ${error.message}`,
        variant: "destructive"
      });
      return { created: 0, updated: 0 };
    } finally {
      setLoading(false);
    }
  };

  // Configurar sincronização automática a cada 5 minutos quando conectado
  useEffect(() => {
    if (isConnected && user) {
      console.log('⏰ Configurando sincronização automática...');
      
      // Sincronizar imediatamente
      autoSyncCalendar();
      
      // Configurar intervalo para sincronização automática
      const syncInterval = setInterval(() => {
        console.log('🔄 Executando sincronização automática...');
        autoSyncCalendar();
      }, 5 * 60 * 1000); // 5 minutos

      return () => {
        console.log('🛑 Parando sincronização automática');
        clearInterval(syncInterval);
      };
    }
  }, [isConnected, user]);

  useEffect(() => {
    if (user) {
      checkConnection();
      processGoogleCallback();
    }
  }, [user]);

  return {
    isConnected,
    loading,
    integration,
    processingOAuth,
    error,
    connectGoogleCalendar,
    connectGoogle,
    disconnectGoogleCalendar,
    disconnectGoogle,
    createGoogleMeetEvent,
    deleteGoogleCalendarEvent,
    checkConnection,
    syncGoogleCalendarEvents,
    fullResyncCalendar,
    autoSyncCalendar
  };
};
