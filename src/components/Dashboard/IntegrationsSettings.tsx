
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Video, ExternalLink, CheckCircle, Loader2, AlertCircle, RefreshCw, Plug, MessageSquare, Slack, BarChart3, Globe } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';
import { useZoomIntegration } from '@/hooks/useZoomIntegration';
import { GOOGLE_OAUTH_ENABLED } from '@/config/featureFlags';
import ComingSoonIntegrationCard from '@/components/common/ComingSoonIntegrationCard';

const IntegrationsSettings = () => {
  const { 
    isConnected: googleConnected, 
    loading: googleLoading, 
    processingOAuth: googleProcessingOAuth,
    error: googleError,
    connectGoogle, 
    disconnectGoogle,
    checkConnection: checkGoogleConnection
  } = useGoogleCalendar();

  const {
    isConnected: zoomConnected,
    loading: zoomLoading,
    connectZoom,
    disconnectZoom,
    checkConnection: checkZoomConnection
  } = useZoomIntegration();

  const getGoogleStatusInfo = () => {
    if (googleProcessingOAuth) {
      return {
        icon: <Loader2 className="w-6 h-6 animate-spin text-[#2F428D]" />,
        badge: { variant: 'secondary' as const, text: 'Conectando...' },
        status: 'connecting'
      };
    }
    
    if (googleLoading) {
      return {
        icon: <Loader2 className="w-6 h-6 animate-spin text-yellow-600" />,
        badge: { variant: 'secondary' as const, text: 'Carregando...' },
        status: 'loading'
      };
    }
    
    if (googleError) {
      return {
        icon: <AlertCircle className="w-6 h-6 text-red-600" />,
        badge: { variant: 'destructive' as const, text: 'Erro' },
        status: 'error'
      };
    }
    
    if (googleConnected) {
      return {
        icon: <CheckCircle className="w-6 h-6 text-green-600" />,
        badge: { variant: 'default' as const, text: 'Conectado' },
        status: 'connected'
      };
    }
    
    return {
      icon: <Video className="w-6 h-6 text-[#2F428D]" />,
      badge: { variant: 'secondary' as const, text: 'Desconectado' },
      status: 'disconnected'
    };
  };

  const getZoomStatusInfo = () => {
    if (zoomLoading) {
      return {
        icon: <Loader2 className="w-6 h-6 animate-spin text-yellow-600" />,
        badge: { variant: 'secondary' as const, text: 'Carregando...' },
        status: 'loading'
      };
    }
    
    if (zoomConnected) {
      return {
        icon: <CheckCircle className="w-6 h-6 text-green-600" />,
        badge: { variant: 'default' as const, text: 'Conectado' },
        status: 'connected'
      };
    }
    
    return {
      icon: <Video className="w-6 h-6 text-[#2F428D]" />,
      badge: { variant: 'secondary' as const, text: 'Desconectado' },
      status: 'disconnected'
    };
  };

  const googleStatus = getGoogleStatusInfo();
  const zoomStatus = getZoomStatusInfo();
  const canInteractGoogle = !googleLoading && !googleProcessingOAuth;
  const canInteractZoom = !zoomLoading;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Integrações</h2>
        <p className="text-gray-600">
          Conecte seus serviços favoritos para ampliar as funcionalidades do sistema
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Google Meet Integration */}
        {GOOGLE_OAUTH_ENABLED ? (
        <Card className="shadow-lg border-0 rounded-2xl">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full flex items-center justify-center bg-[#F0F2FE]">
                {googleStatus.icon}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Google Meet</h3>
                <p className="text-sm text-gray-600">Calendário e reuniões automáticas</p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Badge variant={googleStatus.badge.variant}>
                {googleStatus.badge.text}
              </Badge>
              
              <div className="flex items-center space-x-2">
                {googleError && (
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={checkGoogleConnection}
                    className="min-w-[100px]"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Tentar Novamente
                  </Button>
                )}
                
                {canInteractGoogle && !googleError && (
                  <Button 
                    variant={googleConnected ? "outline" : "default"}
                    onClick={googleConnected ? disconnectGoogle : connectGoogle}
                    className="min-w-[120px]"
                    disabled={!canInteractGoogle}
                  >
                    {googleConnected ? (
                      "Desconectar"
                    ) : (
                      <>
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Conectar
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>

            <div className="text-sm text-gray-600">
              {googleConnected ? (
                <p>✅ Conectado - Reuniões automáticas ativadas</p>
              ) : googleError ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    ❌ {googleError}
                  </AlertDescription>
                </Alert>
              ) : googleProcessingOAuth ? (
                <p className="text-[#2F428D]">🔄 Processando conexão...</p>
              ) : (
                <p>Conecte para criar reuniões automaticamente</p>
              )}
            </div>

            {googleProcessingOAuth && (
              <div className="p-3 bg-[#DFE4FB] border border-[#B3BFF0] rounded-xl">
                <div className="flex items-center space-x-2">
                  <Loader2 className="h-4 w-4 text-[#2F428D] animate-spin" />
                  <span className="text-sm text-[#253573]">
                    Finalizando conexão com Google Meet...
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        ) : (
          <ComingSoonIntegrationCard
            icon={<Video className="h-6 w-6 text-[#2F428D]" />}
            iconBgClassName="bg-[#F0F2FE]"
            title="Google Meet"
            subtitle="Calendário e reuniões automáticas"
            description="A integração com Google Calendar e Google Meet estará disponível assim que finalizarmos a verificação oficial no Google Console."
          />
        )}

        {/* Google Search Console - Coming Soon */}
        <ComingSoonIntegrationCard
          icon={<Globe className="h-6 w-6 text-[#253573]" />}
          iconBgClassName="bg-[#F0F2FE]"
          title="Google Console (SEO)"
          subtitle="Indexação e visibilidade"
          description="Gerencie a presença do seu site no Google, solicite indexação e acompanhe erros de SEO diretamente pelo dashboard."
        />

        {/* Google Analytics - Coming Soon */}
        <ComingSoonIntegrationCard
          icon={<BarChart3 className="h-6 w-6 text-yellow-600" />}
          iconBgClassName="bg-yellow-50"
          title="Google Analytics"
          subtitle="Métricas de tráfego e conversão"
          description="Conecte seu GA4 para visualizar o comportamento dos usuários e taxas de conversão de suas campanhas em tempo real."
        />

        {/* Zoom Integration */}
        <Card className="shadow-lg border-0 rounded-2xl">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full flex items-center justify-center bg-[#F0F2FE]">
                {zoomStatus.icon}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Zoom</h3>
                <p className="text-sm text-gray-600">Reuniões e webinars</p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Badge variant={zoomStatus.badge.variant}>
                {zoomStatus.badge.text}
              </Badge>
              
              <div className="flex items-center space-x-2">
                {canInteractZoom && (
                  <Button 
                    variant={zoomConnected ? "outline" : "default"}
                    onClick={zoomConnected ? disconnectZoom : connectZoom}
                    className="min-w-[120px]"
                    disabled={!canInteractZoom}
                  >
                    {zoomConnected ? (
                      "Desconectar"
                    ) : (
                      <>
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Conectar
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>

            <div className="text-sm text-gray-600">
              {zoomConnected ? (
                <p>✅ Conectado - Reuniões Zoom ativadas</p>
              ) : zoomLoading ? (
                <p className="text-[#2F428D]">🔄 Carregando...</p>
              ) : (
                <p>Conecte para criar reuniões Zoom automaticamente</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* WhatsApp Business - Coming Soon */}
        <Card className="shadow-lg border-0 rounded-2xl opacity-70">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full flex items-center justify-center bg-green-50">
                <MessageSquare className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-700">WhatsApp Business</h3>
                <p className="text-sm text-gray-500">Automação de mensagens</p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Badge variant="outline">Em Breve</Badge>
              <Button disabled className="min-w-[120px]">
                Em Desenvolvimento
              </Button>
            </div>
            <div className="text-sm text-gray-500">
              <p>Integração com WhatsApp Business API para automação de mensagens e atendimento.</p>
            </div>
          </CardContent>
        </Card>

        {/* Slack - Coming Soon */}
        <Card className="shadow-lg border-0 rounded-2xl opacity-70">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full flex items-center justify-center bg-purple-50">
                <Slack className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-700">Slack</h3>
                <p className="text-sm text-gray-500">Notificações e comandos</p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Badge variant="outline">Em Breve</Badge>
              <Button disabled className="min-w-[120px]">
                Em Desenvolvimento
              </Button>
            </div>
            <div className="text-sm text-gray-500">
              <p>Receba notificações e gerencie reuniões diretamente no Slack.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-2 border-dashed border-gray-200">
        <CardContent className="p-8 text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
            <Plug className="h-6 w-6 text-gray-400" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">Mais integrações em breve</h3>
          <p className="text-gray-600">
            Estamos trabalhando para adicionar mais integrações como Microsoft Teams, Slack e outras ferramentas.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default IntegrationsSettings;
