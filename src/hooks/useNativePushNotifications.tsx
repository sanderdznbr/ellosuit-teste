
import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type PermissionStatus = 'prompt' | 'granted' | 'denied';

export const useNativePushNotifications = () => {
  const [isRegistered, setIsRegistered] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [deviceToken, setDeviceToken] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>('prompt');
  const { toast } = useToast();

  // Verificar se está rodando em WebView com bridge nativo
  const isWebViewWithBridge = () => {
    return window.webkit?.messageHandlers?.iosNotifications;
  };

  // Enviar mensagem para o app nativo via bridge
  const sendMessageToNative = (message: any) => {
    if (isWebViewWithBridge()) {
      window.webkit?.messageHandlers?.iosNotifications?.postMessage(message);
      return true;
    }
    return false;
  };

  useEffect(() => {
    initializePushNotifications();
    
    // Listener para mensagens do app nativo
    const handleNativeMessage = (event: MessageEvent) => {
      const { type, data } = event.data;
      
      switch (type) {
        case 'pushToken':
          console.log('✅ Token recebido do app nativo:', data.token);
          setDeviceToken(data.token);
          setIsRegistered(true);
          registerDeviceToken(data.token);
          break;
        case 'pushPermission':
          console.log('🔔 Permissão recebida do app nativo:', data.status);
          setPermissionStatus(data.status as PermissionStatus);
          break;
        case 'pushError':
          console.error('❌ Erro do app nativo:', data.error);
          setIsRegistering(false);
          toast({
            title: "❌ Erro",
            description: data.error,
            variant: "destructive"
          });
          break;
      }
    };

    window.addEventListener('message', handleNativeMessage);
    return () => window.removeEventListener('message', handleNativeMessage);
  }, []);

  const initializePushNotifications = async () => {
    // Tentar bridge primeiro (para WebView)
    if (isWebViewWithBridge()) {
      console.log('🌉 Usando bridge JavaScript-Native');
      sendMessageToNative({ type: 'initialize' });
      return;
    }

    // Fallback para Capacitor nativo
    if (!Capacitor.isNativePlatform()) {
      console.log('📱 Não é uma plataforma nativa, usando notificações web');
      return;
    }

    console.log('🍎 Inicializando notificações push nativas...');

    try {
      // Verificar status da permissão
      const permResult = await PushNotifications.checkPermissions();
      const status = permResult.receive === 'prompt-with-rationale' ? 'prompt' : permResult.receive as PermissionStatus;
      setPermissionStatus(status);
      console.log('🔔 Status atual da permissão:', status);

      // Se já tem permissão, registrar automaticamente
      if (status === 'granted') {
        await registerForPushNotifications();
      }

      // Listeners para eventos de notificação
      PushNotifications.addListener('registration', (token: Token) => {
        console.log('✅ Token de push registrado:', token.value);
        setDeviceToken(token.value);
        setIsRegistered(true);
        registerDeviceToken(token.value);
      });

      PushNotifications.addListener('registrationError', (error: any) => {
        console.error('❌ Erro no registro de push:', error);
        setIsRegistering(false);
        toast({
          title: "❌ Erro",
          description: "Falha ao registrar para notificações push",
          variant: "destructive"
        });
      });

      PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
        console.log('📱 Notificação recebida:', notification);
        toast({
          title: notification.title || "Nova notificação",
          description: notification.body || "",
        });
      });

      PushNotifications.addListener('pushNotificationActionPerformed', (notification: ActionPerformed) => {
        console.log('👆 Notificação tocada:', notification);
      });
    } catch (error) {
      console.error('💥 Erro ao inicializar:', error);
    }
  };

  const requestPermissions = async () => {
    setIsRegistering(true);
    console.log('🔔 Solicitando permissões para notificações push...');

    try {
      // Tentar bridge primeiro
      if (isWebViewWithBridge()) {
        console.log('🌉 Solicitando permissão via bridge');
        sendMessageToNative({ type: 'requestPermission' });
        return true;
      }

      if (!Capacitor.isNativePlatform()) {
        toast({
          title: "ℹ️ Aviso",
          description: "Notificações push só funcionam em dispositivos móveis nativos",
          variant: "destructive"
        });
        return false;
      }

      const permResult = await PushNotifications.requestPermissions();
      console.log('📋 Resultado da permissão:', permResult);
      
      const status = permResult.receive === 'prompt-with-rationale' ? 'prompt' : permResult.receive as PermissionStatus;
      setPermissionStatus(status);

      if (status === 'granted') {
        console.log('✅ Permissão concedida! Registrando para notificações...');
        await registerForPushNotifications();
        return true;
      } else {
        console.log('❌ Permissão negada');
        toast({
          title: "❌ Permissão negada",
          description: "Para receber notificações, ative nas configurações do dispositivo",
          variant: "destructive"
        });
        return false;
      }
    } catch (error) {
      console.error('💥 Erro ao solicitar permissões:', error);
      toast({
        title: "❌ Erro",
        description: "Erro ao solicitar permissões para notificações",
        variant: "destructive"
      });
      return false;
    } finally {
      setIsRegistering(false);
    }
  };

  const registerForPushNotifications = async () => {
    try {
      console.log('📱 Registrando para notificações push...');
      await PushNotifications.register();
    } catch (error) {
      console.error('❌ Erro ao registrar para push:', error);
      setIsRegistering(false);
    }
  };

  const registerDeviceToken = async (token: string) => {
    try {
      console.log('📤 Enviando token para o servidor:', token.substring(0, 20) + '...');
      
      const { data, error } = await supabase.functions.invoke('register-device', {
        body: { token }
      });

      if (error) {
        console.error('❌ Erro ao registrar token no servidor:', error);
        throw error;
      }

      console.log('✅ Token registrado no servidor com sucesso');
      
      // Salvar no localStorage
      localStorage.setItem('nativeDeviceToken', token);
      localStorage.setItem('isNativeRegistered', 'true');
      
      toast({
        title: "✅ Sucesso",
        description: "Notificações push ativadas com sucesso!",
      });
      
    } catch (error: any) {
      console.error('💥 Erro ao registrar token:', error);
      toast({
        title: "❌ Erro",
        description: `Falha ao registrar: ${error.message}`,
        variant: "destructive"
      });
    }
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
      console.log('🧪 Enviando notificação teste...');
      
      const { data, error } = await supabase.functions.invoke('send-push', {
        body: {
          title: "🎉 Teste iOS Bridge",
          body: "Notificação push funcionando via bridge JavaScript-Native!",
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
    localStorage.removeItem('nativeDeviceToken');
    localStorage.removeItem('isNativeRegistered');
    console.log('🔄 Registro resetado');
  };

  return {
    isRegistered,
    isRegistering,
    deviceToken,
    permissionStatus,
    isNativePlatform: Capacitor.isNativePlatform() || isWebViewWithBridge(),
    isWebViewWithBridge: isWebViewWithBridge(),
    requestPermissions,
    sendTestNotification,
    resetRegistration
  };
};
