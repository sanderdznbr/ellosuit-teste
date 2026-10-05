import { useState, useRef } from "react";
import { isPathHidden } from "@/config/featureFlags";
import { Link, useLocation } from "react-router-dom";
import { 
  Calendar, 
  Mail, 
  Home, 
  Users, 
  FileText, 
  Settings, 
  LogOut,
  Video,
  CheckSquare,
  MessageSquare,
  Bot,
  Zap,
  BarChart3,
  Menu,
  Shield,
  HelpCircle,
  Layers,
  Radio,
  ChevronRight,
  Database
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { ElloLogo } from "@/components/shared/ElloLogo";

const menuGroups = [
  {
    id: 'sistema',
    label: 'Sistema',
    icon: Home,
    items: [
      { id: 'home', path: '/dashboard', icon: Home, label: 'Dashboard' },
      { id: 'bot-ia', path: '/dashboard/bot-ia', icon: Bot, label: 'Agentes Ello IA' },
      { id: 'documents', path: '/dashboard/drive', icon: FileText, label: 'Arquivos' }
    ]
  },
  {
    id: 'banco-dados',
    label: 'Banco de Dados',
    icon: Database,
    items: [
      { id: 'users', path: '/dashboard/funcionarios', icon: Users, label: 'Usuários' },
      { id: 'clients', path: '/dashboard/clientes', icon: Users, label: 'Clientes' },
      { id: 'suppliers', path: '/dashboard/fornecedores', icon: Users, label: 'Fornecedores' },
      { id: 'prospects', path: '/dashboard/prospectos', icon: Users, label: 'Prospectos' }
    ]
  },
  {
    id: 'ello-flows',
    label: 'Ello Flows',
    icon: Zap,
    items: [
      { id: 'tasks', path: '/dashboard/tasks', icon: CheckSquare, label: 'Tarefas' },
      { id: 'flows', path: '/dashboard/fluxos', icon: Zap, label: 'Fluxos de Produção' },
      { id: 'calendar', path: '/dashboard/agenda', icon: Calendar, label: 'Agenda' },
      { id: 'agenda-aberta', path: '/dashboard/agenda-aberta', icon: Calendar, label: 'Agenda Online' },
      { id: 'meetings', path: '/dashboard/reunioes', icon: Video, label: 'Ello Meetings' }
    ]
  },
  {
    id: 'ello-omni',
    label: 'Ello Omni',
    icon: MessageSquare,
    items: [
      { id: 'crm-ello', path: '/dashboard/crm-ello', icon: MessageSquare, label: 'CRM Ello' },
      { id: 'email-default', path: '/dashboard/email', icon: Mail, label: 'Email padrão' },
      { id: 'email-marketing', path: '/dashboard/email-marketing', icon: Mail, label: 'Email marketing' }
    ]
  },
  {
    id: 'ello-track',
    label: 'Ello Track',
    icon: Radio,
    items: [
      { id: 'document-tracking', path: '/dashboard/rastreamento-documento', icon: FileText, label: 'Rastreamento de PDF' },
      { id: 'link-tracking', path: '/dashboard/rastreamento-link', icon: FileText, label: 'Rastreamento de Link' },
      { id: 'video-tracking', path: '/dashboard/rastreamento-video', icon: Video, label: 'Rastreamento de Vídeo' }
    ]
  },
  {
    id: 'analise-relatorio',
    label: 'Análise & Relatório',
    icon: BarChart3,
    items: [
      { id: 'vision', path: '/dashboard/ello-vision', icon: BarChart3, label: 'Ello Vision' },
      { id: 'analytics', path: '/dashboard/analytics', icon: BarChart3, label: 'Análises' },
      { id: 'reports', path: '/dashboard/relatorios', icon: FileText, label: 'Relatórios' }
    ]
  },
  {
    id: 'ajuda-suporte',
    label: 'Ajuda & Suporte',
    icon: HelpCircle,
    items: [
      { id: 'support', path: '/dashboard/suporte', icon: MessageSquare, label: 'Suporte' },
      { id: 'report-problem', path: '/dashboard/reportar-problema', icon: FileText, label: 'Reporte um problema' },
      { id: 'terms', path: '/terms', icon: FileText, label: 'Termos & Políticas' }
    ]
  },
  {
    id: 'config-privacidade',
    label: 'Configurações',
    icon: Settings,
    items: [
      { id: 'settings', path: '/dashboard/configuracoes', icon: Settings, label: 'Configurações' },
      
      { id: 'security', path: '/dashboard/seguranca', icon: Shield, label: 'Segurança & Privacidade' }
    ]
  }
];

export function MobileSidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const location = useLocation();
  const { user, signOut } = useAuth();

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard' || location.pathname === '/dashboard/';
    }
    return location.pathname.startsWith(path);
  };

  const handleLinkClick = () => {
    setIsOpen(false);
    setExpandedGroup(null);
  };

  const toggleGroup = (groupId: string) => {
    setExpandedGroup(prev => prev === groupId ? null : groupId);
  };

  const hasActiveItemInGroup = (group: typeof menuGroups[0]) => {
    return group.items.some(item => isActive(item.path));
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/10"
        >
          <Menu className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      
      <SheetContent 
        side="left" 
        className="w-auto p-0 bg-transparent border-none"
        style={{ zIndex: 100 }}
      >
        <div className="h-full flex">
          {/* Icon strip */}
          <div className="w-16 bg-primary flex flex-col h-full">
            {/* Logo */}
            <div className="h-14 flex items-center justify-center border-b border-white/10">
              <Link to="/dashboard" onClick={handleLinkClick}>
                <ElloLogo className="h-7 w-auto" color="white" />
              </Link>
            </div>

            {/* Menu Group Icons */}
            <div className="flex-1 py-2 flex flex-col items-center">
              {menuGroups.map((group) => {
                const IconComponent = group.icon;
                const isExpanded = expandedGroup === group.id;
                const hasActive = hasActiveItemInGroup(group);
                
                return (
                  <button
                    key={group.id}
                    onClick={() => toggleGroup(group.id)}
                    className={cn(
                      "w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 mb-1",
                      isExpanded 
                        ? "bg-white text-primary shadow-lg" 
                        : hasActive 
                          ? "bg-white/20 text-white" 
                          : "text-white/70 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    <IconComponent className="h-5 w-5" />
                  </button>
                );
              })}
            </div>

            {/* User Avatar & Logout */}
            <div className="py-3 flex flex-col items-center border-t border-white/10">
              {user && (
                <Avatar className="h-9 w-9 mb-2">
                  <AvatarImage src={user.user_metadata?.avatar_url} />
                  <AvatarFallback className="bg-white/20 text-white text-xs">
                    {user.email?.substring(0, 2).toUpperCase() || 'US'}
                  </AvatarFallback>
                </Avatar>
              )}
              
              <button
                onClick={() => {
                  signOut();
                  handleLinkClick();
                }}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-white/70 hover:bg-white/10 hover:text-white transition-colors"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Expandable Panel */}
          <div 
            className={cn(
              "bg-primary/95 backdrop-blur-sm border-l border-white/10 overflow-hidden transition-all duration-300 ease-in-out",
              expandedGroup ? "w-56" : "w-0"
            )}
          >
            {expandedGroup && (
              <div className="w-56 h-full flex flex-col">
                {/* Panel Header */}
                <div className="h-14 px-4 flex items-center border-b border-white/10">
                  <h3 className="text-white font-semibold text-sm">
                    {menuGroups.find(g => g.id === expandedGroup)?.label}
                  </h3>
                </div>

                {/* Panel Items */}
                <div className="flex-1 py-2 px-2 overflow-y-auto">
                  <nav className="space-y-1">
                    {menuGroups.find(g => g.id === expandedGroup)?.items.filter((it: any) => !isPathHidden(it.path)).map((item) => {
                      const ItemIcon = item.icon;
                      const active = isActive(item.path);
                      
                      return (
                        <Link
                          key={item.id}
                          to={item.path}
                          onClick={handleLinkClick}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                            active 
                              ? "bg-white text-primary shadow-sm" 
                              : "text-white/80 hover:bg-white/10 hover:text-white"
                          )}
                        >
                          <ItemIcon className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate">{item.label}</span>
                          {active && <ChevronRight className="h-4 w-4 ml-auto" />}
                        </Link>
                      );
                    })}
                  </nav>
                </div>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
