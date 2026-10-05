import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Users, Eye, CheckCircle, TrendingUp, Clock, 
  BarChart3, Loader2, Calendar, Filter, Download
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface FunnelStep {
  id: string;
  position: number;
  step_type: string;
  title: string;
}

interface Submission {
  id: string;
  session_id: string;
  status: string;
  current_step: number | null;
  started_at: string | null;
  completed_at: string | null;
  answers: any;
  metadata: any;
}

interface StepEvent {
  id: string;
  step_id: string | null;
  event_type: string;
  timestamp: string | null;
  metadata: any;
}

const COLORS = ['#374DA4', '#374DA4', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];

const LeadFunnelAnalytics: React.FC = () => {
  const { funnelId } = useParams<{ funnelId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [funnel, setFunnel] = useState<any>(null);
  const [steps, setSteps] = useState<FunnelStep[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [events, setEvents] = useState<StepEvent[]>([]);
  const [dateRange, setDateRange] = useState('7');

  useEffect(() => {
    const loadData = async () => {
      if (!funnelId) return;

      setLoading(true);

      // Load funnel
      const { data: funnelData } = await supabase
        .from('lead_funnels')
        .select('*')
        .eq('id', funnelId)
        .single();

      if (funnelData) setFunnel(funnelData);

      // Load steps
      const { data: stepsData } = await supabase
        .from('lead_funnel_steps')
        .select('*')
        .eq('funnel_id', funnelId)
        .order('position', { ascending: true });

      if (stepsData) setSteps(stepsData);

      // Load submissions
      const daysAgo = subDays(new Date(), parseInt(dateRange));
      const { data: subsData } = await supabase
        .from('lead_submissions')
        .select('*')
        .eq('funnel_id', funnelId)
        .gte('started_at', daysAgo.toISOString())
        .order('started_at', { ascending: false });

      if (subsData) setSubmissions(subsData);

      // Load events
      const { data: eventsData } = await supabase
        .from('lead_step_events')
        .select('*')
        .eq('funnel_id', funnelId)
        .gte('timestamp', daysAgo.toISOString())
        .order('timestamp', { ascending: true });

      if (eventsData) setEvents(eventsData);

      setLoading(false);
    };

    loadData();
  }, [funnelId, dateRange]);

  // Calculate stats
  const totalViews = submissions.length;
  const completions = submissions.filter(s => s.status === 'completed').length;
  const conversionRate = totalViews > 0 ? (completions / totalViews) * 100 : 0;
  const inProgress = submissions.filter(s => s.status === 'in_progress').length;

  // Calculate average completion time
  const completedWithTime = submissions.filter(s => s.completed_at && s.started_at);
  const avgTimeMs = completedWithTime.length > 0
    ? completedWithTime.reduce((acc, s) => {
        const start = new Date(s.started_at!).getTime();
        const end = new Date(s.completed_at!).getTime();
        return acc + (end - start);
      }, 0) / completedWithTime.length
    : 0;
  const avgTimeMinutes = Math.round(avgTimeMs / 60000);

  // Build funnel visualization data
  const funnelDataArray = steps.map((step, stepIdx) => {
    const viewEvents = events.filter(e => e.step_id === step.id && e.event_type === 'view');
    const completeEvents = events.filter(e => e.step_id === step.id && e.event_type === 'complete');
    
    return {
      name: step.title || `Etapa ${step.position}`,
      views: viewEvents.length,
      completions: completeEvents.length,
      stepIdx
    };
  });

  // Build daily chart data
  const dailyData: Record<string, { date: string; views: number; completions: number }> = {};
  for (let i = parseInt(dateRange) - 1; i >= 0; i--) {
    const date = format(subDays(new Date(), i), 'dd/MM');
    dailyData[date] = { date, views: 0, completions: 0 };
  }

  submissions.forEach(sub => {
    if (!sub.started_at) return;
    const date = format(new Date(sub.started_at), 'dd/MM');
    if (dailyData[date]) {
      if (sub.status === 'completed') {
        dailyData[date].completions++;
      }
    }
  });

  const chartData = Object.values(dailyData);

  // Device breakdown
  const deviceCounts: Record<string, number> = { mobile: 0, desktop: 0, tablet: 0 };
  submissions.forEach(sub => {
    const ua = sub.metadata?.userAgent || '';
    if (/mobile/i.test(ua)) deviceCounts.mobile++;
    else if (/tablet/i.test(ua)) deviceCounts.tablet++;
    else deviceCounts.desktop++;
  });

  const deviceData = Object.entries(deviceCounts)
    .filter(([_, v]) => v > 0)
    .map(([name, value]) => ({ name, value }));

  // Recent submissions
  const recentSubmissions = submissions.slice(0, 10);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 page-content">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/leads')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{funnel?.name}</h1>
              <p className="text-muted-foreground text-sm">
                Analytics e rastreamento de conversões
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[140px]">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="14">Últimos 14 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#374DA4]/10">
                <Eye className="h-5 w-5 text-[#2F428D]" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalViews}</p>
                <p className="text-xs text-muted-foreground">Visualizações</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-green-500/10">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{completions}</p>
                <p className="text-xs text-muted-foreground">Completados</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-primary">{conversionRate.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">Taxa Conversão</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-violet-500/10">
                <Clock className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-violet-600">{avgTimeMinutes}min</p>
                <p className="text-xs text-muted-foreground">Tempo Médio</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Chart */}
        <Card className="border-0 shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Visualizações vs Conversões</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      background: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="views" 
                    stackId="1"
                    stroke="#374DA4" 
                    fill="#374DA4" 
                    fillOpacity={0.2}
                    name="Visualizações"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="completions" 
                    stackId="2"
                    stroke="#10B981" 
                    fill="#10B981" 
                    fillOpacity={0.4}
                    name="Conversões"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Device Breakdown */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Dispositivos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={deviceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {deviceData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-4 mt-4">
              {deviceData.map((item, index) => (
                <div key={item.name} className="flex items-center gap-2 text-xs">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: COLORS[index % COLORS.length] }} 
                  />
                  <span className="capitalize">{item.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Funnel Steps Analysis */}
      <Card className="border-0 shadow-sm mb-8">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Análise por Etapa
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {steps.map((step, idx) => {
              const stepEvents = events.filter(e => e.step_id === step.id);
              const views = stepEvents.filter(e => e.event_type === 'view').length;
              const completes = stepEvents.filter(e => e.event_type === 'complete').length;
              const prevStepViews = idx > 0 
                ? events.filter(e => e.step_id === steps[idx-1].id && e.event_type === 'view').length 
                : totalViews;
              const dropoffRate = prevStepViews > 0 
                ? ((prevStepViews - views) / prevStepViews) * 100 
                : 0;

              return (
                <div key={step.id} className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary text-sm">
                    {step.position}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">{step.title || `Etapa ${step.position}`}</span>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{views} visualizações</span>
                        <span className="text-green-600">{completes} completados</span>
                        {dropoffRate > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            -{dropoffRate.toFixed(0)}% abandonos
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Progress 
                      value={totalViews > 0 ? (views / totalViews) * 100 : 0} 
                      className="h-2" 
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recent Submissions */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-5 w-5" />
            Submissões Recentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            {recentSubmissions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma submissão encontrada no período
              </div>
            ) : (
              <div className="space-y-3">
                {recentSubmissions.map((sub) => (
                  <div 
                    key={sub.id} 
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${
                        sub.status === 'completed' ? 'bg-green-500' : 'bg-yellow-500'
                      }`} />
                      <div>
                        <p className="text-sm font-medium">
                          Sessão: {sub.session_id.slice(0, 12)}...
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(sub.started_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={sub.status === 'completed' ? 'default' : 'secondary'}>
                        {sub.status === 'completed' ? 'Completo' : `Etapa ${sub.current_step}`}
                      </Badge>
                      {Object.keys(sub.answers || {}).length > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {Object.keys(sub.answers).length} respostas
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default LeadFunnelAnalytics;
