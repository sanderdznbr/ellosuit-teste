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
  ChevronRight,
  FolderOpen,
  Radio,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ElloLogo } from "@/components/shared/ElloLogo";

// Define menu groups with their icons and items
const menuGroups = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: Home,
    items: [
      { id: 'home', path: '/dashboard', icon: Home, label: 'Home' }
    ]
  },
  {
    id: 'inteligencia-artificial',
    label: 'Inteligência Artificial',
    icon: Sparkles,
    items: [
      { id: 'agentes-ia', path: '/dashboard/bot-ia', icon: Bot, label: 'Agentes de IA' }
    ]
  },
  {
    id: 'comunicacao',
    label: 'Comunicação',
    icon: MessageSquare,
    items: [
      { id: 'crm-ello', path: '/dashboard/crm-ello', icon: MessageSquare, label: 'CRM Ello' },
      { id: 'email', path: '/dashboard/email', icon: Mail, label: 'Email' }
    ]
  },
  {
    id: 'produtividade',
    label: 'Produtividade',
    icon: Calendar,
    items: [
      { id: 'agenda', path: '/dashboard/agenda', icon: Calendar, label: 'Agenda' },
      { id: 'agenda-aberta', path: '/dashboard/agenda-aberta', icon: Calendar, label: 'Agenda Online' },
      { id: 'tasks', path: '/dashboard/tasks', icon: CheckSquare, label: 'Tarefas' },
      { id: 'reunioes', path: '/dashboard/meet-hub', icon: Video, label: 'Reuniões' },
      { id: 'meet-skills', path: '/dashboard/meet-skills', icon: Sparkles, label: 'Skills de Reunião' },
      { id: 'fluxos', path: '/dashboard/fluxos', icon: Zap, label: 'Fluxos' }
    ]
  },
  {
    id: 'gestao',
    label: 'Gestão',
    icon: Users,
    items: [
      { id: 'cadastros', path: '/dashboard/cadastros', icon: Users, label: 'Cadastros' },
      { id: 'arquivos', path: '/dashboard/drive', icon: FolderOpen, label: 'Arquivos' },
      { id: 'rastreamento', path: '/dashboard/rastreamento', icon: Radio, label: 'Rastreamento' }
    ]
  },
  {
    id: 'insights',
    label: 'Insights',
    icon: BarChart3,
    items: [
      { id: 'analytics', path: '/dashboard/analytics', icon: BarChart3, label: 'Analytics' },
      { id: 'ello-vision', path: '/dashboard/ello-vision', icon: BarChart3, label: 'Ello Vision' },
      { id: 'relatorios', path: '/dashboard/relatorios', icon: FileText, label: 'Relatórios' }
    ]
  },
  {
    id: 'configuracoes',
    label: 'Configurações',
    icon: Settings,
    items: [
      { id: 'preferencias', path: '/dashboard/configuracoes', icon: Settings, label: 'Preferências' },
      { id: 'seguranca', path: '/dashboard/seguranca', icon: Shield, label: 'Segurança' },
      { id: 'suporte', path: '/dashboard/suporte', icon: HelpCircle, label: 'Suporte' }
    ]
  }
];

interface UnifiedSidebarProps {
  isMobile: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function UnifiedSidebar({ isMobile, isOpen = false, onOpenChange }: UnifiedSidebarProps) {
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const location = useLocation();
  const { user, signOut } = useAuth();

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard' || location.pathname === '/dashboard/';
    }
    return location.pathname.startsWith(path);
  };

  const handleLinkClick = () => {
    setHoveredGroup(null);
    if (isMobile && onOpenChange) {
      onOpenChange(false);
    }
  };

  const handleMouseEnter = (groupId: string) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    setHoveredGroup(groupId);
  };

  const handleMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredGroup(null);
    }, 150);
  };

  const hasActiveItemInGroup = (group: typeof menuGroups[0]) => {
    return group.items.some(item => isActive(item.path));
  };

  // Check if we're on the CRM WhatsApp page
  const isCRMWhatsApp = location.pathname === '/dashboard/crm-whatsapp';
  
  const sidebarContent = (
    <div className="h-full flex" onMouseLeave={handleMouseLeave}>
      {/* Main icon strip */}
      <div className={cn("w-16 flex flex-col h-full", isCRMWhatsApp ? "bg-[#374DA4]" : "bg-primary")}>
        {/* Logo */}
        <div className="h-14 flex items-center justify-center border-b border-white/10">
          <Link to="/dashboard" onClick={handleLinkClick}>
            <ElloLogo className="h-7 w-auto" color="white" />
          </Link>
        </div>

        {/* Menu Group Icons */}
        <div className="flex-1 py-2 flex flex-col items-center">
          <TooltipProvider delayDuration={0}>
            {menuGroups.map((group) => {
              const IconComponent = group.icon;
              const isHovered = hoveredGroup === group.id;
              const hasActive = hasActiveItemInGroup(group);
              
              return (
                <div
                  key={group.id}
                  onMouseEnter={() => handleMouseEnter(group.id)}
                  className="relative"
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        className={cn(
                          "w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 mb-1",
                          isHovered 
                            ? isCRMWhatsApp 
                              ? "bg-white text-[#374DA4] shadow-lg scale-105"
                              : "bg-white text-primary shadow-lg scale-105" 
                            : hasActive 
                              ? "bg-white/20 text-white" 
                              : "text-white/70 hover:bg-white/10 hover:text-white"
                        )}
                      >
                        <IconComponent className="h-5 w-5" />
                      </button>
                    </TooltipTrigger>
                    {!isHovered && (
                      <TooltipContent side="right" className="rounded-lg font-medium">
                        {group.label}
                      </TooltipContent>
                    )}
                  </Tooltip>
                </div>
              );
            })}
          </TooltipProvider>
        </div>

        {/* User Avatar & Logout */}
        <div className="py-3 flex flex-col items-center border-t border-white/10">
          {user && (
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Avatar className="h-9 w-9 mb-2 cursor-pointer">
                    <AvatarImage src={user.user_metadata?.avatar_url} />
                    <AvatarFallback className="bg-white/20 text-white text-xs">
                      {user.email?.substring(0, 2).toUpperCase() || 'US'}
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent side="right" className="rounded-lg">
                  <p className="font-medium">{user.user_metadata?.full_name || 'Usuário'}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => {
                    signOut();
                    handleLinkClick();
                  }}
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="rounded-lg">
                Sair
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Expandable Panel - appears on hover */}
      <div 
        className={cn(
          "bg-primary/95 backdrop-blur-sm border-l border-white/10 overflow-hidden transition-all duration-200 ease-out",
          hoveredGroup ? "w-56 opacity-100" : "w-0 opacity-0"
        )}
        onMouseEnter={() => {
          if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
          }
        }}
      >
        {hoveredGroup && (
          <div className="w-56 h-full flex flex-col animate-in fade-in slide-in-from-left-2 duration-200">
            {/* Panel Header */}
            <div className="h-14 px-4 flex items-center border-b border-white/10">
              <h3 className="text-white font-semibold text-sm">
                {menuGroups.find(g => g.id === hoveredGroup)?.label}
              </h3>
            </div>

            {/* Panel Items */}
            <div className="flex-1 py-2 px-2">
              <nav className="space-y-1">
                {menuGroups.find(g => g.id === hoveredGroup)?.items.filter((it: any) => !isPathHidden(it.path)).map((item) => {
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
  );

  // Mobile: Render as Sheet
  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={onOpenChange}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/10 rounded-xl"
          >
            <Menu className="h-6 w-6" />
          </Button>
        </SheetTrigger>
        
        <SheetContent 
          side="left" 
          className="w-auto p-0 bg-transparent border-none"
          style={{ zIndex: 100 }}
        >
          <div className="h-full">
            {sidebarContent}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: Render as fixed div
  return (
    <div className="h-screen sticky top-0 flex">
      {sidebarContent}
    </div>
  );
}
