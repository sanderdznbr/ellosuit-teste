import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Target, Save, Play, ArrowLeft, Plus, Pause, Trash2, ChevronDown, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import HabitSidebar from './HabitSidebar';
import HabitCanvas from './HabitCanvas';
import HabitPropertiesPanel from './HabitPropertiesPanel';
import { HabitFlowNode, HabitFlowEdge, HabitBlockDefinition } from './types';

const SUITE_COLOR = '#374DA4';

interface HabitRoutine {
  id: string;
  company_id: string;
  title: string;
  description: string | null;
  frequency: string;
  is_active: boolean | null;
  created_by: string;
  created_at: string | null;
  // We store nodes/edges in description as JSON (or we can use the existing columns creatively)
  // For now we serialize flow data in a JSON string stored in description
}

// We'll store the flow graph as JSON in the task_routines.description field
// Format: { nodes: [...], edges: [...] }

const HabitFlowBuilder: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [routines, setRoutines] = useState<any[]>([]);
  const [currentRoutineId, setCurrentRoutineId] = useState<string | null>(searchParams.get('id'));
  const [nodes, setNodes] = useState<HabitFlowNode[]>([]);
  const [edges, setEdges] = useState<HabitFlowEdge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [flowName, setFlowName] = useState('Novo Hábito');
  const [isSaving, setIsSaving] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newName, setNewName] = useState('');

  // Get company
  useEffect(() => {
    const init = async () => {
      if (!user?.id) return;
      const { data } = await supabase.from('company_users').select('company_id').eq('user_id', user.id).single();
      if (data) setCompanyId(data.company_id);
    };
    init();
  }, [user?.id]);

  // Load routines
  useEffect(() => {
    if (!companyId) return;
    const load = async () => {
      const { data } = await supabase
        .from('task_routines')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (data) {
        setRoutines(data);
        const target = currentRoutineId ? data.find((r: any) => r.id === currentRoutineId) : data[0];
        if (target) selectRoutine(target);
      }
      setLoading(false);
    };
    load();
  }, [companyId]);

  const selectRoutine = (r: any) => {
    setCurrentRoutineId(r.id);
    setFlowName(r.title);
    setIsActive(!!r.is_active);
    // Parse flow data from description
    try {
      const flowData = r.description ? JSON.parse(r.description) : null;
      if (flowData?.nodes && flowData?.edges) {
        setNodes(flowData.nodes);
        setEdges(flowData.edges);
      } else {
        setNodes([]);
        setEdges([]);
      }
    } catch {
      setNodes([]);
      setEdges([]);
    }
    setSelectedNodeId(null);
  };

  const handleDragStart = useCallback((_block: HabitBlockDefinition) => {}, []);

  const handleNodeSelect = useCallback((node: HabitFlowNode | null) => {
    setSelectedNodeId(node?.id || null);
  }, []);

  const handleNodeUpdate = useCallback((nodeId: string, updates: Partial<HabitFlowNode>) => {
    setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, ...updates } : n));
  }, []);

  const computeNextRun = (frequency: string, triggerConfig: any): string => {
    const now = new Date();
    const timeStr = triggerConfig.time || '09:00';
    const [hours, minutes] = timeStr.split(':').map(Number);

    if (frequency === 'daily') {
      const next = new Date(now);
      // If time hasn't passed today, schedule for today; otherwise tomorrow
      next.setHours(hours, minutes, 0, 0);
      if (next <= now) next.setDate(next.getDate() + 1);
      return next.toISOString();
    }

    if (frequency === 'weekly') {
      const days: number[] = triggerConfig.days || [1];
      for (let i = 0; i <= 7; i++) {
        const candidate = new Date(now);
        candidate.setDate(candidate.getDate() + i);
        candidate.setHours(hours, minutes, 0, 0);
        if (days.includes(candidate.getDay()) && candidate > now) {
          return candidate.toISOString();
        }
      }
      const fallback = new Date(now);
      fallback.setDate(fallback.getDate() + 7);
      fallback.setHours(hours, minutes, 0, 0);
      return fallback.toISOString();
    }

    if (frequency === 'monthly') {
      const dom = triggerConfig.dayOfMonth || 1;
      let next = new Date(now.getFullYear(), now.getMonth(), dom, hours, minutes, 0);
      if (next <= now) next = new Date(now.getFullYear(), now.getMonth() + 1, dom, hours, minutes, 0);
      return next.toISOString();
    }

    const fallback = new Date(now);
    fallback.setHours(hours, minutes, 0, 0);
    if (fallback <= now) fallback.setDate(fallback.getDate() + 1);
    return fallback.toISOString();
  };

  const saveFlow = async () => {
    if (!companyId || !user?.id) return;
    setIsSaving(true);

    const flowData = JSON.stringify({ nodes, edges });

    // Determine frequency from trigger nodes
    const triggerNode = nodes.find(n => n.type === 'trigger');
    const frequency = triggerNode?.subType || 'daily';
    const triggerConfig = triggerNode?.data.config || {};
    const nextRunAt = computeNextRun(frequency, triggerConfig);

    try {
      if (currentRoutineId) {
        const { error } = await supabase
          .from('task_routines')
          .update({
            title: flowName,
            description: flowData,
            frequency,
            time_of_day: (triggerConfig.time || '09:00') + ':00',
            days_of_week: triggerConfig.days || null,
            day_of_month: triggerConfig.dayOfMonth || null,
            next_run_at: isActive ? nextRunAt : null,
          })
          .eq('id', currentRoutineId);
        if (error) throw error;
        setRoutines(prev => prev.map(r => r.id === currentRoutineId ? { ...r, title: flowName, description: flowData, frequency } : r));
      } else {
        const { data, error } = await supabase
          .from('task_routines')
          .insert({
            company_id: companyId,
            created_by: user.id,
            title: flowName,
            description: flowData,
            frequency,
            time_of_day: (triggerConfig.time || '09:00') + ':00',
            days_of_week: triggerConfig.days || null,
            day_of_month: triggerConfig.dayOfMonth || null,
            is_active: false,
            next_run_at: null,
          })
          .select()
          .single();
        if (error) throw error;
        setRoutines(prev => [data, ...prev]);
        setCurrentRoutineId(data.id);
      }
      toast.success('Hábito salvo!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar');
    } finally {
      setIsSaving(false);
    }
  };

  const createNew = async () => {
    if (!newName.trim() || !companyId || !user?.id) return;
    try {
      const { data, error } = await supabase
        .from('task_routines')
        .insert({
          company_id: companyId,
          created_by: user.id,
          title: newName,
          description: JSON.stringify({ nodes: [], edges: [] }),
          frequency: 'daily',
          is_active: false,
        })
        .select()
        .single();
      if (error) throw error;
      setRoutines(prev => [data, ...prev]);
      selectRoutine(data);
      setShowNewDialog(false);
      setNewName('');
      toast.success('Hábito criado!');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const toggleActive = async () => {
    if (!currentRoutineId) return;
    try {
      const newActive = !isActive;
      let nextRunAt: string | null = null;

      if (newActive) {
        // Compute next_run_at when activating
        const triggerNode = nodes.find(n => n.type === 'trigger');
        const frequency = triggerNode?.subType || 'daily';
        const triggerConfig = triggerNode?.data.config || {};
        nextRunAt = computeNextRun(frequency, triggerConfig);
      }

      await supabase.from('task_routines').update({ 
        is_active: newActive,
        next_run_at: nextRunAt,
      }).eq('id', currentRoutineId);
      
      setIsActive(newActive);
      setRoutines(prev => prev.map(r => r.id === currentRoutineId ? { ...r, is_active: newActive } : r));
      toast.success(isActive ? 'Hábito pausado' : 'Hábito ativado! 🚀');

      // Trigger execution check immediately
      if (newActive) {
        try {
          await supabase.functions.invoke('execute-routines');
        } catch (e) {
          console.log('Execute-routines check triggered');
        }
      }
    } catch { toast.error('Erro'); }
  };

  const deleteRoutine = async () => {
    if (!currentRoutineId || !confirm('Excluir este hábito?')) return;
    try {
      await supabase.from('task_routines').delete().eq('id', currentRoutineId);
      const remaining = routines.filter(r => r.id !== currentRoutineId);
      setRoutines(remaining);
      if (remaining.length > 0) selectRoutine(remaining[0]);
      else { setCurrentRoutineId(null); setNodes([]); setEdges([]); setFlowName('Novo Hábito'); }
      toast.success('Excluído');
    } catch { toast.error('Erro'); }
  };

  const selectedNode = nodes.find(n => n.id === selectedNodeId) || null;

  if (loading) {
    return (
      <div className="h-[calc(100vh-64px)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: SUITE_COLOR }} />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-gradient-to-br from-background to-muted/50">
      {/* Header */}
      <div className="h-16 bg-background border-b shadow-sm flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/habitos')} className="rounded-xl hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg" style={{ background: `linear-gradient(135deg, ${SUITE_COLOR}, ${SUITE_COLOR}dd)` }}>
              <Target className="h-5 w-5 text-white" />
            </div>
            <div>
              <Input
                value={flowName}
                onChange={e => setFlowName(e.target.value)}
                className="h-7 text-sm font-semibold border-0 p-0 focus-visible:ring-0 bg-transparent"
                placeholder="Nome do hábito"
              />
              <div className="flex items-center gap-2 mt-0.5">
                {isActive ? (
                  <Badge className="bg-emerald-100 text-emerald-700 text-[10px] px-1.5 py-0 rounded-full">Ativo</Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 rounded-full">Inativo</Badge>
                )}
                <span className="text-[10px] text-muted-foreground">{nodes.length} blocos</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Routine selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 rounded-xl">
                <span className="max-w-[100px] truncate">{flowName || 'Selecionar'}</span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-xl">
              <DropdownMenuItem onClick={() => setShowNewDialog(true)} className="rounded-lg">
                <Plus className="h-4 w-4 mr-2" /> Novo Hábito
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {routines.map(r => (
                <DropdownMenuItem key={r.id} onClick={() => selectRoutine(r)} className={`rounded-lg ${currentRoutineId === r.id ? 'bg-muted' : ''}`}>
                  <div className="flex items-center justify-between w-full">
                    <span className="truncate">{r.title}</span>
                    {r.is_active && <div className="w-2 h-2 rounded-full bg-emerald-500" />}
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {currentRoutineId && (
            <>
              <Button variant="outline" size="sm" onClick={toggleActive} className="gap-2 rounded-xl">
                {isActive ? <><Pause className="h-4 w-4" /> Pausar</> : <><Play className="h-4 w-4" /> Ativar</>}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl">
                    <Settings className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-xl">
                  <DropdownMenuItem onClick={deleteRoutine} className="text-destructive rounded-lg">
                    <Trash2 className="h-4 w-4 mr-2" /> Excluir Hábito
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}

          <Button onClick={saveFlow} disabled={isSaving} className="gap-2 rounded-xl text-white shadow-lg" style={{ background: `linear-gradient(135deg, ${SUITE_COLOR}, ${SUITE_COLOR}dd)` }}>
            <Save className="h-4 w-4" />
            {isSaving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex overflow-hidden">
        <HabitSidebar onDragStart={handleDragStart} />
        <HabitCanvas
          nodes={nodes}
          edges={edges}
          onNodesChange={setNodes}
          onEdgesChange={setEdges}
          onNodeSelect={handleNodeSelect}
          selectedNodeId={selectedNodeId}
        />
        {selectedNode && (
          <HabitPropertiesPanel
            node={selectedNode}
            onClose={() => setSelectedNodeId(null)}
            onUpdate={handleNodeUpdate}
          />
        )}
      </div>

      {/* New Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Criar Novo Hábito</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nome do hábito" className="rounded-xl" onKeyDown={e => e.key === 'Enter' && createNew()} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)} className="rounded-xl">Cancelar</Button>
            <Button onClick={createNew} disabled={!newName.trim()} className="rounded-xl text-white" style={{ backgroundColor: SUITE_COLOR }}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HabitFlowBuilder;
