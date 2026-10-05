import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

type PermissionStatus = 'prompt' | 'granted' | 'denied';

// Declaração global consolidada para TypeScript
declare global {
  interface Window {
    webkit?: {
      messageHandlers?: {
        iosNotifications?: {
          postMessage: (message: any) => void;
        };
        usuarioLogado?: {
          postMessage: (message: string) => void;
        };
      };
    };
  }
}

export const useIOSPushNotifications = () => {
  const [isRegistered, setIsRegistered] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [deviceToken, setDeviceToken] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>('prompt');
  const { toast } = useToast();

  // Verificar se está rodando em WebView iOS
  const isIOSWebView = () => {
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  };

  // Enviar mensagem para o iOS nativo
  const sendMessageToIOS = (type: string, data?: any) => {
    try {
      if (window.webkit?.messageHandlers?.iosNotifications) {
        window.webkit.messageHandlers.iosNotifications.postMessage({
          type,
          ...data
        });
        return true;
      }
    } catch (error) {
      console.log('📱 webkit messageHandlers não disponível:', error);
    }
    return false;
  };

  useEffect(() => {
    if (!isIOSWebView()) {
      console.log('📱 Não é um dispositivo iOS');
      return;
    }

    // Verificar token salvo no localStorage
    const savedToken = localStorage.getItem('deviceToken');
    const savedStatus = localStorage.getItem('isRegistered');
    
    if (savedToken && savedStatus === 'true') {
      setDeviceToken(savedToken);
      setIsRegistered(true);
      setPermissionStatus('granted');
      console.log('✅ Token iOS carregado do localStorage:', savedToken.substring(0, 20) + '...');
    }

    // Listener para token recebido do iOS
    const handleDeviceToken = (event: CustomEvent) => {
      const { token, source } = event.detail;
      console.log('📱 Token recebido do iOS:', token.substring(0, 20) + '...', 'fonte:', source);
      
      setDeviceToken(token);
      setIsRegistered(true);
      setPermissionStatus('granted');
      setIsRegistering(false);
      
      toast({
        title: "✅ Notificações ativadas",
        description: "Seu iPhone está configurado para receber notificações push!",
      });
    };

    // Listener para status de permissão
    const handlePermissionStatus = (event: CustomEvent) => {
      const { status, error } = event.detail;
      console.log('🔔 Status de permissão recebido:', status);
      
      setPermissionStatus(status as PermissionStatus);
      setIsRegistering(false);
      
      if (status === 'denied') {
        toast({
          title: "❌ Notificações desativadas",
          description: error || "Ative nas Configurações > Notificações > [Nome do App]",
          variant: "destructive"
        });
      }
    };

    // Adicionar listeners
    window.addEventListener('deviceTokenReceived', handleDeviceToken as EventListener);
    window.addEventListener('pushPermissionStatus', handlePermissionStatus as EventListener);

    // Verificar status inicial
    setTimeout(() => {
      sendMessageToIOS('checkPermission');
    }, 1000);

    // Cleanup
    return () => {
      window.removeEventListener('deviceTokenReceived', handleDeviceToken as EventListener);
      window.removeEventListener('pushPermissionStatus', handlePermissionStatus as EventListener);
    };
  }, [toast]);

  const requestPermissions = async () => {
    if (!isIOSWebView()) {
      toast({
        title: "ℹ️ Aviso",
        description: "Esta funcionalidade só está disponível no app iOS",
        variant: "destructive"
      });
      return false;
    }

    setIsRegistering(true);
    console.log('🔔 Solicitando permissões via iOS nativo...');

    const success = sendMessageToIOS('requestPermission');
    
    if (!success) {
      setIsRegistering(false);
      toast({
        title: "❌ Erro",
        description: "Não foi possível comunicar com o iOS",
        variant: "destructive"
      });
      return false;
    }

    return true;
  };

  const sendTestNotification = async () => {
    if (!deviceToken) {
      toast({
        title: "❌ Erro",
        description: "Device token não encontrado",
        variant: "destructive"
      });
      return;
    }

    try {
      console.log('🧪 Enviando notificação teste iOS...');
      
      // Notificar o iOS sobre o teste
      sendMessageToIOS('sendTestNotification', {
        title: "🎉 Teste iOS Nativo",
        message: "Notificação push funcionando no iPhone!"
      });

      // Enviar via Supabase também
      const { supabase } = await import('@/integrations/supabase/client');
      const { data, error } = await supabase.functions.invoke('send-push', {
        body: {
          title: "🍎 Teste iOS Nativo",
          body: "Notificação push via APNs funcionando perfeitamente!",
          deviceToken: deviceToken
        }
      });

      if (error) {
        console.error('❌ Erro ao enviar teste:', error);
        throw error;
      }

      console.log('✅ Teste enviado:', data);
      
      toast({
        title: "📤 Teste enviado",
        description: "Verifique se a notificação chegou no seu iPhone",
      });
      
    } catch (error: any) {
      console.error('💥 Erro no teste:', error);
      toast({
        title: "❌ Erro",
        description: `Erro no teste: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  const resetRegistration = () => {
    setDeviceToken(null);
    setIsRegistered(false);
    setPermissionStatus('prompt');
    localStorage.removeItem('deviceToken');
    localStorage.removeItem('isRegistered');
    localStorage.removeItem('deviceSource');
    console.log('🔄 Registro iOS resetado');
  };

  return {
    isRegistered,
    isRegistering,
    deviceToken,
    permissionStatus,
    isIOSWebView: isIOSWebView(),
    requestPermissions,
    sendTestNotification,
    resetRegistration
  };
};
