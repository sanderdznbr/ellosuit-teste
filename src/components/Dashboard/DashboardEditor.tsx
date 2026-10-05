import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Calendar, Mail, Users, Video, FileText, CheckSquare, Bot, Zap, 
  BarChart3, Settings, GripVertical, Eye, EyeOff, Save, Loader2,
  FolderOpen, Clock
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface DashboardEditorProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
}

interface WidgetConfig {
  id: string;
  type: string;
  label: string;
  icon: React.ElementType;
  visible: boolean;
  position: number;
}

const WIDGET_TYPES = [
  { type: 'meetings', label: 'Reuniões Hoje', icon: Video },
  { type: 'clients', label: 'Clientes', icon: Users },
  { type: 'documents', label: 'Documentos', icon: FolderOpen },
  { type: 'agents', label: 'Agentes IA', icon: Bot },
  { type: 'nextEvent', label: 'Próximo Compromisso', icon: Clock },
  { type: 'quickAccess', label: 'Acesso Rápido', icon: Zap },
  { type: 'quickActions', label: 'Ações Rápidas', icon: BarChart3 },
];

const SortableWidget: React.FC<{ widget: WidgetConfig; onToggle: () => void }> = ({ widget, onToggle }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: widget.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const Icon = widget.icon;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
        widget.visible ? 'bg-card' : 'bg-muted/50 opacity-60'
      }`}
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </div>

      <div className="p-2.5 bg-primary/10 rounded-xl">
        <Icon className="h-5 w-5 text-primary" />
      </div>

      <div className="flex-1">
        <p className="font-medium">{widget.label}</p>
        <p className="text-xs text-muted-foreground">
          {widget.visible ? 'Visível no dashboard' : 'Oculto'}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <button onClick={onToggle} className="p-2 hover:bg-muted rounded-lg transition-colors">
          {widget.visible ? (
            <Eye className="h-4 w-4 text-primary" />
          ) : (
            <EyeOff className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
        <Switch checked={widget.visible} onCheckedChange={onToggle} />
      </div>
    </div>
  );
};

const DashboardEditor: React.FC<DashboardEditorProps> = ({ open, onClose, onSave }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [widgets, setWidgets] = useState<WidgetConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  useEffect(() => {
    if (open && user) {
      loadWidgets();
    }
  }, [open, user]);

  const loadWidgets = async () => {
    if (!user) return;

    try {
      const { data: companyUser } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!companyUser) return;
      setCompanyId(companyUser.company_id);

      const { data: savedWidgets } = await supabase
        .from('dashboard_widgets')
        .select('*')
        .eq('user_id', user.id)
        .eq('company_id', companyUser.company_id)
        .order('position');

      if (savedWidgets && savedWidgets.length > 0) {
        const widgetConfigs = savedWidgets.map((w, index) => {
          const widgetType = WIDGET_TYPES.find(t => t.type === w.widget_type);
          return {
            id: w.id,
            type: w.widget_type,
            label: widgetType?.label || w.widget_type,
            icon: widgetType?.icon || Settings,
            visible: w.is_visible ?? true,
            position: w.position ?? index,
          };
        });
        setWidgets(widgetConfigs);
      } else {
        // Create default widgets
        const defaultWidgets = WIDGET_TYPES.map((w, index) => ({
          id: `temp-${index}`,
          type: w.type,
          label: w.label,
          icon: w.icon,
          visible: true,
          position: index,
        }));
        setWidgets(defaultWidgets);
      }
    } catch (error) {
      console.error('Error loading widgets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      setWidgets((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex).map((w, i) => ({ ...w, position: i }));
      });
    }
  };

  const toggleWidget = (widgetId: string) => {
    setWidgets((prev) =>
      prev.map((w) => (w.id === widgetId ? { ...w, visible: !w.visible } : w))
    );
  };

  const handleSave = async () => {
    if (!user || !companyId) return;

    setSaving(true);
    try {
      // Delete existing widgets
      await supabase
        .from('dashboard_widgets')
        .delete()
        .eq('user_id', user.id)
        .eq('company_id', companyId);

      // Insert updated widgets
      const widgetsToInsert = widgets.map((w, index) => ({
        user_id: user.id,
        company_id: companyId,
        widget_type: w.type,
        position: index,
        is_visible: w.visible,
        size: 'medium',
      }));

      const { error } = await supabase
        .from('dashboard_widgets')
        .insert(widgetsToInsert);

      if (error) throw error;

      toast({ title: 'Dashboard salvo com sucesso!' });
      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving widgets:', error);
      toast({
        title: 'Erro ao salvar',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-xl">
              <Settings className="h-5 w-5 text-primary" />
            </div>
            Personalizar Dashboard
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Arraste para reordenar e use o toggle para mostrar/ocultar widgets.
            </p>

            <ScrollArea className="h-[400px] pr-4">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={widgets.map((w) => w.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {widgets.map((widget) => (
                      <SortableWidget
                        key={widget.id}
                        widget={widget}
                        onToggle={() => toggleWidget(widget.id)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </ScrollArea>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={onClose} className="rounded-xl">
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving} className="rounded-xl">
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Salvar
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default DashboardEditor;
