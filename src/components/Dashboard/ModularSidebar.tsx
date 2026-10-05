import { useState, useRef, useEffect } from "react";
import { isPathHidden } from "@/config/featureFlags";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { 
  Calendar, Mail, Home, Users, FileText, Settings, Video,
  CheckSquare, MessageSquare, Bot, Zap, BarChart3, Menu, Shield,
  HelpCircle, ChevronRight, FolderOpen, Radio, Sparkles, GripVertical, Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ElloLogo } from "@/components/shared/ElloLogo";
import { useSidebarSettings } from "@/hooks/useSidebarSettings";
import { UserProfileMenu } from "./UserProfileMenu";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Icon mapping
const iconMap: Record<string, any> = {
  Home, Calendar, Mail, Users, FileText, Settings, Video, CheckSquare,
  MessageSquare, Bot, Zap, BarChart3, Shield, HelpCircle, FolderOpen, Radio, Sparkles, Eye
};

// Default menu groups - reorganized with hub colors
const DEFAULT_MENU_GROUPS = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: 'Home',
    color: '#374DA4',
    hubPath: '/dashboard',
    items: [
      { id: 'home', path: '/dashboard', icon: 'Home', label: 'Home' }
    ]
  },
  {
    id: 'inteligencia-artificial',
    label: 'Inteligência Artificial',
    icon: 'Sparkles',
    color: '#8B5CF6',
    hubPath: '/dashboard/bot-ia',
    items: [
      { id: 'agentes-ia', path: '/dashboard/bot-ia', icon: 'Bot', label: 'Agentes de IA' },
      { id: 'chatbots', path: '/dashboard/chatbot', icon: 'Zap', label: 'Chatbots' },
      { id: 'automacoes', path: '/dashboard/automacoes', icon: 'Workflow', label: 'Automações' }
    ]
  },
  {
    id: 'ellosuit-omni',
    label: 'Ellosuit Omni',
    icon: 'MessageSquare',
    color: '#E34800',
    hubPath: '/dashboard/omni',
    items: [
      { id: 'crm-ello', path: '/dashboard/crm-ello', icon: 'MessageSquare', label: 'CRM Ello' },
      { id: 'email', path: '/dashboard/email', icon: 'Mail', label: 'Email Marketing' },
      { id: 'clientes', path: '/dashboard/cadastros', icon: 'Users', label: 'Banco de Clientes' },
      { id: 'agentes-ia-omni', path: '/dashboard/bot-ia', icon: 'Bot', label: 'Agentes de IA' }
    ]
  },
  {
    id: 'ellosuit-track',
    label: 'Ellosuit Track',
    icon: 'Radio',
    color: '#2ECC71',
    hubPath: '/dashboard/track',
    items: [
      { id: 'rastreamento-docs', path: '/dashboard/rastreamento?tab=documents', icon: 'FileText', label: 'Rastrear Documentos' },
      { id: 'rastreamento-links', path: '/dashboard/rastreamento?tab=links', icon: 'Radio', label: 'Rastrear Links' },
      { id: 'rastreamento-videos', path: '/dashboard/rastreamento?tab=videos', icon: 'Video', label: 'Rastrear Vídeos' },
      { id: 'email-tracker', path: '/dashboard/email-tracker', icon: 'Eye', label: 'Rastrear Emails' },
      { id: 'google-console', path: '#', icon: 'Radio', label: 'SEO (Em breve)' }
    ]
  },
  {
    id: 'ellosuit-flow',
    label: 'Ellosuit Flow',
    icon: 'Zap',
    color: '#007DE3',
    hubPath: '/dashboard/flows',
    items: [
      { id: 'agenda', path: '/dashboard/agenda', icon: 'Calendar', label: 'Agenda' },
      { id: 'agenda-aberta', path: '/dashboard/agenda-aberta', icon: 'Calendar', label: 'Agenda Online' },
      { id: 'tasks', path: '/dashboard/tasks', icon: 'CheckSquare', label: 'Tarefas' },
      { id: 'reunioes', path: '/dashboard/reunioes', icon: 'Video', label: 'Reuniões' },
      { id: 'gravacoes', path: '/dashboard/reunioes/gravacoes', icon: 'Video', label: 'Gravações' },
      { id: 'fluxos', path: '/dashboard/fluxos', icon: 'Zap', label: 'Fluxos' }
    ]
  },
  {
    id: 'gestao',
    label: 'Gestão',
    icon: 'Users',
    color: '#6366F1',
    hubPath: '/dashboard/cadastros',
    items: [
      { id: 'cadastros', path: '/dashboard/cadastros', icon: 'Users', label: 'Cadastros' },
      { id: 'arquivos', path: '/dashboard/drive', icon: 'FolderOpen', label: 'Arquivos' }
    ]
  },
  {
    id: 'insights',
    label: 'Insights',
    icon: 'BarChart3',
    color: '#EC4899',
    hubPath: '/dashboard/analytics',
    items: [
      { id: 'analytics', path: '/dashboard/analytics', icon: 'BarChart3', label: 'Analytics' },
      { id: 'ello-vision', path: '/dashboard/ello-vision', icon: 'BarChart3', label: 'Ello Vision' },
      { id: 'relatorios', path: '/dashboard/relatorios', icon: 'FileText', label: 'Relatórios' }
    ]
  },
  {
    id: 'configuracoes',
    label: 'Configurações',
    icon: 'Settings',
    color: '#64748B',
    hubPath: '/dashboard/configuracoes',
    items: [
      { id: 'preferencias', path: '/dashboard/configuracoes', icon: 'Settings', label: 'Preferências' },
      { id: 'seguranca', path: '/dashboard/seguranca', icon: 'Shield', label: 'Segurança' },
      { id: 'suporte', path: '/dashboard/suporte', icon: 'HelpCircle', label: 'Suporte' }
    ]
  }
];

interface SortableMenuGroupProps {
  group: typeof DEFAULT_MENU_GROUPS[0];
  isHovered: boolean;
  hasActive: boolean;
  onHover: (id: string) => void;
  isEditMode: boolean;
  onNavigate: (path: string) => void;
}

function SortableMenuGroup({ group, isHovered, hasActive, onHover, isEditMode, onNavigate }: SortableMenuGroupProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: group.id, disabled: !isEditMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const IconComponent = iconMap[group.icon] || Home;
  const groupColor = group.color || '#374DA4';

  const handleClick = () => {
    if (!isEditMode && group.hubPath) {
      onNavigate(group.hubPath);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative"
      onMouseEnter={() => onHover(group.id)}
    >
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleClick}
              className={cn(
                "w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 mb-1",
                isDragging && "cursor-grabbing"
              )}
              style={{
                backgroundColor: isHovered ? groupColor : hasActive ? `${groupColor}20` : 'transparent',
                color: isHovered ? 'white' : hasActive ? groupColor : '#9CA3AF',
                boxShadow: isHovered ? `0 10px 20px -5px ${groupColor}50` : 'none',
                transform: isHovered ? 'scale(1.05)' : 'scale(1)',
              }}
              {...(isEditMode ? { ...attributes, ...listeners } : {})}
            >
              {isEditMode ? (
                <GripVertical className="h-5 w-5" />
              ) : (
                <IconComponent className="h-5 w-5" />
              )}
            </button>
          </TooltipTrigger>
          {!isHovered && (
            <TooltipContent side="right" className="rounded-lg font-medium bg-gray-900 border-gray-800 text-white">
              {group.label}
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

interface ModularSidebarProps {
   isMobile: boolean;
   isOpen?: boolean;
   onOpenChange?: (open: boolean) => void;
   iconColor?: string;
}

 export function ModularSidebar({ isMobile, isOpen = false, onOpenChange, iconColor }: ModularSidebarProps) {
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [menuGroups, setMenuGroups] = useState(DEFAULT_MENU_GROUPS);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { settings, updateSettings } = useSidebarSettings();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Load saved order from settings
  useEffect(() => {
    if (settings.menu_order && settings.menu_order.length > 0) {
      const orderedGroups = settings.menu_order
        .map(id => DEFAULT_MENU_GROUPS.find(g => g.id === id))
        .filter(Boolean) as typeof DEFAULT_MENU_GROUPS;
      
      // Add any missing groups at the end
      DEFAULT_MENU_GROUPS.forEach(group => {
        if (!orderedGroups.find(g => g.id === group.id)) {
          orderedGroups.push(group);
        }
      });
      
      setMenuGroups(orderedGroups);
    }
  }, [settings.menu_order]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      setMenuGroups((items) => {
        const oldIndex = items.findIndex(i => i.id === active.id);
        const newIndex = items.findIndex(i => i.id === over.id);
        const newOrder = arrayMove(items, oldIndex, newIndex);
        
        // Save new order
        updateSettings({ menu_order: newOrder.map(g => g.id) });
        
        return newOrder;
      });
    }
  };

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

  const hasActiveItemInGroup = (group: typeof DEFAULT_MENU_GROUPS[0]) => {
    return group.items.some(item => isActive(item.path));
  };

  const sidebarContent = (
    <div className="h-full flex" onMouseLeave={handleMouseLeave}>
      {/* Main icon strip - BLACK */}
      <div className="w-16 bg-black flex flex-col h-full">
        {/* Logo */}
        <div className="h-14 flex items-center justify-center border-b border-white/10">
          <Link to="/dashboard" onClick={handleLinkClick}>
            <ElloLogo className="h-7 w-auto" color="white" />
          </Link>
        </div>

        {/* Menu Group Icons with DnD */}
        <div className="flex-1 py-2 flex flex-col items-center overflow-y-auto">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={menuGroups.map(g => g.id)}
              strategy={verticalListSortingStrategy}
            >
              {menuGroups.map((group) => (
                <SortableMenuGroup
                  key={group.id}
                  group={group}
                  isHovered={hoveredGroup === group.id}
                  hasActive={hasActiveItemInGroup(group)}
                  onHover={handleMouseEnter}
                  isEditMode={isEditMode}
                  onNavigate={(path) => {
                    navigate(path);
                    setHoveredGroup(null);
                    if (isMobile && onOpenChange) {
                      onOpenChange(false);
                    }
                  }}
                />
              ))}
            </SortableContext>
          </DndContext>
          
          {/* Edit mode toggle */}
          <button
            onClick={() => setIsEditMode(!isEditMode)}
            className={cn(
              "w-9 h-9 rounded-xl flex items-center justify-center mt-2 transition-colors",
              isEditMode 
                ? "bg-[#374DA4] text-white" 
                : "text-gray-500 hover:bg-white/5 hover:text-white"
            )}
            title={isEditMode ? "Salvar ordem" : "Reordenar menu"}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        </div>

        {/* User Avatar with Profile Menu */}
        <div className="py-3 flex flex-col items-center border-t border-white/10">
          <UserProfileMenu onLinkClick={handleLinkClick} />
        </div>
      </div>

      {/* Expandable Panel - Dark gray */}
      <div 
        className={cn(
          "bg-gray-900 backdrop-blur-sm border-l border-white/5 overflow-hidden transition-all duration-200 ease-out",
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
            <div className="h-14 px-4 flex items-center border-b border-white/5">
              <h3 className="text-white font-semibold text-sm">
                {menuGroups.find(g => g.id === hoveredGroup)?.label}
              </h3>
            </div>

            <div className="flex-1 py-2 px-2">
              <nav className="space-y-1">
                {menuGroups.find(g => g.id === hoveredGroup)?.items.filter((it: any) => !isPathHidden(it.path)).map((item) => {
                  const ItemIcon = iconMap[item.icon] || Home;
                  const active = isActive(item.path);
                  const currentGroup = menuGroups.find(g => g.id === hoveredGroup);
                  const groupColor = currentGroup?.color || '#374DA4';
                  
                  return (
                    <Link
                      key={item.id}
                      to={item.path}
                      onClick={handleLinkClick}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
                      style={{
                        backgroundColor: active ? groupColor : 'transparent',
                        color: active ? 'white' : '#9CA3AF',
                        boxShadow: active ? `0 10px 20px -5px ${groupColor}40` : 'none',
                      }}
                      onMouseEnter={(e) => {
                        if (!active) {
                          e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
                          e.currentTarget.style.color = 'white';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!active) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.color = '#9CA3AF';
                        }
                      }}
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

  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={onOpenChange}>
         <SheetTrigger asChild>
           <Button 
             variant="ghost" 
             size="icon" 
             className="hover:bg-white/10 rounded-xl transition-colors duration-300"
             style={{ color: iconColor || 'white' }}
           >
             <Menu className="h-6 w-6" />
           </Button>
         </SheetTrigger>
        
        <SheetContent side="left" className="w-auto p-0 bg-transparent border-none" style={{ zIndex: 100 }}>
          <div className="h-full">{sidebarContent}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <div className="h-screen sticky top-0 flex">
      {sidebarContent}
    </div>
  );
}

export default ModularSidebar;
