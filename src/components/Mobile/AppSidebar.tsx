import { useState } from "react";
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
  BarChart3
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";

const menuGroups = [
  {
    id: 'sistema',
    label: 'Sistema',
    items: [
      { id: 'home', path: '/dashboard', icon: Home, label: 'Dashboard' },
      { id: 'users', path: '/dashboard/funcionarios', icon: Users, label: 'Usuários' },
      { id: 'clients', path: '/dashboard/clientes', icon: Users, label: 'Clientes' },
      { id: 'suppliers', path: '/dashboard/fornecedores', icon: Users, label: 'Fornecedores' },
      { id: 'prospects', path: '/dashboard/prospectos', icon: Users, label: 'Prospectos' },
      { id: 'bot-ia', path: '/dashboard/bot-ia', icon: Bot, label: 'Agentes Ello IA' },
      { id: 'documents', path: '/dashboard/drive', icon: FileText, label: 'Arquivos' }
    ]
  },
  {
    id: 'ello-flows',
    label: 'Ello Flows',
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
    items: [
      { id: 'crm-ello', path: '/dashboard/crm-ello', icon: MessageSquare, label: 'CRM Ello' },
      { id: 'email', path: '/dashboard/email', icon: Mail, label: 'Email Marketing' }
    ]
  },
  {
    id: 'ello-track',
    label: 'Ello Track',
    items: [
      { id: 'document-tracking', path: '/dashboard/rastreamento-documento', icon: FileText, label: 'Rastreamento de PDF' },
      { id: 'link-tracking', path: '/dashboard/rastreamento-link', icon: FileText, label: 'Rastreamento de Link' },
      { id: 'video-tracking', path: '/dashboard/rastreamento-video', icon: Video, label: 'Rastreamento de Vídeo' }
    ]
  },
  {
    id: 'analise-relatorio',
    label: 'Análise & Relatório',
    items: [
      { id: 'vision', path: '/dashboard/ello-vision', icon: BarChart3, label: 'Ello Vision' },
      { id: 'analytics', path: '/dashboard/analytics', icon: BarChart3, label: 'Análises' },
      { id: 'reports', path: '/dashboard/relatorios', icon: FileText, label: 'Relatórios' }
    ]
  },
  {
    id: 'ajuda-suporte',
    label: 'Ajuda & Suporte',
    items: [
      { id: 'support', path: '/dashboard/suporte', icon: MessageSquare, label: 'Suporte' },
      { id: 'report-problem', path: '/dashboard/reportar-problema', icon: FileText, label: 'Reporte um problema' },
      { id: 'terms', path: '/termos', icon: FileText, label: 'Termos & Políticas' }
    ]
  },
  {
    id: 'config-privacidade',
    label: 'Configurações & Privacidade',
    items: [
      { id: 'settings', path: '/dashboard/configuracoes', icon: Settings, label: 'Configurações' },
      
      { id: 'security', path: '/dashboard/seguranca', icon: Settings, label: 'Segurança & Privacidade' }
    ]
  }
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const isCollapsed = state === "collapsed";

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard' || location.pathname === '/dashboard/';
    }
    return location.pathname.startsWith(path);
  };

  const getNavClassName = (active: boolean) => {
    return active 
      ? "bg-white/20 text-white font-medium hover:bg-white/30" 
      : "text-white/80 hover:bg-white/10 hover:text-white";
  };

  return (
    <Sidebar
      className={`${isCollapsed ? "w-14" : "w-64"} border-r`}
      style={{ backgroundColor: 'hsl(var(--primary))' }}
      collapsible="icon"
    >
      <SidebarContent className="bg-primary text-white">
        {/* Logo */}
        <div className="p-4 border-b border-white/10">
          {isCollapsed ? (
            <Link to="/dashboard" className="flex items-center justify-center">
              <img 
                src="/lovable-uploads/331ff3c7-4d10-4f90-bfdf-ec5b94766b0d.png" 
                alt="ElloSuit" 
                className="h-8 w-8 object-contain filter brightness-0 invert"
                onError={(e) => {
                  console.error('Erro ao carregar favicon padrão:', e);
                }}
              />
            </Link>
          ) : (
            <Link to="/dashboard" className="flex items-center">
              <img 
                src="/lovable-uploads/1ace337d-1080-46b1-b9e6-15dba227814c.png" 
                alt="ElloSuit Logo" 
                className="h-8 w-auto filter brightness-0 invert"
                onError={(e) => {
                  console.error('Erro ao carregar logo padrão:', e);
                }}
              />
            </Link>
          )}
        </div>

        {/* Menu Groups */}
        <div className="flex-1 overflow-y-auto">
          {menuGroups.map((group) => (
            <SidebarGroup key={group.id} className="px-2 py-2">
              {!isCollapsed && (
                <SidebarGroupLabel className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-2">
                  {group.label}
                </SidebarGroupLabel>
              )}
              
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.filter((it: any) => !isPathHidden(it.path)).map((item) => {
                    const IconComponent = item.icon;
                    const active = isActive(item.path);
                    
                    return (
                      <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton 
                          asChild 
                          className={`${getNavClassName(active)} transition-colors rounded-lg mx-1`}
                        >
                          <Link to={item.path} className="flex items-center">
                            <IconComponent className={`${isCollapsed ? 'h-5 w-5' : 'h-4 w-4 mr-3'} flex-shrink-0 text-white`} />
                            {!isCollapsed && <span className="truncate">{item.label}</span>}
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </div>

        {/* User Profile */}
        <div className="border-t border-white/10 p-3">
          {user && (
            <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'space-x-3'} p-2`}>
              <Avatar className="h-8 w-8">
                <AvatarImage src={user.user_metadata?.avatar_url} />
                <AvatarFallback className="bg-white/20 text-white text-xs">
                  {user.email?.substring(0, 2).toUpperCase() || 'US'}
                </AvatarFallback>
              </Avatar>
              
              {!isCollapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {user.user_metadata?.full_name || 'Usuário'}
                  </p>
                  <p className="text-xs text-white/70 truncate">
                    {user.email}
                  </p>
                </div>
              )}
              
              <Button
                variant="ghost"
                size="sm"
                onClick={signOut}
                className={`text-white hover:bg-white/10 ${isCollapsed ? 'p-1' : 'p-2'}`}
                title="Sair"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </SidebarContent>
    </Sidebar>
  );
}