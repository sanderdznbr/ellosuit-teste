import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Eye, TrendingUp, Users, BarChart3, Lightbulb, ArrowUp, ArrowDown, Sparkles, 
  Target, Zap, Mail, MessageSquare, FileText, CalendarDays, RefreshCw, Info, 
  AlertTriangle, Bot, Video, Phone, ShieldAlert, Rocket, Brain, 
  CheckCircle2, XCircle, Clock, Flame, ThumbsUp, ThumbsDown, Minus,
  ArrowRight, Star, TrendingDown, Activity, Mic
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface InsightData {
  type: 'positive' | 'warning' | 'critical' | 'info' | 'opportunity';
  title: string;
  description: string;
  metric: string;
  action?: string;
}

interface ChurnAlert {
  risk_level: 'high' | 'medium' | 'low';
  signal: string;
  recommendation: string;
}

interface StrategicTip {
  category: string;
  tip: string;
  impact: 'alto' | 'médio' | 'baixo';
  effort: 'fácil' | 'médio' | 'complexo';
}

interface VisionData {
  metrics: {
    total_docs: number;
    total_clients: number;
    active_clients: number;
    inactive_clients: number;
    new_clients_week: number;
    new_clients_month: number;
    emails_sent: number;
    email_open_rate: number;
    link_clicks: number;
    doc_views: number;
    events_this_week: number;
    whatsapp_conversations: number;
    unread_messages: number;
    active_habits: number;
    docs_change: number;
    emails_change: number;
    ai_enabled_conversations: number;
    total_meetings: number;
    meeting_minutes: number;
    confirmed_bookings: number;
    cancelled_bookings: number;
    active_agents: number;
    total_agents: number;
    active_flows: number;
    total_flow_executions: number;
    pipeline_stages: Record<string, number>;
  };
  ai: {
    insights: InsightData[];
    churn_alerts: ChurnAlert[];
    meeting_analysis: {
      key_topics: string[];
      action_items: string[];
      sentiment: string;
      summary: string;
    };
    conversation_analysis: {
      overall_sentiment: string;
      hot_leads: number;
      needs_attention: number;
      common_topics: string[];
      summary: string;
    };
    strategic_tips: StrategicTip[];
    summary: string;
    performance: {
      email_engagement: number;
      client_growth: number;
      content_activity: number;
      communication: number;
      automation_usage: number;
      meeting_productivity: number;
    };
    pipeline_health: {
      score: number;
      bottleneck: string;
      recommendation: string;
    };
  };
}

const insightColors: Record<string, { bg: string; border: string; text: string; icon: React.ElementType }> = {
  positive: { bg: 'bg-emerald-50 dark:bg-emerald-950/40', border: 'border-emerald-500', text: 'text-emerald-600', icon: TrendingUp },
  warning: { bg: 'bg-amber-50 dark:bg-amber-950/40', border: 'border-amber-500', text: 'text-amber-600', icon: AlertTriangle },
  critical: { bg: 'bg-red-50 dark:bg-red-950/40', border: 'border-red-500', text: 'text-red-600', icon: ShieldAlert },
  info: { bg: 'bg-[#F0F2FE] dark:bg-blue-950/40', border: 'border-[#374DA4]', text: 'text-[#2F428D]', icon: Info },
  opportunity: { bg: 'bg-purple-50 dark:bg-purple-950/40', border: 'border-purple-500', text: 'text-purple-600', icon: Rocket },
};

const sentimentIcon: Record<string, { icon: React.ElementType; color: string }> = {
  positivo: { icon: ThumbsUp, color: 'text-emerald-500' },
  negativo: { icon: ThumbsDown, color: 'text-red-500' },
  neutro: { icon: Minus, color: 'text-gray-500' },
  misto: { icon: Activity, color: 'text-amber-500' },
};

const pipelineLabels: Record<string, string> = {
  novo: 'Novos',
  em_atendimento: 'Em Atendimento',
  aguardando: 'Aguardando',
  qualificado: 'Qualificados',
  finalizado: 'Finalizados',
  sem_estagio: 'Sem Estágio',
};

const pipelineColors: Record<string, string> = {
  novo: 'bg-[#374DA4]',
  em_atendimento: 'bg-amber-500',
  aguardando: 'bg-[#2F428D]',
  qualificado: 'bg-emerald-500',
  finalizado: 'bg-gray-400',
  sem_estagio: 'bg-gray-300',
};

const categoryIcons: Record<string, React.ElementType> = {
  vendas: Target,
  marketing: Zap,
  atendimento: MessageSquare,
  produtividade: Rocket,
  automação: Bot,
};

const impactColors: Record<string, string> = {
  alto: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
  médio: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  baixo: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
};

const effortColors: Record<string, string> = {
  fácil: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
  médio: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  complexo: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
};

const ElloVisionDashboard = () => {
  const [data, setData] = useState<VisionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchVision = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error('Faça login para ver os insights'); return; }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ello-vision`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );

      if (res.status === 429) { toast.error('Limite de requisições. Tente novamente em alguns segundos.'); return; }
      if (res.status === 402) { toast.error('Créditos insuficientes para análise IA.'); return; }
      if (!res.ok) throw new Error('Failed to fetch');
      const result = await res.json();
      setData(result);
      if (isRefresh) toast.success('Análise atualizada!');
    } catch (err) {
      console.error('Ello Vision error:', err);
      toast.error('Erro ao carregar análise');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchVision(); }, [fetchVision]);

  if (loading) {
    return (
      <div className="page-content p-4 md:p-6 space-y-6 bg-muted/30 min-h-screen">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
              <Eye className="h-7 w-7 text-primary" /> Ello Vision
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Analisando seus dados com IA...</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {[...Array(12)].map((_, i) => (
            <Card key={i} className="border-none shadow-md rounded-xl bg-card">
              <CardContent className="p-4 space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-7 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="border-none shadow-lg rounded-2xl bg-card">
              <CardContent className="p-6 space-y-4">
                <Skeleton className="h-5 w-32" />
                {[...Array(3)].map((_, j) => <Skeleton key={j} className="h-16 w-full" />)}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const metricCards = [
    { label: 'Clientes', value: data.metrics.total_clients, icon: Users, sub: `${data.metrics.active_clients} ativos` },
    { label: 'Novos (semana)', value: data.metrics.new_clients_week, icon: TrendingUp, color: 'text-emerald-500' },
    { label: 'Emails Enviados', value: data.metrics.emails_sent, change: data.metrics.emails_change, icon: Mail },
    { label: 'Taxa Abertura', value: `${data.metrics.email_open_rate}%`, icon: Eye },
    { label: 'WhatsApp', value: data.metrics.whatsapp_conversations, icon: MessageSquare, sub: data.metrics.unread_messages > 0 ? `${data.metrics.unread_messages} não lidas` : undefined },
    { label: 'IA Ativa', value: data.metrics.ai_enabled_conversations, icon: Bot, sub: `${data.metrics.active_agents} agentes` },
    { label: 'Reuniões', value: data.metrics.total_meetings, icon: Video, sub: `${data.metrics.meeting_minutes} min` },
    { label: 'Agendamentos', value: data.metrics.confirmed_bookings, icon: CalendarDays, sub: data.metrics.cancelled_bookings > 0 ? `${data.metrics.cancelled_bookings} cancelados` : undefined },
    { label: 'Documentos', value: data.metrics.total_docs, change: data.metrics.docs_change, icon: FileText },
    { label: 'Cliques Links', value: data.metrics.link_clicks, icon: Zap },
    { label: 'Views Docs', value: data.metrics.doc_views, icon: BarChart3 },
    { label: 'Chatbot Exec.', value: data.metrics.total_flow_executions, icon: Bot, sub: `${data.metrics.active_flows} fluxos` },
  ];

  const totalPipeline = Object.values(data.metrics.pipeline_stages).reduce((s, v) => s + v, 0);

  const SentimentBadge = ({ sentiment }: { sentiment: string }) => {
    const s = sentimentIcon[sentiment] || sentimentIcon.neutro;
    const Icon = s.icon;
    return (
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-muted ${s.color}`}>
        <Icon className="h-3.5 w-3.5" />
        {sentiment.charAt(0).toUpperCase() + sentiment.slice(1)}
      </div>
    );
  };

  return (
    <div className="page-content p-4 md:p-6 space-y-6 bg-muted/30 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
            <Eye className="h-7 w-7 text-primary" /> Ello Vision
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">Análise completa do seu negócio com inteligência artificial</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => fetchVision(true)} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Analisando...' : 'Atualizar'}
        </Button>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {metricCards.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <Card key={index} className="border-none shadow-md rounded-xl bg-card hover:shadow-lg transition-shadow">
              <CardContent className="p-3 md:p-4">
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon className={`h-3.5 w-3.5 ${'color' in metric && metric.color ? metric.color : 'text-muted-foreground'}`} />
                  <p className="text-xs text-muted-foreground truncate">{metric.label}</p>
                </div>
                <div className="flex items-end justify-between mt-1">
                  <p className="text-xl md:text-2xl font-bold text-foreground">
                    {typeof metric.value === 'number' ? metric.value.toLocaleString() : metric.value}
                  </p>
                  {'change' in metric && metric.change !== undefined && metric.change !== 0 && (
                    <div className={`flex items-center gap-0.5 text-xs ${metric.change > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {metric.change > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                      {Math.abs(metric.change)}%
                    </div>
                  )}
                </div>
                {'sub' in metric && metric.sub && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">{metric.sub}</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Pipeline Health + Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline Health */}
        <Card className="border-none shadow-lg rounded-2xl bg-card">
          <CardHeader className="p-4 md:p-6 pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Target className="h-5 w-5 text-primary" /> Saúde do Pipeline
              <Badge variant="outline" className="ml-auto text-xs">Score: {data.ai.pipeline_health?.score || 0}%</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-2 space-y-4">
            {/* Pipeline stages bar */}
            {totalPipeline > 0 && (
              <div className="space-y-3">
                <div className="flex h-4 rounded-full overflow-hidden">
                  {Object.entries(data.metrics.pipeline_stages).map(([stage, count]) => (
                    <div
                      key={stage}
                      className={`${pipelineColors[stage] || 'bg-gray-300'} transition-all`}
                      style={{ width: `${(count / totalPipeline) * 100}%` }}
                      title={`${pipelineLabels[stage] || stage}: ${count}`}
                    />
                  ))}
                </div>
                <div className="flex flex-wrap gap-3 text-xs">
                  {Object.entries(data.metrics.pipeline_stages).map(([stage, count]) => (
                    <div key={stage} className="flex items-center gap-1.5">
                      <div className={`w-2.5 h-2.5 rounded-full ${pipelineColors[stage] || 'bg-gray-300'}`} />
                      <span className="text-muted-foreground">{pipelineLabels[stage] || stage}:</span>
                      <span className="font-semibold">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {data.ai.pipeline_health && (
              <div className="space-y-2 pt-2 border-t">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-medium">Gargalo</p>
                    <p className="text-xs text-muted-foreground">{data.ai.pipeline_health.bottleneck}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Lightbulb className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-medium">Recomendação</p>
                    <p className="text-xs text-muted-foreground">{data.ai.pipeline_health.recommendation}</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Performance Overview */}
        <Card className="border-none shadow-lg rounded-2xl bg-card">
          <CardHeader className="p-4 md:p-6 pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <BarChart3 className="h-5 w-5" /> Performance Geral
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-2 space-y-3">
            {[
              { label: 'Engajamento de Email', value: data.ai.performance.email_engagement, icon: Mail },
              { label: 'Crescimento de Clientes', value: data.ai.performance.client_growth, icon: Users },
              { label: 'Atividade de Conteúdo', value: data.ai.performance.content_activity, icon: FileText },
              { label: 'Comunicação', value: data.ai.performance.communication, icon: MessageSquare },
              { label: 'Uso de Automação', value: data.ai.performance.automation_usage, icon: Bot },
              { label: 'Produtividade em Reuniões', value: data.ai.performance.meeting_productivity, icon: Video },
            ].map((perf, idx) => {
              const Icon = perf.icon;
              return (
                <div key={idx}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <div className="flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm">{perf.label}</span>
                    </div>
                    <span className={`font-semibold text-sm ${perf.value >= 70 ? 'text-emerald-600' : perf.value >= 40 ? 'text-amber-600' : 'text-red-500'}`}>
                      {perf.value}%
                    </span>
                  </div>
                  <Progress value={perf.value} className="h-2" />
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Churn Alerts + Conversation Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Churn Alerts */}
        <Card className="border-none shadow-lg rounded-2xl bg-card">
          <CardHeader className="p-4 md:p-6 pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldAlert className="h-5 w-5 text-red-500" /> Alertas de Churn
              {data.ai.churn_alerts?.length > 0 && (
                <Badge variant="destructive" className="ml-auto text-xs">{data.ai.churn_alerts.length} alertas</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-2 space-y-3">
            {data.ai.churn_alerts && data.ai.churn_alerts.length > 0 ? (
              data.ai.churn_alerts.map((alert, idx) => (
                <div key={idx} className={`p-3 rounded-lg border-l-4 ${
                  alert.risk_level === 'high' ? 'border-red-500 bg-red-50 dark:bg-red-950/30' :
                  alert.risk_level === 'medium' ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30' :
                  'border-[#5A74D1] bg-[#F0F2FE] dark:bg-blue-950/30'
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className={`text-[10px] px-1.5 ${
                      alert.risk_level === 'high' ? 'border-red-300 text-red-600' :
                      alert.risk_level === 'medium' ? 'border-amber-300 text-amber-600' :
                      'border-[#879CE0] text-[#2F428D]'
                    }`}>
                      {alert.risk_level === 'high' ? '🔴 Alto' : alert.risk_level === 'medium' ? '🟡 Médio' : '🔵 Baixo'}
                    </Badge>
                  </div>
                  <p className="text-sm font-medium">{alert.signal}</p>
                  <p className="text-xs text-muted-foreground mt-1 flex items-start gap-1">
                    <ArrowRight className="h-3 w-3 mt-0.5 shrink-0" />
                    {alert.recommendation}
                  </p>
                </div>
              ))
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
                <p className="text-sm">Nenhum alerta de churn detectado</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Conversation Analysis */}
        <Card className="border-none shadow-lg rounded-2xl bg-card">
          <CardHeader className="p-4 md:p-6 pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessageSquare className="h-5 w-5 text-green-500" /> Análise de Conversas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-2 space-y-4">
            {data.ai.conversation_analysis && (
              <>
                <div className="flex items-center gap-4">
                  <SentimentBadge sentiment={data.ai.conversation_analysis.overall_sentiment} />
                  <div className="flex gap-4 text-sm">
                    <div className="flex items-center gap-1.5">
                      <Flame className="h-4 w-4 text-[#2F428D]" />
                      <span className="font-semibold">{data.ai.conversation_analysis.hot_leads}</span>
                      <span className="text-muted-foreground text-xs">leads quentes</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      <span className="font-semibold">{data.ai.conversation_analysis.needs_attention}</span>
                      <span className="text-muted-foreground text-xs">atenção</span>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{data.ai.conversation_analysis.summary}</p>
                {data.ai.conversation_analysis.common_topics?.length > 0 && (
                  <div>
                    <p className="text-xs font-medium mb-2">Tópicos frequentes</p>
                    <div className="flex flex-wrap gap-1.5">
                      {data.ai.conversation_analysis.common_topics.map((topic, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">{topic}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Meeting Analysis */}
      <Card className="border-none shadow-lg rounded-2xl bg-card">
        <CardHeader className="p-4 md:p-6 pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Mic className="h-5 w-5 text-[#374DA4]" /> Análise de Reuniões
            {data.ai.meeting_analysis && (
              <SentimentBadge sentiment={data.ai.meeting_analysis.sentiment} />
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 md:p-6 pt-2">
          {data.ai.meeting_analysis && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm font-medium mb-2">Resumo</p>
                <p className="text-sm text-muted-foreground">{data.ai.meeting_analysis.summary}</p>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Tópicos Principais</p>
                <div className="space-y-1.5">
                  {data.ai.meeting_analysis.key_topics?.map((topic, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#374DA4]" />
                      {topic}
                    </div>
                  ))}
                  {(!data.ai.meeting_analysis.key_topics || data.ai.meeting_analysis.key_topics.length === 0) && (
                    <p className="text-sm text-muted-foreground">Sem dados de tópicos</p>
                  )}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Ações Pendentes</p>
                <div className="space-y-1.5">
                  {data.ai.meeting_analysis.action_items?.map((item, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                      {item}
                    </div>
                  ))}
                  {(!data.ai.meeting_analysis.action_items || data.ai.meeting_analysis.action_items.length === 0) && (
                    <p className="text-sm text-muted-foreground">Sem ações pendentes</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Insights */}
      <Card className="border-none shadow-lg rounded-2xl bg-card">
        <CardHeader className="p-4 md:p-6 pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Lightbulb className="h-5 w-5 text-yellow-500" /> Insights da IA
            <Badge variant="secondary" className="ml-auto text-xs">{data.ai.insights?.length || 0} insights</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 md:p-6 pt-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.ai.insights?.map((insight, idx) => {
              const style = insightColors[insight.type] || insightColors.info;
              const Icon = style.icon;
              return (
                <div key={idx} className={`p-4 rounded-xl border-l-4 ${style.bg} ${style.border}`}>
                  <div className="flex items-start gap-3">
                    <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${style.text}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-medium text-sm truncate">{insight.title}</h4>
                        <span className={`text-sm font-bold shrink-0 ${style.text}`}>{insight.metric}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{insight.description}</p>
                      {insight.action && (
                        <p className="text-xs mt-2 font-medium flex items-start gap-1">
                          <ArrowRight className="h-3 w-3 mt-0.5 shrink-0" />
                          {insight.action}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Strategic Tips */}
      {data.ai.strategic_tips && data.ai.strategic_tips.length > 0 && (
        <Card className="border-none shadow-lg rounded-2xl bg-card">
          <CardHeader className="p-4 md:p-6 pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Brain className="h-5 w-5 text-purple-500" /> Dicas Estratégicas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-2">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.ai.strategic_tips.map((tip, idx) => {
                const CatIcon = categoryIcons[tip.category] || Star;
                return (
                  <div key={idx} className="p-4 rounded-xl bg-muted/50 border border-border/50 hover:border-primary/20 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      <CatIcon className="h-4 w-4 text-primary" />
                      <span className="text-xs font-medium capitalize text-muted-foreground">{tip.category}</span>
                      <div className="ml-auto flex gap-1.5">
                        <Badge className={`text-[10px] px-1.5 py-0 ${impactColors[tip.impact] || ''}`}>
                          Impacto: {tip.impact}
                        </Badge>
                        <Badge className={`text-[10px] px-1.5 py-0 ${effortColors[tip.effort] || ''}`}>
                          {tip.effort}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-sm">{tip.tip}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Executive Summary */}
      <Card className="border-none shadow-lg rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-full bg-primary/20 shrink-0">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Resumo Executivo</h3>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{data.ai.summary}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ElloVisionDashboard;
