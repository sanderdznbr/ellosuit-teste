import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { 
  Calendar, 
  Mail, 
  Users, 
  FileText, 
  Video,
  BarChart3,
  MessageSquare,
  CheckSquare,
  GripVertical,
  Save,
  RotateCcw,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  Square
} from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface DashboardWidget {
  id: string;
  widget_type: string;
  position: number;
  size: 'small' | 'medium' | 'large';
  is_visible: boolean;
}

const AVAILABLE_WIDGETS = [
  { 
    type: 'calendar', 
    label: 'Próximos Eventos', 
    icon: Calendar, 
    description: 'Visualize seus compromissos próximos',
    color: 'bg-[#374DA4]'
  },
  { 
    type: 'emails', 
    label: 'E-mails Recentes', 
    icon: Mail, 
    description: 'Acompanhe suas mensagens importantes',
    color: 'bg-purple-500'
  },
  { 
    type: 'clients', 
    label: 'Clientes', 
    icon: Users, 
    description: 'Gerenciar seus contatos e leads',
    color: 'bg-green-500'
  },
  { 
    type: 'meetings', 
    label: 'Reuniões', 
    icon: Video, 
    description: 'Acesso rápido às suas salas de reunião',
    color: 'bg-red-500'
  },
  { 
    type: 'analytics', 
    label: 'Análises', 
    icon: BarChart3, 
    description: 'Métricas e performance do negócio',
    color: 'bg-yellow-500'
  },
  { 
    type: 'tasks', 
    label: 'Tarefas', 
    icon: CheckSquare, 
    description: 'Suas tarefas pendentes e concluídas',
    color: 'bg-indigo-500'
  },
  { 
    type: 'crm', 
    label: 'WhatsApp CRM', 
    icon: MessageSquare, 
    description: 'Mensagens e conversas do CRM',
    color: 'bg-emerald-500'
  },
  { 
    type: 'documents', 
    label: 'Documentos', 
    icon: FileText, 
    description: 'Seus arquivos e documentos recentes',
    color: 'bg-orange-500'
  }
];

const SIZE_LABELS = {
  small: { label: 'Pequeno', icon: Minimize2, cols: '1 coluna' },
  medium: { label: 'Médio', icon: Square, cols: '2 colunas' },
  large: { label: 'Grande', icon: Maximize2, cols: '3 colunas' }
};

interface SortableWidgetItemProps {
  widget: DashboardWidget;
  widgetInfo: typeof AVAILABLE_WIDGETS[0];
  onToggle: (id: string, visible: boolean) => void;
  onSizeChange: (id: string, size: 'small' | 'medium' | 'large') => void;
}

function SortableWidgetItem({ widget, widgetInfo, onToggle, onSizeChange }: SortableWidgetItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const IconComponent = widgetInfo.icon;
  const SizeIcon = SIZE_LABELS[widget.size].icon;

  return (
    <Card 
      ref={setNodeRef} 
      style={style}
      className={`transition-all duration-200 ${widget.is_visible ? 'ring-2 ring-primary/20' : 'opacity-60'}`}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 flex-1">
            {/* Drag Handle */}
            <button
              {...attributes}
              {...listeners}
              className="mt-1 cursor-grab active:cursor-grabbing touch-none p-1 hover:bg-accent rounded transition-colors"
              aria-label="Arrastar widget"
            >
              <GripVertical className="h-5 w-5 text-muted-foreground" />
            </button>

            {/* Icon */}
            <div className={`p-3 ${widgetInfo.color} bg-opacity-10 rounded-lg shrink-0`}>
              <IconComponent className={`h-6 w-6 ${widgetInfo.color.replace('bg-', 'text-')}`} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-lg truncate">{widgetInfo.label}</h3>
                <Badge variant={widget.is_visible ? 'default' : 'secondary'} className="shrink-0">
                  {widget.is_visible ? 'Visível' : 'Oculto'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-3">{widgetInfo.description}</p>
              
              {/* Size Selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Tamanho:</span>
                <div className="flex gap-1">
                  {(['small', 'medium', 'large'] as const).map((size) => {
                    const SizeIconBtn = SIZE_LABELS[size].icon;
                    return (
                      <Button
                        key={size}
                        variant={widget.size === size ? 'default' : 'outline'}
                        size="sm"
                        className="h-8 px-2"
                        onClick={() => onSizeChange(widget.id, size)}
                        disabled={!widget.is_visible}
                      >
                        <SizeIconBtn className="h-3 w-3 mr-1" />
                        {SIZE_LABELS[size].label}
                      </Button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Toggle Switch */}
          <div className="flex items-center gap-2 shrink-0">
            <Switch
              checked={widget.is_visible}
              onCheckedChange={(checked) => onToggle(widget.id, checked)}
              aria-label={`${widget.is_visible ? 'Ocultar' : 'Mostrar'} widget`}
            />
            {widget.is_visible ? (
              <Eye className="h-4 w-4 text-muted-foreground" />
            ) : (
              <EyeOff className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const ImprovedDashboardCustomizer = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [companyId, setCompanyId] = useState<string>('');
  const [hasChanges, setHasChanges] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    loadWidgetSettings();
  }, []);

  const loadWidgetSettings = async () => {
    try {
      const { data: companyData } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user?.id)
        .single();

      if (!companyData) return;
      setCompanyId(companyData.company_id);

      const { data: widgetData, error } = await supabase
        .from('dashboard_widgets')
        .select('*')
        .eq('user_id', user?.id)
        .eq('company_id', companyData.company_id)
        .order('position');

      if (error) throw error;

      if (!widgetData || widgetData.length === 0) {
        await createDefaultWidgets(companyData.company_id);
        return;
      }

      setWidgets(widgetData as DashboardWidget[]);
      setHasChanges(false);
    } catch (error) {
      console.error('Erro ao carregar widgets:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar configurações',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const createDefaultWidgets = async (compId: string) => {
    const defaultWidgets = AVAILABLE_WIDGETS.map((w, idx) => ({
      user_id: user!.id,
      company_id: compId,
      widget_type: w.type,
      position: idx,
      size: 'medium' as const,
      is_visible: true
    }));

    const { error } = await supabase
      .from('dashboard_widgets')
      .insert(defaultWidgets);

    if (!error) {
      loadWidgetSettings();
    }
  };

  const toggleWidgetVisibility = (widgetId: string, visible: boolean) => {
    setWidgets(widgets.map(w => 
      w.id === widgetId ? { ...w, is_visible: visible } : w
    ));
    setHasChanges(true);
  };

  const changeWidgetSize = (widgetId: string, newSize: 'small' | 'medium' | 'large') => {
    setWidgets(widgets.map(w => 
      w.id === widgetId ? { ...w, size: newSize } : w
    ));
    setHasChanges(true);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setWidgets((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        
        const newItems = arrayMove(items, oldIndex, newIndex);
        return newItems.map((item, index) => ({ ...item, position: index }));
      });
      setHasChanges(true);
    }
  };

  const saveChanges = async () => {
    setSaving(true);
    try {
      const updates = widgets.map(widget => ({
        id: widget.id,
        position: widget.position,
        size: widget.size,
        is_visible: widget.is_visible
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('dashboard_widgets')
          .update(update)
          .eq('id', update.id);

        if (error) throw error;
      }

      toast({
        title: 'Configurações Salvas',
        description: 'Seu dashboard foi personalizado com sucesso!',
      });
      setHasChanges(false);
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar as configurações',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const resetToDefault = async () => {
    if (!confirm('Tem certeza que deseja restaurar as configurações padrão? Isso não pode ser desfeito.')) {
      return;
    }

    try {
      await supabase
        .from('dashboard_widgets')
        .delete()
        .eq('user_id', user?.id)
        .eq('company_id', companyId);

      await createDefaultWidgets(companyId);
      
      toast({
        title: 'Configurações Restauradas',
        description: 'Dashboard voltou às configurações padrão',
      });
    } catch (error) {
      console.error('Erro ao restaurar:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível restaurar as configurações',
        variant: 'destructive'
      });
    }
  };

  const visibleCount = widgets.filter(w => w.is_visible).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl bg-white min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Personalizar Dashboard</h1>
        <p className="text-muted-foreground mb-4">
          Configure quais widgets aparecem no seu dashboard, ajuste o tamanho e reorganize a ordem
        </p>
        
        <div className="flex items-center justify-between gap-4 p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-sm font-medium">Widgets Visíveis</p>
              <p className="text-2xl font-bold">{visibleCount} / {widgets.length}</p>
            </div>
            <Separator orientation="vertical" className="h-12" />
            <div>
              <p className="text-sm text-muted-foreground">
                Arraste os cards para reorganizar
              </p>
              <p className="text-sm text-muted-foreground">
                Use o switch para mostrar/ocultar
              </p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={resetToDefault}
              disabled={saving}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Restaurar Padrão
            </Button>
            <Button 
              onClick={saveChanges}
              disabled={!hasChanges || saving}
            >
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </div>
        </div>
      </div>

      {/* Widgets List */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={widgets.map(w => w.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-4">
            {widgets.map((widget) => {
              const widgetInfo = AVAILABLE_WIDGETS.find(w => w.type === widget.widget_type);
              if (!widgetInfo) return null;

              return (
                <SortableWidgetItem
                  key={widget.id}
                  widget={widget}
                  widgetInfo={widgetInfo}
                  onToggle={toggleWidgetVisibility}
                  onSizeChange={changeWidgetSize}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {/* Info Card */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-lg">Dicas de Personalização</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• <strong>Arrastar:</strong> Clique e segure no ícone ☰ para reorganizar os widgets</p>
          <p>• <strong>Visibilidade:</strong> Use o switch para mostrar ou ocultar widgets</p>
          <p>• <strong>Tamanho:</strong> Escolha entre Pequeno (1 coluna), Médio (2 colunas) ou Grande (3 colunas)</p>
          <p>• <strong>Salvar:</strong> Não esqueça de clicar em "Salvar Alterações" quando terminar</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default ImprovedDashboardCustomizer;
