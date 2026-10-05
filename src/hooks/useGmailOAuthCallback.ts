import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

/**
 * Processa o callback OAuth do Gmail em QUALQUER rota do dashboard.
 *
 * O Google redireciona para /dashboard/email?code=...&state=gmail_auth, mas se o
 * usuário estiver com bundle/cache antigo (ou o redirect registrado no console do
 * Google apontar para /dashboard), o código chegaria numa rota que não o processa
 * e a conexão se perde silenciosamente. Este hook garante que o código é trocado
 * e a conta salva independentemente da rota de destino, e então leva o usuário
 * para /dashboard/email, onde o status "Conectado" é exibido.
 *
 * Na própria /dashboard/email quem processa é o useGmail (página) — este hook
 * ignora a rota para não trocar o mesmo código duas vezes (códigos são single-use).
 */
export const useGmailOAuthCallback = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current || !user) return;

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const oauthError = params.get('error');

    if (!code && !oauthError) return;
    if (state !== 'gmail_auth') return;
    // Na página de email o useGmail já processa o callback — evitar troca duplicada.
    if (location.pathname.endsWith('/dashboard/email')) return;

    processed.current = true;

    // Limpa a URL imediatamente (evita reprocessamento em re-render/refresh).
    window.history.replaceState({}, document.title, location.pathname);

    const finish = async () => {
      if (oauthError) {
        console.error('❌ OAuth Gmail (callback global):', oauthError);
        let description = `Erro: ${oauthError}`;
        if (oauthError === 'access_denied') {
          description = 'Acesso negado. Você precisa autorizar o aplicativo para conectar o Gmail.';
        } else if (oauthError.includes('redirect_uri_mismatch')) {
          description = 'Erro de configuração: adicione https://www.ellosuit.app/dashboard/email nas "Authorized redirect URIs" do Google Console.';
        }
        toast({ title: 'Erro de Autorização Gmail', description, variant: 'destructive' });
        navigate('/dashboard/email', { replace: true });
        return;
      }

      try {
        console.log('🔄 Trocando código OAuth Gmail (callback global)...');
        const { data, error } = await supabase.functions.invoke('google-calendar', {
          body: { action: 'exchange_code_gmail', code, user_id: user.id }
        });

        if (error) throw new Error(error.message || 'Erro desconhecido');
        if (!data?.success) throw new Error('Falha ao salvar a conta Gmail');

        console.log('✅ Gmail conectado (callback global):', data.email);
        toast({
          title: '✅ Gmail Conectado!',
          description: `Conta ${data.email} conectada com sucesso.`,
          duration: 5000
        });
      } catch (err: any) {
        console.error('💥 Erro no callback global do Gmail:', err);
        toast({
          title: 'Erro ao conectar Gmail',
          description: err?.message || 'Não foi possível concluir a conexão.',
          variant: 'destructive'
        });
      } finally {
        navigate('/dashboard/email', { replace: true });
      }
    };

    finish();
  }, [user, location.pathname, navigate, toast]);
};
