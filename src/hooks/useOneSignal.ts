import { useEffect, useRef, useState, useCallback } from 'react';
import OneSignal from 'react-onesignal';
import { useAuth } from '@/hooks/useAuth';

const ONESIGNAL_APP_ID = "61ba07fc-0952-40dc-baa3-1a5783ac0b61";
const SAFARI_WEB_ID = "web.onesignal.auto.4cc30974-98f9-47ba-8e02-4635d2d477f2";

export function useOneSignal() {
  const { user } = useAuth();
  const initialized = useRef(false);
  const [permission, setPermission] = useState<'default' | 'granted' | 'denied'>('default');
  const [ready, setReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    if (initialized.current) return;

    if (typeof Notification === 'undefined') {
      setInitError('Notificações não suportadas neste navegador/contexto.');
      console.warn('[OneSignal] Notification API not available');
      return;
    }

    // OneSignal só é autorizado nos domínios de produção (ellosuit.online/app).
    // Em preview / localhost / lovable.app o SDK falha com erros barulhentos no
    // console — pulamos a inicialização nesses ambientes silenciosamente.
    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    const ALLOWED_HOSTS = ['ellosuit.online', 'www.ellosuit.online', 'ellosuit.app', 'www.ellosuit.app'];
    if (!ALLOWED_HOSTS.includes(host)) {
      initialized.current = true;
      return;
    }

    setPermission(Notification.permission as any);

    OneSignal.init({
      appId: ONESIGNAL_APP_ID,
      safari_web_id: SAFARI_WEB_ID,
      allowLocalhostAsSecureOrigin: true,
      serviceWorkerPath: '/OneSignalSDKWorker.js',
    } as any).then(() => {
      initialized.current = true;
      setReady(true);
      setInitError(null);
      console.log('[OneSignal] Initialized successfully');
      setPermission(Notification.permission as any);
    }).catch((err: any) => {
      // Mantém silencioso — o erro mais comum é "Can only be used on: <host>"
      // ou "SDK already initialized" em hot-reload.
      const msg = err?.message || 'Falha ao inicializar OneSignal';
      if (!/already initialized|Can only be used on/i.test(msg)) {
        console.warn('[OneSignal] Init skipped:', msg);
      }
      setInitError(msg);
    });
  }, []);

  // Associate Supabase user with OneSignal external ID
  useEffect(() => {
    if (!ready || !user?.id) return;

    const loginUser = async () => {
      try {
        await OneSignal.login(user.id);
        console.log('[OneSignal] Logged in user:', user.id);
      } catch (err) {
        console.error('[OneSignal] Login error:', err);
      }
    };
    loginUser();
  }, [user?.id, ready]);

  const requestPermission = useCallback(async () => {
    if (ready) {
      try {
        await (OneSignal as any).Notifications.requestPermission();
        const perm = Notification.permission as any;
        setPermission(perm);
        console.log('[OneSignal] Permission granted via SDK:', perm);
        
        // Re-login after permission granted to ensure device is registered
        if (perm === 'granted' && user?.id) {
          try {
            await OneSignal.login(user.id);
            console.log('[OneSignal] Re-logged in after permission grant:', user.id);
          } catch (e) {
            console.warn('[OneSignal] Re-login error:', e);
          }
        }
        return;
      } catch (err) {
        console.warn('[OneSignal] SDK permission failed, trying native:', err);
      }
    }

    // Native fallback
    if (typeof Notification !== 'undefined') {
      try {
        const result = await Notification.requestPermission();
        setPermission(result as any);
        console.log('[OneSignal] Permission via native:', result);
      } catch (err) {
        console.error('[OneSignal] Native permission error:', err);
        setInitError('Não foi possível solicitar permissão. Tente nas configurações do navegador.');
      }
    } else {
      setInitError('Notificações não suportadas neste navegador/contexto (iframe).');
    }
  }, [ready, user?.id]);

  return { permission, ready, requestPermission, initError };
}
