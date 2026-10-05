import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Calendar, Mail, Users, Video, FileText, CheckSquare, 
  MessageSquare, Bot, Zap, BarChart3, Clock, ChevronRight,
  CalendarDays, Plus, ArrowRight, Sparkles
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { format, isToday, isTomorrow, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface MobileHomeProps {
  onNavigate: (item: string) => void;
}

const navigationItems = [
  { icon: Video, label: 'Reuniões', path: '/dashboard/reunioes', color: 'bg-[#374DA4]' },
  { icon: Calendar, label: 'Agenda', path: '/dashboard/agenda', color: 'bg-indigo-500' },
  { icon: Mail, label: 'Email', path: '/dashboard/email', color: 'bg-cyan-500' },
  { icon: Users, label: 'Contatos', path: '/dashboard/clientes', color: 'bg-violet-500' },
  { icon: FileText, label: 'Arquivos', path: '/dashboard/drive', color: 'bg-[#2F428D]' },
  { icon: CheckSquare, label: 'Tarefas', path: '/dashboard/tasks', color: 'bg-pink-500' },
  { icon: Zap, label: 'Fluxos', path: '/dashboard/fluxos', color: 'bg-red-500' },
  { icon: MessageSquare, label: 'CRM Ello', path: '/dashboard/crm-ello', color: 'bg-[#2F428D]' },
  { icon: Bot, label: 'Bot IA', path: '/dashboard/bot-ia', color: 'bg-purple-500' },
  { icon: CalendarDays, label: 'Ag. Online', path: '/dashboard/agenda-aberta', color: 'bg-teal-500' },
  { icon: BarChart3, label: 'Análises', path: '/dashboard/analytics', color: 'bg-amber-500' },
  { icon: Sparkles, label: 'Mais', path: '/dashboard', color: 'bg-slate-500' },
];

const MobileHome: React.FC<MobileHomeProps> = ({ onNavigate }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState({
    meetingsToday: 0,
    tasksToday: 0,
    nextEvent: null as any,
    totalClients: 0
  });
  const [recentEvents, setRecentEvents] = useState<any[]>([]);

  const userName = user?.user_metadata?.full_name?.split(' ')[0] || 
                   user?.email?.split('@')[0] || 'Usuário';

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  const loadDashboardData = async () => {
    if (!user) return;

    const { data: companyUsers } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', user.id)
      .limit(1);

    if (!companyUsers || companyUsers.length === 0) return;
    const companyId = companyUsers[0].company_id;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get meetings today
    const { data: meetingsToday } = await supabase
      .from('meeting_rooms')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .gte('created_at', today.toISOString())
      .lt('created_at', tomorrow.toISOString());

    // Get upcoming events
    const { data: upcomingEvents } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('company_id', companyId)
      .gte('start_date', new Date().toISOString())
      .order('start_date', { ascending: true })
      .limit(4);

    // Get total clients
    const { count: totalClients } = await supabase
      .from('clients')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId);

    setStats({
      meetingsToday: meetingsToday?.length || 0,
      tasksToday: 0,
      nextEvent: upcomingEvents?.[0] || null,
      totalClients: totalClients || 0
    });

    setRecentEvents(upcomingEvents || []);
  };

  const formatEventDate = (dateString: string) => {
    const date = parseISO(dateString);
    if (isToday(date)) return `Hoje, ${format(date, 'HH:mm')}`;
    if (isTomorrow(date)) return `Amanhã, ${format(date, 'HH:mm')}`;
    return format(date, "EEE, dd MMM 'às' HH:mm", { locale: ptBR });
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary px-5 pt-12 pb-8 rounded-b-[32px]">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-primary-foreground/70 text-sm">{getGreeting()}</p>
            <h1 className="text-2xl font-bold text-primary-foreground">{userName} 👋</h1>
          </div>
          <button 
            onClick={() => navigate('/dashboard/reunioes')}
            className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center"
          >
            <Plus className="h-6 w-6 text-primary-foreground" />
          </button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-3 text-center">
            <p className="text-2xl font-bold text-primary-foreground">{stats.meetingsToday}</p>
            <p className="text-xs text-primary-foreground/70">Reuniões</p>
          </div>
          <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-3 text-center">
            <p className="text-2xl font-bold text-primary-foreground">{stats.totalClients}</p>
            <p className="text-xs text-primary-foreground/70">Contatos</p>
          </div>
          <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-3 text-center">
            <p className="text-2xl font-bold text-primary-foreground">{recentEvents.length}</p>
            <p className="text-xs text-primary-foreground/70">Eventos</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-5 -mt-4 space-y-6 pb-24">
        {/* Navigation Grid */}
        <div className="bg-card rounded-3xl shadow-lg p-4">
          <div className="grid grid-cols-4 gap-3">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className="flex flex-col items-center gap-2 p-3 rounded-2xl hover:bg-muted/50 active:scale-95 transition-all"
                >
                  <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", item.color)}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <span className="text-xs font-medium text-foreground text-center leading-tight">
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Next Event Card */}
        {stats.nextEvent && (
          <div 
            onClick={() => navigate('/dashboard/agenda')}
            className="bg-gradient-to-r from-primary to-primary/80 rounded-3xl p-5 shadow-lg cursor-pointer active:scale-[0.98] transition-transform"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-primary-foreground/80 bg-white/20 px-3 py-1 rounded-full">
                Próximo compromisso
              </span>
              <ChevronRight className="h-5 w-5 text-primary-foreground/60" />
            </div>
            <h3 className="text-lg font-semibold text-primary-foreground mb-1 line-clamp-1">
              {stats.nextEvent.title}
            </h3>
            <div className="flex items-center gap-2 text-primary-foreground/80 text-sm">
              <Clock className="h-4 w-4" />
              <span>{formatEventDate(stats.nextEvent.start_date)}</span>
            </div>
          </div>
        )}

        {/* Upcoming Events */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Próximos Eventos</h2>
            <button 
              onClick={() => navigate('/dashboard/agenda')}
              className="text-sm text-primary font-medium flex items-center gap-1"
            >
              Ver todos
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          {recentEvents.length > 0 ? (
            <div className="space-y-3">
              {recentEvents.slice(0, 3).map((event, index) => (
                <div 
                  key={event.id}
                  onClick={() => navigate('/dashboard/agenda')}
                  className="bg-card rounded-2xl p-4 shadow-sm flex items-center gap-4 cursor-pointer active:scale-[0.98] transition-transform"
                >
                  <div 
                    className="w-1.5 h-12 rounded-full"
                    style={{ backgroundColor: event.color || 'hsl(var(--primary))' }}
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-foreground truncate">{event.title}</h4>
                    <p className="text-sm text-muted-foreground">
                      {formatEventDate(event.start_date)}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-card rounded-2xl p-8 text-center shadow-sm">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <CalendarDays className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground text-sm">Nenhum evento agendado</p>
              <button 
                onClick={() => navigate('/dashboard/agenda')}
                className="mt-4 text-sm text-primary font-medium"
              >
                Agendar agora
              </button>
            </div>
          )}
        </div>

        {/* Quick Actions Row */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate('/dashboard/reunioes')}
            className="bg-card rounded-2xl p-4 shadow-sm flex items-center gap-3 active:scale-[0.98] transition-transform"
          >
            <div className="w-10 h-10 bg-[#DFE4FB] rounded-xl flex items-center justify-center">
              <Video className="h-5 w-5 text-[#2F428D]" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-foreground">Nova Reunião</p>
              <p className="text-xs text-muted-foreground">Iniciar agora</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/dashboard/agenda-aberta')}
            className="bg-card rounded-2xl p-4 shadow-sm flex items-center gap-3 active:scale-[0.98] transition-transform"
          >
            <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center">
              <CalendarDays className="h-5 w-5 text-teal-600" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-foreground">Agenda Online</p>
              <p className="text-xs text-muted-foreground">Criar link</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default MobileHome;
