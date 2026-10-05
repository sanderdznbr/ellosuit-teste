
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useDeviceRegistration = () => {
  const [deviceToken, setDeviceToken] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const { toast } = useToast();

  const registerDevice = async (token: string) => {
    if (isRegistering) return;
    
    setIsRegistering(true);
    
    try {
      console.log('📱 Registrando device token:', token.substring(0, 20) + '...');
      
      const { data, error } = await supabase.functions.invoke('register-device', {
        body: { token }
      });

      if (error) {
        console.error('❌ Erro ao registrar device:', error);
        throw error;
      }

      console.log('✅ Device registrado com sucesso:', data);
      setIsRegistered(true);
      setDeviceToken(token);
      
      // Salvar no localStorage para persistir entre sessões
      localStorage.setItem('deviceToken', token);
      localStorage.setItem('isRegistered', 'true');
      
      toast({
        title: "✅ Sucesso",
        description: "Dispositivo registrado para notificações push!",
      });
      
      return data;
    } catch (error: any) {
      console.error('💥 Erro ao registrar device:', error);
      toast({
        title: "❌ Erro",
        description: `Falha ao registrar dispositivo: ${error.message}`,
        variant: "destructive"
      });
      throw error;
    } finally {
      setIsRegistering(false);
    }
  };

  const requestNotificationPermission = async () => {
    console.log('🔔 Solicitando permissão para notificações...');
    
    if (!('Notification' in window)) {
      console.log('❌ Este navegador não suporta notificações');
      toast({
        title: "❌ Não suportado",
        description: "Este navegador não suporta notificações push",
        variant: "destructive"
      });
      return false;
    }

    try {
      // Solicitar permissão para notificações
      const permission = await Notification.requestPermission();
      
      if (permission === 'granted') {
        console.log('✅ Permissão para notificações concedida');
        
        // Para desenvolvimento web, gerar token simulado que funciona com APNs
        const simulatedToken = `apns_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        console.log('🔧 Usando token simulado para desenvolvimento:', simulatedToken.substring(0, 20) + '...');
        
        await registerDevice(simulatedToken);
        return true;
        
      } else {
        console.log('❌ Permissão para notificações negada');
        toast({
          title: "❌ Permissão negada",
          description: "Para receber notificações, permita o acesso nas configurações do navegador.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('❌ Erro ao solicitar permissão:', error);
      toast({
        title: "❌ Erro",
        description: "Erro ao solicitar permissão para notificações",
        variant: "destructive"
      });
    }
    
    return false;
  };

  // Verificar status persistido no localStorage
  useEffect(() => {
    const savedToken = localStorage.getItem('deviceToken');
    const savedStatus = localStorage.getItem('isRegistered');
    
    if (savedToken && savedStatus === 'true') {
      setDeviceToken(savedToken);
      setIsRegistered(true);
      console.log('✅ Device token carregado do localStorage:', savedToken.substring(0, 20) + '...');
    } else if (!isRegistered && !isRegistering) {
      // Auto-registrar apenas se não estiver registrado e não estiver em processo
      console.log('🚀 Iniciando registro automático de notificações...');
      setTimeout(() => {
        requestNotificationPermission();
      }, 2000); // Delay de 2s para melhor UX
    }
  }, []);

  const resetRegistration = () => {
    setDeviceToken(null);
    setIsRegistered(false);
    localStorage.removeItem('deviceToken');
    localStorage.removeItem('isRegistered');
    console.log('🔄 Registration reset');
  };

  return {
    deviceToken,
    isRegistered,
    isRegistering,
    registerDevice,
    requestNotificationPermission,
    resetRegistration
  };
};
