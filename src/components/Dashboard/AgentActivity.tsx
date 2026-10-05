import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Check, Loader2, X, Wrench, Users, Sparkles, CircleDashed } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface AgentStep {
  id: string;
  kind: string;
  agent_label: string;
  title: string | null;
  content: string | null;
  tool_name: string | null;
  status: string;
  created_at: string;
}

interface PlanStep { title: string; status: string }

const TOOL_LABELS: Record<string, string> = {
  list_tasks: 'Lendo tarefas',
  create_task: 'Criando tarefa',
  list_calendar_events: 'Consultando agenda',
  create_calendar_event: 'Agendando',
  list_contacts: 'Buscando contatos',
  create_contact: 'Cadastrando contato',
  send_whatsapp_message: 'Enviando WhatsApp',
  create_dispatch_campaign: 'Montando disparo',
  generate_image: 'Gerando imagem',
  generate_pdf: 'Gerando PDF',
  generate_chart: 'Montando gráfico',
};

const AgentActivity: React.FC<{ active: boolean; userId?: string }> = ({ active, userId }) => {
  const [plan, setPlan] = useState<PlanStep[]>([]);
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [runId, setRunId] = useState<string | null>(null);

  useEffect(() => {
    if (!active || !userId) { setPlan([]); setSteps([]); setRunId(null); return; }
    let cancelled = false;

    const tick = async () => {
      const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: runs } = await supabase
        .from('ai_agent_runs')
        .select('id, plan')
        .eq('user_id', userId)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(1);

      const run = runs?.[0];
      if (!run || cancelled) return;
      setRunId(run.id);
      setPlan(Array.isArray(run.plan) ? (run.plan as unknown as PlanStep[]) : []);

      const { data: stepRows } = await supabase
        .from('ai_agent_steps')
        .select('id, kind, agent_label, title, content, tool_name, status, created_at')
        .eq('run_id', run.id)
        .order('created_at', { ascending: true })
        .limit(60);
      if (!cancelled && stepRows) setSteps(stepRows as AgentStep[]);
    };

    tick();
    const id = setInterval(tick, 1500);
    return () => { cancelled = true; clearInterval(id); };
  }, [active, userId]);

  const visibleSteps = steps.filter(s => s.kind !== 'plan' && s.kind !== 'answer').slice(-6);

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center gap-2 text-[13px] font-semibold text-[#374DA4]">
        <Brain className="h-4 w-4 animate-pulse" />
        <span>Pensando e trabalhando...</span>
        {runId && <Loader2 className="h-3.5 w-3.5 animate-spin opacity-60" />}
      </div>

      {plan.length > 0 && (
        <div className="rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-[#faf9f7] dark:bg-white/[0.03] p-3 space-y-1.5">
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#8a877f] mb-1">Plano</div>
          {plan.map((p, i) => (
            <div key={i} className="flex items-start gap-2 text-[13px]">
              {p.status === 'done' ? <Check className="h-3.5 w-3.5 mt-0.5 text-emerald-600 shrink-0" />
                : p.status === 'doing' ? <Loader2 className="h-3.5 w-3.5 mt-0.5 text-[#374DA4] animate-spin shrink-0" />
                : p.status === 'failed' ? <X className="h-3.5 w-3.5 mt-0.5 text-red-500 shrink-0" />
                : <CircleDashed className="h-3.5 w-3.5 mt-0.5 text-[#b5b2a9] shrink-0" />}
              <span className={p.status === 'done' ? 'line-through opacity-60' : ''}>{p.title}</span>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence initial={false}>
        {visibleSteps.map((s) => (
          <motion.div
            key={s.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 text-[12px] text-[#8a877f] dark:text-white/45"
          >
            {s.kind === 'subagent' ? <Users className="h-3.5 w-3.5 text-[#374DA4]" />
              : s.kind === 'memory' ? <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              : <Wrench className="h-3.5 w-3.5" />}
            <span className="truncate">
              {s.agent_label !== 'principal' && <span className="text-[#374DA4] font-medium">{s.agent_label}: </span>}
              {s.title || TOOL_LABELS[s.tool_name || ''] || s.tool_name || s.kind}
            </span>
            {s.status === 'error' && <span className="text-red-500">falhou, tentando outro caminho</span>}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default AgentActivity;
