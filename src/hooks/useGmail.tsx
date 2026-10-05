import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';

export interface GmailAlias {
  email: string;
  displayName: string;
  isDefault: boolean;
  isPrimary: boolean;
  verificationStatus: string;
}

export const useGmail = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailAccount, setEmailAccount] = useState<any>(null);
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);
  const [aliases, setAliases] = useState<GmailAlias[]>([]);
  const [selectedAlias, setSelectedAlias] = useState<string>('');
  const [savedAlias, setSavedAlias] = useState<string>('');
  const [savingAlias, setSavingAlias] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const checkConnection = async () => {
    if (!user) {
      console.log('⚠️ Não há usuário logado');
      setIsConnected(false);
      setEmailAccount(null);
      return;
    }

    try {
      console.log('🔍 Verificando conexão Gmail para usuário:', user.id);
      
      const { data, error } = await supabase
        .from('user_email_accounts')
        .select('*')
        .eq('user_id', user.id)
        .eq('provider', 'gmail')
        .maybeSingle();

      if (error) {
        console.error('❌ Erro ao verificar conta de email:', error);
        setIsConnected(false);
        setEmailAccount(null);
        return;
      }

      if (data) {
        console.log('✅ Conta Gmail encontrada:', data.id);
        
        // Verificar se o token não expirou - se expirado, tentar refresh silenciosamente
        const now = new Date();
        const expiresAt = new Date(data.expires_at);
        
        if (now >= expiresAt && data.refresh_token) {
          console.log('⚠️ Token Gmail expirado, mas há refresh_token disponível - mantendo conexão');
          // Não remover a conta se há refresh_token - o backend fará o refresh automaticamente
        } else if (now >= expiresAt && !data.refresh_token) {
          console.log('⚠️ Token Gmail expirado sem refresh_token, removendo conta...');
          try {
            await supabase
              .from('user_email_accounts')
              .delete()
              .eq('id', data.id);
            
            setIsConnected(false);
            setEmailAccount(null);
            // Não mostrar toast aqui para evitar erro flash durante OAuth callback
            console.log('🗑️ Conta expirada removida silenciosamente');
            return;
          } catch (deleteError) {
            console.error('❌ Erro ao deletar conta expirada:', deleteError);
          }
        }
        
        setEmailAccount(data);
        setIsConnected(true);
      } else {
        console.log('⚠️ Nenhuma conta Gmail encontrada');
        setIsConnected(false);
        setEmailAccount(null);
      }
    } catch (error) {
      console.error('💥 Erro ao verificar conexão Gmail:', error);
      setIsConnected(false);
      setEmailAccount(null);
    }
  };

  const getGoogleClientId = async () => {
    try {
      console.log('🔑 Buscando Google Client ID para Gmail...');
      
      const { data, error } = await supabase.functions.invoke('google-calendar', {
        body: { action: 'get_client_id' }
      });

      if (error) {
        console.error('❌ Erro ao buscar Client ID:', error);
        throw error;
      }

      if (data?.client_id) {
        console.log('✅ Client ID obtido com sucesso');
        setGoogleClientId(data.client_id);
        return data.client_id;
      } else {
        throw new Error('Client ID não encontrado');
      }
    } catch (error) {
      console.error('💥 Erro ao obter Client ID:', error);
      toast({
        title: "Erro de Configuração",
        description: "Google Client ID não configurado. Verifique as configurações do Supabase.",
        variant: "destructive"
      });
      return null;
    }
  };

  const connectGmail = async () => {
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
      console.log('🔗 Iniciando conexão com Gmail...');
      
      // Detectar se estamos em um domínio customizado (não lovable.app/lovableproject.com)
      const isCustomDomain = 
        !window.location.hostname.includes('lovable.app') && 
        !window.location.hostname.includes('lovableproject.com');
      
      console.log('🌐 Domínio customizado:', isCustomDomain, window.location.hostname);
      
      // Obter Client ID da edge function
      const clientId = googleClientId || await getGoogleClientId();
      
      if (!clientId) {
        throw new Error('Não foi possível obter o Google Client ID');
      }

      // Scopes necessários para Gmail
      const scopes = [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile'
      ].join(' ');

      // Redirect sempre no domínio canônico — nunca cair para
      // window.location.origin (previews Lovable vazam para o OAuth do Google).
      const redirectUri = `https://www.ellosuit.app/dashboard/email`;
      
      console.log('📝 Configuração OAuth Gmail:', {
        clientId: clientId,
        redirectUri: redirectUri,
        scopes: scopes,
        isCustomDomain: isCustomDomain
      });
      
      // Construir URL OAuth manualmente para evitar bloqueio do auth-bridge
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${clientId}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `scope=${encodeURIComponent(scopes)}&` +
        `response_type=code&` +
        `access_type=offline&` +
        `prompt=consent&` +
        `state=gmail_auth`;

      console.log('🔗 URL de autorização Gmail:', authUrl);
      
      // Redirecionar diretamente (bypass auth-bridge)
      window.location.href = authUrl;
    } catch (error: any) {
      console.error('💥 Erro ao conectar Gmail:', error);
      toast({
        title: "Erro",
        description: `Erro ao conectar com Gmail: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const processOAuthCallback = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');

    // Se não há code nem error, não fazer nada (não é um callback OAuth)
    if (!code && !error) {
      return;
    }

    if (error) {
      console.error('❌ Erro OAuth Gmail:', error);
      
      let errorMessage = `Erro: ${error}`;
      if (error === 'access_denied') {
        errorMessage = 'Acesso negado. Você precisa autorizar o aplicativo para conectar o Gmail.';
      } else if (error.includes('redirect_uri_mismatch')) {
        errorMessage = 'Erro de configuração: Adicione https://ellosuit.online/dashboard nas "Authorized redirect URIs" do Google Console.';
      }
      
      toast({
        title: "Erro de Autorização Gmail",
        description: errorMessage,
        variant: "destructive"
      });
      // Limpar URL após erro
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    if (code && state === 'gmail_auth' && user) {
      console.log('🔄 Processando código OAuth Gmail...');
      setLoading(true);
      
      try {
        const { data, error } = await supabase.functions.invoke('google-calendar', {
          body: {
            action: 'exchange_code_gmail',
            code: code,
            user_id: user.id
          }
        });

        if (error) {
          console.error('❌ Erro da Edge Function Gmail:', error);
          throw new Error(`Erro ao conectar: ${error.message || 'Erro desconhecido'}`);
        }

        if (data?.success) {
          console.log('✅ OAuth Gmail processado com sucesso');
          
          // Limpar URL e redirecionar para página de email
          window.history.replaceState({}, document.title, '/dashboard/email');
          
          // Aguardar um pouco para garantir que a conta foi salva
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Verificar conexão
          await checkConnection();
          
          // Mostrar popup de sucesso
          toast({
            title: "✅ Gmail Conectado!",
            description: "Gmail foi conectado com sucesso! Agora você pode enviar emails diretamente da plataforma.",
            duration: 5000,
          });
        } else {
          throw new Error('Falha na conexão com Gmail');
        }
      } catch (error) {
        console.error('💥 Erro ao processar OAuth Gmail:', error);
        toast({
          title: "Erro",
          description: `Erro ao conectar: ${error.message}`,
          variant: "destructive"
        });
        
        // Limpar URL após erro
        window.history.replaceState({}, document.title, '/dashboard/email');
      } finally {
        setLoading(false);
      }
    }
  };

  const disconnectGmail = async () => {
    if (!user || !emailAccount) return;

    setLoading(true);
    
    try {
      console.log('🔌 Desconectando Gmail...');
      
      const { error } = await supabase
        .from('user_email_accounts')
        .delete()
        .eq('id', emailAccount.id);

      if (error) {
        throw error;
      }

      setIsConnected(false);
      setEmailAccount(null);
      setAliases([]);
      setSelectedAlias('');
      
      console.log('✅ Gmail desconectado');
      toast({
        title: "Sucesso",
        description: "Gmail desconectado com sucesso"
      });
    } catch (error) {
      console.error('💥 Erro ao desconectar Gmail:', error);
      toast({
        title: "Erro",
        description: "Erro ao desconectar Gmail",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAliases = async () => {
    if (!user) return;
    
    try {
      console.log('📋 Buscando aliases do Gmail...');
      const { data, error } = await supabase.functions.invoke('google-calendar', {
        body: { action: 'list_gmail_aliases', user_id: user.id }
      });

      if (error) {
        console.error('❌ Erro ao buscar aliases:', error);
        return;
      }

      if (data?.aliases) {
        console.log('✅ Aliases encontrados:', data.aliases.length);
        setAliases(data.aliases);
        // Set default alias
        const defaultAlias = data.aliases.find((a: GmailAlias) => a.isPrimary) || data.aliases[0];
        if (defaultAlias && !selectedAlias) {
          setSelectedAlias(defaultAlias.email);
        }
      }
    } catch (error) {
      console.error('💥 Erro ao buscar aliases:', error);
    }
  };

  const loadSavedAlias = async () => {
    if (!user) return;
    try {
      const { data: companyData } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!companyData?.company_id) return;

      const { data } = await supabase
        .from('user_email_preferences')
        .select('default_from_email')
        .eq('user_id', user.id)
        .eq('company_id', companyData.company_id)
        .maybeSingle();

      if (data?.default_from_email) {
        setSelectedAlias(data.default_from_email);
        setSavedAlias(data.default_from_email);
      }
    } catch (error) {
      console.error('Erro ao carregar alias salvo:', error);
    }
  };

  const savePreferredAlias = async (email: string) => {
    if (!user || !email) return;
    setSavingAlias(true);
    try {
      const { data: companyData } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!companyData?.company_id) throw new Error('Empresa não encontrada');

      const { error } = await supabase
        .from('user_email_preferences')
        .upsert({
          user_id: user.id,
          company_id: companyData.company_id,
          default_from_email: email,
        }, { onConflict: 'user_id,company_id' });

      if (error) throw error;

      setSavedAlias(email);
      toast({
        title: "✅ Remetente salvo!",
        description: `Emails serão enviados como ${email}`,
      });
    } catch (error: any) {
      console.error('Erro ao salvar alias:', error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar a preferência",
        variant: "destructive"
      });
    } finally {
      setSavingAlias(false);
    }
  };

  useEffect(() => {
    if (user) {
      checkConnection();
      getGoogleClientId();
      processOAuthCallback();
      loadSavedAlias();
    }
  }, [user]);

  // Fetch aliases when connected
  useEffect(() => {
    if (isConnected && user) {
      fetchAliases();
    }
  }, [isConnected, user]);

  return {
    isConnected,
    loading,
    emailAccount,
    aliases,
    selectedAlias,
    savedAlias,
    savingAlias,
    setSelectedAlias,
    savePreferredAlias,
    connectGmail,
    disconnectGmail,
    checkConnection,
    fetchAliases
  };
};