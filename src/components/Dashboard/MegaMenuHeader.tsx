import { useState, useRef, useMemo, useEffect } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { 
  MessageSquare, Mail, Users, Bot, Calendar, CheckSquare, Video, Zap, Coins,
  FileText, Link2, PlayCircle, Eye, BarChart3, FolderOpen, Settings, Mic,
  Shield, HelpCircle, ChevronDown, User, LogOut, CreditCard, Bell, GitBranch,
  Briefcase, Key, Megaphone, Target, FileSignature, Workflow, Moon, Sun, CheckCheck, AlertCircle, CheckCircle, Trash2, Archive, X, Sparkles,
  LayoutGrid, ImageIcon, FlaskConical, CloudCog, Menu, Home, Search, Brain
} from "lucide-react";
import WhatsAppIcon from "@/components/icons/WhatsAppIcon";
import ellocontentLogo from "@/assets/ellocontent-logo.png";
import { supabase } from "@/integrations/supabase/client";
import ellocontentHero from "@/assets/ellocontent-hero.webp";
import ellosuitHero from "@/assets/ellosuit-hero.webp";
import { useTheme } from "@/hooks/useTheme";
import { ElloLogo } from "@/components/shared/ElloLogo";
import { EllosuitOmniLogo } from "@/components/shared/EllosuitOmniLogo";
import { useAuth } from "@/hooks/useAuth";
import { isPathHidden } from "@/config/featureFlags";
import { useHubColor } from "@/hooks/useHubColor";
import { useAdminMaster } from "@/hooks/useAdminMaster";
import { useNotifications } from "@/hooks/useNotifications";
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";

const COLORS = {
  // Unified brand accent — no more hub-specific colors in the global navigation
  brand: "#374DA4",
  config: "#64748B",
  meet: "#101010",
  // Aliases kept so any legacy reference still resolves to the brand color
  omni: "#374DA4",
  flow: "#374DA4",
  track: "#374DA4",
  suite: "#374DA4",
};

interface MenuItem {
  id: string;
  label: string;
  description: string;
  icon: any;
  path: string;
}

interface MenuGroup {
  id: string;
  label: string;
  color: string;
  hubPath: string;
  columns: {
    title: string;
    items: MenuItem[];
  }[];
}

// Flat, function-first navigation (no Omni / Flow / Track / Suite / Meet sub-brands).
// Hidden items still get filtered via `featureFlags.isPathHidden`.
const menuGroups: MenuGroup[] = [
  {
    id: "conversas",
    label: "Conversas",
    color: COLORS.brand,
    hubPath: "/dashboard/crm-ello",
    columns: [
      {
        title: "WhatsApp",
        items: [
          { id: "crm", label: "CRM WhatsApp", description: "Atendimento e vendas via WhatsApp", icon: WhatsAppIcon, path: "/dashboard/crm-ello" },
          { id: "disparos", label: "Disparos em Massa", description: "Envio em massa via WhatsApp", icon: Megaphone, path: "/dashboard/disparos" },
          { id: "chatbot", label: "ChatBot Builder", description: "Fluxos automatizados de WhatsApp", icon: GitBranch, path: "/dashboard/chatbot" },
          { id: "chatbot-ai", label: "Chatbot IA Creator", description: "Crie chatbots conversando com IA", icon: Bot, path: "/dashboard/criar-chatbot" },
        ],
      },
      {
        title: "IA e Email",
        items: [
          { id: "agentes", label: "Agentes de IA", description: "Atendentes virtuais inteligentes", icon: Bot, path: "/dashboard/bot-ia" },
          { id: "email", label: "Email Marketing", description: "Campanhas por email", icon: Mail, path: "/dashboard/email" },
          { id: "email-tracker", label: "Rastrear Emails", description: "Aberturas e cliques rastreados", icon: Eye, path: "/dashboard/email-tracker" },
        ],
      },
      {
        title: "Desenvolvedores",
        items: [
          { id: "api-whatsapp", label: "API WhatsApp", description: "Integração via API restrita", icon: Key, path: "/dashboard/api-whatsapp" },
        ],
      },
    ],
  },
  {
    id: "contatos",
    label: "Contatos",
    color: COLORS.brand,
    hubPath: "/dashboard/cadastros",
    columns: [
      {
        title: "Pessoas",
        items: [
          { id: "cadastros", label: "Cadastros", description: "Clientes, leads e contatos", icon: Users, path: "/dashboard/cadastros" },
        ],
      },
      {
        title: "Arquivos",
        items: [
          { id: "drive", label: "Drive", description: "Documentos e mídias da empresa", icon: FolderOpen, path: "/dashboard/drive" },
        ],
      },
    ],
  },
  {
    id: "agenda",
    label: "Agenda",
    color: COLORS.brand,
    hubPath: "/dashboard/agenda",
    columns: [
      {
        title: "Compromissos",
        items: [
          { id: "agenda", label: "Minha Agenda", description: "Compromissos e eventos", icon: Calendar, path: "/dashboard/agenda" },
          { id: "agenda-online", label: "Agenda Online", description: "Links públicos de agendamento", icon: Calendar, path: "/dashboard/agenda-aberta" },
        ],
      },
      {
        title: "Produtividade",
        items: [
          { id: "tasks", label: "Tarefas", description: "Listas e lembretes", icon: CheckSquare, path: "/dashboard/tasks" },
          { id: "fluxos", label: "Fluxos (Kanban)", description: "Quadros e cartões", icon: Zap, path: "/dashboard/fluxos" },
        ],
      },
    ],
  },
  {
    id: "reunioes",
    label: "Reuniões",
    color: COLORS.brand,
    hubPath: "/dashboard/reunioes",
    columns: [
      {
        title: "Videochamadas",
        items: [
          { id: "reunioes", label: "Iniciar Reunião", description: "Salas de reunião online", icon: Video, path: "/dashboard/reunioes" },
          { id: "gravacoes", label: "Reuniões Recentes", description: "Histórico e transcrições", icon: Video, path: "/dashboard/reunioes/gravacoes" },
          { id: "gravacao-nova", label: "Gravar Presencial", description: "Gravar e transcrever in loco", icon: Mic, path: "/dashboard/reunioes?action=record" },
        ],
      },
    ],
  },
  {
    id: "conteudo",
    label: "Conteúdo & Dados",
    color: COLORS.brand,
    hubPath: "/dashboard/analytics",
    columns: [
      {
        title: "Links e Recibos",
        items: [
          { id: "encurtador", label: "Encurtador de Links", description: "Encurte URLs e acompanhe cliques", icon: Link2, path: "/dashboard/encurtador" },
          { id: "recibos", label: "Recibos", description: "Recibos de pagamento", icon: FileText, path: "/dashboard/recibos" },
          { id: "apps", label: "Templates Prontos", description: "Automações prontas para ativar", icon: LayoutGrid, path: "/dashboard/apps" },
        ],
      },
      {
        title: "Análises",
        items: [
          { id: "analytics", label: "Analytics", description: "Métricas gerais", icon: BarChart3, path: "/dashboard/analytics" },
          { id: "vision", label: "Ello Vision", description: "Insights avançados", icon: BarChart3, path: "/dashboard/ello-vision" },
          { id: "relatorios", label: "Relatórios", description: "Exportar dados", icon: FileText, path: "/dashboard/relatorios" },
        ],
      },
    ],
  },
];

const testMenuGroup: MenuGroup = {
  id: "test",
  label: "Test",
  color: "#9333ea",
  hubPath: "/dashboard",
  columns: [
    {
      title: "Laboratório",
      items: []
    }
  ]
};

const configMenu: MenuGroup = {
  id: "config",
  label: "Configurações",
  color: COLORS.config,
  hubPath: "/dashboard/configuracoes",
  columns: [
    {
      title: "Sistema",
      items: [
        { id: "prefs", label: "Preferências", description: "Configurações gerais", icon: Settings, path: "/dashboard/configuracoes" },
        { id: "security", label: "Segurança", description: "Senha e acesso", icon: Shield, path: "/dashboard/seguranca" },
        
      ]
    },
      {
        title: "Conta",
        items: [
          { id: "profile", label: "Meu Perfil", description: "Dados pessoais", icon: User, path: "/dashboard/perfil" },
          { id: "subscription", label: "Minha Assinatura", description: "Plano e pagamentos", icon: CreditCard, path: "/dashboard/minhassinatura" },
        ]
      },
    {
      title: "Ajuda",
      items: [
        { id: "support", label: "Suporte", description: "Ajuda e tutoriais", icon: HelpCircle, path: "/dashboard/suporte" },
        { id: "report", label: "Reportar Problema", description: "Enviar feedback", icon: AlertCircle, path: "/dashboard/reportar-problema" },
      ]
    }
  ]
};

export function MegaMenuHeader() {
  const [customLogos, setCustomLogos] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MenuItem[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
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
      .channel('hub_logos_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hub_logos' }, loadLogos)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const renderHubLogo = (hubKey: string) => {
    if (customLogos[hubKey]) {
      return (
        <div 
          className="h-7 w-auto flex items-center [&_svg]:h-7 [&_svg]:w-auto [&_svg]:max-w-none"
          dangerouslySetInnerHTML={{ __html: customLogos[hubKey] }} 
        />
      );
    }

    const isDark = theme === 'dark' || isThemeDark;
    const logoColor = isDark 
      ? (isDashboardHome ? "#374DA4" : hubColor) 
      : "white";

    // Fallback components/images if SVG not uploaded
    switch(hubKey) {
      case 'home': return <ElloLogo className="h-8 w-auto" color={logoColor} />;
      case 'omni': return <span className="text-white font-bold">Omni</span>;
      case 'flow': return <span className="text-white font-bold">Flow</span>;
      case 'meet': return <span className="text-white font-bold">Meet</span>;
      case 'track': return <span className="text-white font-bold">Track</span>;
      case 'suite': return <span className="text-white font-bold">Suite</span>;
      default: return <ElloLogo className="h-8 w-auto" color={logoColor} />;
    }
  };

  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [showEarlyAccessModal, setShowEarlyAccessModal] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [actionsPinned, setActionsPinned] = useState(false);
  const actionsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { color: hubColor, hub, isDark: isThemeDark } = useHubColor();
  const { isAdminMaster, loading: adminLoading } = useAdminMaster();
  const { theme, toggleTheme } = useTheme();
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification, archiveNotification } = useNotifications();
  const isMeetHubRoute = location.pathname === '/dashboard/meet-hub'
    || location.pathname.startsWith('/dashboard/meet')
    || location.pathname.startsWith('/dashboard/reunioes');
  const isOmniHubRoute = location.pathname.startsWith('/dashboard/omni');
  const isDashboardHome = location.pathname === '/dashboard' || location.pathname === '/dashboard/';
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

  const handleMouseEnter = (menuId: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setActiveMenu(menuId);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setActiveMenu(null);
    }, 150);
  };

  const handleMenuClick = (hubPath: string) => {
    navigate(hubPath);
    setActiveMenu(null);
  };

  const isActive = (path: string) => {
    if (path.includes('?')) {
      return location.pathname === path.split('?')[0];
    }
    return location.pathname.startsWith(path);
  };

  const getActiveGroup = () => {
    let bestMatch: { groupId: string; pathLen: number } | null = null;
    for (const group of menuGroups) {
      for (const col of group.columns) {
        for (const item of col.items) {
          const itemPath = item.path.includes('?') ? item.path.split('?')[0] : item.path;
          if (location.pathname.startsWith(itemPath) && (!bestMatch || itemPath.length > bestMatch.pathLen)) {
            bestMatch = { groupId: group.id, pathLen: itemPath.length };
          }
        }
      }
    }
    return bestMatch?.groupId || null;
  };

  const visibleMenuGroups = useMemo(() => {
    return menuGroups;
  }, [isAdminMaster]);

  const activeGroupId = (() => {
    let bestMatch: { groupId: string; pathLen: number } | null = null;
    for (const group of visibleMenuGroups) {
      for (const col of group.columns) {
        for (const item of col.items) {
          const itemPath = item.path.includes('?') ? item.path.split('?')[0] : item.path;
          if (location.pathname.startsWith(itemPath) && (!bestMatch || itemPath.length > bestMatch.pathLen)) {
            bestMatch = { groupId: group.id, pathLen: itemPath.length };
          }
        }
      }
    }
    return bestMatch?.groupId || null;
  })();
  const userInitials = user?.email?.slice(0, 2).toUpperCase() || "US";

  useEffect(() => {
    if (searchQuery.trim().length === 0) {
      setSearchResults([]);
      return;
    }

    const query = searchQuery.toLowerCase();
    const results: MenuItem[] = [];
    
    [...menuGroups, configMenu].forEach(group => {
      group.columns.forEach(column => {
        column.items.filter(it => !isPathHidden(it.path)).forEach(item => {
          if (item.label.toLowerCase().includes(query) || item.description.toLowerCase().includes(query)) {
            results.push(item);
          }
        });
      });
    });

    setSearchResults(results.slice(0, 8));
  }, [searchQuery]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setSearchQuery("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Atalho de teclado ⌘K / Ctrl+K abre a pesquisa
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Todos os itens pesquisáveis (menus + configurações)
  const searchableItems = useMemo(() => {
    const items: { group: string; item: MenuItem }[] = [];
    [...menuGroups, configMenu].forEach((g) => {
      g.columns.forEach((col) => {
        col.items.filter(it => !isPathHidden(it.path)).forEach((it) => items.push({ group: g.label, item: it }));
      });
    });
    return items;
  }, []);

  return (
    <>
    <header
      className="sticky top-0 z-[100]"

      data-mega-header
      data-menu-open={activeMenu !== null}
      style={{
        backgroundColor: (theme === 'dark' || isThemeDark)
          ? 'hsl(0, 0%, 8%)'
          : COLORS.brand,
        transition: 'background-color 0.5s ease-in-out',
      }}
    >
      {(theme === 'dark' || isThemeDark) && (
        <div 
          className="absolute top-0 left-0 right-0 h-[2px] z-10"
          style={{ backgroundColor: COLORS.brand }}
        />
      )}
      <div className="h-16 px-6 flex items-center relative">
        <div className="flex items-center flex-1 min-w-0 h-full">
          <div className="shrink-0 pr-4 border-r border-white/10 mr-4 h-8 flex items-center">
               <Link to="/dashboard" className="p-2 -ml-2 rounded-lg hover:bg-white/10 transition-colors">
                  <ElloLogo 
                    className="h-8 w-auto" 
                    color={(theme === 'dark' || isThemeDark) ? COLORS.brand : "white"} 
                  />
               </Link>
          </div>

          <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar h-full">
            {visibleMenuGroups.map((group) => {
              const isOpen = activeMenu === group.id;
              const isCurrentHub = activeGroupId === group.id;
              return (
                <div
                  key={group.id}
                  className="relative flex items-center h-full"
                  onMouseEnter={() => handleMouseEnter(group.id)}
                  onMouseLeave={handleMouseLeave}
                >
                  <button
                    onClick={() => handleMenuClick(group.hubPath)}
                    className="px-4 flex items-center gap-1 text-sm font-medium transition-colors duration-200 h-8 rounded-full"
                    style={{
                      backgroundColor: isOpen || isCurrentHub ? 'rgba(255,255,255,0.15)' : 'transparent',
                      color: isOpen || isCurrentHub ? 'white' : 'rgba(255,255,255,0.75)',
                    }}
                  >
                    <span>{group.label}</span>
                    <ChevronDown className={`h-3 w-3 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                </div>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3 shrink-0 ml-4 h-full">
          <div ref={searchRef} className="relative hidden md:block">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              title="Abrir menu de ferramentas"
              aria-label="Abrir menu de ferramentas"
              className="p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            >
              <LayoutGrid className="h-5 w-5" />
            </button>
          </div>

          {/* Profile/Actions Area */}
          <div className="flex items-center gap-2">
            {/* Desktop: Theme, Notifications, Profile */}
            <div className="hidden md:flex items-center gap-2">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white"
                title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
              >
                {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>

              <div className="relative">
                <button 
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white relative"
                  onMouseEnter={() => {
                    if (timeoutRef.current) clearTimeout(timeoutRef.current);
                    setActiveMenu('notifications');
                  }}
                  onMouseLeave={handleMouseLeave}
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 h-4 min-w-4 px-0.5 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center font-medium">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>
                {activeMenu === 'notifications' && (
                  <div
                    className="absolute right-0 bg-popover shadow-xl overflow-hidden z-50 mt-2"
                    style={{
                      borderRadius: '16px 0 16px 16px',
                      width: '380px',
                      animation: 'megamenu-slide-down 0.25s ease-out forwards',
                    }}
                    onMouseEnter={() => {
                      if (timeoutRef.current) clearTimeout(timeoutRef.current);
                    }}
                    onMouseLeave={handleMouseLeave}
                  >
                    <div className="px-4 py-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-foreground">Notificações</h4>
                        {unreadCount > 0 && (
                          <button onClick={() => markAllAsRead()} className="text-muted-foreground hover:text-foreground">
                            <CheckCheck className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="max-h-72 overflow-y-auto space-y-1">
                        {notifications.slice(0, 10).length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-8">
                            <Bell className="h-8 w-8 text-muted-foreground/30 mb-2" />
                            <p className="text-sm text-muted-foreground">Nenhuma notificação</p>
                          </div>
                        ) : (
                          notifications.slice(0, 10).map((notif) => (
                            <button
                              key={notif.id}
                              onClick={() => {
                                if (!notif.is_read) markAsRead(notif.id);
                                if (notif.action_url) { navigate(notif.action_url); setActiveMenu(null); }
                              }}
                              className={`w-full flex items-start gap-3 p-3 rounded-lg cursor-pointer hover:bg-muted group text-left ${!notif.is_read ? 'bg-primary/5' : ''}`}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  {!notif.is_read && <div className="w-1.5 h-1.5 rounded-full shrink-0 bg-primary" />}
                                  <span className="font-medium text-sm text-foreground">{notif.title}</span>
                                </div>
                                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{notif.message}</p>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <button 
                className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white"
                onMouseEnter={() => {
                  if (timeoutRef.current) clearTimeout(timeoutRef.current);
                  setActiveMenu('config');
                }}
                onMouseLeave={handleMouseLeave}
                onClick={(event) => {
                  event.preventDefault();
                  if (timeoutRef.current) clearTimeout(timeoutRef.current);
                  setActiveMenu((current) => current === 'config' ? null : 'config');
                }}
              >
                <User className="h-5 w-5" />
              </button>
            </div>

            {/* Mobile: Hamburger */}
            <div className="md:hidden flex items-center gap-1">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white"
                title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
              >
                {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>
              {isDashboardHome && (
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('open-knowledge-hub'))}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white"
                  title="Knowledge Hub"
                  aria-label="Abrir Knowledge Hub"
                >
                  <HelpCircle className="h-5 w-5" />
                </button>
              )}
              <button 
                className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white"
                onClick={() => setActionsOpen(!actionsOpen)}
              >
                {actionsOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Início Mega Menu */}
      {activeMenu === 'inicio' && (
        <div 
          className="absolute left-0 right-0 bg-popover shadow-xl overflow-hidden"
          style={{
            borderRadius: '0 0 16px 16px',
            top: '100%',
            animation: 'megamenu-slide-down 0.25s ease-out forwards',
          }}
          onMouseEnter={() => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }}
          onMouseLeave={handleMouseLeave}
        >
          <div className="max-w-3xl mx-auto px-6 py-6">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 animate-fade-in">Nosso Ecossistema</h4>
            <div className="grid grid-cols-2 gap-4">
              {/* Ellosuit */}
               <button
                 onClick={() => { 
                   navigate(isMeetHubRoute ? '/dashboard/meet-hub' : '/dashboard'); 
                   setActiveMenu(null); 
                 }}
                 className="group relative rounded-2xl overflow-hidden h-32 transition-transform hover:scale-[1.02]"
                style={{ 
                  animation: 'scale-in 0.35s cubic-bezier(0.16,1,0.3,1) 0.05s both',
                  opacity: 0 
                }}
              >
                <img src={ellosuitHero} alt="Ellosuit" className="absolute inset-0 w-full h-full object-cover" />
              </button>
              {/* Ellocontent */}
              <a
                href="https://www.ellocontent.com"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setActiveMenu(null)}
                className="group relative rounded-2xl overflow-hidden h-32 transition-transform hover:scale-[1.02]"
                style={{ 
                  animation: 'scale-in 0.35s cubic-bezier(0.16,1,0.3,1) 0.15s both',
                  opacity: 0 
                }}
              >
                <img src={ellocontentHero} alt="Ellocontent" className="absolute inset-0 w-full h-full object-cover" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Mega Menu Dropdown */}
      {activeMenu && activeMenu !== 'notifications' && activeMenu !== 'inicio' && (() => {
        const resolvedConfigMenu = {
          ...configMenu,
          columns: !adminLoading && isAdminMaster
            ? [
                ...configMenu.columns,
                {
                  title: 'Administração',
                  items: [
                    { id: 'admin', label: 'Admin Master', description: 'Painel administrativo', icon: Shield, path: '/dashboard/admin' },
                  ],
                },
              ]
            : configMenu.columns,
        };
        const isConfig = activeMenu === 'config';
        const currentGroup = isConfig ? resolvedConfigMenu : visibleMenuGroups.find(g => g.id === activeMenu);
        if (!currentGroup) return null;

        const colCount = currentGroup.columns.length;
        // Wider columns but capped so Suite (4 cols) still fits on the screen
        const perCol = 240;
        const menuWidth = isConfig ? 760 : Math.max(300, colCount * perCol);

        // Regular megamenus align to the left (logo edge ~ 96px)
        // Profile/config menu aligns to the right
        const leftPos = isConfig ? 'auto' : '96px';
        const rightPos = isConfig ? '24px' : 'auto';

        return (
          <div
            className="absolute bg-popover/95 backdrop-blur-md shadow-2xl border border-border/60 overflow-hidden"
            style={{
              borderRadius: '14px',
              top: 'calc(100% + 6px)',
              left: leftPos,
              right: rightPos,
              width: `${menuWidth}px`,
              maxWidth: isConfig ? 'calc(100vw - 48px)' : 'calc(100vw - 120px)',
              animation: 'megamenu-slide-down 0.25s ease-out forwards',
            }}
            onMouseEnter={() => {
              if (timeoutRef.current) clearTimeout(timeoutRef.current);
            }}
            onMouseLeave={handleMouseLeave}
          >
            <div className="px-3 py-3">
              {isConfig && (
                <div className="px-3 py-3 mb-2 border-b border-border/40 flex items-center gap-3">
                  <Avatar className="h-10 w-10 border-2 border-primary/20">
                    <AvatarImage src={user?.user_metadata?.avatar_url} />
                    <AvatarFallback className="bg-primary/10 text-primary font-bold">{userInitials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{user?.email}</p>
                    <p className="text-[11px] text-muted-foreground">Sua conta pessoal</p>
                  </div>
                </div>
              )}

              <div className={isConfig ? "grid grid-cols-2 gap-x-5 gap-y-4" : "flex gap-3 flex-1"}>
                {currentGroup.columns.map((column, idx) => (
                  <div key={idx} className="flex-1 min-w-0">
                    <h4 className="text-[11px] font-medium text-muted-foreground/70 mb-2 px-2">
                      {column.title}
                    </h4>
                    <div className="flex flex-col gap-0.5">
                       {column.items.filter(it => !isPathHidden(it.path)).map((item) => {
                        const Icon = item.icon;
                        const active = isActive(item.path);
                        const itemPath = isMeetHubRoute ? '/dashboard/meet-hub' : item.path;

                        return (
                          <Link
                            key={item.id}
                            to={itemPath}
                            onClick={() => setActiveMenu(null)}
                            className="group relative flex items-center gap-3 px-2 py-2 rounded-lg transition-colors hover:bg-muted/60"
                          >
                            <div
                              className="shrink-0 h-9 w-9 rounded-lg flex items-center justify-center bg-muted/70 border border-border/40 group-hover:bg-background transition-colors"
                              style={{
                                color: (theme === 'dark' || isThemeDark) && currentGroup.id === 'meet'
                                  ? 'white'
                                  : currentGroup.color,
                              }}
                            >
                              <Icon className="h-[18px] w-[18px]" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <span
                                className="text-[13px] font-semibold block text-foreground truncate leading-tight"
                                style={{ color: active ? currentGroup.color : undefined }}
                              >
                                {item.label}
                              </span>
                              <span className="text-[11px] text-muted-foreground block truncate leading-tight mt-0.5">
                                {item.description}
                              </span>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {isConfig && (
                <div className="mt-2 pt-2 border-t border-border/40 flex flex-col gap-0.5">
                  <button 
                    onClick={() => {
                      toggleTheme();
                      setActiveMenu(null);
                    }} 
                    className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-muted/60 text-left w-full group"
                  >
                    <div className="shrink-0 h-8 w-8 rounded-lg flex items-center justify-center bg-muted/70 border border-border/40 group-hover:bg-background">
                      {theme === 'dark' ? <Sun className="h-4 w-4 text-yellow-500" /> : <Moon className="h-4 w-4 text-slate-700" />}
                    </div>
                    <span className="text-[13px] font-semibold text-foreground">
                      {theme === 'dark' ? 'Mudar para Modo Claro' : 'Mudar para Modo Escuro'}
                    </span>
                  </button>
                  
                  <button 
                    onClick={() => {
                      signOut();
                      setActiveMenu(null);
                    }} 
                    className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-red-500/10 text-left w-full group"
                  >
                    <div className="shrink-0 h-8 w-8 rounded-lg flex items-center justify-center bg-red-500/10 border border-red-500/20 group-hover:bg-red-500/20">
                      <LogOut className="h-4 w-4 text-red-600" />
                    </div>
                    <span className="text-[13px] font-semibold text-red-600">Sair da conta</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </header>
    <CommandDialog 
      open={searchOpen} 
      onOpenChange={setSearchOpen}
      className="max-w-[800px] h-[600px] max-h-[85vh]"
    >
      <CommandInput placeholder="Pesquisar páginas, ferramentas, configurações..." />
      <CommandList className="max-h-[500px] scrollbar-thin">
        <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
        {[...menuGroups, configMenu].map((group) => {
          const items = group.columns.flatMap((col) => col.items).filter((it) => !isPathHidden(it.path));
          if (items.length === 0) return null;
          
          return (
            <CommandGroup 
              key={group.id} 
              heading={group.label}
              className="px-2"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-1 py-1">
                {items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <CommandItem
                      key={`${group.id}-${item.id}`}
                      value={`${group.label} ${item.label} ${item.description}`}
                      onSelect={() => {
                        setSearchOpen(false);
                        navigate(item.path);
                      }}
                      className="flex items-start gap-3 p-3 rounded-xl cursor-pointer"
                    >
                      <div 
                        className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${group.color}15`, color: group.color }}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="font-bold text-sm text-foreground truncate">{item.label}</span>
                        <span className="text-[11px] text-muted-foreground line-clamp-1">{item.description}</span>
                      </div>
                    </CommandItem>
                  );
                })}
              </div>
            </CommandGroup>
          );
        })}
      </CommandList>
    </CommandDialog>
    </>
  );
}