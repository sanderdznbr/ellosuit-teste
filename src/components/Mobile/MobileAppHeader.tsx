import React, { useState } from 'react';
import { isPathHidden } from "@/config/featureFlags";
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Bell, Moon, Sun, Settings, User, CreditCard, Shield, LogOut, ChevronRight,
  HelpCircle, AlertCircle, Palette, Eye, Users, FileText, History, Menu,
  CheckCheck, Calendar, MessageSquare, CheckCircle, Video, Mail, FolderOpen,
  Trash2, Archive, X, Home, Search, Zap, Briefcase, Link2, BarChart3
} from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { useHubColor } from '@/hooks/useHubColor';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ElloLogo } from '@/components/shared/ElloLogo';
import logoElloDefault from '@/assets/logoellosuit.png';
import ellomeetingLogo from "/lovable-uploads/logo-ellomeeting-new.png";

const BRAND = '#374DA4';

const navigationGroup = {
  title: 'Navegação',
  items: [
    { icon: MessageSquare, label: 'Conversas', path: '/dashboard/crm-ello', color: BRAND },
    { icon: Users, label: 'Contatos', path: '/dashboard/cadastros', color: BRAND },
    { icon: Calendar, label: 'Agenda', path: '/dashboard/agenda', color: BRAND },
    { icon: Video, label: 'Reuniões', path: '/dashboard/reunioes', color: BRAND },
    { icon: BarChart3, label: 'Conteúdo & Dados', path: '/dashboard/analytics', color: BRAND },
  ],
};

const settingsGroups = [
  navigationGroup,
  {
    title: 'Conta',
    items: [
      { icon: User, label: 'Meu Perfil', path: '/dashboard/perfil', color: '#374DA4' },
      { icon: CreditCard, label: 'Minha Assinatura', path: '/dashboard/minhassinatura', color: '#374DA4' },
      { icon: Shield, label: 'Segurança', path: '/dashboard/seguranca', color: '#374DA4' },
    ],
  },
  {
    title: 'Preferências',
    items: [
      { icon: Palette, label: 'Aparência', path: '/dashboard/configuracoes/aparencia', color: '#8B5CF6' },
      { icon: Bell, label: 'Notificações', path: '/dashboard/configuracoes/notificacoes', color: '#F59E0B' },
      { icon: Eye, label: 'Privacidade', path: '/dashboard/configuracoes/privacidade', color: '#10B981' },
    ],
  },
  {
    title: 'Empresa',
    items: [],
  },
  {
    title: 'Ajuda',
    items: [
      { icon: HelpCircle, label: 'Suporte', path: '/dashboard/suporte', color: '#64748B' },
      { icon: AlertCircle, label: 'Reportar Problema', path: '/dashboard/reportar-problema', color: '#EF4444' },
      { icon: FileText, label: 'Termos e Políticas', path: '/terms', color: '#64748B' },
    ],
  },
];

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  system: AlertCircle, calendar: Calendar, crm: MessageSquare,
  task: CheckCircle, meeting: Video, email: Mail, drive: FolderOpen,
};

const CATEGORY_COLORS: Record<string, string> = {
  system: '#6366f1', calendar: '#007DE3', crm: '#374DA4',
  task: '#22c55e', meeting: '#8b5cf6', email: '#f59e0b', drive: '#374DA4',
};

const MobileAppHeader = () => {
  const [customLogos, setCustomLogos] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    const loadLogos = async () => {
      const { data } = await supabase.from('hub_logos').select('hub_id, svg_content');
      if (data) {
        const logoMap: Record<string, string> = {};
        data.forEach(item => {
          logoMap[item.hub_id] = item.svg_content;
        });
        setCustomLogos(logoMap);
      }
    };
    loadLogos();

    const channel = supabase
      .channel('hub_logos_mobile')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hub_logos' }, loadLogos)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const navigate = useNavigate();
  const location = useLocation();
  const { color: hubColor } = useHubColor();
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification, archiveNotification } = useNotifications();
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'menu' | 'notifications'>('menu');

  React.useEffect(() => {
    const handler = () => { 
      setMenuOpen(true); 
      setActiveTab('menu'); 
    };
    window.addEventListener('open-mobile-menu', handler);
    return () => window.removeEventListener('open-mobile-menu', handler);
  }, []);
  
  const isMeetContext = location.pathname.includes('/meet-hub') || location.pathname.startsWith('/meet/') || location.pathname.startsWith('/dashboard/reunioes');
  const isOmniHubRoute = location.pathname.startsWith('/dashboard/omni');
  const isDashboardHome = location.pathname === '/dashboard' || location.pathname === '/dashboard/' || location.pathname === '/dashboard/omni';
  const isFlowHubRoute = location.pathname.startsWith('/dashboard/flows')
    || location.pathname.startsWith('/dashboard/agenda')
    || location.pathname.startsWith('/dashboard/agenda-aberta')
    || location.pathname.startsWith('/dashboard/tasks')
    || location.pathname.startsWith('/dashboard/fluxos');
  const isTrackHubRoute = location.pathname.startsWith('/dashboard/track')
    || location.pathname.startsWith('/dashboard/rastreamento')
    || location.pathname.startsWith('/dashboard/encurtador')
    || location.pathname.startsWith('/dashboard/email-tracker')
    || location.pathname.startsWith('/dashboard/leads');
  const isSuiteHubRoute = location.pathname.startsWith('/dashboard/suite')
    || location.pathname.startsWith('/dashboard/cadastros')
    || location.pathname.startsWith('/dashboard/drive')
    || location.pathname.startsWith('/dashboard/habitos')
    || location.pathname.startsWith('/dashboard/contratos')
    || location.pathname.startsWith('/dashboard/propostas')
    || location.pathname.startsWith('/dashboard/recibos')
    || location.pathname.startsWith('/dashboard/analytics')
    || location.pathname.startsWith('/dashboard/ello-vision')
    || location.pathname.startsWith('/dashboard/relatorios')
    || location.pathname.startsWith('/dashboard/apps');

  const currentHubKey = isMeetContext ? 'meet' :
    isOmniHubRoute ? 'omni' :
    isFlowHubRoute ? 'flow' :
    isTrackHubRoute ? 'track' :
    isSuiteHubRoute ? 'suite' :
    isDashboardHome ? 'home' : 'default';

  const isDarkHub = theme === 'dark';

  // Unified brand color — no more hub-specific tinting on the mobile header.
  const headerBg = isDarkHub ? '#101010' : BRAND;
  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuário';
  const userEmail = user?.email || '';
  const avatarUrl = user?.user_metadata?.avatar_url;

  const handleLogout = async () => {
    setMenuOpen(false);
    await supabase.auth.signOut();
    navigate('/auth');
  };

  const handleNotificationClick = (notification: any) => {
    if (!notification.is_read) markAsRead(notification.id);
    if (notification.action_url) {
      setMenuOpen(false);
      navigate(notification.action_url);
    }
  };

  const recentNotifications = notifications.slice(0, 15);

  return (
    <>
      {/* The main fixed header is now in DashboardLayout.tsx to avoid duplication and z-index issues */}

      {/* Full-screen slide-in menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-[200] flex flex-col bg-[#faf9f7] dark:bg-[#141414] animate-in slide-in-from-right duration-200">
          {/* Menu Header */}
          <div
            className="shrink-0 flex items-center justify-between px-4 h-14 border-b"
            style={{ 
              backgroundColor: isDarkHub ? '#141414' : '#faf9f7', 
              borderColor: isDarkHub ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
              paddingTop: 'env(safe-area-inset-top)', 
              minHeight: 'calc(3.5rem + env(safe-area-inset-top))' 
            }}
          >
            {/* Tabs: Menu / Notificações */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveTab('menu')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${activeTab === 'menu' ? 'bg-black/5 dark:bg-white/10 text-foreground' : 'text-muted-foreground'}`}
              >
                Menu
              </button>
              <button
                onClick={() => setActiveTab('notifications')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors relative ${activeTab === 'notifications' ? 'bg-black/5 dark:bg-white/10 text-foreground' : 'text-muted-foreground'}`}
              >
                Notificações
                {unreadCount > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center h-4 min-w-4 px-1 bg-primary rounded-full text-[9px] text-white font-bold">
                    {unreadCount}
                  </span>
                )}
              </button>
            </div>
            <button onClick={() => setMenuOpen(false)} className="p-2 rounded-xl text-foreground active:bg-black/5 dark:active:bg-white/10">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'menu' ? (
              <div className="flex flex-col">
                {/* User card */}
                <div className="p-5 border-b border-border">
                  <div className="flex items-center gap-3">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={userName} className="h-12 w-12 rounded-full object-cover border-2 border-border" />
                    ) : (
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-6 w-6 text-primary" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{userName}</p>
                      <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
                    </div>
                  </div>
                </div>

                {/* Quick actions */}
                <div className="px-5 pt-4 pb-2">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Ações Rápidas</p>
                </div>
                <div className="grid grid-cols-3 gap-2 px-5 pb-3">
                  <button
                    onClick={() => { window.dispatchEvent(new CustomEvent('open-ai-history')); setMenuOpen(false); }}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-muted/50 active:bg-muted transition-colors"
                  >
                    <History className="h-5 w-5 text-primary" />
                    <span className="text-[10px] font-medium text-foreground">Conversas</span>
                  </button>
                  <button
                    onClick={toggleTheme}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-muted/50 active:bg-muted transition-colors"
                  >
                    {theme === 'dark' ? <Sun className="h-5 w-5 text-amber-500" /> : <Moon className="h-5 w-5 text-indigo-500" />}
                    <span className="text-[10px] font-medium text-foreground">{theme === 'dark' ? 'Claro' : 'Escuro'}</span>
                  </button>
                  <button
                    onClick={() => { setMenuOpen(false); navigate('/dashboard/configuracoes'); }}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-muted/50 active:bg-muted transition-colors"
                  >
                    <Settings className="h-5 w-5 text-muted-foreground" />
                    <span className="text-[10px] font-medium text-foreground">Config</span>
                  </button>
                </div>

                {/* Settings groups */}
                {settingsGroups.map((group) => (
                  <div key={group.title}>
                    <div className="px-5 pt-4 pb-1.5">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{group.title}</p>
                    </div>
                    {group.items.filter((it: any) => !isPathHidden(it.path)).map((item) => (
                      <button
                        key={item.path}
                        onClick={() => { setMenuOpen(false); navigate(item.path); }}
                        className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-muted/50 active:bg-muted transition-colors"
                      >
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: item.color + '14' }}>
                          <item.icon className="h-4 w-4" style={{ color: item.color }} />
                        </div>
                        <span className="flex-1 text-sm font-medium text-foreground">{item.label}</span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
                      </button>
                    ))}
                  </div>
                ))}

                {/* Logout */}
                <div className="border-t border-border p-4 mt-2">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20 active:bg-destructive/25 transition-colors text-sm font-semibold"
                  >
                    <LogOut className="h-4 w-4" />
                    Sair da conta
                  </button>
                </div>
              </div>
            ) : (
              /* Notifications tab */
              <div className="flex flex-col">
                <div className="px-5 py-3 border-b border-border flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">Notificações</p>
                  {unreadCount > 0 && (
                    <button onClick={() => markAllAsRead()} className="text-xs text-primary font-medium flex items-center gap-1">
                      <CheckCheck className="h-3.5 w-3.5" />
                      Marcar todas como lidas
                    </button>
                  )}
                </div>

                {recentNotifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 px-4">
                    <Bell className="h-10 w-10 text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground">Nenhuma notificação</p>
                  </div>
                ) : (
                  recentNotifications.map((notif) => {
                    const Icon = CATEGORY_ICONS[notif.category] || AlertCircle;
                    const dotColor = CATEGORY_COLORS[notif.category] || '#6366f1';
                    return (
                      <button
                        key={notif.id}
                        onClick={() => handleNotificationClick(notif)}
                        className={`w-full flex items-start gap-3 p-4 text-left border-b border-border/50 active:bg-muted/50 transition-colors ${!notif.is_read ? 'bg-primary/5' : ''}`}
                      >
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                          style={{ backgroundColor: `${dotColor}15` }}
                        >
                          <Icon className="h-4 w-4" style={{ color: dotColor }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            {!notif.is_read && (
                              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
                            )}
                            <span className="font-medium text-sm text-foreground truncate">{notif.title}</span>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{notif.message}</p>
                          <div className="flex items-center justify-between mt-1.5">
                            <span className="text-[10px] text-muted-foreground/70">
                              {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: ptBR })}
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={(e) => { e.stopPropagation(); archiveNotification(notif.id); }}
                                className="p-1 rounded hover:bg-muted"
                              >
                                <Archive className="h-3.5 w-3.5 text-muted-foreground" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); deleteNotification(notif.id); }}
                                className="p-1 rounded hover:bg-destructive/10"
                              >
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}

                {recentNotifications.length > 0 && (
                  <button
                    onClick={() => { setMenuOpen(false); navigate('/dashboard/notificacoes'); }}
                    className="w-full py-3 text-center text-xs font-medium text-primary"
                  >
                    Ver todas as notificações
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default MobileAppHeader;
