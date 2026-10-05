import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle2, PauseCircle, PlayCircle, XCircle, Bot } from 'lucide-react';

interface Run {
  id: string;
  goal: string;
  status: string;
  plan: any;
  steps_used: number;
  final_answer: string | null;
  created_at: string;
}

const STATUS_LABEL: Record<string, string> = {
  running: 'Trabalhando',
  background: 'Em segundo plano',
  awaiting_approval: 'Aguardando sua autorização',
  paused: 'Pausado',
  completed: 'Concluído',
  failed: 'Falhou',
  cancelled: 'Cancelado',
};

const AgentJobsPanel: React.FC<{ userId?: string }> = ({ userId }) => {
  const [runs, setRuns] = useState<Run[]>([]);

  const load = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('ai_agent_runs')
      .select('id, goal, status, plan, steps_used, final_answer, created_at')
      .eq('user_id', userId)
      .in('status', ['running', 'background', 'awaiting_approval', 'paused'])
      .order('created_at', { ascending: false })
      .limit(5);
    setRuns((data as Run[]) || []);
  }, [userId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [load]);

  const setStatus = async (runId: string, status: string) => {
    await supabase.from('ai_agent_runs').update({ status }).eq('id', runId);
    if (status === 'running') {
      await supabase.functions.invoke('ai-agent-worker', { body: { runId } });
    }
    load();
  };

  if (!runs.length) return null;

  return (
    <div className="w-full max-w-3xl mx-auto mt-6 space-y-2">
      <div className="text-[10px] font-bold uppercase tracking-widest text-[#8a877f] px-1">Trabalhos do agente</div>
      {runs.map((r) => {
        const plan = Array.isArray(r.plan) ? r.plan : [];
        const done = plan.filter((p: any) => p.status === 'done').length;
        return (
          <div key={r.id} className="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-white/[0.03] p-4">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-xl bg-[#374DA4]/10 flex items-center justify-center shrink-0">
                <Bot className="h-4.5 w-4.5 text-[#374DA4]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#1a1a18] dark:text-white truncate">{r.goal}</p>
                <p className="text-xs text-[#8a877f] mt-0.5 flex items-center gap-1.5">
                  {r.status === 'completed' ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    : r.status === 'paused' ? <PauseCircle className="h-3.5 w-3.5" />
                    : <Loader2 className="h-3.5 w-3.5 animate-spin text-[#374DA4]" />}
                  {STATUS_LABEL[r.status] || r.status}
                  {plan.length > 0 && ` • ${done}/${plan.length} etapas`}
                  {` • ${r.steps_used} passos`}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {r.status === 'paused' ? (
                  <button onClick={() => setStatus(r.id, 'running')} className="p-2 rounded-lg hover:bg-black/[0.04]" title="Retomar">
                    <PlayCircle className="h-4 w-4 text-[#374DA4]" />
                  </button>
                ) : (
                  <button onClick={() => setStatus(r.id, 'paused')} className="p-2 rounded-lg hover:bg-black/[0.04]" title="Pausar">
                    <PauseCircle className="h-4 w-4 text-[#8a877f]" />
                  </button>
                )}
                <button onClick={() => setStatus(r.id, 'cancelled')} className="p-2 rounded-lg hover:bg-black/[0.04]" title="Cancelar">
                  <XCircle className="h-4 w-4 text-[#8a877f]" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default AgentJobsPanel;
