import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Save, Eye, Plus, Trash2, GripVertical,
  Type, Mail, Phone, CircleDot, CheckSquare, Star, MousePointer,
  Loader2, Settings, ChevronLeft, ChevronRight, Smartphone, Monitor,
  ExternalLink, Calendar, Hash, MapPin, Link, FileText, User, Building, 
  Image, Palette, AlignLeft, AlignCenter, AlignRight, Bold, X,
  Upload, GitBranch, Copy
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

// Component types for the palette
const COMPONENT_TYPES = [
  { type: 'text', label: 'Texto', icon: Type, category: 'input' },
  { type: 'email', label: 'Email', icon: Mail, category: 'input' },
  { type: 'phone', label: 'Telefone', icon: Phone, category: 'input' },
  { type: 'name', label: 'Nome', icon: User, category: 'input' },
  { type: 'company', label: 'Empresa', icon: Building, category: 'input' },
  { type: 'number', label: 'Número', icon: Hash, category: 'input' },
  { type: 'url', label: 'URL', icon: Link, category: 'input' },
  { type: 'date', label: 'Data', icon: Calendar, category: 'input' },
  { type: 'address', label: 'Endereço', icon: MapPin, category: 'input' },
  { type: 'textarea', label: 'Texto Longo', icon: FileText, category: 'input' },
  { type: 'single_choice', label: 'Escolha Única', icon: CircleDot, category: 'choice' },
  { type: 'multiple_choice', label: 'Múltipla Escolha', icon: CheckSquare, category: 'choice' },
  { type: 'image_choice', label: 'Escolha de Imagem', icon: Image, category: 'choice' },
  { type: 'rating', label: 'Avaliação', icon: Star, category: 'special' },
  { type: 'heading', label: 'Título', icon: Type, category: 'layout' },
  { type: 'paragraph', label: 'Parágrafo', icon: AlignLeft, category: 'layout' },
];

interface ImageOption {
  id: string;
  imageUrl: string;
  label: string;
  nextStepId?: string; // For conditional logic
}

interface StepField {
  id: string;
  type: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
  imageOptions?: ImageOption[];
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  align?: 'left' | 'center' | 'right';
  bold?: boolean;
}

interface FunnelStep {
  id: string;
  position: number;
  step_type: string;
  title: string;
  description: string;
  content: any;
  required: boolean;
}

interface LeadFunnel {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  settings: any;
}

const LeadFunnelBuilder: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const funnelId = searchParams.get('id');
  
  const [funnel, setFunnel] = useState<LeadFunnel | null>(null);
  const [steps, setSteps] = useState<FunnelStep[]>([]);
  const [selectedStepIndex, setSelectedStepIndex] = useState<number>(0);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState<'mobile' | 'desktop'>('mobile');
  const [draggedComponent, setDraggedComponent] = useState<string | null>(null);
  
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadData = async () => {
      if (!funnelId) {
        navigate('/dashboard/leads');
        return;
      }

      setLoading(true);

      const { data: funnelData, error: funnelError } = await supabase
        .from('lead_funnels')
        .select('*')
        .eq('id', funnelId)
        .single();

      if (funnelError || !funnelData) {
        toast({ title: 'Erro', description: 'Funil não encontrado', variant: 'destructive' });
        navigate('/dashboard/leads');
        return;
      }

      setFunnel(funnelData);

      const { data: stepsData } = await supabase
        .from('lead_funnel_steps')
        .select('*')
        .eq('funnel_id', funnelId)
        .order('position', { ascending: true });

      if (stepsData && stepsData.length > 0) {
        setSteps(stepsData.map(s => ({
          ...s,
          title: s.title || '',
          description: s.description || '',
          content: s.content || { fields: [] }
        })));
      } else {
        // Create default first step
        const defaultStep: FunnelStep = {
          id: `new-${Date.now()}`,
          position: 1,
          step_type: 'form',
          title: 'Etapa 1',
          description: '',
          content: { fields: [] },
          required: true
        };
        setSteps([defaultStep]);
      }

      setLoading(false);
    };

    loadData();
  }, [funnelId]);

  const currentStep = steps[selectedStepIndex];
  const currentFields: StepField[] = currentStep?.content?.fields || [];

  const addStep = () => {
    const newStep: FunnelStep = {
      id: `new-${Date.now()}`,
      position: steps.length + 1,
      step_type: 'form',
      title: `Etapa ${steps.length + 1}`,
      description: '',
      content: { fields: [] },
      required: true
    };
    setSteps(prev => [...prev, newStep]);
    setSelectedStepIndex(steps.length);
    setSelectedFieldId(null);
  };

  const duplicateStep = (index: number) => {
    const stepToCopy = steps[index];
    const newStep: FunnelStep = {
      ...JSON.parse(JSON.stringify(stepToCopy)),
      id: `new-${Date.now()}`,
      position: steps.length + 1,
      title: `${stepToCopy.title} (cópia)`
    };
    setSteps(prev => [...prev, newStep]);
  };

  const deleteStep = (index: number) => {
    if (steps.length === 1) return;
    setSteps(prev => {
      const filtered = prev.filter((_, i) => i !== index);
      return filtered.map((s, i) => ({ ...s, position: i + 1 }));
    });
    if (selectedStepIndex >= index && selectedStepIndex > 0) {
      setSelectedStepIndex(selectedStepIndex - 1);
    }
    setSelectedFieldId(null);
  };

  const updateCurrentStep = (updates: Partial<FunnelStep>) => {
    setSteps(prev => prev.map((s, i) => 
      i === selectedStepIndex ? { ...s, ...updates } : s
    ));
  };

  const addField = (type: string) => {
    const newField: StepField = {
      id: `field-${Date.now()}`,
      type,
      label: COMPONENT_TYPES.find(c => c.type === type)?.label || 'Campo',
      placeholder: '',
      required: type !== 'heading' && type !== 'paragraph',
      options: (type === 'single_choice' || type === 'multiple_choice') 
        ? ['Opção 1', 'Opção 2'] 
        : undefined,
      imageOptions: type === 'image_choice' 
        ? [
            { id: 'img-1', imageUrl: '', label: 'Opção 1' },
            { id: 'img-2', imageUrl: '', label: 'Opção 2' }
          ] 
        : undefined,
      max: type === 'rating' ? 5 : undefined,
      size: type === 'heading' ? 'lg' : 'md',
      align: 'left'
    };

    const newFields = [...currentFields, newField];
    updateCurrentStep({ content: { ...currentStep.content, fields: newFields } });
    setSelectedFieldId(newField.id);
  };

  const updateField = (fieldId: string, updates: Partial<StepField>) => {
    const newFields = currentFields.map(f => 
      f.id === fieldId ? { ...f, ...updates } : f
    );
    updateCurrentStep({ content: { ...currentStep.content, fields: newFields } });
  };

  const deleteField = (fieldId: string) => {
    const newFields = currentFields.filter(f => f.id !== fieldId);
    updateCurrentStep({ content: { ...currentStep.content, fields: newFields } });
    setSelectedFieldId(null);
  };

  const moveField = (fieldId: string, direction: 'up' | 'down') => {
    const idx = currentFields.findIndex(f => f.id === fieldId);
    if ((direction === 'up' && idx === 0) || (direction === 'down' && idx === currentFields.length - 1)) return;
    
    const newFields = [...currentFields];
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    [newFields[idx], newFields[newIdx]] = [newFields[newIdx], newFields[idx]];
    updateCurrentStep({ content: { ...currentStep.content, fields: newFields } });
  };

  const handleDragStart = (type: string) => {
    setDraggedComponent(type);
  };

  const handleDragEnd = () => {
    setDraggedComponent(null);
  };

  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedComponent) {
      addField(draggedComponent);
      setDraggedComponent(null);
    }
  };

  const handleCanvasDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const saveChanges = async () => {
    if (!funnel || !funnelId) return;

    setSaving(true);

    try {
      await supabase
        .from('lead_funnel_steps')
        .delete()
        .eq('funnel_id', funnelId);

      if (steps.length > 0) {
        const stepsToInsert = steps.map(s => ({
          funnel_id: funnelId,
          position: s.position,
          step_type: s.step_type,
          title: s.title || null,
          description: s.description || null,
          content: s.content || {},
          required: s.required
        }));

        const { error: stepsError } = await supabase
          .from('lead_funnel_steps')
          .insert(stepsToInsert);

        if (stepsError) throw stepsError;
      }

      await supabase
        .from('lead_funnels')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', funnelId);

      toast({ title: 'Salvo!', description: 'Alterações salvas com sucesso.' });
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const selectedField = selectedFieldId 
    ? currentFields.find(f => f.id === selectedFieldId) 
    : null;

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-muted/30">
      {/* Header */}
      <div className="border-b bg-card px-4 py-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/leads')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="font-semibold text-foreground">{funnel?.name}</h1>
              <p className="text-xs text-muted-foreground">/f/{funnel?.slug}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Preview Mode Toggle */}
            <div className="flex items-center border rounded-lg p-1 bg-muted/50">
              <Button
                variant={previewMode === 'mobile' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 px-2"
                onClick={() => setPreviewMode('mobile')}
              >
                <Smartphone className="h-4 w-4" />
              </Button>
              <Button
                variant={previewMode === 'desktop' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 px-2"
                onClick={() => setPreviewMode('desktop')}
              >
                <Monitor className="h-4 w-4" />
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={() => window.open(`/f/${funnel?.slug}`, '_blank')}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Visualizar
            </Button>
            <Button onClick={saveChanges} disabled={saving} size="sm">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Components Palette */}
        <div className="w-64 border-r bg-card flex flex-col shrink-0">
          <div className="p-3 border-b">
            <h3 className="font-semibold text-sm">Componentes</h3>
            <p className="text-xs text-muted-foreground">Arraste para adicionar</p>
          </div>
          
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-4">
              {/* Inputs */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Campos</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {COMPONENT_TYPES.filter(c => c.category === 'input').map(comp => {
                    const Icon = comp.icon;
                    return (
                      <button
                        key={comp.type}
                        draggable
                        onDragStart={() => handleDragStart(comp.type)}
                        onDragEnd={handleDragEnd}
                        onClick={() => addField(comp.type)}
                        className="p-2.5 text-left rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-all cursor-grab active:cursor-grabbing"
                      >
                        <Icon className="h-4 w-4 text-primary mb-1" />
                        <p className="text-[11px] font-medium truncate">{comp.label}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Choices */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Escolhas</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {COMPONENT_TYPES.filter(c => c.category === 'choice').map(comp => {
                    const Icon = comp.icon;
                    return (
                      <button
                        key={comp.type}
                        draggable
                        onDragStart={() => handleDragStart(comp.type)}
                        onDragEnd={handleDragEnd}
                        onClick={() => addField(comp.type)}
                        className="p-2.5 text-left rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-all cursor-grab active:cursor-grabbing"
                      >
                        <Icon className="h-4 w-4 text-primary mb-1" />
                        <p className="text-[11px] font-medium truncate">{comp.label}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Special */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Especiais</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {COMPONENT_TYPES.filter(c => c.category === 'special' || c.category === 'layout').map(comp => {
                    const Icon = comp.icon;
                    return (
                      <button
                        key={comp.type}
                        draggable
                        onDragStart={() => handleDragStart(comp.type)}
                        onDragEnd={handleDragEnd}
                        onClick={() => addField(comp.type)}
                        className="p-2.5 text-left rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-all cursor-grab active:cursor-grabbing"
                      >
                        <Icon className="h-4 w-4 text-primary mb-1" />
                        <p className="text-[11px] font-medium truncate">{comp.label}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>

        {/* Center - Canvas */}
        <div className="flex-1 flex flex-col min-w-0 bg-white">
          {/* Step Navigation */}
          <div className="border-b bg-muted/30 px-4 py-3">
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {steps.map((step, index) => (
                <button
                  key={step.id}
                  onClick={() => {
                    setSelectedStepIndex(index);
                    setSelectedFieldId(null);
                  }}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all whitespace-nowrap shrink-0",
                    selectedStepIndex === index
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border bg-card hover:border-primary/50"
                  )}
                >
                  <span className="w-6 h-6 rounded-full bg-current/10 flex items-center justify-center text-xs font-bold">
                    {index + 1}
                  </span>
                  <span className="text-sm font-medium">{step.title || `Etapa ${index + 1}`}</span>
                  {steps.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteStep(index);
                      }}
                      className="ml-1 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </button>
              ))}
              
              {/* Add Step Button */}
              <button
                onClick={addStep}
                className="flex items-center justify-center w-10 h-10 rounded-lg border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-all shrink-0"
              >
                <Plus className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Canvas Area */}
          <div className="flex-1 flex items-start justify-center p-6 overflow-auto">
            <div 
              ref={canvasRef}
              className={cn(
                "bg-card rounded-2xl shadow-xl border transition-all min-h-[500px]",
                previewMode === 'mobile' ? 'w-[390px]' : 'w-full max-w-2xl'
              )}
              onDrop={handleCanvasDrop}
              onDragOver={handleCanvasDragOver}
            >
              {/* Step Header - Editable */}
              <div className="p-6 border-b">
                <input
                  type="text"
                  value={currentStep?.title || ''}
                  onChange={(e) => updateCurrentStep({ title: e.target.value })}
                  placeholder="Título da etapa..."
                  className="text-xl font-bold w-full bg-transparent border-none outline-none focus:ring-0 placeholder:text-muted-foreground/50"
                />
                <input
                  type="text"
                  value={currentStep?.description || ''}
                  onChange={(e) => updateCurrentStep({ description: e.target.value })}
                  placeholder="Descrição opcional..."
                  className="text-sm text-muted-foreground w-full bg-transparent border-none outline-none focus:ring-0 mt-1 placeholder:text-muted-foreground/40"
                />
              </div>

              {/* Fields Canvas */}
              <div className="p-6 space-y-4">
                {currentFields.length === 0 ? (
                  <div 
                    className={cn(
                      "border-2 border-dashed rounded-xl p-8 text-center transition-colors",
                      draggedComponent ? "border-primary bg-primary/5" : "border-muted-foreground/20"
                    )}
                  >
                    <Plus className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">
                      Arraste componentes aqui ou clique na paleta
                    </p>
                  </div>
                ) : (
                  currentFields.map((field, index) => (
                    <CanvasField
                      key={field.id}
                      field={field}
                      isSelected={selectedFieldId === field.id}
                      onSelect={() => setSelectedFieldId(field.id)}
                      onUpdate={(updates) => updateField(field.id, updates)}
                      onDelete={() => deleteField(field.id)}
                      onMoveUp={() => moveField(field.id, 'up')}
                      onMoveDown={() => moveField(field.id, 'down')}
                      isFirst={index === 0}
                      isLast={index === currentFields.length - 1}
                      steps={steps}
                    />
                  ))
                )}

                {currentFields.length > 0 && (
                  <div 
                    className={cn(
                      "border-2 border-dashed rounded-lg p-4 text-center transition-colors",
                      draggedComponent ? "border-primary bg-primary/5" : "border-transparent hover:border-muted-foreground/20"
                    )}
                  >
                    <p className="text-xs text-muted-foreground">+ Solte componente aqui</p>
                  </div>
                )}
              </div>

              {/* Progress indicator */}
              <div className="p-6 border-t">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                  <span>Etapa {selectedStepIndex + 1} de {steps.length}</span>
                  <span>{Math.round(((selectedStepIndex + 1) / steps.length) * 100)}%</span>
                </div>
                <Progress value={((selectedStepIndex + 1) / steps.length) * 100} className="h-1.5" />
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Properties */}
        <div className="w-72 border-l bg-card flex flex-col shrink-0">
          <div className="p-3 border-b">
            <h3 className="font-semibold text-sm">
              {selectedField ? 'Propriedades' : 'Configurações'}
            </h3>
          </div>
          
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-4">
              {selectedField ? (
                <FieldPropertiesPanel
                  field={selectedField}
                  onUpdate={(updates) => updateField(selectedField.id, updates)}
                  onDelete={() => deleteField(selectedField.id)}
                  steps={steps}
                  currentStepIndex={selectedStepIndex}
                />
              ) : currentStep ? (
                <StepPropertiesPanel
                  step={currentStep}
                  onUpdate={updateCurrentStep}
                  onDuplicate={() => duplicateStep(selectedStepIndex)}
                />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Settings className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Selecione uma etapa</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
};

// Canvas Field Component - Interactive & Editable
const CanvasField: React.FC<{
  field: StepField;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<StepField>) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
  steps: FunnelStep[];
}> = ({ field, isSelected, onSelect, onUpdate, onDelete, onMoveUp, onMoveDown, isFirst, isLast, steps }) => {
  
  const renderFieldContent = () => {
    switch (field.type) {
      case 'heading':
        return (
          <input
            type="text"
            value={field.label}
            onChange={(e) => onUpdate({ label: e.target.value })}
            className={cn(
              "w-full bg-transparent border-none outline-none",
              field.size === 'lg' ? 'text-2xl font-bold' : field.size === 'sm' ? 'text-base font-semibold' : 'text-xl font-bold',
              field.align === 'center' ? 'text-center' : field.align === 'right' ? 'text-right' : 'text-left'
            )}
            placeholder="Digite o título..."
          />
        );
      
      case 'paragraph':
        return (
          <textarea
            value={field.label}
            onChange={(e) => onUpdate({ label: e.target.value })}
            className={cn(
              "w-full bg-transparent border-none outline-none resize-none text-muted-foreground",
              field.align === 'center' ? 'text-center' : field.align === 'right' ? 'text-right' : 'text-left'
            )}
            placeholder="Digite o texto..."
            rows={2}
          />
        );

      case 'single_choice':
      case 'multiple_choice':
        return (
          <div className="space-y-2">
            <p className="text-sm font-medium">{field.label}</p>
            {(field.options || []).map((opt, idx) => (
              <div key={idx} className="flex items-center gap-2 p-2.5 rounded-lg border bg-muted/30">
                <div className={cn(
                  "w-4 h-4 border-2 border-muted-foreground/50",
                  field.type === 'single_choice' ? 'rounded-full' : 'rounded'
                )} />
                <input
                  type="text"
                  value={opt}
                  onChange={(e) => {
                    const newOptions = [...(field.options || [])];
                    newOptions[idx] = e.target.value;
                    onUpdate({ options: newOptions });
                  }}
                  className="flex-1 bg-transparent border-none outline-none text-sm"
                />
              </div>
            ))}
          </div>
        );

      case 'image_choice':
        return (
          <div className="space-y-2">
            <p className="text-sm font-medium">{field.label}</p>
            <div className="grid grid-cols-2 gap-2">
              {(field.imageOptions || []).map((opt, idx) => (
                <div key={opt.id} className="border rounded-lg overflow-hidden bg-muted/30">
                  <div className="aspect-video bg-muted flex items-center justify-center">
                    {opt.imageUrl ? (
                      <img src={opt.imageUrl} alt={opt.label} className="w-full h-full object-cover" />
                    ) : (
                      <Upload className="h-6 w-6 text-muted-foreground/40" />
                    )}
                  </div>
                  <input
                    type="text"
                    value={opt.label}
                    onChange={(e) => {
                      const newOptions = [...(field.imageOptions || [])];
                      newOptions[idx] = { ...opt, label: e.target.value };
                      onUpdate({ imageOptions: newOptions });
                    }}
                    className="w-full p-2 text-xs bg-transparent border-none outline-none text-center"
                    placeholder="Legenda..."
                  />
                  {opt.nextStepId && (
                    <div className="px-2 pb-2">
                      <Badge variant="secondary" className="text-[10px] w-full justify-center">
                        <GitBranch className="h-3 w-3 mr-1" />
                        Vai para: {steps.find(s => s.id === opt.nextStepId)?.title || 'Etapa'}
                      </Badge>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );

      case 'rating':
        return (
          <div className="space-y-2">
            <p className="text-sm font-medium">{field.label}</p>
            <div className="flex gap-1 justify-center">
              {Array.from({ length: field.max || 5 }).map((_, idx) => (
                <Star key={idx} className="h-6 w-6 text-muted-foreground/40" />
              ))}
            </div>
          </div>
        );

      case 'textarea':
      case 'address':
        return (
          <div className="space-y-1.5">
            <p className="text-sm font-medium">{field.label}</p>
            <Textarea 
              placeholder={field.placeholder || 'Digite aqui...'} 
              className="bg-muted/30 pointer-events-none" 
              rows={2}
              readOnly 
            />
          </div>
        );

      default:
        return (
          <div className="space-y-1.5">
            <p className="text-sm font-medium">{field.label}</p>
            <Input 
              placeholder={field.placeholder || 'Digite aqui...'} 
              className="bg-muted/30 pointer-events-none" 
              readOnly 
            />
          </div>
        );
    }
  };

  return (
    <div
      onClick={onSelect}
      className={cn(
        "relative group rounded-xl p-4 transition-all cursor-pointer",
        isSelected 
          ? "ring-2 ring-primary bg-primary/5" 
          : "hover:bg-muted/50"
      )}
    >
      {/* Actions */}
      {isSelected && (
        <div className="absolute -top-3 right-2 flex items-center gap-1 bg-card border rounded-lg shadow-sm p-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
            disabled={isFirst}
          >
            <ChevronLeft className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
            disabled={isLast}
          >
            <ChevronRight className="h-3 w-3" />
          </Button>
          <Separator orientation="vertical" className="h-4" />
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-destructive hover:text-destructive"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      )}

      {renderFieldContent()}

      {field.required && field.type !== 'heading' && field.type !== 'paragraph' && (
        <span className="absolute top-2 right-2 text-red-500 text-xs">*</span>
      )}
    </div>
  );
};

// Field Properties Panel
const FieldPropertiesPanel: React.FC<{
  field: StepField;
  onUpdate: (updates: Partial<StepField>) => void;
  onDelete: () => void;
  steps: FunnelStep[];
  currentStepIndex: number;
}> = ({ field, onUpdate, onDelete, steps, currentStepIndex }) => {
  
  const isLayoutField = field.type === 'heading' || field.type === 'paragraph';

  return (
    <div className="space-y-4">
      {/* Field Type */}
      <div className="p-3 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-2">
          {(() => {
            const Icon = COMPONENT_TYPES.find(c => c.type === field.type)?.icon || Type;
            return <Icon className="h-4 w-4 text-primary" />;
          })()}
          <span className="text-sm font-medium">
            {COMPONENT_TYPES.find(c => c.type === field.type)?.label}
          </span>
        </div>
      </div>

      {/* Label */}
      <div className="space-y-1.5">
        <Label className="text-xs">Label</Label>
        <Input
          value={field.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          placeholder="Ex: Seu nome"
        />
      </div>

      {/* Placeholder (for input types) */}
      {!isLayoutField && field.type !== 'single_choice' && field.type !== 'multiple_choice' && 
       field.type !== 'image_choice' && field.type !== 'rating' && (
        <div className="space-y-1.5">
          <Label className="text-xs">Placeholder</Label>
          <Input
            value={field.placeholder || ''}
            onChange={(e) => onUpdate({ placeholder: e.target.value })}
            placeholder="Texto de ajuda..."
          />
        </div>
      )}

      {/* Size for headings */}
      {field.type === 'heading' && (
        <div className="space-y-1.5">
          <Label className="text-xs">Tamanho</Label>
          <Select value={field.size || 'md'} onValueChange={(v: any) => onUpdate({ size: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sm">Pequeno</SelectItem>
              <SelectItem value="md">Médio</SelectItem>
              <SelectItem value="lg">Grande</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Alignment */}
      {isLayoutField && (
        <div className="space-y-1.5">
          <Label className="text-xs">Alinhamento</Label>
          <div className="flex gap-1">
            <Button
              variant={field.align === 'left' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onUpdate({ align: 'left' })}
            >
              <AlignLeft className="h-4 w-4" />
            </Button>
            <Button
              variant={field.align === 'center' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onUpdate({ align: 'center' })}
            >
              <AlignCenter className="h-4 w-4" />
            </Button>
            <Button
              variant={field.align === 'right' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onUpdate({ align: 'right' })}
            >
              <AlignRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Required toggle */}
      {!isLayoutField && (
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div>
            <p className="text-sm font-medium">Obrigatório</p>
          </div>
          <Switch
            checked={field.required !== false}
            onCheckedChange={(checked) => onUpdate({ required: checked })}
          />
        </div>
      )}

      {/* Options for choice fields */}
      {(field.type === 'single_choice' || field.type === 'multiple_choice') && (
        <div className="space-y-2">
          <Label className="text-xs">Opções</Label>
          {(field.options || []).map((opt, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Input
                value={opt}
                onChange={(e) => {
                  const newOptions = [...(field.options || [])];
                  newOptions[idx] = e.target.value;
                  onUpdate({ options: newOptions });
                }}
                className="text-sm"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => {
                  const newOptions = (field.options || []).filter((_, i) => i !== idx);
                  onUpdate({ options: newOptions });
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => {
              const newOptions = [...(field.options || []), `Opção ${(field.options?.length || 0) + 1}`];
              onUpdate({ options: newOptions });
            }}
          >
            <Plus className="h-3 w-3 mr-1" />
            Adicionar
          </Button>
        </div>
      )}

      {/* Image Choice Options */}
      {field.type === 'image_choice' && (
        <div className="space-y-3">
          <Label className="text-xs">Opções de Imagem</Label>
          {(field.imageOptions || []).map((opt, idx) => (
            <div key={opt.id} className="p-3 border rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">Opção {idx + 1}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => {
                    const newOptions = (field.imageOptions || []).filter((_, i) => i !== idx);
                    onUpdate({ imageOptions: newOptions });
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              
              <Input
                value={opt.imageUrl}
                onChange={(e) => {
                  const newOptions = [...(field.imageOptions || [])];
                  newOptions[idx] = { ...opt, imageUrl: e.target.value };
                  onUpdate({ imageOptions: newOptions });
                }}
                placeholder="URL da imagem..."
                className="text-xs"
              />
              
              <Input
                value={opt.label}
                onChange={(e) => {
                  const newOptions = [...(field.imageOptions || [])];
                  newOptions[idx] = { ...opt, label: e.target.value };
                  onUpdate({ imageOptions: newOptions });
                }}
                placeholder="Legenda..."
                className="text-xs"
              />

              {/* Conditional Logic */}
              <div className="pt-2 border-t">
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1.5">
                  <GitBranch className="h-3 w-3" />
                  <span>Lógica Condicional</span>
                </div>
                <Select
                  value={opt.nextStepId || 'next'}
                  onValueChange={(v) => {
                    const newOptions = [...(field.imageOptions || [])];
                    newOptions[idx] = { ...opt, nextStepId: v === 'next' ? undefined : v };
                    onUpdate({ imageOptions: newOptions });
                  }}
                >
                  <SelectTrigger className="text-xs h-8">
                    <SelectValue placeholder="Ir para..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="next">Próxima etapa (padrão)</SelectItem>
                    {steps.filter((_, i) => i !== currentStepIndex).map(step => (
                      <SelectItem key={step.id} value={step.id}>
                        {step.title || `Etapa ${step.position}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => {
              const newOptions = [
                ...(field.imageOptions || []), 
                { id: `img-${Date.now()}`, imageUrl: '', label: `Opção ${(field.imageOptions?.length || 0) + 1}` }
              ];
              onUpdate({ imageOptions: newOptions });
            }}
          >
            <Plus className="h-3 w-3 mr-1" />
            Adicionar Imagem
          </Button>
        </div>
      )}

      {/* Rating max */}
      {field.type === 'rating' && (
        <div className="space-y-1.5">
          <Label className="text-xs">Máximo</Label>
          <Select
            value={String(field.max || 5)}
            onValueChange={(v) => onUpdate({ max: parseInt(v) })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5 estrelas</SelectItem>
              <SelectItem value="10">10 pontos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <Separator />

      <Button
        variant="destructive"
        size="sm"
        className="w-full"
        onClick={onDelete}
      >
        <Trash2 className="h-4 w-4 mr-2" />
        Remover Campo
      </Button>
    </div>
  );
};

// Step Properties Panel
const StepPropertiesPanel: React.FC<{
  step: FunnelStep;
  onUpdate: (updates: Partial<FunnelStep>) => void;
  onDuplicate: () => void;
}> = ({ step, onUpdate, onDuplicate }) => {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">Título da Etapa</Label>
        <Input
          value={step.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          placeholder="Ex: Suas informações"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Descrição</Label>
        <Textarea
          value={step.description}
          onChange={(e) => onUpdate({ description: e.target.value })}
          placeholder="Texto de apoio..."
          rows={2}
        />
      </div>

      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
        <div>
          <p className="text-sm font-medium">Obrigatório</p>
          <p className="text-xs text-muted-foreground">Usuário deve responder</p>
        </div>
        <Switch
          checked={step.required}
          onCheckedChange={(checked) => onUpdate({ required: checked })}
        />
      </div>

      <Separator />

      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={onDuplicate}
      >
        <Copy className="h-4 w-4 mr-2" />
        Duplicar Etapa
      </Button>
    </div>
  );
};

export default LeadFunnelBuilder;
