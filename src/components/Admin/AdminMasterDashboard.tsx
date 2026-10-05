import React, { useEffect, useState } from 'react';
import { useAdminMaster } from '@/hooks/useAdminMaster';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Building2, Users, CreditCard, DollarSign, HeadphonesIcon, 
  Activity, ChevronRight, TrendingUp, UserPlus, AlertCircle, Bug,
  BarChart3, Clock, ArrowUpRight, ArrowDownRight, Zap, Globe, ShieldCheck, X, MessageSquare
} from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const CHART_COLORS = ['#374DA4', '#d97757', '#8a877f', '#c9b99a', '#1a1a18', '#7d9b76'];

type KpiKey = 'revenue' | 'companies' | 'users' | 'activeSubs' | 'trial' | 'recent' | 'tickets' | 'bugs';

const AdminMasterDashboard = () => {
  const { isAdminMaster, loading: authLoading, callAdminApi } = useAdminMaster();
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [detailModal, setDetailModal] = useState<KpiKey | null>(null);

  useEffect(() => {
    if (!isAdminMaster || authLoading) return;
    callAdminApi('stats')
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoadingStats(false));
  }, [isAdminMaster, authLoading]);

  if (authLoading) return <div className="p-6"><Skeleton className="h-64 w-full" /></div>;

  const allSubs = stats?.subscriptions || [];
  const activeSubs = allSubs.filter((s: any) => s.status === 'active' && s.plan_type !== 'partner');
  const revenue = activeSubs.reduce((sum: number, s: any) => sum + (Number(s.monthly_price) || 0), 0);
  const trialSubs = allSubs.filter((s: any) => s.status === 'trialing');
  const recentCompanies = stats?.recentCompanies || [];
  const allCompanies = stats?.allCompanies || [];
  const companyNameById = (id?: string) => {
    if (!id) return '—';
    const c = allCompanies.find((x: any) => x.id === id);
    return c?.name || `${id.slice(0, 8)}…`;
  };

  const kpis: { label: string; value: any; icon: any; gradient: string; trend: string | null; up: boolean; key: KpiKey }[] = [
    { label: 'Receita Mensal', value: `R$ ${revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: DollarSign, gradient: 'from-[#374DA4] to-[#6C3AFF]', trend: null, up: true, key: 'revenue' },
    { label: 'Empresas', value: stats?.totalCompanies ?? 0, icon: Building2, gradient: 'from-[#0EA5E9] to-[#38BDF8]', trend: null, up: true, key: 'companies' },
    { label: 'Usuários', value: stats?.totalUsers ?? 0, icon: Users, gradient: 'from-[#10B981] to-[#34D399]', trend: null, up: true, key: 'users' },
    { label: 'Assinaturas Ativas', value: activeSubs.length, icon: CreditCard, gradient: 'from-[#8B5CF6] to-[#A78BFA]', trend: null, up: true, key: 'activeSubs' },
    { label: 'Em Trial', value: trialSubs.length, icon: Clock, gradient: 'from-[#F59E0B] to-[#FBBF24]', trend: null, up: false, key: 'trial' },
    { label: 'Novos (30d)', value: recentCompanies.length, icon: UserPlus, gradient: 'from-[#06B6D4] to-[#67E8F9]', trend: null, up: true, key: 'recent' },
    { label: 'Tickets Abertos', value: stats?.openTickets ?? 0, icon: AlertCircle, gradient: 'from-[#EF4444] to-[#F87171]', trend: null, up: false, key: 'tickets' },
    { label: 'Bugs Abertos', value: stats?.openBugs ?? 0, icon: Bug, gradient: 'from-[#EC4899] to-[#F472B6]', trend: null, up: false, key: 'bugs' },
  ];

  // Chart data
  const planBreakdown = stats?.planBreakdown || {};
  const pieData = Object.entries(planBreakdown).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }));

  const trend = stats?.registrationTrend || {};
  const areaData = Object.entries(trend).map(([date, count]) => ({
    day: new Date(date).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' }).replace('.', ''),
    registros: count,
  }));


  const panels = [
    { label: 'Empresas & Usuários', desc: 'Gerenciar empresas, impersonar, alterar roles', icon: Users, path: '/dashboard/admin/users', color: 'from-[#374DA4]/10 to-[#6C3AFF]/5 border-[#374DA4]/10 hover:border-[#374DA4]/30' },
    { label: 'Assinaturas & Planos', desc: 'Status de pagamentos, ativar/desativar módulos', icon: CreditCard, path: '/dashboard/admin/subs', color: 'from-[#8B5CF6]/10 to-[#A78BFA]/5 border-[#8B5CF6]/10 hover:border-[#8B5CF6]/30' },
    { label: 'Saúde do Sistema', desc: 'Edge functions, APIs, erros recentes', icon: Activity, path: '/dashboard/admin/system', color: 'from-[#10B981]/10 to-[#34D399]/5 border-[#10B981]/10 hover:border-[#10B981]/30' },
    { label: 'Suporte & Bugs', desc: 'Tickets abertos, relatórios de bugs', icon: HeadphonesIcon, path: '/dashboard/admin/support', color: 'from-[#EF4444]/10 to-[#F87171]/5 border-[#EF4444]/10 hover:border-[#EF4444]/30' },
    { label: 'Custos de API', desc: 'Tracking de custos ElevenLabs, OpenAI, etc', icon: DollarSign, path: '/dashboard/admin/costs', color: 'from-[#F59E0B]/10 to-[#FBBF24]/5 border-[#F59E0B]/10 hover:border-[#F59E0B]/30' },
    { label: 'Evolution API', desc: 'Gerenciar todas as instâncias conectadas', icon: MessageSquare, path: '/dashboard/admin/evolution', color: 'from-[#FF4500]/10 to-[#FF8C00]/5 border-[#FF4500]/10 hover:border-[#FF4500]/30' },
    { label: 'Logs Auditoria', desc: 'Linha do tempo financeira e ações', icon: Clock, path: '/dashboard/admin/logs', color: 'from-[#1A1D1F]/10 to-[#1A1D1F]/5 border-[#1A1D1F]/10 hover:border-[#1A1D1F]/30' },
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload?.length) {
      return (
        <div className="bg-[#1a1a18] text-white px-3 py-2 rounded-xl shadow-xl border border-white/10 text-xs">
          <p className="font-medium mb-0.5">{label}</p>
          {payload.map((p: any, i: number) => (
            <p key={i} className="text-white/70">{p.name}: <span className="font-bold text-white">{typeof p.value === 'number' && p.name === 'receita' ? `R$ ${p.value.toFixed(0)}` : p.value}</span></p>
          ))}
        </div>
      );
    }
    return null;
  };

  const getModalTitle = (key: KpiKey) => {
    const titles: Record<KpiKey, string> = {
      revenue: 'Detalhes da Receita Mensal',
      companies: 'Todas as Empresas',
      users: 'Todos os Usuários',
      activeSubs: 'Assinaturas Ativas',
      trial: 'Assinaturas em Trial',
      recent: 'Empresas Criadas nos Últimos 30 Dias',
      tickets: 'Tickets Abertos',
      bugs: 'Bugs Abertos',
    };
    return titles[key];
  };

  const renderModalContent = (key: KpiKey) => {
    switch (key) {
      case 'revenue':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-xl bg-[#374DA4]/5 border border-[#374DA4]/10">
                <p className="text-2xl font-bold text-foreground">R$ {revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                <p className="text-xs text-muted-foreground">Receita total mensal</p>
              </div>
              <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                <p className="text-2xl font-bold text-foreground">{activeSubs.length}</p>
                <p className="text-xs text-muted-foreground">Assinaturas pagantes</p>
              </div>
            </div>
            <h4 className="text-sm font-semibold text-foreground">Distribuição de Receita</h4>
            <div className="p-8 text-center bg-muted/20 rounded-xl border border-dashed border-muted-foreground/20">
              <TrendingUp className="h-8 w-8 text-[#374DA4] mx-auto mb-2 opacity-20" />
              <p className="text-xs text-muted-foreground">Soma das assinaturas ativas cadastradas.</p>
            </div>
          </div>
        );

      case 'companies':
       case 'users': {
         const isUsers = key === 'users';
         const list = isUsers ? (stats?.recentUsers || []) : recentCompanies;
         const total = isUsers ? (stats?.totalUsers || 0) : (stats?.totalCompanies || 0);
         const label = isUsers ? 'usuários' : 'empresas';
         const iconColor = isUsers ? 'text-[#10B981]' : 'text-[#0EA5E9]';
         const bgColor = isUsers ? 'bg-[#10B981]/10' : 'bg-[#0EA5E9]/10';
         const Icon = isUsers ? Users : Building2;

         return (
           <div className="space-y-2">
             <p className="text-sm text-muted-foreground mb-3">Total: {total} {label} cadastrados</p>
             {list.map((item: any) => (
               <div key={item.id || item.user_id} className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer"
                 onClick={() => { setDetailModal(null); navigate('/dashboard/admin/users'); }}>
                 <div className="flex items-center gap-3">
                   <div className={`h-8 w-8 rounded-lg ${bgColor} flex items-center justify-center`}>
                     <Icon className={`h-4 w-4 ${iconColor}`} />
                   </div>
                   <div>
                     <p className="text-sm font-medium text-foreground">{isUsers ? (item.email || 'Usuário') : item.name}</p>
                     <p className="text-[10px] text-muted-foreground">
                       {isUsers ? `ID: ${item.user_id.slice(0, 8)}…` : new Date(item.created_at).toLocaleDateString('pt-BR')}
                     </p>
                   </div>
                 </div>
                 {isUsers && <Badge variant="outline" className="text-[10px] uppercase">{item.role}</Badge>}
                 <ChevronRight className="h-4 w-4 text-muted-foreground" />
               </div>
             ))}
             <button onClick={() => { setDetailModal(null); navigate('/dashboard/admin/users'); }} className="w-full text-center text-xs text-[#374DA4] hover:underline py-2 font-medium">
               Ver todos os {label} →
             </button>
           </div>
         );
       }

      case 'activeSubs':
      case 'trial': {
        const subsToShow = key === 'activeSubs' ? activeSubs : trialSubs;
        return (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground mb-3">{subsToShow.length} assinatura{subsToShow.length !== 1 ? 's' : ''}</p>
            {subsToShow.map((sub: any) => (
              <div
                key={sub.id}
                onClick={() => { setDetailModal(null); navigate('/dashboard/admin/subs'); }}
                className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{companyNameById(sub.company_id)}</p>
                  <Badge variant="outline" className="capitalize text-[10px] font-semibold shrink-0">{sub.plan_type}</Badge>
                  <Badge className={`text-[10px] border-0 shrink-0 ${sub.status === 'active' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-[#374DA4]/10 text-[#2F428D]'}`}>{sub.status}</Badge>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-foreground">R$ {Number(sub.monthly_price || 0).toFixed(2)}</p>
                  <p className="text-[10px] text-muted-foreground">{sub.current_period_end ? new Date(sub.current_period_end).toLocaleDateString('pt-BR') : '—'}</p>
                </div>
              </div>
            ))}
          </div>
        );
      }

      case 'recent':
        return (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground mb-3">{recentCompanies.length} empresas nos últimos 30 dias</p>
            {recentCompanies.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-[#06B6D4]/10 flex items-center justify-center">
                    <UserPlus className="h-4 w-4 text-[#06B6D4]" />
                  </div>
                  <p className="text-sm font-medium text-foreground">{c.name}</p>
                </div>
                <p className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString('pt-BR')}</p>
              </div>
            ))}
          </div>
        );

      case 'tickets':
        return (
          <div className="text-center py-8">
            <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">{stats?.openTickets || 0} ticket{(stats?.openTickets || 0) !== 1 ? 's' : ''} aberto{(stats?.openTickets || 0) !== 1 ? 's' : ''}</p>
            <button onClick={() => { setDetailModal(null); navigate('/dashboard/admin/support'); }} className="mt-3 text-xs text-[#374DA4] hover:underline font-medium">
              Ver no painel de suporte →
            </button>
          </div>
        );

      case 'bugs':
        return (
          <div className="text-center py-8">
            <Bug className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">{stats?.openBugs || 0} bug{(stats?.openBugs || 0) !== 1 ? 's' : ''} aberto{(stats?.openBugs || 0) !== 1 ? 's' : ''}</p>
            <button onClick={() => { setDetailModal(null); navigate('/dashboard/admin/support'); }} className="mt-3 text-xs text-[#374DA4] hover:underline font-medium">
              Ver no painel de suporte →
            </button>
          </div>
        );

      default:
        return <p className="text-sm text-muted-foreground">Sem dados disponíveis.</p>;
    }
  };

  return (
    <div className="p-4 md:p-10 space-y-8 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="h-4 w-4 text-[#8a877f]" />
            <span className="text-xs font-semibold text-[#8a877f] uppercase tracking-widest">Admin Master</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-semibold text-[#1a1a18] dark:text-white tracking-tight">Visão Geral</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Números reais da plataforma</p>
        </div>
        <div className="hidden md:flex items-center gap-2 bg-white dark:bg-white/[0.03] px-3.5 py-1.5 rounded-full border border-black/[0.06]">
          
          <span className="text-xs font-medium text-[#6b6962]">Sistema online</span>
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {kpis.map(kpi => (
          <Card 
            key={kpi.label} 
            className="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] shadow-none bg-white dark:bg-white/[0.03] hover:border-black/[0.12] transition-colors cursor-pointer"
            onClick={() => setDetailModal(kpi.key)}
          >
            <CardContent className="p-4 relative">
              <div className="flex items-start justify-between mb-3">
                <div className="p-2 rounded-lg bg-[#f5f4ef] dark:bg-white/[0.06]">
                  <kpi.icon className="h-4 w-4 text-[#6b6962] dark:text-white/70" />
                </div>
                {kpi.trend && (
                  <div className={`flex items-center gap-0.5 text-[11px] font-semibold ${kpi.up ? 'text-emerald-500' : 'text-red-500'}`}>
                    {kpi.up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {kpi.trend}
                  </div>
                )}
              </div>
              {loadingStats ? <Skeleton className="h-7 w-20 mb-1" /> : (
                <p className="text-xl md:text-2xl font-semibold text-[#1a1a18] dark:text-white tracking-tight tabular-nums">{kpi.value}</p>
              )}
              <p className="text-xs text-[#8a877f] mt-0.5">{kpi.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Detail Modal */}
      <Dialog open={!!detailModal} onOpenChange={(open) => !open && setDetailModal(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] p-0 overflow-hidden">
          <DialogHeader className="p-5 pb-3 border-b border-border">
            <DialogTitle className="text-base font-semibold">{detailModal && getModalTitle(detailModal)}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[65vh] px-5 pb-5">
            {detailModal && renderModalContent(detailModal)}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] shadow-none bg-white dark:bg-white/[0.03]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-[#8a877f]" />
              Distribuição de Planos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingStats ? <Skeleton className="h-52 w-full" /> : pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value" stroke="none">
                    {pieData.map((_, index) => (
                      <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">Nenhum dado</div>
            )}
          </CardContent>
        </Card>
      <Card className="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] shadow-none bg-white dark:bg-white/[0.03]">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-[#8a877f]" />
              Cadastros Recentes
            </CardTitle>
            <Badge variant="outline" className="text-[10px] border-black/[0.08] text-[#6b6962]">Últimos 7 dias</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {loadingStats ? <Skeleton className="h-48 w-full" /> : areaData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={areaData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#374DA4" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#374DA4" stopOpacity={0.7} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="registros" fill="url(#barGrad)" radius={[6, 6, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">Nenhum cadastro recente</div>
          )}
        </CardContent>
      </Card>

      </div>

      {/* Quick Navigation */}
      <div>
        <h2 className="text-base font-semibold text-foreground mb-3">Acesso Rápido</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {panels.map(panel => (
            <Card 
              key={panel.label} 
              className={`cursor-pointer transition-all duration-300 bg-white dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.08] shadow-none hover:border-black/[0.14] rounded-2xl group`}
              onClick={() => navigate(panel.path)}
            >
              <CardContent className="p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[#f5f4ef] dark:bg-white/[0.06]">
                    <panel.icon className="h-4 w-4 text-[#6b6962] dark:text-white/70" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm">{panel.label}</p>
                    <p className="text-[11px] text-muted-foreground">{panel.desc}</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Recent Subscriptions */}
      {(stats?.recentSubscriptionsDetailed?.length > 0 || stats?.subscriptions?.length > 0) && (
        <Card className="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] shadow-none bg-white dark:bg-white/[0.03]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-[#8a877f]" />
                Assinaturas Recentes
              </CardTitle>
              <button onClick={() => navigate('/dashboard/admin/subs')} className="text-xs text-[#374DA4] hover:underline font-medium flex items-center gap-1">
                Ver todas <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {(stats.recentSubscriptionsDetailed && stats.recentSubscriptionsDetailed.length > 0
                ? stats.recentSubscriptionsDetailed
                : stats.subscriptions.slice(0, 8)
              ).map((sub: any) => {
                const fmt = (d?: string) => d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
                return (
                <div
                  key={sub.id}
                  onClick={() => navigate('/dashboard/admin/subs')}
                  className="flex items-start justify-between gap-3 py-3 px-3 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer border border-transparent hover:border-border"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="h-9 w-9 rounded-lg bg-[#f5f4ef] dark:bg-white/[0.06] flex items-center justify-center shrink-0">
                      <CreditCard className="h-4 w-4 text-[#6b6962]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {sub.company_name || companyNameById(sub.company_id)}
                        </p>
                        <Badge variant="outline" className="capitalize text-[10px] font-semibold">{sub.plan_type}</Badge>
                        <Badge
                          className={`text-[10px] border-0 ${
                            sub.status === 'active' ? 'bg-emerald-500/10 text-emerald-600' :
                            sub.status === 'trialing' ? 'bg-[#374DA4]/10 text-[#2F428D]' :
                            sub.status === 'canceled' ? 'bg-red-500/10 text-red-600' :
                            'bg-amber-500/10 text-amber-600'
                          }`}
                        >
                          {sub.status}
                        </Badge>
                      </div>
                      {(sub.owner_email || sub.owner_name) && (
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {sub.owner_name ? `${sub.owner_name} · ` : ''}{sub.owner_email}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground mt-1">
                        <span><span className="font-medium text-foreground/70">Início:</span> {fmt(sub.current_period_start || sub.created_at)}</span>
                        {sub.status === 'trialing' && sub.trial_ends_at ? (
                          <span><span className="font-medium text-foreground/70">Trial até:</span> {fmt(sub.trial_ends_at)}</span>
                        ) : (
                          <span><span className="font-medium text-foreground/70">Expira:</span> {fmt(sub.current_period_end)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-foreground">R$ {Number(sub.monthly_price || 0).toFixed(2)}</p>
                    <p className="text-[10px] text-muted-foreground">
                      Criada em {sub.created_at ? new Date(sub.created_at).toLocaleDateString('pt-BR') : '—'}
                    </p>
                  </div>
                </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminMasterDashboard;
