import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Clock, Repeat, User, Save, Loader2 } from 'lucide-react';
import { useCompanyEmployees } from '@/hooks/useCompanyEmployees';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface TaskRoutineModalProps {
  open: boolean;
  onClose: () => void;
  routine?: any;
  onSaved: () => void;
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Dom' },
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
];

const TaskRoutineModal: React.FC<TaskRoutineModalProps> = ({ open, onClose, routine, onSaved }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { employees, companyId } = useCompanyEmployees();
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assigned_user_id: '',
    frequency: 'daily',
    days_of_week: [] as number[],
    day_of_month: 1,
    time_of_day: '09:00',
    duration_minutes: 60,
    priority: 'medium',
    color: '#3600FF'
  });

  useEffect(() => {
    if (routine) {
      setFormData({
        title: routine.title || '',
        description: routine.description || '',
        assigned_user_id: routine.assigned_user_id || '',
        frequency: routine.frequency || 'daily',
        days_of_week: routine.days_of_week || [],
        day_of_month: routine.day_of_month || 1,
        time_of_day: routine.time_of_day?.slice(0, 5) || '09:00',
        duration_minutes: routine.duration_minutes || 60,
        priority: routine.priority || 'medium',
        color: routine.color || '#3600FF'
      });
    } else {
      setFormData({
        title: '',
        description: '',
        assigned_user_id: '',
        frequency: 'daily',
        days_of_week: [1, 2, 3, 4, 5], // Default weekdays
        day_of_month: 1,
        time_of_day: '09:00',
        duration_minutes: 60,
        priority: 'medium',
        color: '#3600FF'
      });
    }
  }, [routine, open]);

  const toggleDayOfWeek = (day: number) => {
    setFormData(prev => ({
      ...prev,
      days_of_week: prev.days_of_week.includes(day)
        ? prev.days_of_week.filter(d => d !== day)
        : [...prev.days_of_week, day].sort()
    }));
  };

  const handleSave = async () => {
    if (!formData.title || !companyId || !user) {
      toast({
        title: 'Erro',
        description: 'Preencha todos os campos obrigatórios',
        variant: 'destructive'
      });
      return;
    }

    setSaving(true);
    try {
      const routineData = {
        company_id: companyId,
        created_by: user.id,
        title: formData.title,
        description: formData.description || null,
        assigned_user_id: formData.assigned_user_id || null,
        frequency: formData.frequency,
        days_of_week: formData.frequency === 'weekly' ? formData.days_of_week : null,
        day_of_month: formData.frequency === 'monthly' ? formData.day_of_month : null,
        time_of_day: formData.time_of_day + ':00',
        duration_minutes: formData.duration_minutes,
        priority: formData.priority,
        color: formData.color,
        is_active: true
      };

      if (routine) {
        const { error } = await supabase
          .from('task_routines')
          .update(routineData)
          .eq('id', routine.id);

        if (error) throw error;
        toast({ title: 'Rotina atualizada com sucesso!' });
      } else {
        const { error } = await supabase
          .from('task_routines')
          .insert(routineData);

        if (error) throw error;
        toast({ title: 'Rotina criada com sucesso!' });
      }

      onSaved();
      onClose();
    } catch (error) {
      console.error('Error saving routine:', error);
      toast({
        title: 'Erro ao salvar rotina',
        variant: 'destructive'
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
              <Repeat className="h-5 w-5 text-primary" />
            </div>
            {routine ? 'Editar Rotina' : 'Nova Rotina de Tarefas'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div>
            <Label>Título da Tarefa *</Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Ex: Relatório diário, Backup semanal..."
              className="mt-1.5 rounded-xl"
            />
          </div>

          <div>
            <Label>Descrição</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Descreva a tarefa..."
              rows={2}
              className="mt-1.5 rounded-xl resize-none"
            />
          </div>

          <div>
            <Label>Atribuir a</Label>
            <Select 
              value={formData.assigned_user_id} 
              onValueChange={(v) => setFormData({ ...formData, assigned_user_id: v })}
            >
              <SelectTrigger className="mt-1.5 rounded-xl">
                <SelectValue placeholder="Selecione um funcionário" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="" className="rounded-lg">Nenhum (para mim)</SelectItem>
                {employees.map((emp) => (
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Frequência</Label>
              <Select 
                value={formData.frequency} 
                onValueChange={(v) => setFormData({ ...formData, frequency: v })}
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
                  value={formData.time_of_day}
                  onChange={(e) => setFormData({ ...formData, time_of_day: e.target.value })}
                  className="pl-10 rounded-xl"
                />
              </div>
            </div>
          </div>

          {formData.frequency === 'weekly' && (
            <div>
              <Label>Dias da semana</Label>
              <div className="flex gap-2 mt-2">
                {DAYS_OF_WEEK.map((day) => (
                  <button
                    key={day.value}
                    onClick={() => toggleDayOfWeek(day.value)}
                    className={`w-10 h-10 rounded-xl text-sm font-medium transition-all ${
                      formData.days_of_week.includes(day.value)
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-muted/80'
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {formData.frequency === 'monthly' && (
            <div>
              <Label>Dia do mês</Label>
              <Select 
                value={String(formData.day_of_month)} 
                onValueChange={(v) => setFormData({ ...formData, day_of_month: Number(v) })}
              >
                <SelectTrigger className="mt-1.5 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl max-h-48">
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                    <SelectItem key={d} value={String(d)} className="rounded-lg">Dia {d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Prioridade</Label>
              <Select 
                value={formData.priority} 
                onValueChange={(v) => setFormData({ ...formData, priority: v })}
              >
                <SelectTrigger className="mt-1.5 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="low" className="rounded-lg">Baixa</SelectItem>
                  <SelectItem value="medium" className="rounded-lg">Média</SelectItem>
                  <SelectItem value="high" className="rounded-lg">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Duração (minutos)</Label>
              <Input
                type="number"
                value={formData.duration_minutes}
                onChange={(e) => setFormData({ ...formData, duration_minutes: Number(e.target.value) })}
                min={15}
                step={15}
                className="mt-1.5 rounded-xl"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
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
                Salvar Rotina
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TaskRoutineModal;
