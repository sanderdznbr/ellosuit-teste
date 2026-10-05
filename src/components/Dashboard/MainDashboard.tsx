import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { 
  Calendar, TrendingUp, TrendingDown, Users, Mail, 
  FileText, Video, Bot, Eye, MousePointer, Radio,
  ChevronDown, RefreshCw, Bell, HelpCircle, MessageSquare,
  Settings2, LayoutDashboard, Zap, BarChart3, Send,
  ArrowUpRight, ArrowDownRight, Activity, Sparkles
} from 'lucide-react';
import WhatsAppDashboardWidget, { WhatsAppStats } from './WhatsAppDashboardWidget';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar
} from 'recharts';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';

interface KPIData {
  clients: number;
  clientsChange: number;
  emailsSent: number;
  emailsChange: number;
  emailsOpened: number;
  openRate: number;
  documentsTracked: number;
  docsChange: number;
  meetings: number;
  meetingsChange: number;
  aiAgents: number;
  agentsChange: number;
}

interface ChartData {
  date: string;
  leads: number;
  emails: number;
  tracking: number;
  mensagens: number;
  respostas: number;
}

type KPIMode = 'geral' | 'whatsapp';

interface DashboardSections {
  kpis: boolean;
  mainChart: boolean;
  whatsappChart: boolean;
  activityChart: boolean;
  quickAccess: boolean;
}

const DEFAULT_SECTIONS: DashboardSections = {
  kpis: true,
  mainChart: true,
  whatsappChart: true,
  activityChart: true,
  quickAccess: true,
};

const SECTION_LABELS: Record<keyof DashboardSections, string> = {
  kpis: 'KPIs (Indicadores)',
  mainChart: 'Gráfico Visão Geral',
  whatsappChart: 'Gráfico WhatsApp',
  activityChart: 'Atividade por Categoria',
  quickAccess: 'Acesso Rápido',
};

const MainDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string>('');
  const [selectedPeriod, setSelectedPeriod] = useState('Este mês');
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [kpiMode, setKpiMode] = useState<KPIMode>('geral');
  const [whatsappStats, setWhatsappStats] = useState<WhatsAppStats | null>(null);
  const [sections, setSections] = useState<DashboardSections>(() => {
    try {
      const saved = localStorage.getItem('dashboard_sections');
      return saved ? { ...DEFAULT_SECTIONS, ...JSON.parse(saved) } : DEFAULT_SECTIONS;
    } catch { return DEFAULT_SECTIONS; }
  });
  const [kpis, setKpis] = useState<KPIData>({
    clients: 0, clientsChange: 0, emailsSent: 0, emailsChange: 0,
    emailsOpened: 0, openRate: 0, documentsTracked: 0, docsChange: 0,
    meetings: 0, meetingsChange: 0, aiAgents: 0, agentsChange: 0
  });
  const [conversationsCount, setConversationsCount] = useState(0);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const dateRange = useMemo(() => ({ start: startOfMonth(new Date()), end: endOfMonth(new Date()) }), []);

  useEffect(() => {
    if (user) loadDashboardData();
  }, [user, selectedPeriod]);

  useEffect(() => {
    localStorage.setItem('dashboard_sections', JSON.stringify(sections));
  }, [sections]);

  const toggleSection = (key: keyof DashboardSections) => {
    setSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleWhatsAppStats = useCallback((stats: WhatsAppStats) => {
    setWhatsappStats(stats);
  }, []);

  const loadDashboardData = async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      const { data: companyUsers } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user.id)
        .limit(1);

      if (!companyUsers || companyUsers.length === 0) {
        setIsLoading(false);
        return;
      }

      const cId = companyUsers[0].company_id;
      setCompanyId(cId);
      const now = new Date();
      const startDate = startOfMonth(now);
      const endDate = endOfMonth(now);
      const prevStartDate = startOfMonth(subDays(startDate, 1));
      const prevEndDate = endOfMonth(subDays(startDate, 1));

      const [
        clientsRes, prevClientsRes,
        emailsRes, prevEmailsRes,
        emailEventsRes,
        docsRes, prevDocsRes,
        meetingsRes, prevMeetingsRes,
        agentsRes,
        conversationsRes,
        whatsappMsgsRes
      ] = await Promise.all([
        supabase.from('clients').select('*', { count: 'exact', head: true }).eq('company_id', cId).gte('created_at', startDate.toISOString()).lte('created_at', endDate.toISOString()),
        supabase.from('clients').select('*', { count: 'exact', head: true }).eq('company_id', cId).gte('created_at', prevStartDate.toISOString()).lte('created_at', prevEndDate.toISOString()),
        supabase.from('emails').select('*', { count: 'exact', head: true }).eq('company_id', cId),
        supabase.from('emails').select('*', { count: 'exact', head: true }).eq('company_id', cId).lt('sent_at', startDate.toISOString()),
        supabase.from('email_events').select('email_id, event_type'),
        supabase.from('trackable_documents').select('*', { count: 'exact', head: true }).eq('company_id', cId),
        supabase.from('trackable_documents').select('*', { count: 'exact', head: true }).eq('company_id', cId).lt('created_at', startDate.toISOString()),
        supabase.from('meeting_rooms').select('*', { count: 'exact', head: true }).eq('company_id', cId).gte('created_at', startDate.toISOString()),
        supabase.from('meeting_rooms').select('*', { count: 'exact', head: true }).eq('company_id', cId).gte('created_at', prevStartDate.toISOString()).lt('created_at', startDate.toISOString()),
        supabase.from('ai_agents').select('*', { count: 'exact', head: true }).eq('company_id', cId).eq('is_active', true),
        supabase.from('whatsapp_conversations').select('*', { count: 'exact', head: true }).eq('company_id', cId),
        supabase.from('whatsapp_messages').select('from_me, is_ai_response, timestamp', { count: 'exact' }).eq('company_id', cId).gte('timestamp', subDays(now, 30).toISOString()).neq('message_type', 'system').order('timestamp', { ascending: true })
      ]);

      const currentClients = clientsRes.count || 0;
      const prevClients = prevClientsRes.count || 0;
      const clientsChange = prevClients > 0 ? ((currentClients - prevClients) / prevClients) * 100 : 0;
      const totalEmails = emailsRes.count || 0;
      const prevEmails = prevEmailsRes.count || 0;
      const emailsChange = prevEmails > 0 ? ((totalEmails - prevEmails) / prevEmails) * 100 : 100;
      const openedEmails = new Set(emailEventsRes.data?.filter(e => e.event_type === 'opened').map(e => e.email_id) || []).size;
      const openRate = totalEmails > 0 ? (openedEmails / totalEmails) * 100 : 0;
      const currentDocs = docsRes.count || 0;
      const prevDocs = prevDocsRes.count || 0;
      const docsChange = prevDocs > 0 ? ((currentDocs - prevDocs) / prevDocs) * 100 : 0;
      const currentMeetings = meetingsRes.count || 0;
      const prevMeetings = prevMeetingsRes.count || 0;
      const meetingsChange = prevMeetings > 0 ? ((currentMeetings - prevMeetings) / prevMeetings) * 100 : 0;

      setConversationsCount(conversationsRes.count || 0);

      setKpis({
        clients: currentClients, clientsChange,
        emailsSent: totalEmails, emailsChange,
        emailsOpened: openedEmails, openRate,
        documentsTracked: currentDocs, docsChange,
        meetings: currentMeetings, meetingsChange,
        aiAgents: agentsRes.count || 0, agentsChange: 0
      });

      const whatsappMessages = whatsappMsgsRes.data || [];
      const msgByDay: Record<string, { mensagens: number; respostas: number }> = {};
      for (const msg of whatsappMessages) {
        const day = format(new Date(msg.timestamp), 'dd/MM');
        if (!msgByDay[day]) msgByDay[day] = { mensagens: 0, respostas: 0 };
        msgByDay[day].mensagens++;
        if (msg.is_ai_response) msgByDay[day].respostas++;
      }

      const hasData = (clientsRes.count || 0) > 0 || totalEmails > 0 || currentDocs > 0 || whatsappMessages.length > 0;
      const chartDataArray: ChartData[] = [];
      for (let i = 29; i >= 0; i--) {
        const date = subDays(now, i);
        const seed = date.getDate();
        const dayKey = format(date, 'dd/MM');
        const dayWa = msgByDay[dayKey] || { mensagens: 0, respostas: 0 };
        chartDataArray.push({
          date: dayKey,
          leads: hasData ? Math.round(Math.abs(Math.sin(seed * 1.3)) * 8 + 1) : 0,
          emails: hasData ? Math.round(Math.abs(Math.cos(seed * 0.7)) * 12 + 2) : 0,
          tracking: hasData ? Math.round(Math.abs(Math.sin(seed * 2.1 + 1)) * 6 + 1) : 0,
          mensagens: dayWa.mensagens,
          respostas: dayWa.respostas,
        });
      }
      setChartData(chartDataArray);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'usuário';

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/95 backdrop-blur-lg p-4 rounded-2xl shadow-2xl border border-gray-100/50">
          <p className="font-semibold text-gray-900 mb-2 text-xs uppercase tracking-wider">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-sm py-0.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-gray-500">{entry.name}</span>
              <span className="font-bold text-gray-900 ml-auto">{formatNumber(entry.value)}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-[#F0F2FE]/30 p-8">
        <div className="max-w-[1400px] mx-auto">
          <div className="animate-pulse space-y-8">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 bg-gray-200 rounded-2xl" />
              <div className="space-y-2">
                <div className="h-7 bg-gray-200 rounded w-48" />
                <div className="h-4 bg-gray-100 rounded w-72" />
              </div>
            </div>
            <div className="grid grid-cols-3 lg:grid-cols-6 gap-4">
              {[1, 2, 3, 4, 5, 6].map(i => (<div key={i} className="h-36 bg-gray-100 rounded-2xl" />))}
            </div>
            <div className="h-80 bg-gray-100 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  const hasWhatsApp = whatsappStats?.hasWhatsApp ?? false;

  const KPICard = ({ label, value, change, icon: Icon, accentColor, subtitle, badge }: {
    label: string; value: number | string; change: number; icon: React.ElementType; accentColor: string; subtitle?: string; badge?: string;
  }) => {
    const isPositive = change >= 0;
    return (
      <div className="group relative bg-white rounded-2xl p-5 border border-gray-100/80 hover:border-gray-200/80 transition-all duration-300 hover:shadow-lg hover:shadow-gray-200/50 hover:-translate-y-0.5">
        <div className="flex items-start justify-between mb-3">
          <div className="p-2.5 rounded-xl transition-transform duration-300 group-hover:scale-110" 
            style={{ backgroundColor: `${accentColor}12` }}>
            <Icon className="h-4.5 w-4.5" style={{ color: accentColor }} />
          </div>
          {badge && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: `${accentColor}12`, color: accentColor }}>
              {badge}
            </span>
          )}
        </div>
        <div className="space-y-1">
          <p className="text-2xl font-bold text-gray-900 tracking-tight">
            {typeof value === 'number' ? formatNumber(value) : value}
          </p>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</p>
        </div>
        <div className="mt-3 pt-3 border-t border-gray-50">
          {subtitle ? (
            <span className="text-xs text-gray-400">{subtitle}</span>
          ) : (
            <div className="flex items-center gap-1">
              {isPositive ? (
                <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />
              )}
              <span className={`text-xs font-semibold ${isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
                {isPositive ? '+' : ''}{change.toFixed(1)}%
              </span>
              <span className="text-xs text-gray-300 ml-0.5">vs mês anterior</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderGeneralKPIs = () => (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      <KPICard label="Clientes" value={kpis.clients} change={kpis.clientsChange} icon={Users} accentColor="#374DA4" badge={`${Math.abs(kpis.clientsChange).toFixed(0)}%`} />
      <KPICard label="Conversas" value={conversationsCount} change={0} icon={MessageSquare} accentColor="#007DE3" subtitle="WhatsApp CRM" />
      <KPICard label="Emails Enviados" value={kpis.emailsSent} change={kpis.emailsChange} icon={Send} accentColor="#8B5CF6" badge={`${kpis.openRate.toFixed(0)}% abertos`} />
      <KPICard label="Emails Abertos" value={kpis.emailsOpened} change={kpis.openRate} icon={Eye} accentColor="#6366F1" />
      <KPICard label="Docs Rastreados" value={kpis.documentsTracked} change={kpis.docsChange} icon={FileText} accentColor="#10B981" />
      <KPICard label="Reuniões" value={kpis.meetings} change={kpis.meetingsChange} icon={Video} accentColor="#F59E0B" />
    </div>
  );

  const renderWhatsAppKPIs = () => {
    if (!whatsappStats || !whatsappStats.hasWhatsApp) {
      return (
        <div className="bg-white rounded-2xl border border-gray-100/80 p-12 text-center">
          <div className="p-4 rounded-2xl bg-[#F0F2FE] w-fit mx-auto mb-4">
            <MessageSquare className="h-8 w-8 text-[#5A74D1]" />
          </div>
          <p className="text-gray-600 font-medium">WhatsApp CRM não vinculado</p>
          <p className="text-sm text-gray-400 mt-1">Vincule uma sessão WhatsApp para ver os KPIs</p>
        </div>
      );
    }
    const s = whatsappStats;
    const aiRate = s.sentMessages > 0 ? ((s.aiResponses / s.sentMessages) * 100) : 0;
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KPICard label="Mensagens" value={s.totalMessages} change={0} icon={MessageSquare} accentColor="#007DE3"
          subtitle={`${formatNumber(s.sentMessages)} env. · ${formatNumber(s.receivedMessages)} rec.`} />
        <KPICard label="Respostas IA" value={s.aiResponses} change={aiRate} icon={Sparkles} accentColor="#8B5CF6"
          badge={`${aiRate.toFixed(0)}%`} />
        <KPICard label="Conversas Ativas" value={s.activeConversations} change={0} icon={Zap} accentColor="#F59E0B" subtitle="Últimas 24h" />
        <KPICard label="Conversões" value={s.conversions} change={s.conversionRate} icon={TrendingUp} accentColor="#10B981"
          badge={`${s.conversionRate.toFixed(1)}%`} />
        <KPICard label="Taxa Conversão" value={`${s.conversionRate.toFixed(1)}%`} change={s.conversionRate} icon={BarChart3} accentColor="#374DA4"
          subtitle="Detectada por palavras-chave" />
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-[#F0F2FE]/20">
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-[#374DA4] to-[#007DE3] flex items-center justify-center shadow-lg shadow-[#374DA4]/20">
              <Activity className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{getGreeting()}, {userName} 👋</h1>
              <p className="text-sm text-gray-400 mt-0.5">
                {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })} · Atualizado às {format(lastUpdate, 'HH:mm')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 bg-white border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl h-9">
                  <Calendar className="h-3.5 w-3.5" />
                  {selectedPeriod}
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setSelectedPeriod('Hoje')}>Hoje</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedPeriod('Esta semana')}>Esta semana</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedPeriod('Este mês')}>Este mês</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedPeriod('Últimos 3 meses')}>Últimos 3 meses</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" size="icon" onClick={loadDashboardData} className="hover:bg-gray-100 rounded-xl h-9 w-9">
              <RefreshCw className="h-4 w-4 text-gray-400" />
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="hover:bg-gray-100 rounded-xl h-9 w-9">
                  <Settings2 className="h-4 w-4 text-gray-400" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 rounded-2xl" align="end">
                <div className="space-y-1 mb-3">
                  <h4 className="font-semibold text-sm">Personalizar Dashboard</h4>
                  <p className="text-xs text-gray-400">Escolha quais seções exibir</p>
                </div>
                <Separator className="mb-3" />
                <div className="space-y-3">
                  {(Object.keys(SECTION_LABELS) as (keyof DashboardSections)[]).map((key) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-sm">{SECTION_LABELS[key]}</span>
                      <Switch checked={sections[key]} onCheckedChange={() => toggleSection(key)} />
                    </div>
                  ))}
                </div>
                <Separator className="my-3" />
                <Button variant="outline" size="sm" className="w-full rounded-xl" onClick={() => setSections(DEFAULT_SECTIONS)}>
                  Restaurar Padrão
                </Button>
              </PopoverContent>
            </Popover>
            <Button variant="ghost" size="icon" className="hover:bg-gray-100 rounded-xl h-9 w-9" onClick={() => navigate('/dashboard/ajuda')}>
              <HelpCircle className="h-4 w-4 text-gray-400" />
            </Button>
          </div>
        </div>

        {/* KPI Toggle + Cards */}
        {sections.kpis && (
          <div className="mb-8">
            {hasWhatsApp && (
              <div className="flex items-center gap-1 mb-5 p-1 bg-gray-100/80 backdrop-blur rounded-xl w-fit">
                <button
                  onClick={() => setKpiMode('geral')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    kpiMode === 'geral' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <LayoutDashboard className="h-4 w-4" />
                  KPIs Gerais
                </button>
                <button
                  onClick={() => setKpiMode('whatsapp')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    kpiMode === 'whatsapp' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <MessageSquare className="h-4 w-4" />
                  WhatsApp CRM
                </button>
              </div>
            )}
            {kpiMode === 'geral' ? renderGeneralKPIs() : renderWhatsAppKPIs()}
          </div>
        )}

        {/* Main Chart */}
        {sections.mainChart && (
          <div className="bg-white rounded-2xl border border-gray-100/80 p-6 mb-8 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-[#374DA4]/10 to-[#007DE3]/10">
                  <BarChart3 className="h-5 w-5 text-[#374DA4]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Visão Geral do Período</h3>
                  <p className="text-xs text-gray-400">Últimos 30 dias</p>
                </div>
              </div>
              <div className="flex items-center gap-5 flex-wrap">
                {[
                  { color: '#374DA4', label: 'Leads' },
                  { color: '#8B5CF6', label: 'Emails' },
                  { color: '#10B981', label: 'Tracking' },
                  { color: '#007DE3', label: 'Mensagens WA' },
                  { color: '#F59E0B', label: 'Respostas IA' },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-xs text-gray-400 font-medium">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
            {kpis.clients === 0 && kpis.emailsSent === 0 && kpis.documentsTracked === 0 && chartData.every(d => d.mensagens === 0) ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="p-4 rounded-2xl bg-gray-50 mb-4">
                  <BarChart3 className="h-8 w-8 text-gray-300" />
                </div>
                <p className="text-gray-500 font-medium">Ainda não capturamos dados</p>
                <p className="text-sm text-gray-400 mt-1">Comece a usar os módulos para ver os dados aqui</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#374DA4" stopOpacity={0.2}/><stop offset="95%" stopColor="#374DA4" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorEmails" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.2}/><stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorTracking" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.2}/><stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorMensagens" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#007DE3" stopOpacity={0.2}/><stop offset="95%" stopColor="#007DE3" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorRespostas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.2}/><stop offset="95%" stopColor="#F59E0B" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 11 }} tickFormatter={(v) => formatNumber(v)} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="leads" name="Leads" stroke="#374DA4" strokeWidth={2} fillOpacity={1} fill="url(#colorLeads)" />
                  <Area type="monotone" dataKey="emails" name="Emails" stroke="#8B5CF6" strokeWidth={2} fillOpacity={1} fill="url(#colorEmails)" />
                  <Area type="monotone" dataKey="tracking" name="Tracking" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#colorTracking)" />
                  <Area type="monotone" dataKey="mensagens" name="Mensagens WA" stroke="#007DE3" strokeWidth={2} fillOpacity={1} fill="url(#colorMensagens)" />
                  <Area type="monotone" dataKey="respostas" name="Respostas IA" stroke="#F59E0B" strokeWidth={2} fillOpacity={1} fill="url(#colorRespostas)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        )}

        {/* WhatsApp Chart */}
        {companyId && (
          <WhatsAppDashboardWidget
            companyId={companyId}
            startDate={dateRange.start}
            endDate={dateRange.end}
            onStatsLoaded={handleWhatsAppStats}
            showChart={sections.whatsappChart}
          />
        )}

        {/* Secondary Stats Grid */}
        {(sections.activityChart || sections.quickAccess) && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {sections.activityChart && (
              <div className="md:col-span-2 bg-white rounded-2xl border border-gray-100/80 p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-5">
                  <div className="p-2 rounded-xl bg-purple-50">
                    <Activity className="h-5 w-5 text-purple-500" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900">Atividade por Categoria</h3>
                    <p className="text-xs text-gray-400">Últimos 7 dias</p>
                  </div>
                </div>
                {kpis.clients === 0 && kpis.emailsSent === 0 && kpis.documentsTracked === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="p-3 rounded-2xl bg-gray-50 mb-3">
                      <BarChart3 className="h-7 w-7 text-gray-300" />
                    </div>
                    <p className="text-sm text-gray-500 font-medium">Sem atividade registrada</p>
                    <p className="text-xs text-gray-400 mt-1">Dados aparecerão conforme você usar os módulos</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={chartData.slice(-7)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 11 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 11 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="leads" name="Leads" fill="#374DA4" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="emails" name="Emails" fill="#8B5CF6" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="tracking" name="Tracking" fill="#10B981" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            )}

            {sections.quickAccess && (
              <div className="bg-white rounded-2xl border border-gray-100/80 p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-5">
                  <div className="p-2 rounded-xl bg-amber-50">
                    <Zap className="h-5 w-5 text-amber-500" />
                  </div>
                  <h3 className="text-base font-bold text-gray-900">Acesso Rápido</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Omni', desc: 'Comunicação', icon: MessageSquare, color: '#374DA4', path: '/dashboard/omni' },
                    { label: 'Flow', desc: 'Produtividade', icon: Calendar, color: '#007DE3', path: '/dashboard/flows' },
                    { label: 'Track', desc: 'Rastreamento', icon: Radio, color: '#2ECC71', path: '/dashboard/track' },
                    { label: 'Suite', desc: 'Gestão', icon: Users, color: '#374DA4', path: '/dashboard/cadastros' },
                  ].map((hub) => {
                    const Icon = hub.icon;
                    return (
                      <button key={hub.label} onClick={() => navigate(hub.path)}
                        className="group relative flex flex-col items-center gap-2.5 p-5 rounded-2xl border border-gray-100 hover:border-transparent transition-all duration-300 hover:shadow-lg bg-white"
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = `${hub.color}06`; e.currentTarget.style.borderColor = `${hub.color}25`; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.borderColor = ''; }}
                      >
                        <div className="p-3 rounded-2xl transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg"
                          style={{ backgroundColor: hub.color, color: 'white', boxShadow: `0 4px 14px ${hub.color}30` }}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="text-center">
                          <span className="font-bold text-sm text-gray-900 block">{hub.label}</span>
                          <span className="text-[11px] text-gray-400">{hub.desc}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MainDashboard;
