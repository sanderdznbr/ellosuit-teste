import React, { useState } from 'react';
import { Settings, Palette, Share2, Eye, Users, Filter, Zap, Clock, Plus, X, Bell, ArrowRight } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WorkflowGroup, WorkflowColumn } from './types';
import { FluxosBoardBackgroundPicker, BoardBackground } from './FluxosBoardBackgroundPicker';

interface BoardAutomation {
  id: string;
  trigger: 'card_added' | 'card_not_moved';
  trigger_config: { days?: number; column_id?: string };
  action: 'move_card' | 'notify' | 'assign' | 'add_label';
  action_config: { column_id?: string; user_id?: string; label?: string; message?: string };
  enabled: boolean;
}

interface FluxosSettingsSidebarProps {
  boardColor: string;
  boardName: string;
  boardBackground?: BoardBackground;
  group?: WorkflowGroup;
  columns: WorkflowColumn[];
  employees?: any[];
  onColorChange?: (color: string) => void;
  onBackgroundChange?: (bg: BoardBackground) => void;
}


export const FluxosSettingsSidebar: React.FC<FluxosSettingsSidebarProps> = ({
  boardColor, boardName, boardBackground, group, columns, employees = [], onColorChange, onBackgroundChange
}) => {
  const [automations, setAutomations] = useState<BoardAutomation[]>([
    {
      id: '1',
      trigger: 'card_added',
      trigger_config: {},
      action: 'notify',
      action_config: { message: 'Novo card adicionado' },
      enabled: true
    }
  ]);
  const [showAddAutomation, setShowAddAutomation] = useState(false);
  const [newTrigger, setNewTrigger] = useState<'card_added' | 'card_not_moved'>('card_added');
  const [newAction, setNewAction] = useState<'move_card' | 'notify' | 'assign' | 'add_label'>('notify');
  const [newDays, setNewDays] = useState('3');
  const [visibility, setVisibility] = useState<'private' | 'team' | 'public'>('team');

  const addAutomation = () => {
    const automation: BoardAutomation = {
      id: Date.now().toString(),
      trigger: newTrigger,
      trigger_config: newTrigger === 'card_not_moved' ? { days: parseInt(newDays) } : {},
      action: newAction,
      action_config: {},
      enabled: true
    };
    setAutomations([...automations, automation]);
    setShowAddAutomation(false);
  };

  const removeAutomation = (id: string) => {
    setAutomations(automations.filter(a => a.id !== id));
  };

  const toggleAutomation = (id: string) => {
    setAutomations(automations.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a));
  };

  const getTriggerLabel = (trigger: string, config: any) => {
    if (trigger === 'card_added') return 'Quando um card é adicionado';
    if (trigger === 'card_not_moved') return `Quando card não é movido em ${config.days || 3} dias`;
    return trigger;
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      move_card: 'Mover card para coluna',
      notify: 'Enviar notificação',
      assign: 'Atribuir a membro',
      add_label: 'Adicionar etiqueta'
    };
    return labels[action] || action;
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="rounded-xl h-9 w-9">
          <Settings className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[440px] p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4">
          <SheetTitle className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: boardColor }} />
            <div>
              <span className="text-base">{boardName}</span>
              {group && <p className="text-xs text-muted-foreground font-normal">{group.name}</p>}
            </div>
          </SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="settings" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-6 grid grid-cols-3 rounded-xl bg-muted/50 p-1 shrink-0">
            <TabsTrigger value="settings" className="rounded-lg text-xs">Geral</TabsTrigger>
            <TabsTrigger value="members" className="rounded-lg text-xs">Membros</TabsTrigger>
            <TabsTrigger value="automations" className="rounded-lg text-xs">Automações</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 mt-4">
            {/* General Settings */}
            <TabsContent value="settings" className="px-6 pb-6 space-y-6 mt-0">
              {/* Background Customization */}
              <div>
                <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
                  <Palette className="h-4 w-4" /> Tela de Fundo
                </h4>
                <FluxosBoardBackgroundPicker
                  currentBackground={boardBackground || { type: 'solid', value: boardColor }}
                  onBackgroundChange={(bg) => {
                    onBackgroundChange?.(bg);
                    if (bg.type === 'solid') onColorChange?.(bg.value);
                  }}
                  onClose={() => {}}
                />
              </div>

              <Separator />

              {/* Visibility */}
              <div>
                <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
                  <Eye className="h-4 w-4" /> Visibilidade
                </h4>
                <div className="space-y-2">
                  {(['private', 'team', 'public'] as const).map(v => (
                    <button
                      key={v}
                      onClick={() => setVisibility(v)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl text-sm transition-all ${visibility === v ? 'bg-primary/10 border border-primary/30' : 'bg-muted/50 border border-transparent hover:bg-muted'}`}
                    >
                      <div className={`w-2 h-2 rounded-full ${visibility === v ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
                      <div className="text-left">
                        <span className="font-medium">{v === 'private' ? 'Privado' : v === 'team' ? 'Equipe' : 'Público'}</span>
                        <p className="text-[11px] text-muted-foreground">
                          {v === 'private' ? 'Apenas você pode ver' : v === 'team' ? 'Membros da equipe' : 'Qualquer pessoa com o link'}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Sharing */}
              <div>
                <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
                  <Share2 className="h-4 w-4" /> Compartilhamento
                </h4>
                <div className="flex gap-2">
                  <Input placeholder="Email para convidar..." className="rounded-xl h-10 flex-1" />
                  <Button size="sm" className="rounded-xl h-10">Convidar</Button>
                </div>
              </div>

              <Separator />

              {/* Filters */}
              <div>
                <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
                  <Filter className="h-4 w-4" /> Filtros
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Mostrar cards concluídos</span>
                    <Switch />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Filtrar por membro</span>
                    <Switch />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Filtrar por prioridade</span>
                    <Switch />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Members */}
            <TabsContent value="members" className="px-6 pb-6 space-y-4 mt-0">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Users className="h-4 w-4" /> Participantes
              </h4>

              <div className="flex gap-2">
                <Input placeholder="Adicionar por email..." className="rounded-xl h-10 flex-1" />
                <Button size="sm" className="rounded-xl h-10"><Plus className="h-4 w-4" /></Button>
              </div>

              <div className="space-y-2">
                {employees.slice(0, 10).map(emp => {
                  const initials = emp.name ? emp.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : '??';
                  return (
                    <div key={emp.user_id} className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/50">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">{initials}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{emp.name}</p>
                        {emp.email && <p className="text-[11px] text-muted-foreground truncate">{emp.email}</p>}
                      </div>
                      <Badge variant="secondary" className="text-[10px] rounded-lg">Membro</Badge>
                    </div>
                  );
                })}
                {employees.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhum membro encontrado</p>
                )}
              </div>
            </TabsContent>

            {/* Automations */}
            <TabsContent value="automations" className="px-6 pb-6 space-y-4 mt-0">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Zap className="h-4 w-4" /> Automações
                </h4>
                <Button size="sm" variant="outline" className="rounded-xl h-8 text-xs gap-1" onClick={() => setShowAddAutomation(true)}>
                  <Plus className="h-3.5 w-3.5" /> Nova
                </Button>
              </div>

              {/* Existing automations */}
              <div className="space-y-3">
                {automations.map(auto => (
                  <div key={auto.id} className={`p-3 rounded-xl border transition-all ${auto.enabled ? 'bg-card border-border' : 'bg-muted/30 border-border/40 opacity-60'}`}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-1">
                          <Bell className="h-3 w-3" />
                          Gatilho
                        </div>
                        <p className="text-sm">{getTriggerLabel(auto.trigger, auto.trigger_config)}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Switch checked={auto.enabled} onCheckedChange={() => toggleAutomation(auto.id)} />
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-lg" onClick={() => removeAutomation(auto.id)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <div>
                        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-0.5">
                          <Zap className="h-3 w-3" /> Ação
                        </div>
                        <p className="text-sm">{getActionLabel(auto.action)}</p>
                      </div>
                    </div>
                  </div>
                ))}

                {automations.length === 0 && !showAddAutomation && (
                  <div className="text-center py-8">
                    <Zap className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Nenhuma automação configurada</p>
                    <p className="text-xs text-muted-foreground mt-1">Crie regras para automatizar ações nos cards</p>
                  </div>
                )}
              </div>

              {/* Add automation form */}
              {showAddAutomation && (
                <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-4">
                  <h5 className="text-sm font-semibold">Nova Automação</h5>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Quando...</label>
                    <Select value={newTrigger} onValueChange={(v: any) => setNewTrigger(v)}>
                      <SelectTrigger className="rounded-xl h-10"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="card_added" className="rounded-lg">Um card é adicionado</SelectItem>
                        <SelectItem value="card_not_moved" className="rounded-lg">Card não movido em X dias</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {newTrigger === 'card_not_moved' && (
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Dias sem movimentação</label>
                      <div className="flex items-center gap-2">
                        <Input type="number" value={newDays} onChange={e => setNewDays(e.target.value)} className="rounded-xl h-10 w-20" min="1" />
                        <span className="text-sm text-muted-foreground">dias</span>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Então...</label>
                    <Select value={newAction} onValueChange={(v: any) => setNewAction(v)}>
                      <SelectTrigger className="rounded-xl h-10"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="notify" className="rounded-lg">Enviar notificação</SelectItem>
                        <SelectItem value="move_card" className="rounded-lg">Mover card para coluna</SelectItem>
                        <SelectItem value="assign" className="rounded-lg">Atribuir a membro</SelectItem>
                        <SelectItem value="add_label" className="rounded-lg">Adicionar etiqueta</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="ghost" className="rounded-xl" onClick={() => setShowAddAutomation(false)}>Cancelar</Button>
                    <Button size="sm" className="rounded-xl" onClick={addAutomation}>Criar Automação</Button>
                  </div>
                </div>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};
