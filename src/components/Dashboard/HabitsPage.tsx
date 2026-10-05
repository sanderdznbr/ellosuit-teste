import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCompanyEmployees } from '@/hooks/useCompanyEmployees';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus, Repeat, Clock, Calendar, User, Trash2, Edit2, MoreVertical,
  Loader2, Zap, CheckSquare, Video, MessageCircle, Search, Target,
  Sunrise, Moon, Sun, Filter,
} from 'lucide-react';
import { toast } from 'sonner';

const SUITE_COLOR = '#374DA4';

const DAYS_OF_WEEK = [
  { value: 0, label: 'Dom', short: 'D' },
  { value: 1, label: 'Seg', short: 'S' },
  { value: 2, label: 'Ter', short: 'T' },
  { value: 3, label: 'Qua', short: 'Q' },
  { value: 4, label: 'Qui', short: 'Q' },
  { value: 5, label: 'Sex', short: 'S' },
  { value: 6, label: 'Sáb', short: 'S' },
];

const FREQUENCY_LABELS: Record<string, string> = {
  daily: 'Diário',
  weekly: 'Semanal',
  monthly: 'Mensal',
};

const PRIORITY_CONFIG: Record<string, { label: string; class: string }> = {
  low: { label: 'Baixa', class: 'bg-emerald-100 text-emerald-700' },
  medium: { label: 'Média', class: 'bg-amber-100 text-amber-700' },
  high: { label: 'Alta', class: 'bg-red-100 text-red-700' },
};

const ACTION_TYPES = [
  { value: 'task', label: 'Criar Tarefa', icon: CheckSquare, description: 'Adiciona à lista de tarefas e agenda' },
  { value: 'meeting', label: 'Criar Reunião', icon: Video, description: 'Gera link de reunião ElloMeeting' },
  { value: 'whatsapp', label: 'Enviar WhatsApp', icon: MessageCircle, description: 'Envia mensagem via WhatsApp' },
];

interface Routine {
  id: string;
  title: string;
  description: string | null;
  assigned_user_id: string | null;
  frequency: string;
  days_of_week: number[] | null;
  day_of_month: number | null;
  time_of_day: string | null;
  duration_minutes: number | null;
  priority: string | null;
  color: string | null;
  is_active: boolean | null;
  created_by: string;
  created_at: string | null;
  last_run_at: string | null;
  next_run_at: string | null;
}

const defaultForm = {
  title: '',
  description: '',
  assigned_user_id: '_self',
  frequency: 'daily',
  days_of_week: [1, 2, 3, 4, 5] as number[],
  day_of_month: 1,
  time_of_day: '09:00',
  duration_minutes: 60,
  priority: 'medium',
  color: SUITE_COLOR,
  action_type: 'task',
};

const HabitsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { employees, companyId } = useCompanyEmployees();
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterFreq, setFilterFreq] = useState<string>('all');
  const [filterAssignee, setFilterAssignee] = useState<string>('all');

  const loadRoutines = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('task_routines')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setRoutines((data as Routine[]) || []);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar hábitos');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (companyId) loadRoutines();
  }, [companyId, loadRoutines]);

  const openNew = () => {
    setEditingId(null);
    setForm(defaultForm);
    setDialogOpen(true);
  };

  const openEdit = (r: Routine) => {
    setEditingId(r.id);
    setForm({
      title: r.title,
      description: r.description || '',
      assigned_user_id: r.assigned_user_id || '_self',
      frequency: r.frequency,
      days_of_week: r.days_of_week || [1, 2, 3, 4, 5],
      day_of_month: r.day_of_month || 1,
      time_of_day: r.time_of_day?.slice(0, 5) || '09:00',
      duration_minutes: r.duration_minutes || 60,
      priority: r.priority || 'medium',
      color: r.color || SUITE_COLOR,
      action_type: 'task',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !companyId || !user) {
      toast.error('Preencha o título do hábito');
      return;
    }
    setSaving(true);
    try {
      const data = {
        company_id: companyId,
        created_by: user.id,
        title: form.title,
        description: form.description || null,
        assigned_user_id: form.assigned_user_id === '_self' ? null : (form.assigned_user_id || null),
        frequency: form.frequency,
        days_of_week: form.frequency === 'weekly' ? form.days_of_week : null,
        day_of_month: form.frequency === 'monthly' ? form.day_of_month : null,
        time_of_day: form.time_of_day + ':00',
        duration_minutes: form.duration_minutes,
        priority: form.priority,
        color: form.color,
        is_active: true,
      };

      if (editingId) {
        const { error } = await supabase.from('task_routines').update(data).eq('id', editingId);
        if (error) throw error;
        toast.success('Hábito atualizado!');
      } else {
        const { error } = await supabase.from('task_routines').insert(data);
        if (error) throw error;
        toast.success('Hábito criado com sucesso!');
      }
      setDialogOpen(false);
      loadRoutines();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (id: string, current: boolean) => {
    try {
      await supabase.from('task_routines').update({ is_active: !current }).eq('id', id);
      setRoutines(prev => prev.map(r => r.id === id ? { ...r, is_active: !current } : r));
      toast.success(!current ? 'Hábito ativado' : 'Hábito pausado');
    } catch { toast.error('Erro'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este hábito permanentemente?')) return;
    try {
      await supabase.from('task_routines').delete().eq('id', id);
      setRoutines(prev => prev.filter(r => r.id !== id));
      toast.success('Hábito excluído');
    } catch { toast.error('Erro ao excluir'); }
  };

  const toggleDay = (day: number) => {
    setForm(prev => ({
      ...prev,
      days_of_week: prev.days_of_week.includes(day)
        ? prev.days_of_week.filter(d => d !== day)
        : [...prev.days_of_week, day].sort(),
    }));
  };

  const getEmployeeName = (userId: string | null) => {
    if (!userId) return null;
    if (userId === user?.id) return 'Você';
    const emp = employees.find(e => e.user_id === userId);
    return emp?.name || 'Colaborador';
  };

  const getTimeIcon = (time: string | null) => {
    if (!time) return Sun;
    const hour = parseInt(time.split(':')[0]);
    if (hour < 12) return Sunrise;
    if (hour < 18) return Sun;
    return Moon;
  };

  const formatSchedule = (r: Routine) => {
    const time = r.time_of_day?.slice(0, 5) || '00:00';
    if (r.frequency === 'daily') return `Todo dia às ${time}`;
    if (r.frequency === 'weekly') {
      const days = (r.days_of_week || []).map(d => DAYS_OF_WEEK.find(x => x.value === d)?.label).join(', ');
      return `${days} às ${time}`;
    }
    if (r.frequency === 'monthly') return `Dia ${r.day_of_month} de cada mês às ${time}`;
    return time;
  };

  // Filter routines
  const filtered = routines.filter(r => {
    if (searchQuery && !r.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filterFreq !== 'all' && r.frequency !== filterFreq) return false;
    if (filterAssignee === 'mine' && r.assigned_user_id && r.assigned_user_id !== user?.id) return false;
    if (filterAssignee === 'team' && (!r.assigned_user_id || r.assigned_user_id === user?.id)) return false;
    return true;
  });

  const activeCount = routines.filter(r => r.is_active).length;
  const dailyCount = routines.filter(r => r.frequency === 'daily').length;
  const teamCount = routines.filter(r => r.assigned_user_id && r.assigned_user_id !== user?.id).length;

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl" style={{ backgroundColor: SUITE_COLOR + '15' }}>
              <Target className="h-6 w-6" style={{ color: SUITE_COLOR }} />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Criar Hábitos</h1>
              <p className="text-muted-foreground text-sm">Rotinas automáticas para tarefas, reuniões e mensagens</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => navigate('/dashboard/habitos/builder')} className="gap-2 rounded-xl text-white" style={{ backgroundColor: SUITE_COLOR }}>
            <Plus className="h-4 w-4" /> Criar Hábito
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total', count: routines.length, icon: Repeat },
          { label: 'Ativos', count: activeCount, icon: Zap },
          { label: 'Diários', count: dailyCount, icon: Sunrise },
          { label: 'Da Equipe', count: teamCount, icon: User },
        ].map(s => (
          <Card key={s.label} className="border shadow-sm rounded-2xl">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-xl" style={{ backgroundColor: SUITE_COLOR + '12' }}>
                <s.icon className="h-4 w-4" style={{ color: SUITE_COLOR }} />
              </div>
              <div>
                <p className="text-xl font-bold">{s.count}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar hábitos..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10 rounded-xl"
          />
        </div>
        <Select value={filterFreq} onValueChange={setFilterFreq}>
          <SelectTrigger className="w-[140px] rounded-xl">
            <SelectValue placeholder="Frequência" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all" className="rounded-lg">Todas</SelectItem>
            <SelectItem value="daily" className="rounded-lg">Diária</SelectItem>
            <SelectItem value="weekly" className="rounded-lg">Semanal</SelectItem>
            <SelectItem value="monthly" className="rounded-lg">Mensal</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterAssignee} onValueChange={setFilterAssignee}>
          <SelectTrigger className="w-[140px] rounded-xl">
            <SelectValue placeholder="Atribuição" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all" className="rounded-lg">Todos</SelectItem>
            <SelectItem value="mine" className="rounded-lg">Meus</SelectItem>
            <SelectItem value="team" className="rounded-lg">Equipe</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Routines list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="rounded-2xl border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-4 rounded-2xl mb-4" style={{ backgroundColor: SUITE_COLOR + '10' }}>
              <Target className="h-10 w-10" style={{ color: SUITE_COLOR }} />
            </div>
            <h3 className="text-lg font-semibold mb-1">
              {searchQuery || filterFreq !== 'all' ? 'Nenhum hábito encontrado' : 'Crie seu primeiro hábito'}
            </h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm">
              Automatize rotinas diárias como criar tarefas, agendar reuniões ou enviar mensagens para sua equipe.
            </p>
            {!searchQuery && filterFreq === 'all' && (
              <Button onClick={() => navigate('/dashboard/habitos/builder')} className="rounded-xl gap-2 text-white" style={{ backgroundColor: SUITE_COLOR }}>
                <Plus className="h-4 w-4" /> Criar Hábito
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => {
            const TimeIcon = getTimeIcon(r.time_of_day);
            const priority = PRIORITY_CONFIG[r.priority || 'medium'];
            const assigneeName = getEmployeeName(r.assigned_user_id);
            return (
              <Card key={r.id} className={`rounded-2xl border shadow-sm transition-all ${!r.is_active ? 'opacity-50' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div
                        className="p-2.5 rounded-xl mt-0.5 shrink-0"
                        style={{ backgroundColor: (r.color || SUITE_COLOR) + '15' }}
                      >
                        <Repeat className="h-5 w-5" style={{ color: r.color || SUITE_COLOR }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-sm truncate">{r.title}</h3>
                          <Badge className={`text-[10px] ${priority.class}`}>{priority.label}</Badge>
                          <Badge variant="outline" className="text-[10px] gap-1">
                            <Repeat className="h-3 w-3" />
                            {FREQUENCY_LABELS[r.frequency] || r.frequency}
                          </Badge>
                        </div>
                        {r.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{r.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <TimeIcon className="h-3.5 w-3.5" />
                            {formatSchedule(r)}
                          </span>
                          {assigneeName && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <User className="h-3.5 w-3.5" />
                              {assigneeName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Switch
                        checked={!!r.is_active}
                        onCheckedChange={() => handleToggleActive(r.id, !!r.is_active)}
                      />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl">
                          <DropdownMenuItem onClick={() => navigate(`/dashboard/habitos/builder?id=${r.id}`)} className="gap-2 rounded-lg">
                            <Zap className="h-4 w-4" /> Abrir no Builder
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEdit(r)} className="gap-2 rounded-lg">
                            <Edit2 className="h-4 w-4" /> Editar Rápido
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(r.id)} className="gap-2 text-destructive rounded-lg">
                            <Trash2 className="h-4 w-4" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg rounded-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-2 rounded-xl" style={{ backgroundColor: SUITE_COLOR + '15' }}>
                <Target className="h-5 w-5" style={{ color: SUITE_COLOR }} />
              </div>
              {editingId ? 'Editar Hábito' : 'Novo Hábito'}
            </DialogTitle>
            <DialogDescription>
              Configure uma rotina automática que será executada no horário definido.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-5 py-2">
              {/* Action type */}
              <div>
                <Label className="text-sm font-semibold mb-2 block">Tipo de Ação</Label>
                <div className="grid grid-cols-3 gap-2">
                  {ACTION_TYPES.map(a => {
                    const Icon = a.icon;
                    const selected = form.action_type === a.value;
                    return (
                      <button
                        key={a.value}
                        onClick={() => setForm(prev => ({ ...prev, action_type: a.value }))}
                        className={`p-3 rounded-xl border-2 transition-all text-center ${
                          selected ? 'border-current' : 'border-transparent bg-muted/50 hover:bg-muted'
                        }`}
                        style={selected ? { borderColor: SUITE_COLOR, backgroundColor: SUITE_COLOR + '08' } : {}}
                      >
                        <Icon className="h-5 w-5 mx-auto mb-1" style={selected ? { color: SUITE_COLOR } : {}} />
                        <span className="text-xs font-medium">{a.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <Separator />

              {/* Title */}
              <div>
                <Label>Título *</Label>
                <Input
                  value={form.title}
                  onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Ex: Standup diário, Relatório semanal..."
                  className="mt-1.5 rounded-xl"
                />
              </div>

              {/* Description */}
              <div>
                <Label>Descrição</Label>
                <Textarea
                  value={form.description}
                  onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Descreva o que essa rotina faz..."
                  rows={2}
                  className="mt-1.5 rounded-xl resize-none"
                />
              </div>

              {/* Assign to */}
              <div>
                <Label>Atribuir a</Label>
                <Select
                  value={form.assigned_user_id}
                  onValueChange={v => setForm(prev => ({ ...prev, assigned_user_id: v }))}
                >
                  <SelectTrigger className="mt-1.5 rounded-xl">
                    <SelectValue placeholder="Para mim (padrão)" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="_self" className="rounded-lg">Para mim</SelectItem>
                    {employees.filter(e => e.user_id !== user?.id).map(emp => (
                      <SelectItem key={emp.user_id} value={emp.user_id} className="rounded-lg">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          {emp.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Frequency + Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Frequência</Label>
                  <Select
                    value={form.frequency}
                    onValueChange={v => setForm(prev => ({ ...prev, frequency: v }))}
                  >
                    <SelectTrigger className="mt-1.5 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="daily" className="rounded-lg">Diária</SelectItem>
                      <SelectItem value="weekly" className="rounded-lg">Semanal</SelectItem>
                      <SelectItem value="monthly" className="rounded-lg">Mensal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Horário</Label>
                  <div className="relative mt-1.5">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="time"
                      value={form.time_of_day}
                      onChange={e => setForm(prev => ({ ...prev, time_of_day: e.target.value }))}
                      className="pl-10 rounded-xl"
                    />
                  </div>
                </div>
              </div>

              {/* Weekly days */}
              {form.frequency === 'weekly' && (
                <div>
                  <Label>Dias da semana</Label>
                  <div className="flex gap-2 mt-2">
                    {DAYS_OF_WEEK.map(day => (
                      <button
                        key={day.value}
                        onClick={() => toggleDay(day.value)}
                        className="w-10 h-10 rounded-xl text-sm font-medium transition-all"
                        style={
                          form.days_of_week.includes(day.value)
                            ? { backgroundColor: SUITE_COLOR, color: 'white' }
                            : {}
                        }
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Monthly day */}
              {form.frequency === 'monthly' && (
                <div>
                  <Label>Dia do mês</Label>
                  <Select
                    value={String(form.day_of_month)}
                    onValueChange={v => setForm(prev => ({ ...prev, day_of_month: Number(v) }))}
                  >
                    <SelectTrigger className="mt-1.5 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl max-h-48">
                      {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                        <SelectItem key={d} value={String(d)} className="rounded-lg">Dia {d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Priority + Duration */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Prioridade</Label>
                  <Select
                    value={form.priority}
                    onValueChange={v => setForm(prev => ({ ...prev, priority: v }))}
                  >
                    <SelectTrigger className="mt-1.5 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="low" className="rounded-lg">🟢 Baixa</SelectItem>
                      <SelectItem value="medium" className="rounded-lg">🟡 Média</SelectItem>
                      <SelectItem value="high" className="rounded-lg">🔴 Alta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Duração (min)</Label>
                  <Input
                    type="number"
                    value={form.duration_minutes}
                    onChange={e => setForm(prev => ({ ...prev, duration_minutes: Number(e.target.value) }))}
                    min={15}
                    step={15}
                    className="mt-1.5 rounded-xl"
                  />
                </div>
              </div>
            </div>
          </ScrollArea>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="rounded-xl gap-2"
              style={{ backgroundColor: SUITE_COLOR }}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              {editingId ? 'Salvar' : 'Criar Hábito'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HabitsPage;
