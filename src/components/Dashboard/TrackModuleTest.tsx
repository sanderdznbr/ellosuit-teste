import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function TrackModuleTest() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);

  const runTests = async () => {
    setLoading(true);
    setResults([]);
    const testResults = [];

    // 1. Auth Test
    testResults.push({
      name: 'Autenticação',
      status: user ? 'success' : 'error',
      message: user ? `Logado como ${user.email}` : 'Usuário não autenticado',
    });

    try {
      // 2. Database Tables Test
      const tables = ['trackable_documents', 'tracked_links', 'emails', 'lead_funnels'];
      for (const table of tables) {
        const { error } = await (supabase as any).from(table).select('id').limit(1);
        testResults.push({
          name: `Tabela: ${table}`,
          status: error ? 'error' : 'success',
          message: error ? `Erro: ${error.message}` : 'Acessível',
        });
      }

      // 3. Storage Buckets Test
      const buckets = ['documents'];
      for (const bucket of buckets) {
        const { error } = await supabase.storage.from(bucket).list('', { limit: 1 });
        testResults.push({
          name: `Storage: ${bucket}`,
          status: error ? 'error' : 'success',
          message: error ? `Erro: ${error.message}` : 'Acessível',
        });
      }

      // 4. Edge Function Test (OPTIONS document-tracking)
      try {
        const response = await fetch('https://jwddiyuezqrpuakazvgg.supabase.co/functions/v1/document-tracking', {
          method: 'OPTIONS',
        });
        testResults.push({
          name: 'Edge Function: document-tracking',
          status: response.ok || response.status === 204 ? 'success' : 'error',
          message: `Status: ${response.status}`,
        });
      } catch (e: any) {
        testResults.push({
          name: 'Edge Function: document-tracking',
          status: 'error',
          message: `Falha na conexão: ${e.message}`,
        });
      }

    } catch (e: any) {
      testResults.push({
        name: 'Erro Geral',
        status: 'error',
        message: e.message,
      });
    }

    setResults(testResults);
    setLoading(false);
  };

  useEffect(() => {
    if (user) runTests();
  }, [user]);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Diagnóstico do Módulo Track</h1>
          <p className="text-muted-foreground">Verificação end-to-end de tabelas, storage e funções.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.location.href = '/dashboard/track'} className="rounded-xl">
            Voltar ao Track
          </Button>
          <Button onClick={runTests} disabled={loading} className="gap-2 rounded-xl">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Reexecutar Testes
          </Button>
        </div>
      </div>

      <div className="grid gap-3">
        {results.map((res, i) => (
          <Card key={i} className="overflow-hidden border-border/60 rounded-2xl">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {res.status === 'success' ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : res.status === 'warning' ? (
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                <div>
                  <p className="font-medium text-sm">{res.name}</p>
                  <p className="text-xs text-muted-foreground">{res.message}</p>
                </div>
              </div>
              <Badge variant={res.status === 'success' ? 'default' : 'destructive'} className={res.status === 'success' ? 'bg-green-500/10 text-green-600 border-0' : ''}>
                {res.status.toUpperCase()}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-3xl border-border/60">
        <CardHeader>
          <CardTitle className="text-base font-bold">Resumo da Revisão E2E</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
              <span><strong>Controle de Acesso:</strong> RLS revisado para <code>trackable_documents</code> para permitir inserção via dashboard.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
              <span><strong>Extração de PDF:</strong> Componente <code>DocumentTrackingDashboard</code> configurado para processar páginas automaticamente via PDF.js.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
              <span><strong>Encurtador:</strong> Hook <code>useTrackedLinks</code> e UI revisados para criação e exclusão imediata.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
              <span><strong>Email & Leads:</strong> Visualizadores de analytics integrados com Recharts para monitoramento em tempo real.</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
