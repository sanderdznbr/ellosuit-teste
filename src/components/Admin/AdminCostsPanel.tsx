import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, TrendingUp, Cpu, Mic, Mail, MessageSquare, BarChart3, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface UsageLog {
  id: string;
  company_id: string;
  user_id: string;
  service_type: string;
  action: string;
  model: string | null;
  input_tokens: number;
  output_tokens: number;
  characters_used: number;
  duration_seconds: number;
  file_size_bytes: number;
  unit_cost: number;
  total_cost: number;
  metadata: Record<string, any>;
  created_at: string;
}

interface CostSummary {
  service_type: string;
  total_cost: number;
  count: number;
  avg_cost: number;
}

const SERVICE_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  elevenlabs_tts: { label: 'ElevenLabs TTS', icon: <Mic className="h-4 w-4" />, color: 'bg-purple-500' },
  openai_tts: { label: 'OpenAI TTS', icon: <Mic className="h-4 w-4" />, color: 'bg-green-500' },
  lovable_ai: { label: 'Lovable AI', icon: <Cpu className="h-4 w-4" />, color: 'bg-[#374DA4]' },
  openai: { label: 'OpenAI GPT', icon: <Cpu className="h-4 w-4" />, color: 'bg-emerald-500' },
  send_email: { label: 'Email (Resend/Gmail)', icon: <Mail className="h-4 w-4" />, color: 'bg-orange-500' },
  whatsapp_message: { label: 'WhatsApp Mensagem', icon: <MessageSquare className="h-4 w-4" />, color: 'bg-green-600' },
  whatsapp_media: { label: 'WhatsApp Mídia', icon: <MessageSquare className="h-4 w-4" />, color: 'bg-green-700' },
  assemblyai: { label: 'AssemblyAI', icon: <Mic className="h-4 w-4" />, color: 'bg-red-500' },
  deepgram: { label: 'Deepgram', icon: <Mic className="h-4 w-4" />, color: 'bg-indigo-500' },
  livekit: { label: 'LiveKit', icon: <Cpu className="h-4 w-4" />, color: 'bg-pink-500' },
  pagarme: { label: 'Pagar.me', icon: <DollarSign className="h-4 w-4" />, color: 'bg-yellow-500' },
};

const COST_REFERENCE: Record<string, string> = {
  elevenlabs_tts: '~$0.30 / 1K chars (Multilingual v2)',
  openai_tts: '~$0.015 / 1K chars (TTS-1)',
  lovable_ai: '~$0.00-0.01 / req (Gemini Flash) | ~$0.01-0.10 / req (GPT-5)',
  send_email: '~$0.00 (Gmail) | ~$0.001 (Resend)',
  whatsapp_message: '~$0.00 (Baileys self-hosted)',
  assemblyai: '~$0.37 / hora de áudio',
  deepgram: '~$0.25 / hora de áudio',
  livekit: '~$0.004 / minuto por participante',
};

const AdminCostsPanel = () => {
  const [logs, setLogs] = useState<UsageLog[]>([]);
  const [summary, setSummary] = useState<CostSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30d');
  const [selectedService, setSelectedService] = useState<string>('all');

  const getDateRange = () => {
    const now = new Date();
    switch (period) {
      case '7d': return subDays(now, 7);
      case '30d': return subDays(now, 30);
      case 'month': return startOfMonth(now);
      case 'last_month': return startOfMonth(subMonths(now, 1));
      default: return subDays(now, 30);
    }
  };

  const getEndDate = () => {
    if (period === 'last_month') return endOfMonth(subMonths(new Date(), 1));
    return new Date();
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const startDate = getDateRange().toISOString();
      const endDate = getEndDate().toISOString();

      let query = supabase
        .from('api_usage_logs')
        .select('*')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: false })
        .limit(500);

      if (selectedService !== 'all') {
        query = query.eq('service_type', selectedService);
      }

      const { data, error } = await query;
      if (error) throw error;

      const typedData = (data || []) as unknown as UsageLog[];
      setLogs(typedData);

      // Calculate summary
      const grouped: Record<string, CostSummary> = {};
      typedData.forEach((log) => {
        if (!grouped[log.service_type]) {
          grouped[log.service_type] = { service_type: log.service_type, total_cost: 0, count: 0, avg_cost: 0 };
        }
        grouped[log.service_type].total_cost += Number(log.total_cost);
        grouped[log.service_type].count += 1;
      });
      Object.values(grouped).forEach(g => { g.avg_cost = g.total_cost / g.count; });
      setSummary(Object.values(grouped).sort((a, b) => b.total_cost - a.total_cost));
    } catch (err) {
      console.error('Error fetching usage logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [period, selectedService]);

  const totalCost = summary.reduce((sum, s) => sum + s.total_cost, 0);
  const totalRequests = summary.reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-destructive" />
            Custos da Plataforma
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tracking real de custos por serviço, empresa e período
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="month">Este mês</SelectItem>
              <SelectItem value="last_month">Mês passado</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Custo Total</p>
                <p className="text-3xl font-bold text-destructive">${totalCost.toFixed(4)}</p>
                <p className="text-xs text-muted-foreground mt-1">≈ R$ {(totalCost * 5.8).toFixed(2)}</p>
              </div>
              <DollarSign className="h-10 w-10 text-destructive/20" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total de Requisições</p>
                <p className="text-3xl font-bold text-foreground">{totalRequests.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">{summary.length} serviços ativos</p>
              </div>
              <BarChart3 className="h-10 w-10 text-muted-foreground/20" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Custo Médio / Req</p>
                <p className="text-3xl font-bold text-foreground">
                  ${totalRequests > 0 ? (totalCost / totalRequests).toFixed(6) : '0.00'}
                </p>
              </div>
              <TrendingUp className="h-10 w-10 text-muted-foreground/20" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="breakdown">
        <TabsList>
          <TabsTrigger value="breakdown">Por Serviço</TabsTrigger>
          <TabsTrigger value="logs">Logs Detalhados</TabsTrigger>
          <TabsTrigger value="reference">Tabela de Preços</TabsTrigger>
        </TabsList>

        {/* Breakdown by service */}
        <TabsContent value="breakdown" className="space-y-3 mt-4">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Carregando...</div>
          ) : summary.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Nenhum custo registrado</p>
                <p className="text-sm mt-1">Os custos serão registrados automaticamente conforme as APIs forem usadas.</p>
              </CardContent>
            </Card>
          ) : (
            summary.map((s) => {
              const info = SERVICE_LABELS[s.service_type] || { label: s.service_type, icon: <Cpu className="h-4 w-4" />, color: 'bg-gray-500' };
              const pct = totalCost > 0 ? (s.total_cost / totalCost) * 100 : 0;
              return (
                <Card key={s.service_type}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${info.color} text-white`}>{info.icon}</div>
                        <div>
                          <p className="font-medium text-foreground">{info.label}</p>
                          <p className="text-xs text-muted-foreground">{s.count} requisições • média ${s.avg_cost.toFixed(6)}/req</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-foreground">${s.total_cost.toFixed(4)}</p>
                        <Badge variant="secondary" className="text-xs">{pct.toFixed(1)}%</Badge>
                      </div>
                    </div>
                    <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full ${info.color} rounded-full transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* Detailed logs */}
        <TabsContent value="logs" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Últimas Chamadas de API</CardTitle>
                <Select value={selectedService} onValueChange={setSelectedService}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Filtrar serviço" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os serviços</SelectItem>
                    {Object.entries(SERVICE_LABELS).map(([key, val]) => (
                      <SelectItem key={key} value={key}>{val.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Carregando...</div>
              ) : logs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">Nenhum log encontrado</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-2 text-muted-foreground font-medium">Data</th>
                        <th className="text-left py-2 px-2 text-muted-foreground font-medium">Serviço</th>
                        <th className="text-left py-2 px-2 text-muted-foreground font-medium">Ação</th>
                        <th className="text-left py-2 px-2 text-muted-foreground font-medium">Modelo</th>
                        <th className="text-right py-2 px-2 text-muted-foreground font-medium">Tokens</th>
                        <th className="text-right py-2 px-2 text-muted-foreground font-medium">Custo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.slice(0, 100).map((log) => {
                        const info = SERVICE_LABELS[log.service_type] || { label: log.service_type, color: 'bg-gray-500' };
                        return (
                          <tr key={log.id} className="border-b border-border/50 hover:bg-muted/50">
                            <td className="py-2 px-2 text-xs text-muted-foreground whitespace-nowrap">
                              {format(new Date(log.created_at), 'dd/MM HH:mm', { locale: ptBR })}
                            </td>
                            <td className="py-2 px-2">
                              <Badge variant="secondary" className="text-xs">{info.label}</Badge>
                            </td>
                            <td className="py-2 px-2 text-xs">{log.action}</td>
                            <td className="py-2 px-2 text-xs text-muted-foreground">{log.model || '-'}</td>
                            <td className="py-2 px-2 text-xs text-right">
                              {log.input_tokens + log.output_tokens > 0
                                ? `${log.input_tokens}/${log.output_tokens}`
                                : log.characters_used > 0
                                ? `${log.characters_used} chars`
                                : '-'}
                            </td>
                            <td className="py-2 px-2 text-xs text-right font-mono font-medium">
                              ${Number(log.total_cost).toFixed(6)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reference prices */}
        <TabsContent value="reference" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tabela de Preços de Referência (USD)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(COST_REFERENCE).map(([key, price]) => {
                  const info = SERVICE_LABELS[key] || { label: key, icon: <Cpu className="h-4 w-4" />, color: 'bg-gray-500' };
                  return (
                    <div key={key} className="flex items-center justify-between py-2 border-b border-border/50">
                      <div className="flex items-center gap-3">
                        <div className={`p-1.5 rounded-lg ${info.color} text-white`}>{info.icon}</div>
                        <span className="font-medium text-foreground">{info.label}</span>
                      </div>
                      <span className="text-sm text-muted-foreground font-mono">{price}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminCostsPanel;
