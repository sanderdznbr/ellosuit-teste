import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Upload, Palette, Settings, Image, RotateCcw, Save, Plus, X } from 'lucide-react';
import { useSidebarSettings, MenuItem, MenuGroup } from '@/hooks/useSidebarSettings';
import { useFileUpload } from '@/hooks/useFileUpload';
import ColorWheel from './ColorWheel';

const defaultMenuItems: MenuItem[] = [
  { id: 'home', label: 'Dashboard', icon: '🏠', path: '/dashboard' },
  { id: 'calendar', label: 'Agendamentos', icon: '📅', path: '/dashboard/agenda' },
  { id: 'clients', label: 'Contatos', icon: '👥', path: '/dashboard/clientes' },
  { id: 'documents', label: 'Arquivos', icon: '📁', path: '/dashboard/drive' },
  { id: 'tasks', label: 'Tarefas', icon: '✅', path: '/dashboard/tasks' },
  { id: 'flows', label: 'Fluxos de produção', icon: '📊', path: '/dashboard/fluxos' },
  { id: 'crm-ello', label: 'CRM Ello', icon: '💬', path: '/dashboard/crm-ello' },
  { id: 'email', label: 'Email Marketing', icon: '📧', path: '/dashboard/email' },
  { id: 'agenda-aberta', label: 'Agendamento Online', icon: '🗓️', path: '/dashboard/agenda-aberta' },
  { id: 'meetings', label: 'Reuniões Ello', icon: '📹', path: '/dashboard/reunioes' },
  { id: 'bot-ia', label: 'Agentes de IA', icon: '🤖', path: '/dashboard/bot-ia' },
  { id: 'settings', label: 'Configurações', icon: '⚙️', path: '/dashboard/configuracoes' }
];

const defaultGroups: MenuGroup[] = [
  {
    id: 'sistema',
    label: 'Sistema',
    color: '#64748B',
    items: [
      { id: 'home', label: 'Dashboard', icon: '🏠', path: '/dashboard' },
      { id: 'settings', label: 'Configurações', icon: '⚙️', path: '/dashboard/configuracoes' }
    ]
  },
  {
    id: 'agendamentos',
    label: 'Agendamentos',
    color: '#374DA4',
    items: [
      { id: 'calendar', label: 'Agendamentos', icon: '📅', path: '/dashboard/agenda' },
      { id: 'agenda-aberta', label: 'Agendamento Online', icon: '🗓️', path: '/dashboard/agenda-aberta' },
      { id: 'meetings', label: 'Reuniões Ello', icon: '📹', path: '/dashboard/reunioes' }
    ]
  },
  {
    id: 'marketing',
    label: 'Marketing',
    color: '#10B981',
    items: [
      { id: 'email', label: 'Email Marketing', icon: '📧', path: '/dashboard/email' },
      { id: 'bot-ia', label: 'Agentes de IA', icon: '🤖', path: '/dashboard/bot-ia' }
    ]
  },
  {
    id: 'producao',
    label: 'Produção',
    color: '#F59E0B',
    items: [
      { id: 'clients', label: 'Contatos', icon: '👥', path: '/dashboard/clientes' },
      { id: 'documents', label: 'Arquivos', icon: '📁', path: '/dashboard/drive' },
      { id: 'tasks', label: 'Tarefas', icon: '✅', path: '/dashboard/tasks' },
      { id: 'flows', label: 'Fluxos de produção', icon: '📊', path: '/dashboard/fluxos' },
      { id: 'crm-ello', label: 'CRM Ello', icon: '💬', path: '/dashboard/crm-ello' }
    ]
  }
];

interface SortableItemProps {
  id: string;
  label: string;
  icon: string;
}

function SortableItem({ id, label, icon }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 bg-white border rounded-lg shadow-sm"
    >
      <div {...attributes} {...listeners} className="cursor-grab hover:cursor-grabbing">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      <span className="text-lg">{icon}</span>
      <span className="font-medium text-foreground">{label}</span>
    </div>
  );
}

interface SortableGroupProps {
  group: MenuGroup;
  onUpdateGroup: (groupId: string, updatedGroup: MenuGroup) => void;
  onDeleteGroup: (groupId: string) => void;
}

function SortableGroup({ group, onUpdateGroup, onDeleteGroup }: SortableGroupProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: group.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(group.label);

  const handleSave = () => {
    onUpdateGroup(group.id, { ...group, label: editName });
    setIsEditing(false);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border rounded-lg bg-card"
    >
      <div className="p-4 border-b" style={{ borderLeftColor: group.color, borderLeftWidth: '4px' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div {...attributes} {...listeners} className="cursor-grab hover:cursor-grabbing">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>
            {isEditing ? (
              <div className="flex items-center gap-2">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-8 text-sm"
                />
                <Button size="sm" onClick={handleSave}>Salvar</Button>
                <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>Cancelar</Button>
              </div>
            ) : (
              <h3 className="font-semibold text-foreground">{group.label}</h3>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsEditing(!isEditing)}
            >
              ✏️
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onDeleteGroup(group.id)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      <div className="p-4">
        <SortableContext items={group.items.map(item => item.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {group.items.map((item) => (
              <SortableItem key={item.id} id={item.id} label={item.label} icon={item.icon} />
            ))}
          </div>
        </SortableContext>
      </div>
    </div>
  );
}

const GroupedSidebarEditor = () => {
  const { settings, loading, updateSettings, refetch } = useSidebarSettings();
  const { uploadFile, uploading } = useFileUpload();
  const [groups, setGroups] = useState<MenuGroup[]>(defaultGroups);
  const [customLogoFile, setCustomLogoFile] = useState<File | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showBackgroundColorPicker, setShowBackgroundColorPicker] = useState(false);
  const [sidebarColor, setSidebarColor] = useState(settings.sidebar_color || '#374DA4');
  const [backgroundColor, setBackgroundColor] = useState(settings.sidebar_background_color || '#3600FF');
  const [sidebarColorHex, setSidebarColorHex] = useState(settings.sidebar_color || '#374DA4');
  const [backgroundColorHex, setBackgroundColorHex] = useState(settings.sidebar_background_color || '#3600FF');
  const [pendingChanges, setPendingChanges] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  React.useEffect(() => {
    if (settings.menu_groups && settings.menu_groups.length > 0) {
      setGroups(settings.menu_groups);
    }
  }, [settings]);

  React.useEffect(() => {
    setSidebarColor(settings.sidebar_color || '#374DA4');
    setBackgroundColor(settings.sidebar_background_color || '#3600FF');
    setSidebarColorHex(settings.sidebar_color || '#374DA4');
    setBackgroundColorHex(settings.sidebar_background_color || '#3600FF');
  }, [settings]);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Se estamos movendo um item para um grupo diferente
    const activeGroup = groups.find(group => group.items.some(item => item.id === activeId));
    const overGroup = groups.find(group => group.id === overId) || groups.find(group => group.items.some(item => item.id === overId));

    if (!activeGroup || !overGroup) return;

    if (activeGroup.id !== overGroup.id) {
      setGroups(prevGroups => {
        const newGroups = [...prevGroups];
        const activeGroupIndex = newGroups.findIndex(g => g.id === activeGroup.id);
        const overGroupIndex = newGroups.findIndex(g => g.id === overGroup.id);
        
        // Remover item do grupo original
        const activeItem = activeGroup.items.find(item => item.id === activeId);
        if (activeItem) {
          newGroups[activeGroupIndex] = {
            ...activeGroup,
            items: activeGroup.items.filter(item => item.id !== activeId)
          };

          // Adicionar ao novo grupo
          if (overGroup.items.some(item => item.id === overId)) {
            const overItemIndex = overGroup.items.findIndex(item => item.id === overId);
            const newItems = [...overGroup.items];
            newItems.splice(overItemIndex, 0, activeItem);
            newGroups[overGroupIndex] = { ...overGroup, items: newItems };
          } else {
            newGroups[overGroupIndex] = {
              ...overGroup,
              items: [...overGroup.items, activeItem]
            };
          }
        }

        return newGroups;
      });
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    if (activeId === overId) return;

    // Verificar se estamos reordenando grupos
    const isGroupDrag = groups.some(group => group.id === activeId);
    
    if (isGroupDrag) {
      setGroups(prevGroups => {
        const oldIndex = prevGroups.findIndex(group => group.id === activeId);
        const newIndex = prevGroups.findIndex(group => group.id === overId);
        return arrayMove(prevGroups, oldIndex, newIndex);
      });
    } else {
      // Reordenar itens dentro do mesmo grupo
      const group = groups.find(group => group.items.some(item => item.id === activeId || item.id === overId));
      
      if (group) {
        setGroups(prevGroups => {
          const newGroups = [...prevGroups];
          const groupIndex = newGroups.findIndex(g => g.id === group.id);
          const oldIndex = group.items.findIndex(item => item.id === activeId);
          const newIndex = group.items.findIndex(item => item.id === overId);
          
          const newItems = arrayMove(group.items, oldIndex, newIndex);
          newGroups[groupIndex] = { ...group, items: newItems };
          
          return newGroups;
        });
      }
    }

    setPendingChanges(true);
  }

  const handleCreateNewGroup = () => {
    const newGroup: MenuGroup = {
      id: `group-${Date.now()}`,
      label: 'Novo Grupo',
      color: '#6B7280',
      items: []
    };
    setGroups([...groups, newGroup]);
    setPendingChanges(true);
  };

  const handleUpdateGroup = (groupId: string, updatedGroup: MenuGroup) => {
    setGroups(prevGroups => 
      prevGroups.map(group => group.id === groupId ? updatedGroup : group)
    );
    setPendingChanges(true);
  };

  const handleDeleteGroup = (groupId: string) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;

    // Mover itens para o primeiro grupo
    if (group.items.length > 0 && groups.length > 1) {
      const firstGroup = groups.find(g => g.id !== groupId);
      if (firstGroup) {
        setGroups(prevGroups => {
          const newGroups = prevGroups.filter(g => g.id !== groupId);
          const firstGroupIndex = newGroups.findIndex(g => g.id === firstGroup.id);
          newGroups[firstGroupIndex] = {
            ...firstGroup,
            items: [...firstGroup.items, ...group.items]
          };
          return newGroups;
        });
      }
    } else {
      setGroups(prevGroups => prevGroups.filter(g => g.id !== groupId));
    }
    setPendingChanges(true);
  };

  const handleColorChange = (color: string) => {
    setSidebarColor(color);
    setSidebarColorHex(color);
    setPendingChanges(true);
  };

  const handleBackgroundColorChange = (color: string) => {
    setBackgroundColor(color);
    setBackgroundColorHex(color);
    setPendingChanges(true);
  };

  const handleCustomLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setCustomLogoFile(e.target.files[0]);
      setPendingChanges(true);
    }
  };

  const handleFaviconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFaviconFile(e.target.files[0]);
      setPendingChanges(true);
    }
  };

  const handleRemoveLogo = () => {
    updateSettings({ custom_logo_url: null });
    setPendingChanges(true);
  };

  const handleRemoveFavicon = () => {
    updateSettings({ custom_favicon_url: null });
    setPendingChanges(true);
  };

  const handleSidebarColorInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSidebarColorHex(e.target.value);
  };

  const handleBackgroundColorInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBackgroundColorHex(e.target.value);
  };

  const applySidebarColorFromInput = () => {
    setSidebarColor(sidebarColorHex);
    setPendingChanges(true);
  };

  const applyBackgroundColorFromInput = () => {
    setBackgroundColor(backgroundColorHex);
    setPendingChanges(true);
  };

  const handleSaveAllChanges = async () => {
    try {
      let logoUrl = settings.custom_logo_url;
      let faviconUrl = settings.custom_favicon_url;

      // Upload files if selected
      if (customLogoFile) {
        const uploadedLogoUrl = await uploadFile(customLogoFile, 'logos');
        if (uploadedLogoUrl) {
          logoUrl = uploadedLogoUrl;
        }
        setCustomLogoFile(null);
      }

      if (faviconFile) {
        const uploadedFaviconUrl = await uploadFile(faviconFile, 'logos');
        if (uploadedFaviconUrl) {
          faviconUrl = uploadedFaviconUrl;
        }
        setFaviconFile(null);
      }

      await updateSettings({
        sidebar_color: sidebarColor,
        sidebar_background_color: backgroundColor,
        custom_logo_url: logoUrl,
        custom_favicon_url: faviconUrl,
        menu_groups: groups
      });

      await refetch();
      setPendingChanges(false);
    } catch (error) {
      console.error('Erro ao salvar alterações:', error);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-8 bg-muted/30 min-h-screen">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content p-6 space-y-8 bg-muted/30 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Reorganizar Sidebar</h1>
          <p className="text-base mt-2">Organize as funções em grupos e personalize a aparência</p>
        </div>
        <Button
          onClick={handleSaveAllChanges}
          disabled={!pendingChanges || uploading}
          className="flex items-center gap-2 px-6 py-3 text-base"
          size="lg"
        >
          <Save className="h-5 w-5" />
          {uploading ? 'Salvando...' : 'Salvar Alterações'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Groups Organization */}
        <div className="lg:col-span-2">
          <Card className="border-none shadow-lg rounded-2xl bg-card">
            <CardHeader className="p-6">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Organização por Grupos
                </CardTitle>
                <Button onClick={handleCreateNewGroup} size="sm" className="flex items-center gap-1">
                  <Plus className="h-4 w-4" />
                  Novo Grupo
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6 pt-0">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={groups.map(group => group.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-6">
                    {groups.map((group) => (
                      <SortableGroup
                        key={group.id}
                        group={group}
                        onUpdateGroup={handleUpdateGroup}
                        onDeleteGroup={handleDeleteGroup}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </CardContent>
          </Card>
        </div>

        {/* Customization Panel - simplified for now */}
        <div className="space-y-6">
          <Card className="border-none shadow-lg rounded-2xl bg-card">
            <CardHeader className="p-6">
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Personalização
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-0">
              <p className="text-sm text-muted-foreground">
                As opções de cor e logo continuam disponíveis. Esta versão foca na organização por grupos.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default GroupedSidebarEditor;
