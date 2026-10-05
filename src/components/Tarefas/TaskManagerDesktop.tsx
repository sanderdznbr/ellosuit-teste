import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Plus, ArrowLeft, Search, Filter, Clock, CheckCircle, 
  Circle, User, Repeat, Calendar, MoreHorizontal, Trash2, Edit2,
  Users, ChevronRight, Loader2
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useCompanyEmployees } from '@/hooks/useCompanyEmployees';
import { useTarefas } from '@/hooks/useTarefas';
import NovoLembreteModal from './NovoLembreteModal';
import TaskRoutineModal from './TaskRoutineModal';
import { format, parseISO, isToday, isTomorrow, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const priorityConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  low: { label: 'Baixa', color: 'text-emerald-600', bgColor: 'bg-emerald-100' },
  medium: { label: 'Média', color: 'text-amber-600', bgColor: 'bg-amber-100' },
  high: { label: 'Alta', color: 'text-rose-600', bgColor: 'bg-rose-100' }
};

const TaskManagerDesktop = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { employees, companyId, loading: loadingEmployees } = useCompanyEmployees();
  const { tarefas, loading: loadingTarefas, createTarefa, updateTarefa, deleteTarefa, refreshEvents } = useTarefas();

  const [activeTab, setActiveTab] = useState('minhas');
  const [filterEmployee, setFilterEmployee] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRoutineModal, setShowRoutineModal] = useState(false);
  const [routines, setRoutines] = useState<any[]>([]);
  const [editingRoutine, setEditingRoutine] = useState<any>(null);
  const [assignedTasks, setAssignedTasks] = useState<any[]>([]);

  useEffect(() => {
    if (companyId) {
      loadRoutines();
      loadAssignedTasks();
    }
  }, [companyId]);

  const loadRoutines = async () => {
    if (!companyId) return;

    const { data, error } = await supabase
      .from('task_routines')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setRoutines(data);
    }
  };

  const loadAssignedTasks = async () => {
    if (!companyId) return;

    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('company_id', companyId)
      .not('assigned_user_id', 'is', null)
      .order('start_date', { ascending: true });

    if (!error && data) {
      setAssignedTasks(data);
    }
  };

  const handleCreateTask = async (taskData: any) => {
    await createTarefa(taskData);
    setShowCreateModal(false);
  };

  const handleToggleComplete = async (task: any) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    await updateTarefa(task.id, { status: newStatus });
  };

  const handleDeleteRoutine = async (routineId: string) => {
    const { error } = await supabase
      .from('task_routines')
      .update({ is_active: false })
      .eq('id', routineId);

    if (!error) {
      toast({ title: 'Rotina removida!' });
      loadRoutines();
    }
  };

  const getFilteredTasks = () => {
    let filtered = activeTab === 'atribuidas' ? assignedTasks : tarefas;

    if (filterEmployee !== 'all') {
      filtered = filtered.filter((t: any) => t.assigned_user_id === filterEmployee);
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter((t: any) => t.status === filterStatus);
    }

    if (searchQuery) {
      filtered = filtered.filter((t: any) => 
        t.title?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return filtered;
  };

  const getEmployeeName = (userId: string) => {
    const emp = employees.find(e => e.user_id === userId);
    return emp?.name || 'Desconhecido';
  };

  const getEmployeeInitials = (userId: string) => {
    const emp = employees.find(e => e.user_id === userId);
    return emp?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '??';
  };

  const formatTaskDate = (dateString: string) => {
    try {
      const date = parseISO(dateString);
      if (isToday(date)) return 'Hoje';
      if (isTomorrow(date)) return 'Amanhã';
      return format(date, "dd 'de' MMM", { locale: ptBR });
    } catch {
      return '';
    }
  };

  const filteredTasks = getFilteredTasks();

  if (loadingTarefas || loadingEmployees) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => navigate('/dashboard')}
              className="rounded-xl"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Gerenciador de Tarefas</h1>
              <p className="text-muted-foreground">Gerencie e atribua tarefas à equipe</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              onClick={() => setShowRoutineModal(true)}
              className="rounded-xl"
            >
              <Repeat className="h-4 w-4 mr-2" />
              Nova Rotina
            </Button>
            <Button 
              onClick={() => setShowCreateModal(true)}
              className="rounded-xl"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nova Tarefa
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="rounded-2xl border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-[#DFE4FB] rounded-xl">
                  <CheckCircle className="h-5 w-5 text-[#2F428D]" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{tarefas.filter(t => t.status === 'completed').length}</p>
                  <p className="text-sm text-muted-foreground">Concluídas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-100 rounded-xl">
                  <Circle className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{tarefas.filter(t => t.status !== 'completed').length}</p>
                  <p className="text-sm text-muted-foreground">Pendentes</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-violet-100 rounded-xl">
                  <Users className="h-5 w-5 text-violet-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{assignedTasks.length}</p>
                  <p className="text-sm text-muted-foreground">Atribuídas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-100 rounded-xl">
                  <Repeat className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{routines.length}</p>
                  <p className="text-sm text-muted-foreground">Rotinas ativas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Tasks List */}
          <div className="lg:col-span-2">
            <Card className="rounded-2xl border-0 shadow-sm">
              <CardHeader className="pb-4">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <div className="flex items-center justify-between">
                    <TabsList className="bg-muted/50 rounded-xl">
                      <TabsTrigger value="minhas" className="rounded-lg">Minhas Tarefas</TabsTrigger>
                      <TabsTrigger value="atribuidas" className="rounded-lg">Atribuídas</TabsTrigger>
                    </TabsList>

                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Buscar..."
                          className="pl-9 w-48 rounded-xl h-9"
                        />
                      </div>

                      {activeTab === 'atribuidas' && (
                        <Select value={filterEmployee} onValueChange={setFilterEmployee}>
                          <SelectTrigger className="w-40 rounded-xl h-9">
                            <SelectValue placeholder="Funcionário" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            <SelectItem value="all" className="rounded-lg">Todos</SelectItem>
                            {employees.map((emp) => (
                              <SelectItem key={emp.user_id} value={emp.user_id} className="rounded-lg">
                                {emp.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}

                      <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger className="w-32 rounded-xl h-9">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="all" className="rounded-lg">Todos</SelectItem>
                          <SelectItem value="pending" className="rounded-lg">Pendentes</SelectItem>
                          <SelectItem value="completed" className="rounded-lg">Concluídas</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </Tabs>
              </CardHeader>

              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-2">
                    {filteredTasks.length === 0 ? (
                      <div className="text-center py-12">
                        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                          <CheckCircle className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <p className="text-muted-foreground">Nenhuma tarefa encontrada</p>
                      </div>
                    ) : (
                      filteredTasks.map((task: any) => {
                        const priority = priorityConfig[task.priority || 'medium'] || priorityConfig.medium;
                        const isOverdue = task.start_date && isPast(parseISO(task.start_date)) && task.status !== 'completed';

                        return (
                          <div
                            key={task.id}
                            className={`p-4 rounded-xl border transition-all hover:shadow-sm ${
                              task.status === 'completed' ? 'bg-muted/50 opacity-70' : 'bg-card'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <button
                                onClick={() => handleToggleComplete(task)}
                                className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                                  task.status === 'completed' 
                                    ? 'bg-primary border-primary text-primary-foreground' 
                                    : 'border-muted-foreground/40 hover:border-primary'
                                }`}
                              >
                                {task.status === 'completed' && <CheckCircle className="h-3 w-3" />}
                              </button>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className={`font-medium ${task.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
                                    {task.title}
                                  </p>
                                  <Badge className={`${priority.bgColor} ${priority.color} border-0 text-xs`}>
                                    {priority.label}
                                  </Badge>
                                  {isOverdue && (
                                    <Badge variant="destructive" className="text-xs">Atrasada</Badge>
                                  )}
                                </div>

                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                  {task.start_date && (
                                    <span className="flex items-center gap-1">
                                      <Calendar className="h-3.5 w-3.5" />
                                      {formatTaskDate(task.start_date)}
                                    </span>
                                  )}

                                  {task.assigned_user_id && (
                                    <span className="flex items-center gap-1">
                                      <Avatar className="h-5 w-5">
                                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                          {getEmployeeInitials(task.assigned_user_id)}
                                        </AvatarFallback>
                                      </Avatar>
                                      {getEmployeeName(task.assigned_user_id)}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="rounded-xl">
                                  <DropdownMenuItem className="rounded-lg">
                                    <Edit2 className="h-4 w-4 mr-2" />
                                    Editar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => deleteTarefa(task.id)}
                                    className="text-destructive rounded-lg"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Excluir
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Routines Sidebar */}
          <div>
            <Card className="rounded-2xl border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Repeat className="h-5 w-5 text-primary" />
                  Rotinas Automáticas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[450px]">
                  <div className="space-y-3">
                    {routines.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-sm text-muted-foreground">
                          Nenhuma rotina criada
                        </p>
                        <Button
                          variant="link"
                          onClick={() => setShowRoutineModal(true)}
                          className="mt-2"
                        >
                          Criar primeira rotina
                        </Button>
                      </div>
                    ) : (
                      routines.map((routine) => (
                        <div
                          key={routine.id}
                          className="p-4 rounded-xl border bg-card hover:shadow-sm transition-all"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-medium text-sm">{routine.title}</h4>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                  <MoreHorizontal className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="rounded-xl">
                                <DropdownMenuItem 
                                  onClick={() => {
                                    setEditingRoutine(routine);
                                    setShowRoutineModal(true);
                                  }}
                                  className="rounded-lg"
                                >
                                  <Edit2 className="h-4 w-4 mr-2" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleDeleteRoutine(routine.id)}
                                  className="text-destructive rounded-lg"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Remover
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>

                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant="outline" className="rounded-lg">
                              {routine.frequency === 'daily' && 'Diária'}
                              {routine.frequency === 'weekly' && 'Semanal'}
                              {routine.frequency === 'monthly' && 'Mensal'}
                            </Badge>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {routine.time_of_day?.slice(0, 5)}
                            </span>
                          </div>

                          {routine.assigned_user_id && (
                            <div className="flex items-center gap-1.5 mt-2 text-xs">
                              <User className="h-3 w-3 text-muted-foreground" />
                              <span>{getEmployeeName(routine.assigned_user_id)}</span>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showCreateModal && (
        <NovoLembreteModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSave={handleCreateTask}
        />
      )}

      <TaskRoutineModal
        open={showRoutineModal}
        onClose={() => {
          setShowRoutineModal(false);
          setEditingRoutine(null);
        }}
        routine={editingRoutine}
        onSaved={loadRoutines}
      />
    </div>
  );
};

export default TaskManagerDesktop;
