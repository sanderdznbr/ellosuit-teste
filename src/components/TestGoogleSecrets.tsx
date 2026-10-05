import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const TestGoogleSecrets = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  const testSecrets = async () => {
    setLoading(true);
    try {
      console.log('🧪 Testando secrets do Google...');
      
      const { data, error } = await supabase.functions.invoke('test-google-secrets', {
        body: {}
      });

      if (error) {
        throw error;
      }

      console.log('📊 Resultado do teste:', data);
      setResult(data);

      toast({
        title: "Teste concluído",
        description: data.allSecretsAvailable ? "Todas as secrets estão disponíveis" : "Algumas secrets estão faltando",
        variant: data.allSecretsAvailable ? "default" : "destructive"
      });

    } catch (error) {
      console.error('❌ Erro no teste:', error);
      toast({
        title: "Erro no teste",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>🔍 Teste de Secrets Google</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={testSecrets} 
          disabled={loading}
          className="w-full"
        >
          {loading ? "Testando..." : "Testar Secrets"}
        </Button>

        {result && (
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <h3 className="font-semibold mb-2">Status das Secrets:</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>GOOGLE_CLIENT_ID:</span>
                  <span className={result.secrets.GOOGLE_CLIENT_ID.exists ? "text-green-600" : "text-red-600"}>
                    {result.secrets.GOOGLE_CLIENT_ID.exists ? "✅ OK" : "❌ FALTANDO"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>GOOGLE_CLIENT_SECRET:</span>
                  <span className={result.secrets.GOOGLE_CLIENT_SECRET.exists ? "text-green-600" : "text-red-600"}>
                    {result.secrets.GOOGLE_CLIENT_SECRET.exists ? "✅ OK" : "❌ FALTANDO"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>SUPABASE_URL:</span>
                  <span className={result.secrets.SUPABASE_URL.exists ? "text-green-600" : "text-red-600"}>
                    {result.secrets.SUPABASE_URL.exists ? "✅ OK" : "❌ FALTANDO"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>SUPABASE_SERVICE_ROLE_KEY:</span>
                  <span className={result.secrets.SUPABASE_SERVICE_ROLE_KEY.exists ? "text-green-600" : "text-red-600"}>
                    {result.secrets.SUPABASE_SERVICE_ROLE_KEY.exists ? "✅ OK" : "❌ FALTANDO"}
                  </span>
                </div>
              </div>
            </div>

            {result.secrets.GOOGLE_CLIENT_ID.exists && (
              <div className="p-4 bg-[#F0F2FE] rounded-lg text-sm">
                <p><strong>Client ID Preview:</strong> {result.secrets.GOOGLE_CLIENT_ID.preview}</p>
                <p><strong>Length:</strong> {result.secrets.GOOGLE_CLIENT_ID.length} caracteres</p>
              </div>
            )}

            <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TestGoogleSecrets;