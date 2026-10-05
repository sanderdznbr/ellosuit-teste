import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  GripVertical
} from 'lucide-react';

interface DashboardWidget {
  id: string;
  widget_type: string;
  position: number;
  size: 'small' | 'medium' | 'large';
  is_visible: boolean;
}

const AVAILABLE_WIDGETS = [
  { type: 'calendar', label: 'Próximos Eventos', icon: Calendar, description: 'Visualize seus compromissos' },
  { type: 'emails', label: 'E-mails Recentes', icon: Mail, description: 'Acompanhe suas mensagens' },
  { type: 'clients', label: 'Clientes', icon: Users, description: 'Gerenciar contatos' },
  { type: 'meetings', label: 'Reuniões', icon: Video, description: 'Salas de reunião' },
  { type: 'analytics', label: 'Análises', icon: BarChart3, description: 'Métricas do negócio' },
  { type: 'tasks', label: 'Tarefas', icon: CheckSquare, description: 'Lista de tarefas' },
  { type: 'crm', label: 'WhatsApp CRM', icon: MessageSquare, description: 'Mensagens do CRM' },
  { type: 'documents', label: 'Documentos', icon: FileText, description: 'Arquivos recentes' }
];

const DashboardCustomizer = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string>('');

  useEffect(() => {
    loadWidgetSettings();
  }, []);

  const loadWidgetSettings = async () => {
    try {
      // Get company
      const { data: companyData } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user?.id)
        .single();

      if (!companyData) return;
      setCompanyId(companyData.company_id);

      // Load user widgets
      const { data: widgetData, error } = await supabase
        .from('dashboard_widgets')
        .select('*')
        .eq('user_id', user?.id)
        .eq('company_id', companyData.company_id)
        .order('position');

      if (error) throw error;

      // Se não tem widgets, criar padrões
      if (!widgetData || widgetData.length === 0) {
        await createDefaultWidgets(companyData.company_id);
        return;
      }

      setWidgets(widgetData as DashboardWidget[]);
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

  const toggleWidgetVisibility = async (widgetId: string, currentVisibility: boolean) => {
    const { error } = await supabase
      .from('dashboard_widgets')
      .update({ is_visible: !currentVisibility })
      .eq('id', widgetId);

    if (!error) {
      setWidgets(widgets.map(w => 
        w.id === widgetId ? { ...w, is_visible: !currentVisibility } : w
      ));
      toast({
        title: !currentVisibility ? 'Widget ativado' : 'Widget desativado',
        description: 'Configuração salva'
      });
    }
  };

  const changeWidgetSize = async (widgetId: string, newSize: 'small' | 'medium' | 'large') => {
    const { error } = await supabase
      .from('dashboard_widgets')
      .update({ size: newSize })
      .eq('id', widgetId);

    if (!error) {
      setWidgets(widgets.map(w => 
        w.id === widgetId ? { ...w, size: newSize } : w
      ));
      toast({
        title: 'Tamanho atualizado',
        description: 'Widget redimensionado'
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Personalizar Dashboard</h1>
        <p className="text-muted-foreground">
          Configure quais widgets aparecem no seu dashboard
        </p>
      </div>

      <div className="grid gap-4">
        {widgets.map((widget) => {
          const widgetInfo = AVAILABLE_WIDGETS.find(w => w.type === widget.widget_type);
          if (!widgetInfo) return null;

          const IconComponent = widgetInfo.icon;

          return (
            <Card key={widget.id} className={widget.is_visible ? '' : 'opacity-50'}>
              <CardContent className="flex items-center justify-between p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <IconComponent className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{widgetInfo.label}</h3>
                    <p className="text-sm text-muted-foreground">{widgetInfo.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Button
                      variant={widget.size === 'small' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => changeWidgetSize(widget.id, 'small')}
                    >
                      P
                    </Button>
                    <Button
                      variant={widget.size === 'medium' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => changeWidgetSize(widget.id, 'medium')}
                    >
                      M
                    </Button>
                    <Button
                      variant={widget.size === 'large' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => changeWidgetSize(widget.id, 'large')}
                    >
                      G
                    </Button>
                  </div>

                  <Switch
                    checked={widget.is_visible}
                    onCheckedChange={() => toggleWidgetVisibility(widget.id, widget.is_visible)}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default DashboardCustomizer;
