
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
// Hooks de integração de reunião removidos - agora apenas em Configurações
import { supabase } from '@/integrations/supabase/client';
import { 
  Mail, 
  Plus, 
  CheckCircle, 
  Settings, 
  Trash2,
  Loader2,
  Clock
} from 'lucide-react';
import { GOOGLE_OAUTH_ENABLED } from '@/config/featureFlags';

const EmailProviders = () => {
  const [connectedAccounts, setConnectedAccounts] = useState<any[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  // Integrações de reunião movidas para Configurações

  useEffect(() => {
    if (user) {
      loadConnectedAccounts();
      checkForNewConnection();
    }
  }, [user]);

  const loadConnectedAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('user_email_accounts')
        .select('*')
        .eq('user_id', user?.id);

      if (error) throw error;
      setConnectedAccounts(data || []);
    } catch (error) {
      console.error('Error loading connected accounts:', error);
    }
  };

  const checkForNewConnection = async () => {
    // Prefer params stashed by the pre-boot interceptor in index.html so
    // supabase-js does not consume the `?code=` and swap the session.
    let code: string | null = null;
    let state: string | null = null;
    try {
      const raw = sessionStorage.getItem('__ellosuit_oauth_pending__');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.flow === 'gmail_auth') {
          if (user?.id && parsed.userId && parsed.userId !== user.id) {
            console.warn('🚫 Gmail OAuth intent user mismatch — descartando');
            sessionStorage.removeItem('__ellosuit_oauth_pending__');
            sessionStorage.removeItem('__ellosuit_oauth_intent__');
            return;
          }
          code = parsed.code ?? null;
          state = parsed.state ?? null;
          sessionStorage.removeItem('__ellosuit_oauth_pending__');
          sessionStorage.removeItem('__ellosuit_oauth_intent__');
        }
      }
    } catch {}

    if (code && state && state.startsWith('gmail_auth.') && user) {
      console.log('🔄 Processando conexão OAuth Gmail...');
      setIsConnecting(true);
      
      try {
        // Exchange code for tokens
        const { data, error } = await supabase.functions.invoke('google-calendar', {
          body: {
            action: 'exchange_code_gmail',
            code: code,
            user_id: user.id
          }
        });

        if (error) throw error;

        // Save the connected account
        await saveConnectedAccount('gmail', user.email || '');
        
        toast({
          title: "Gmail conectado com sucesso!",
          description: `Conta ${user.email} foi conectada para envio de emails.`,
        });

        // Clean URL parameters
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (error: any) {
        console.error('Erro ao processar OAuth:', error);
        toast({
          title: "Erro ao conectar Gmail",
          description: error.message || "Tente novamente.",
          variant: "destructive"
        });
      } finally {
        setIsConnecting(false);
      }
    }
  };

  const saveConnectedAccount = async (provider: string, email: string) => {
    try {
      // Get user's company_id
      const { data: companyData } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user?.id)
        .single();

      if (!companyData?.company_id) {
        console.error('No company found for user');
        return;
      }

      const { error } = await supabase
        .from('user_email_accounts')
        .upsert({
          user_id: user?.id,
          company_id: companyData.company_id,
          provider: provider as 'gmail' | 'outlook' | 'yahoo',
          email: email,
          connected_at: new Date().toISOString(),
          status: 'active'
        });

      if (error) throw error;
      await loadConnectedAccounts();
    } catch (error) {
      console.error('Error saving connected account:', error);
    }
  };

  const connectGmail = async () => {
    setIsConnecting(true);
    try {
      console.log('🔗 Iniciando conexão Gmail...');
      
      // Get Google Client ID from edge function
      const { data: clientData, error: clientError } = await supabase.functions.invoke('google-calendar', {
        body: { action: 'get_client_id' }
      });

      if (clientError || !clientData?.client_id) {
        throw new Error('Client ID não configurado');
      }

      // Redirect to Google OAuth with Gmail scopes
      const scopes = [
        'email',
        'profile', 
        'https://www.googleapis.com/auth/gmail.send'
      ].join(' ');

      // Bind this attempt to the current user via a random nonce carried
      // in `state`. The interceptor rejects callbacks whose state/nonce
      // do not match this pending intent.
      const nonceBytes = new Uint8Array(24);
      crypto.getRandomValues(nonceBytes);
      const nonce = Array.from(nonceBytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      sessionStorage.setItem(
        '__ellosuit_oauth_intent__',
        JSON.stringify({
          flow: 'gmail_auth',
          nonce,
          userId: user?.id ?? null,
          createdAt: Date.now(),
        })
      );

      // Redirect sempre no domínio canônico — nunca cair para
      // window.location.origin senão previews Lovable vazam no OAuth.
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${clientData.client_id}&` +
        `redirect_uri=${encodeURIComponent('https://www.ellosuit.app' + window.location.pathname)}&` +
        `response_type=code&` +
        `scope=${encodeURIComponent(scopes)}&` +
        `access_type=offline&` +
        `prompt=consent&` +
        `state=gmail_auth.${nonce}`;

      console.log('🔗 Redirecionando para Gmail OAuth...');
      window.location.href = authUrl;
    } catch (error: any) {
      console.error('Erro ao conectar Gmail:', error);
      toast({
        title: "Erro ao conectar Gmail",
        description: error.message || "Tente novamente em alguns instantes.",
        variant: "destructive"
      });
      setIsConnecting(false);
    }
  };

  const disconnectAccount = async (accountId: string) => {
    try {
      const { error } = await supabase
        .from('user_email_accounts')
        .delete()
        .eq('id', accountId);

      if (error) throw error;
      
      await loadConnectedAccounts();
      toast({
        title: "Conta desconectada",
        description: "A conta foi removida com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro ao desconectar",
        description: "Tente novamente em alguns instantes.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Provedores de Email</h2>
        <p className="text-gray-600">Conecte suas contas de email para envio de campanhas</p>
        <p className="text-sm text-[#2F428D] mt-1">
          💡 Para conectar Google Meet e Zoom, acesse as Configurações
        </p>
      </div>

      {/* Connected Email Accounts */}
      {connectedAccounts.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Contas Conectadas</h3>
          {connectedAccounts.map((account) => (
            <Card key={account.id} className="border-green-200 bg-green-50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">{account.email}</span>
                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                          {account.provider.charAt(0).toUpperCase() + account.provider.slice(1)}
                        </Badge>
                      </div>
                       <div className="flex items-center space-x-1 text-sm text-gray-500">
                         <CheckCircle className="h-3 w-3" />
                         <span>Conectado em {new Date(account.connected_at).toLocaleDateString('pt-BR')}</span>
                       </div>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm">
                      <Settings className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => disconnectAccount(account.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Available Providers */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Gmail */}
        {GOOGLE_OAUTH_ENABLED ? (
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
              <Mail className="h-6 w-6 text-red-600" />
            </div>
            <CardTitle>Gmail</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-sm text-gray-600">
              Conecte sua conta Gmail para enviar emails diretamente
            </p>
            <Button 
              onClick={connectGmail}
              disabled={isConnecting}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              {isConnecting ? 'Conectando...' : 'Conectar Gmail'}
            </Button>
          </CardContent>
        </Card>
        ) : (
          <Card className="opacity-70">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
                <Mail className="h-6 w-6 text-red-600" />
              </div>
              <CardTitle className="flex items-center justify-center gap-2">
                Gmail
                <Badge variant="outline" className="gap-1 text-xs">
                  <Clock className="h-3 w-3" /> Em breve
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-sm text-gray-600">
                Disponível assim que concluirmos a verificação oficial junto ao Google.
              </p>
              <Button disabled className="w-full">
                Em Desenvolvimento
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Outlook - Coming Soon */}
        <Card className="opacity-50">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-[#DFE4FB] rounded-lg flex items-center justify-center mb-4">
              <Mail className="h-6 w-6 text-[#2F428D]" />
            </div>
            <CardTitle>Outlook</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-sm text-gray-600">
              Conecte sua conta Outlook/Hotmail
            </p>
            <Button disabled className="w-full">
              Em breve
            </Button>
          </CardContent>
        </Card>

        {/* Yahoo - Coming Soon */}
        <Card className="opacity-50">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
              <Mail className="h-6 w-6 text-purple-600" />
            </div>
            <CardTitle>Yahoo</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-sm text-gray-600">
              Conecte sua conta Yahoo Mail
            </p>
            <Button disabled className="w-full">
              Em breve
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EmailProviders;
