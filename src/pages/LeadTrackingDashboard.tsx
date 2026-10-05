import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Users, Eye, CheckCircle, TrendingUp, Clock, 
  BarChart3, Loader2, Calendar, Filter, Download, MapPin,
  Globe, Monitor, Smartphone, Tablet, User, ChevronDown, ChevronRight,
  Target, Search, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, subDays, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
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

interface LeadFunnel {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
}

interface Submission {
  id: string;
  funnel_id: string;
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
  funnel_id: string;
  step_id: string | null;
  submission_id: string | null;
  event_type: string;
  timestamp: string | null;
  metadata: any;
}

const COLORS = ['#374DA4', '#374DA4', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];

const LeadTrackingDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [funnels, setFunnels] = useState<LeadFunnel[]>([]);
  const [steps, setSteps] = useState<Record<string, FunnelStep[]>>({});
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [events, setEvents] = useState<StepEvent[]>([]);
  const [dateRange, setDateRange] = useState('30');
  const [selectedFunnel, setSelectedFunnel] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Get company ID
  useEffect(() => {
    const getCompanyId = async () => {
      if (!user?.id) return;
      
      const metadataCompanyId = user.user_metadata?.company_id;
      if (metadataCompanyId) {
        setCompanyId(metadataCompanyId);
        return;
      }

      const { data } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user.id)
        .single();
      
      if (data?.company_id) {
        setCompanyId(data.company_id);
      }
    };

    getCompanyId();
  }, [user?.id]);

  useEffect(() => {
    const loadData = async () => {
      if (!companyId) return;

      setLoading(true);

      // Load funnels
      const { data: funnelsData } = await supabase
        .from('lead_funnels')
        .select('id, name, slug, is_active')
        .eq('company_id', companyId);

      if (funnelsData) {
        setFunnels(funnelsData);

        // Load steps for all funnels
        const stepsMap: Record<string, FunnelStep[]> = {};
        for (const funnel of funnelsData) {
          const { data: stepsData } = await supabase
            .from('lead_funnel_steps')
            .select('id, position, step_type, title')
            .eq('funnel_id', funnel.id)
            .order('position', { ascending: true });
          
          if (stepsData) {
            stepsMap[funnel.id] = stepsData;
          }
        }
        setSteps(stepsMap);

        // Load submissions
        const daysAgo = subDays(new Date(), parseInt(dateRange));
        const funnelIds = funnelsData.map(f => f.id);
        
        if (funnelIds.length > 0) {
          const { data: subsData } = await supabase
            .from('lead_submissions')
            .select('*')
            .in('funnel_id', funnelIds)
            .gte('started_at', daysAgo.toISOString())
            .order('started_at', { ascending: false });

          if (subsData) setSubmissions(subsData);

          // Load events
          const { data: eventsData } = await supabase
            .from('lead_step_events')
            .select('*')
            .in('funnel_id', funnelIds)
            .gte('timestamp', daysAgo.toISOString())
            .order('timestamp', { ascending: true });

          if (eventsData) setEvents(eventsData);
        }
      }

      setLoading(false);
    };

    loadData();
  }, [companyId, dateRange]);

  // Filter submissions
  const filteredSubmissions = submissions.filter(sub => {
    if (selectedFunnel !== 'all' && sub.funnel_id !== selectedFunnel) return false;
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      const hasEmail = Object.values(sub.answers || {}).some(
        v => typeof v === 'string' && v.toLowerCase().includes(searchLower)
      );
      const hasSessionMatch = sub.session_id.toLowerCase().includes(searchLower);
      if (!hasEmail && !hasSessionMatch) return false;
    }
    return true;
  });

  // Calculate stats
  const totalViews = filteredSubmissions.length;
  const completions = filteredSubmissions.filter(s => s.status === 'completed').length;
  const conversionRate = totalViews > 0 ? (completions / totalViews) * 100 : 0;
  const inProgress = filteredSubmissions.filter(s => s.status === 'in_progress').length;

  // Device breakdown
  const deviceCounts: Record<string, number> = { mobile: 0, desktop: 0, tablet: 0 };
  filteredSubmissions.forEach(sub => {
    const device = sub.metadata?.device || 'desktop';
    if (device === 'mobile') deviceCounts.mobile++;
    else if (device === 'tablet') deviceCounts.tablet++;
    else deviceCounts.desktop++;
  });

  const deviceData = Object.entries(deviceCounts)
    .filter(([_, v]) => v > 0)
    .map(([name, value]) => ({ name, value }));

  // Build daily chart data
  const dailyData: Record<string, { date: string; views: number; completions: number }> = {};
  for (let i = parseInt(dateRange) - 1; i >= 0; i--) {
    const date = format(subDays(new Date(), i), 'dd/MM');
    dailyData[date] = { date, views: 0, completions: 0 };
  }

  filteredSubmissions.forEach(sub => {
    if (!sub.started_at) return;
    const date = format(new Date(sub.started_at), 'dd/MM');
    if (dailyData[date]) {
      dailyData[date].views++;
      if (sub.status === 'completed') {
        dailyData[date].completions++;
      }
    }
  });

  const chartData = Object.values(dailyData);

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const getDeviceIcon = (device: string) => {
    if (device === 'mobile') return <Smartphone className="h-4 w-4" />;
    if (device === 'tablet') return <Tablet className="h-4 w-4" />;
    return <Monitor className="h-4 w-4" />;
  };

  const extractUserInfo = (sub: Submission) => {
    const answers = sub.answers || {};
    let name = '';
    let email = '';
    let phone = '';

    Object.entries(answers).forEach(([key, value]) => {
      if (typeof value !== 'string') return;
      if (key.includes('name') || key.includes('nome')) name = value;
      if (key.includes('email') || value.includes('@')) email = value;
      if (key.includes('phone') || key.includes('telefone')) phone = value;
    });

    return { name, email, phone };
  };

  const getStepTimeAnalysis = (submissionId: string, funnelId: string) => {
    const subEvents = events
      .filter(e => e.submission_id === submissionId)
      .sort((a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime());

    const funnelSteps = steps[funnelId] || [];
    const stepTimes: { step: string; time: number }[] = [];

    funnelSteps.forEach(step => {
      const viewEvent = subEvents.find(e => e.step_id === step.id && e.event_type === 'view');
      const completeEvent = subEvents.find(e => e.step_id === step.id && e.event_type === 'complete');

      if (viewEvent && completeEvent) {
        const start = new Date(viewEvent.timestamp!).getTime();
        const end = new Date(completeEvent.timestamp!).getTime();
        stepTimes.push({
          step: step.title || `Etapa ${step.position}`,
          time: Math.round((end - start) / 1000)
        });
      } else if (viewEvent) {
        stepTimes.push({
          step: step.title || `Etapa ${step.position}`,
          time: -1 // Not completed
        });
      }
    });

    return stepTimes;
  };

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
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/track')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="p-2.5 bg-primary/10 rounded-xl">
              <Target className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Rastreamento de Leads</h1>
              <p className="text-muted-foreground text-sm">
                Análise detalhada de todos os funis e submissões
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <Select value={selectedFunnel} onValueChange={setSelectedFunnel}>
          <SelectTrigger className="w-[200px]">
            <Target className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Todos os funis" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os funis</SelectItem>
            {funnels.map(f => (
              <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-[160px]">
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

        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por email, nome, sessão..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
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
                <p className="text-xs text-muted-foreground">Total Acessos</p>
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
              <div className="p-2.5 rounded-xl bg-yellow-500/10">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-600">{inProgress}</p>
                <p className="text-xs text-muted-foreground">Em Progresso</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Chart */}
        <Card className="border-0 shadow-sm lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Acessos vs Conversões</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip 
                    contentStyle={{ 
                      background: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="views" 
                    stroke="#374DA4" 
                    fill="#374DA4" 
                    fillOpacity={0.15}
                    name="Acessos"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="completions" 
                    stroke="#10B981" 
                    fill="#10B981" 
                    fillOpacity={0.3}
                    name="Conversões"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Device Breakdown */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Por Dispositivo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={deviceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {deviceData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-4 mt-2">
              {deviceData.map((item, index) => (
                <div key={item.name} className="flex items-center gap-1.5 text-xs">
                  <div 
                    className="w-2.5 h-2.5 rounded-full" 
                    style={{ backgroundColor: COLORS[index % COLORS.length] }} 
                  />
                  <span className="capitalize">{item.name}</span>
                  <span className="text-muted-foreground">({item.value})</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Submissions List */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-5 w-5" />
              Submissões Detalhadas
            </CardTitle>
            <Badge variant="secondary">{filteredSubmissions.length} registros</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Lead / Sessão</TableHead>
                  <TableHead>Funil</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Dispositivo</TableHead>
                  <TableHead>Quando</TableHead>
                  <TableHead className="text-right">Progresso</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSubmissions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      Nenhuma submissão encontrada no período
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSubmissions.map((sub) => {
                    const funnel = funnels.find(f => f.id === sub.funnel_id);
                    const userInfo = extractUserInfo(sub);
                    const device = sub.metadata?.device || 'desktop';
                    const isExpanded = expandedRows.has(sub.id);
                    const stepTimes = isExpanded ? getStepTimeAnalysis(sub.id, sub.funnel_id) : [];
                    const totalSteps = steps[sub.funnel_id]?.length || 1;
                    const progress = ((sub.current_step || 1) / totalSteps) * 100;

                    return (
                      <React.Fragment key={sub.id}>
                        <TableRow 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => toggleRow(sub.id)}
                        >
                          <TableCell className="p-2">
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <User className="h-4 w-4 text-primary" />
                              </div>
                              <div>
                                <p className="font-medium text-sm">
                                  {userInfo.name || userInfo.email || `Sessão ${sub.session_id.slice(0, 8)}`}
                                </p>
                                {userInfo.email && userInfo.name && (
                                  <p className="text-xs text-muted-foreground">{userInfo.email}</p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {funnel?.name || 'Funil'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={sub.status === 'completed' ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {sub.status === 'completed' ? 'Completo' : 'Em progresso'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              {getDeviceIcon(device)}
                              <span className="text-xs capitalize">{device}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="text-xs text-muted-foreground">
                              {sub.started_at && formatDistanceToNow(new Date(sub.started_at), { 
                                addSuffix: true, 
                                locale: ptBR 
                              })}
                            </p>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Progress value={progress} className="w-16 h-1.5" />
                              <span className="text-xs text-muted-foreground w-8">
                                {sub.current_step || 1}/{totalSteps}
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>

                        {/* Expanded Details */}
                        {isExpanded && (
                          <TableRow className="bg-muted/30 hover:bg-muted/30">
                            <TableCell colSpan={7} className="p-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Step Analysis */}
                                <div>
                                  <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                                    <Clock className="h-4 w-4" />
                                    Tempo por Etapa
                                  </h4>
                                  <div className="space-y-2">
                                    {stepTimes.length === 0 ? (
                                      <p className="text-xs text-muted-foreground">Sem dados de tempo</p>
                                    ) : (
                                      stepTimes.map((st, idx) => (
                                        <div key={idx} className="flex items-center justify-between text-xs">
                                          <span className="flex items-center gap-2">
                                            <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-medium">
                                              {idx + 1}
                                            </span>
                                            {st.step}
                                          </span>
                                          <span className={st.time < 0 ? 'text-yellow-600' : 'text-muted-foreground'}>
                                            {st.time < 0 ? 'Não completou' : `${st.time}s`}
                                          </span>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </div>

                                {/* Metadata */}
                                <div>
                                  <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                                    <Globe className="h-4 w-4" />
                                    Informações
                                  </h4>
                                  <div className="space-y-2 text-xs">
                                    {sub.metadata?.referrer && (
                                      <div className="flex items-center gap-2">
                                        <span className="text-muted-foreground">Origem:</span>
                                        <span className="truncate max-w-[200px]">{sub.metadata.referrer}</span>
                                      </div>
                                    )}
                                    <div className="flex items-center gap-2">
                                      <span className="text-muted-foreground">Iniciado:</span>
                                      <span>
                                        {sub.started_at && format(new Date(sub.started_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                      </span>
                                    </div>
                                    {sub.completed_at && (
                                      <div className="flex items-center gap-2">
                                        <span className="text-muted-foreground">Completo:</span>
                                        <span>
                                          {format(new Date(sub.completed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                        </span>
                                      </div>
                                    )}
                                    {userInfo.phone && (
                                      <div className="flex items-center gap-2">
                                        <span className="text-muted-foreground">Telefone:</span>
                                        <span>{userInfo.phone}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Answers Preview */}
                                {Object.keys(sub.answers || {}).length > 0 && (
                                  <div className="md:col-span-2">
                                    <h4 className="font-medium text-sm mb-3">Respostas</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                      {Object.entries(sub.answers || {}).slice(0, 6).map(([key, value]) => (
                                        <div key={key} className="p-2 bg-card rounded-lg border text-xs">
                                          <p className="text-muted-foreground truncate">{key}</p>
                                          <p className="font-medium truncate">
                                            {typeof value === 'string' ? value : JSON.stringify(value)}
                                          </p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default LeadTrackingDashboard;
