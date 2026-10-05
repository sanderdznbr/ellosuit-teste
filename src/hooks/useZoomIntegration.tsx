import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';

export const useZoomIntegration = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [integration, setIntegration] = useState<any>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const checkConnection = async () => {
    if (!user) return;

    try {
      console.log('🔍 Verificando conexão Zoom para usuário:', user.id);
      
      const { data, error } = await supabase
        .from('meeting_integrations')
        .select('*')
        .eq('user_id', user.id)
        .eq('provider', 'zoom')
        .maybeSingle();

      if (error) {
        console.error('❌ Erro ao verificar integração Zoom:', error);
        setIsConnected(false);
        setIntegration(null);
        return;
      }

      if (data) {
        console.log('✅ Integração Zoom encontrada:', data.id);
        setIntegration(data);
        setIsConnected(true);
      } else {
        console.log('⚠️ Nenhuma integração Zoom encontrada');
        setIsConnected(false);
      }
    } catch (error) {
      console.error('💥 Erro ao verificar conexão Zoom:', error);
    }
  };

  const processZoomCallback = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');

    if (error) {
      console.error('❌ Erro OAuth Zoom:', error);
      
      let errorMessage = `Erro: ${error}`;
      if (error === 'access_denied') {
        errorMessage = 'Acesso negado. Você precisa autorizar o aplicativo para conectar o Zoom.';
      } else if (error.includes('redirect_uri_mismatch')) {
        errorMessage = 'Erro de configuração: Adicione https://www.ellosuit.online/dashboard nas "Redirect URLs" do Zoom Marketplace.';
      }
      
      toast({
        title: "Erro de Autorização Zoom",
        description: errorMessage,
        variant: "destructive"
      });
      // Limpar URL após erro
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }
    
    if (code && state === 'zoom_auth' && user) {
      console.log('🔄 Processando callback do Zoom...');
      setLoading(true);
      
      try {
        const { data, error } = await supabase.functions.invoke('zoom-integration', {
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
          console.log('✅ Zoom conectado com sucesso');
          
          // Limpar URL primeiro
          window.history.replaceState({}, document.title, '/dashboard');
          
          // Aguardar um pouco para garantir que a integração foi salva
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Verificar conexão
          await checkConnection();
          
          // Mostrar popup de sucesso
          toast({
            title: "✅ Zoom Conectado!",
            description: "Zoom foi conectado com sucesso! Agora você pode criar reuniões automaticamente.",
            duration: 5000,
          });
        } else {
          throw new Error('Falha na conexão com Zoom');
        }
      } catch (error: any) {
        console.error('💥 Erro ao processar callback Zoom:', error);
        toast({
          title: "Erro",
          description: `Erro ao conectar Zoom: ${error.message}`,
          variant: "destructive"
        });
        
        // Limpar URL após erro
        window.history.replaceState({}, document.title, '/dashboard');
      } finally {
        setLoading(false);
      }
    }
  };

  const connectZoom = async () => {
    if (!user) {
      toast({
        title: "Erro",
        description: "Usuário não autenticado",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    
    try {
      console.log('🔗 Iniciando conexão com Zoom...');
      
      const { data, error } = await supabase.functions.invoke('zoom-integration', {
        body: { action: 'get_auth_url', user_id: user.id }
      });

      if (error) {
        throw error;
      }

      if (data?.authUrl) {
        console.log('🔗 Redirecionando para Zoom OAuth...');
        window.location.href = data.authUrl;
      }
    } catch (error: any) {
      console.error('💥 Erro ao conectar Zoom:', error);
      toast({
        title: "Erro",
        description: `Erro ao conectar com Zoom: ${error.message}`,
        variant: "destructive"
      });
      setLoading(false);
    }
  };

  const getValidAccessToken = async () => {
    if (!integration) {
      throw new Error('Zoom not connected');
    }

    // Verificar se o token expirou
    const now = new Date();
    const expiresAt = new Date(integration.expires_at);
    
    if (now >= expiresAt) {
      console.log('🔄 Token Zoom expirado, renovando...');
      return await renewToken();
    }

    return integration.access_token;
  };

  const renewToken = async () => {
    if (!integration?.refresh_token) {
      throw new Error('No refresh token available');
    }

    try {
      console.log('🔄 Renovando token Zoom...');
      
      const { data, error } = await supabase.functions.invoke('zoom-integration', {
        body: {
          action: 'renew_token',
          refreshToken: integration.refresh_token,
          user_id: user?.id
        }
      });

      if (error) {
        throw error;
      }

      if (data?.success) {
        console.log('✅ Token Zoom renovado com sucesso');
        await checkConnection();
        return data.access_token;
      }

      throw new Error('Failed to renew Zoom token');
    } catch (error) {
      console.error('💥 Erro ao renovar token Zoom:', error);
      throw error;
    }
  };

  const disconnectZoom = async () => {
    if (!user || !integration) return;

    setLoading(true);
    
    try {
      console.log('🔌 Desconectando Zoom...');
      
      const { error } = await supabase
        .from('meeting_integrations')
        .delete()
        .eq('id', integration.id);

      if (error) {
        throw error;
      }

      setIsConnected(false);
      setIntegration(null);
      
      console.log('✅ Zoom desconectado');
      toast({
        title: "Sucesso",
        description: "Zoom desconectado com sucesso"
      });
    } catch (error) {
      console.error('💥 Erro ao desconectar Zoom:', error);
      toast({
        title: "Erro",
        description: "Erro ao desconectar Zoom",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      checkConnection();
      processZoomCallback();
    }
  }, [user]);

  return {
    isConnected,
    loading,
    integration,
    connectZoom,
    disconnectZoom,
    checkConnection,
    getValidAccessToken
  };
};
