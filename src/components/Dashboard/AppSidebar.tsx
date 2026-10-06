import { useEffect, useMemo, useState, ElementType } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  MessageSquare, Mail, Users, Bot, Calendar, CheckSquare, Video, Zap,
  FileText, Link2, Eye, BarChart3, FolderOpen, Settings, Mic,
  Shield, HelpCircle, ChevronDown, User, LogOut, CreditCard, Bell, GitBranch,
  Key, Megaphone, Moon, Sun, LayoutGrid, Search, Brain,
  PanelLeftClose, PanelLeft, Plus, Sparkles, TrendingUp, Filter,
  LayoutDashboard, Workflow, Webhook,
} from "lucide-react";
import WhatsAppIcon from "@/components/icons/WhatsAppIcon";
import { ElloLogo } from "@/components/shared/ElloLogo";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useNotifications } from "@/hooks/useNotifications";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { isPathHidden } from "@/config/featureFlags";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const BRAND = "#374DA4";
const STORAGE_KEY = "ello-sidebar-collapsed";

interface NavItem { label: string; path: string; icon: ElementType }
interface NavGroup { id: string; label: string; icon: ElementType; hubPath: string; items: NavItem[] }

const navGroups: NavGroup[] = [
  {
    id: "conversas", label: "Conversas", icon: MessageSquare, hubPath: "/dashboard/crm-ello",
    items: [
      { label: "CRM WhatsApp", path: "/dashboard/crm-ello", icon: WhatsAppIcon },
      // Oculto por feature flag (`/dashboard/email-tracker` em HIDDEN_PATHS).
      { label: "Rastrear Emails", path: "/dashboard/email-tracker", icon: Eye },
    ],
  },
  {
    id: "disparos", label: "Disparos", icon: Megaphone, hubPath: "/dashboard/disparos",
    items: [
      { label: "Disparos em Massa", path: "/dashboard/disparos", icon: Megaphone },
      { label: "Email Marketing", path: "/dashboard/email", icon: Mail },
    ],
  },
  {
    id: "construtores", label: "Construtores", icon: Brain, hubPath: "/dashboard/chatbot",
    items: [
      { label: "Chatbot IA Creator", path: "/dashboard/criar-chatbot", icon: Bot },
      { label: "ChatBot Builder", path: "/dashboard/chatbot", icon: GitBranch },
      { label: "Agentes de IA", path: "/dashboard/bot-ia", icon: Bot },
    ],
  },
  {
    id: "desenvolvedores", label: "Desenvolvedores", icon: Webhook, hubPath: "/dashboard/api-whatsapp",
    items: [
      { label: "API WhatsApp", path: "/dashboard/api-whatsapp", icon: Key },
    ],
  },
  {
    id: "contatos", label: "Contatos", icon: Users, hubPath: "/dashboard/cadastros",
    items: [
      { label: "Cadastros", path: "/dashboard/cadastros", icon: Users },
      { label: "Drive", path: "/dashboard/drive", icon: FolderOpen },
    ],
  },
  {
    id: "agenda", label: "Agenda", icon: Calendar, hubPath: "/dashboard/agenda",
    items: [
      { label: "Minha Agenda", path: "/dashboard/agenda", icon: Calendar },
      { label: "Agenda Online", path: "/dashboard/agenda-aberta", icon: Calendar },
      { label: "Tarefas", path: "/dashboard/tasks", icon: CheckSquare },
      { label: "Fluxos (Kanban)", path: "/dashboard/fluxos", icon: Zap },
    ],
  },
  {
    id: "vendas", label: "Vendas", icon: TrendingUp, hubPath: "/dashboard/vendas/funil",
    items: [
      { label: "Funil", path: "/dashboard/vendas/funil", icon: Filter },
      { label: "KPIs", path: "/dashboard/vendas/kpis", icon: LayoutDashboard },
      { label: "Pipelines", path: "/dashboard/vendas/pipelines", icon: GitBranch },
      { label: "Automações", path: "/dashboard/vendas/automacoes", icon: Workflow },
      { label: "Integrações", path: "/dashboard/vendas/integracoes", icon: Webhook },
    ],
  },
  {
    id: "reunioes", label: "Reuniões", icon: Video, hubPath: "/dashboard/reunioes",
    items: [
      { label: "Iniciar Reunião", path: "/dashboard/reunioes", icon: Video },
      { label: "Reuniões Recentes", path: "/dashboard/reunioes/gravacoes", icon: Video },
      { label: "Gravar Presencial", path: "/dashboard/reunioes?action=record", icon: Mic },
    ],
  },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { notifications, unreadCount, markAllAsRead } = useNotifications();
  const isDark = theme === "dark";

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(STORAGE_KEY) === "1";
  });
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  // Auto-collapse sidebar when navigating to a new page
  useEffect(() => {
    setCollapsed(true);
  }, [location.pathname]);

  const groups = useMemo(
    () => navGroups
      .map((g) => ({ ...g, items: g.items.filter((i) => !isPathHidden(i.path)) }))
      .filter((g) => g.items.length > 0),
    [],
  );

  const activeGroupId = useMemo(() => {
    let best: { id: string; len: number } | null = null;
    for (const g of groups) {
      for (const it of g.items) {
        const p = it.path.split("?")[0];
        if (location.pathname.startsWith(p) && (!best || p.length > best.len)) {
          best = { id: g.id, len: p.length };
        }
      }
    }
    return best?.id ?? null;
  }, [location.pathname, groups]);

  useEffect(() => { setOpenGroup(activeGroupId); }, [activeGroupId]);

  const isHome = location.pathname === "/dashboard" || location.pathname === "/dashboard/";
  const isItemActive = (path: string) => location.pathname.startsWith(path.split("?")[0]);
  const initials = user?.email?.slice(0, 2).toUpperCase() || "US";

  const surface = isDark ? "#161616" : "#f3f2ee";
  const borderColor = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)";
  const textMuted = isDark ? "text-white/55" : "text-[#6b675e]";
  const textStrong = isDark ? "text-white/90" : "text-[#2b2b28]";
  const hoverBg = isDark ? "hover:bg-white/[0.06]" : "hover:bg-black/[0.045]";
  const activeBg = isDark ? "bg-white/[0.10]" : "bg-black/[0.07]";

  const IconBtn = ({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          aria-label={label}
          className={`relative h-9 w-9 rounded-xl flex items-center justify-center transition-colors ${hoverBg} ${textMuted}`}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );

  return (
    <TooltipProvider delayDuration={200}>
      <aside
        data-app-sidebar
        className="hidden md:flex shrink-0 flex-col h-full transition-[width] duration-300 ease-out"
        style={{
          width: collapsed ? 64 : 256,
          backgroundColor: surface,
          borderRight: `1px solid ${borderColor}`,
        }}
      >
        {/* Brand + collapse */}
        <div className={`flex items-center h-14 shrink-0 ${collapsed ? "justify-center px-2" : "justify-between px-3"}`}>
          {!collapsed && (
            <Link to="/dashboard" className="flex items-center gap-2 pl-1">
              <ElloLogo className="h-7 w-auto" color={isDark ? "#ffffff" : BRAND} />
            </Link>
          )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            className={`h-9 w-9 rounded-xl flex items-center justify-center transition-colors ${hoverBg} ${textMuted}`}
          >
            {collapsed ? <PanelLeft className="h-[18px] w-[18px]" /> : <PanelLeftClose className="h-[18px] w-[18px]" />}
          </button>
        </div>

        {/* Primary actions */}
        <div className={`shrink-0 ${collapsed ? "px-2" : "px-3"} pb-2 space-y-1`}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => navigate("/dashboard")}
                className={`w-full flex items-center gap-2.5 rounded-xl text-[13.5px] font-medium transition-colors ${collapsed ? "justify-center h-9" : "px-2.5 h-9"} ${isHome ? activeBg : hoverBg} ${textStrong}`}
              >
                <Plus className="h-[18px] w-[18px] shrink-0" style={{ color: BRAND }} />
                {!collapsed && <span>Nova conversa</span>}
              </button>
            </TooltipTrigger>
            {collapsed && <TooltipContent side="right">Nova conversa</TooltipContent>}
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => window.dispatchEvent(new Event("open-global-search"))}
                className={`w-full flex items-center gap-2.5 rounded-xl text-[13.5px] transition-colors ${collapsed ? "justify-center h-9" : "px-2.5 h-9"} ${hoverBg} ${textMuted}`}
              >
                <Search className="h-[18px] w-[18px] shrink-0" />
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left">Buscar</span>
                    <kbd className={`text-[10px] px-1.5 py-0.5 rounded-md ${isDark ? "bg-white/10" : "bg-black/[0.06]"}`}>⌘K</kbd>
                  </>
                )}
              </button>
            </TooltipTrigger>
            {collapsed && <TooltipContent side="right">Buscar</TooltipContent>}
          </Tooltip>
        </div>

        {/* Nav */}
        <nav className={`flex-1 min-h-0 overflow-y-auto no-scrollbar ${collapsed ? "px-2" : "px-3"} pb-3 space-y-0.5`}>
          {!collapsed && (
            <p className={`px-2.5 pt-3 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] ${isDark ? "text-white/30" : "text-[#a3a096]"}`}>
              Workspace
            </p>
          )}

          {groups.map((group) => {
            const isOpen = !collapsed && openGroup === group.id;
            const isActiveGroup = activeGroupId === group.id;
            return (
              <div key={group.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => (collapsed ? navigate(group.hubPath) : setOpenGroup(isOpen ? null : group.id))}
                      className={`w-full flex items-center gap-2.5 rounded-xl text-[13.5px] font-medium transition-colors ${collapsed ? "justify-center h-9" : "px-2.5 h-9"} ${isActiveGroup && (collapsed || !isOpen) ? activeBg : hoverBg} ${isActiveGroup ? textStrong : textMuted}`}
                    >
                      <group.icon className="h-[18px] w-[18px] shrink-0" />
                      {!collapsed && (
                        <>
                          <span className="flex-1 text-left truncate">{group.label}</span>
                          <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                        </>
                      )}
                    </button>
                  </TooltipTrigger>
                  {collapsed && <TooltipContent side="right">{group.label}</TooltipContent>}
                </Tooltip>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="mt-0.5 mb-1 ml-[19px] pl-3 space-y-0.5" style={{ borderLeft: `1px solid ${borderColor}` }}>
                        {group.items.map((item) => {
                          const active = isItemActive(item.path);
                          return (
                            <Link
                              key={item.path}
                              to={item.path}
                              className={`flex items-center gap-2 rounded-lg px-2.5 h-8 text-[13px] transition-colors ${active ? `${activeBg} ${textStrong} font-medium` : `${hoverBg} ${textMuted}`}`}
                            >
                              <item.icon className="h-[15px] w-[15px] shrink-0 opacity-70" />
                              <span className="truncate">{item.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className={`shrink-0 ${collapsed ? "px-2" : "px-3"} py-2.5`} style={{ borderTop: `1px solid ${borderColor}` }}>
          <div className={`flex items-center ${collapsed ? "flex-col gap-1" : "gap-1 justify-between"}`}>
            <IconBtn label={isDark ? "Modo claro" : "Modo escuro"} onClick={toggleTheme}>
              {isDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
            </IconBtn>

            <Popover>
              <PopoverTrigger asChild>
                <button
                  aria-label="Notificações"
                  className={`relative h-9 w-9 rounded-xl flex items-center justify-center transition-colors ${hoverBg} ${textMuted}`}
                >
                  <Bell className="h-[18px] w-[18px]" />
                  {unreadCount > 0 && (
                    <span
                      className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full text-[9px] font-bold text-white flex items-center justify-center"
                      style={{ backgroundColor: "#ef4444" }}
                    >
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent side="right" align="end" className="w-80 p-0">
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
                  <span className="text-sm font-medium">Notificações</span>
                  {unreadCount > 0 && (
                    <button onClick={() => markAllAsRead()} className="text-[11px] text-muted-foreground hover:text-foreground">
                      Marcar todas como lidas
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-8">Nenhuma notificação</p>
                  ) : (
                    notifications.slice(0, 12).map((n) => (
                      <div key={n.id} className={`px-3 py-2.5 border-b border-border/50 ${!n.is_read ? "bg-muted/40" : ""}`}>
                        <p className="text-[13px] font-medium truncate">{n.title}</p>
                        {n.message && <p className="text-[11px] text-muted-foreground line-clamp-2">{n.message}</p>}
                      </div>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>

            <IconBtn label="Aplicativos" onClick={() => navigate("/dashboard/apps")}>
              <LayoutGrid className="h-[18px] w-[18px]" />
            </IconBtn>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={`h-9 w-9 rounded-xl flex items-center justify-center transition-colors ${hoverBg}`} aria-label="Minha conta">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={(user?.user_metadata as { avatar_url?: string })?.avatar_url} />
                    <AvatarFallback className="text-[10px] font-semibold text-white" style={{ backgroundColor: BRAND }}>
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="text-xs font-medium truncate">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/dashboard/perfil")}>
                  <User className="h-4 w-4 mr-2" /> Meu Perfil
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/dashboard/minhassinatura")}>
                  <CreditCard className="h-4 w-4 mr-2" /> Minha Assinatura
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/dashboard/configuracoes")}>
                  <Settings className="h-4 w-4 mr-2" /> Preferências
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/dashboard/seguranca")}>
                  <Shield className="h-4 w-4 mr-2" /> Segurança
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/dashboard/suporte")}>
                  <HelpCircle className="h-4 w-4 mr-2" /> Suporte
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut()} className="text-destructive focus:text-destructive">
                  <LogOut className="h-4 w-4 mr-2" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}

export default AppSidebar;