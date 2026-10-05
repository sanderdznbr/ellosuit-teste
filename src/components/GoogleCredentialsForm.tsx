import React, { useState } from 'react';
import { GOOGLE_OAUTH_ENABLED } from '@/config/featureFlags';
import { Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ExternalLink, Key } from 'lucide-react';

interface GoogleCredentialsFormProps {
  onCredentialsSubmitted: () => void;
}

const GoogleCredentialsForm: React.FC<GoogleCredentialsFormProps> = ({ onCredentialsSubmitted }) => {
  const [credentials, setCredentials] = useState({
    clientId: '',
    clientSecret: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Aqui você faria a requisição para salvar as credenciais no Supabase
    // Por enquanto, simulamos um delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    onCredentialsSubmitted();
    setIsSubmitting(false);
  };

  if (!GOOGLE_OAUTH_ENABLED) {
    return (
      <Card className="max-w-2xl mx-auto border-dashed border-2 opacity-80">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-12 h-12 bg-[#F0F2FE] rounded-xl flex items-center justify-center mb-4">
            <Key className="h-6 w-6 text-[#2F428D]" />
          </div>
          <CardTitle className="flex items-center justify-center gap-2">
            Google Console
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" /> Em breve
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            A configuração direta do Google Console (OAuth 2.0) está temporariamente bloqueada enquanto 
            finalizamos a verificação oficial do aplicativo Ellosuit.
          </p>
          <Button disabled className="w-full rounded-xl">
            Configuração Indisponível
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          Configurar Credenciais do Google
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <AlertDescription>
            Você precisa configurar novas credenciais do Google Cloud Console para continuar usando a integração do Google Calendar.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <h3 className="font-semibold">Instruções:</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600">
            <li>Acesse o Google Cloud Console</li>
            <li>Vá para "APIs & Serviços" → "Credenciais"</li>
            <li>Clique em "Criar Credenciais" → "ID do cliente OAuth 2.0"</li>
            <li>Configure as URLs de redirecionamento autorizadas:</li>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
              <li><code>https://ellosuit.online/dashboard</code></li>
              <li><code>https://jwddiyuezqrpuakazvgg.supabase.co/functions/v1/google-calendar</code></li>
            </ul>
            <li>Copie o Client ID e Client Secret gerados</li>
          </ol>
        </div>

        <Button 
          variant="outline" 
          className="w-full"
          onClick={() => window.open('https://console.cloud.google.com/apis/credentials', '_blank')}
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Abrir Google Cloud Console
        </Button>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="clientId">Google Client ID</Label>
            <Input
              id="clientId"
              type="text"
              value={credentials.clientId}
              onChange={(e) => setCredentials(prev => ({ ...prev, clientId: e.target.value }))}
              placeholder="Ex: 123456789-abc123.apps.googleusercontent.com"
              required
            />
          </div>

          <div>
            <Label htmlFor="clientSecret">Google Client Secret</Label>
            <Input
              id="clientSecret"
              type="password"
              value={credentials.clientSecret}
              onChange={(e) => setCredentials(prev => ({ ...prev, clientSecret: e.target.value }))}
              placeholder="Ex: GOCSPX-abc123def456"
              required
            />
          </div>

          <Button 
            type="submit" 
            className="w-full"
            disabled={isSubmitting || !credentials.clientId || !credentials.clientSecret}
          >
            {isSubmitting ? 'Salvando...' : 'Salvar Credenciais'}
          </Button>
        </form>

        <Alert>
          <AlertDescription className="text-xs">
            <strong>Importante:</strong> Certifique-se de que as URLs de redirecionamento estão configuradas corretamente no Google Cloud Console. 
            Caso contrário, a integração não funcionará.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};

export default GoogleCredentialsForm;