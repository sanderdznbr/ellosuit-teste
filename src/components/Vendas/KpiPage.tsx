import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, LayoutDashboard, MessageSquare, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { leadState, LeadHostState, LeadModalHost } from './LeadModalHost';
import { KpiView } from './KpiView';
import { useFunnelData } from './useFunnelData';

const PERIODS = [
  { value: 0, label: 'Todo o período' },
  { value: 1, label: 'Hoje' },
  { value: 7, label: 'Últimos 7 dias' },
  { value: 30, label: 'Últimos 30 dias' },
];

/** Página de KPIs do funil: métricas, desenho e desempenho por etapa. */
export function KpiPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const data = useFunnelData();
  const [lead, setLead] = useState<LeadHostState>({ kind: 'closed' });
  const { funnel, update, stageRows, stats, stages, sessions, loading, redrawFromLeads } = data;

  if (!funnel) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-sm text-muted-foreground">Crie um funil para ver os indicadores.</p>
        <Button onClick={() => navigate('/dashboard/vendas/funil')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Ir para o funil
        </Button>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            title="Voltar ao funil"
            onClick={() => navigate('/dashboard/vendas/funil')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <LayoutDashboard className="h-5 w-5 text-primary" />
          <div className="min-w-[180px] flex-1">
            <h1 className="text-xl sm:text-2xl font-bold leading-tight">KPIs do funil</h1>
            <p className="text-xs text-muted-foreground">
              {funnel.name} · {data.activePipeline?.name}
            </p>
          </div>

          <Select value={funnel.channelId} onValueChange={(v) => update({ channelId: v })}>
            <SelectTrigger className="w-[190px] shrink-0" aria-label="Canal WhatsApp">
              <MessageSquare className="h-4 w-4 mr-2 opacity-60" />
              <SelectValue placeholder="Canal" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos os canais</SelectItem>
              {sessions.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  <span
                    className={`mr-2 inline-block h-2 w-2 rounded-full ${
                      s.status === 'connected' ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                  />
                  {s.phone_number || 'Canal'}
                  {s.status === 'connected' ? '' : ' (off)'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={String(funnel.periodDays)}
            onValueChange={(v) => update({ periodDays: Number(v) })}
          >
            <SelectTrigger className="w-[170px] shrink-0" aria-label="Período">
              <Clock className="h-4 w-4 mr-2 opacity-60" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map((p) => (
                <SelectItem key={p.value} value={String(p.value)}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <KpiView
          rows={stageRows}
          stats={stats}
          weights={stages.map((s) => s.weight)}
          showNumbers={funnel.showNumbers}
          selectedStageId={null}
          onSelectStage={(id) => {
            const list = data.itemsOfStage(id).map((c) => c.id);
            if (list.length) setLead(leadState(list[0], data.isCrmPipeline ? 'crm' : 'local', list));
            else setLead({ kind: 'add', stageId: id });
          }}
          onToggleNumbers={(v) => update({ showNumbers: v })}
          onRedraw={() => {
            if (!redrawFromLeads()) {
              toast({
                title: 'Sem contatos para redesenhar',
                description: 'Capture contatos primeiro e tente novamente.',
                variant: 'destructive',
              });
              return;
            }
            toast({ title: 'Funil redesenhado', description: 'Larguras proporcionais aos contatos.' });
          }}
        />

        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" />
          {loading ? 'Atualizando…' : 'Clique numa etapa do gráfico ou da tabela para ver os contatos.'}
        </p>
      </div>

      <LeadModalHost
        data={data}
        state={lead}
        onState={setLead}
        onOpenCRM={() => navigate('/dashboard/crm-ello')}
      />
    </div>
  );
}

export default KpiPage;
