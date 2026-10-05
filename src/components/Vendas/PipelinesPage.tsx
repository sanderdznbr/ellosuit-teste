import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowDownUp,
  ArrowLeft,
  Check,
  GitBranch,
  Percent,
  Plus,
  Search,
  Settings2,
  Snowflake,
  Trash2,
  TrendingUp,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import KanbanColumnConfig from '@/components/CRM/KanbanColumnConfig';
import { useToast } from '@/hooks/use-toast';
import { NewPipelineDialog } from './DealDrawer';
import { leadState, LeadHostState, LeadModalHost } from './LeadModalHost';
import { formatBRL, FunnelKanban } from './FunnelKanban';
import { useFunnelData } from './useFunnelData';

type BoardFilter = 'todos' | 'quentes' | 'frios' | 'sem_valor';
type BoardSort = 'atividade' | 'valor' | 'empresa';

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

const pct = (v: number | null) =>
  v === null ? '—' : `${(v * 100).toFixed(1).replace('.', ',')}%`;

/** Página de pipelines de vendas no estilo RD Station: métricas, etapas e kanban. */
export function PipelinesPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const data = useFunnelData();
  const [lead, setLead] = useState<LeadHostState>({ kind: 'closed' });
  const [configOpen, setConfigOpen] = useState(false);
  const [pipelineDialog, setPipelineDialog] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<BoardFilter>('todos');
  const [sort, setSort] = useState<BoardSort>('atividade');

  const {
    funnel,
    update,
    columns,
    saveColumns,
    connected,
    refreshSessions,
    refresh,
    loading,
    isCrmPipeline,
    activePipeline,
    pipelines,
    stages,
    localStages,
    unmapped,
    cards,
    stats,
    updatePipeline,
    moveTo,
    addLocalStage,
    deletePipeline,
    createPipeline,
  } = data;

  const visibleCards = useMemo(() => {
    const q = norm(query.trim());
    return cards.filter((c) => {
      if (filter === 'quentes' && !['quente', 'negociando'].includes(c.temperature || ''))
        return false;
      if (filter === 'frios' && !c.isFrio) return false;
      if (filter === 'sem_valor' && (c.value || 0) > 0) return false;
      if (!q) return true;
      return (
        norm(c.title || '').includes(q) ||
        norm(c.company || '').includes(q) ||
        norm(c.owner || '').includes(q)
      );
    });
  }, [cards, filter, query]);

  if (!funnel || !activePipeline) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-sm text-muted-foreground">Crie um funil para gerenciar pipelines.</p>
        <Button onClick={() => navigate('/dashboard/vendas/funil')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Ir para o funil
        </Button>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[1500px] px-4 sm:px-6 py-6 space-y-4">
        {/* Cabeçalho */}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            title="Voltar ao funil"
            onClick={() => navigate('/dashboard/vendas/funil')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-[200px] flex-1">
            <h1 className="text-xl sm:text-2xl font-bold leading-tight">Pipeline de vendas</h1>
            <p className="text-xs text-muted-foreground">
              {funnel.name} · {loading ? 'carregando…' : `${visibleCards.length} contato(s)`}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refresh();
              refreshSessions();
            }}
          >
            Atualizar
          </Button>
          <Button size="sm" onClick={() => setPipelineDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo pipeline
          </Button>
        </div>

        {/* Métricas no topo (estilo RD) */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <Metric icon={<Users className="h-4 w-4" />} label="Oportunidades" value={String(stats.total)} />
          <Metric
            icon={<Wallet className="h-4 w-4" />}
            label="Em negociação"
            value={formatBRL(stats.totalValue) || 'R$ 0'}
            accent="text-emerald-600"
          />
          <Metric
            icon={<TrendingUp className="h-4 w-4" />}
            label="Ticket médio"
            value={stats.ticket ? formatBRL(stats.ticket) || 'R$ 0' : '—'}
          />
          <Metric
            icon={<Percent className="h-4 w-4" />}
            label="Conversão"
            value={pct(stats.conversion)}
          />
          <Metric
            icon={<Snowflake className="h-4 w-4" />}
            label="Parados 7d+"
            value={String(stats.frios)}
            accent={stats.frios > 0 ? 'text-sky-600' : undefined}
          />
        </div>

        {isCrmPipeline && connected.length === 0 && (
          <div className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-600">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Nenhum canal WhatsApp conectado — este pipeline precisa de um canal para sincronizar.
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 ml-auto"
              onClick={() => navigate('/dashboard/crm-ello')}
            >
              Conectar canal
            </Button>
          </div>
        )}

        {/* Pipelines */}
        <div className="flex flex-wrap items-center gap-2">
          {pipelines.map((p) => (
            <button
              key={p.id}
              onClick={() => update({ activePipelineId: p.id })}
              className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                p.id === activePipeline.id
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'bg-card hover:bg-muted/60'
              }`}
            >
              <GitBranch className="h-3.5 w-3.5" />
              {p.name}
              {p.crmSync && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                    p.id === activePipeline.id ? 'bg-white/20' : 'bg-emerald-500/15 text-emerald-600'
                  }`}
                >
                  CRM
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Etapas do pipeline ativo */}
        <div className="rounded-2xl border bg-card p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px]">
              <Input
                value={activePipeline.name}
                onChange={(e) => updatePipeline({ name: e.target.value })}
                className="h-9 font-semibold"
                aria-label="Nome do pipeline"
              />
            </div>
            {isCrmPipeline ? (
              <Badge className="bg-emerald-500/15 text-emerald-600">
                <Check className="mr-1 h-3 w-3" />
                Sincronizado com o CRM
              </Badge>
            ) : (
              <Badge variant="outline">Contatos manuais / webhook local</Badge>
            )}
            {isCrmPipeline && (
              <Button variant="outline" size="sm" onClick={() => setConfigOpen(true)}>
                <Settings2 className="h-4 w-4 mr-2" />
                Gerenciar etapas
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive"
              title="Excluir pipeline"
              onClick={() => {
                if (!deletePipeline(activePipeline.id)) {
                  toast({ title: 'O funil precisa de ao menos um pipeline', variant: 'destructive' });
                  return;
                }
                toast({ title: 'Pipeline excluído' });
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Etapas: CRM = somente leitura (as colunas vêm do kanban do CRM) */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground mr-1">Etapas:</span>
            {isCrmPipeline
              ? stages.map((s) => (
                  <span
                    key={s.id}
                    className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs"
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: s.color }}
                    />
                    {s.title}
                    <b className="tabular-nums text-muted-foreground">{data.countOf(s.id)}</b>
                  </span>
                ))
              : localStages.map((s, i) => (
                  <span
                    key={s.id}
                    className="inline-flex items-center gap-1.5 rounded-full border bg-background py-0.5 pl-1 pr-1.5"
                  >
                    <input
                      type="color"
                      value={s.color}
                      onChange={(e) =>
                        updatePipeline({
                          stages: localStages.map((st) =>
                            st.id === s.id ? { ...st, color: e.target.value } : st,
                          ),
                        })
                      }
                      className="h-4 w-4 rounded-full border-0 bg-transparent p-0"
                      title="Cor da etapa"
                    />
                    <span className="text-[10px] font-bold text-muted-foreground">{i + 1}.</span>
                    <input
                      value={s.title}
                      onChange={(e) =>
                        updatePipeline({
                          stages: localStages.map((st) =>
                            st.id === s.id ? { ...st, title: e.target.value } : st,
                          ),
                        })
                      }
                      className="w-28 bg-transparent text-xs outline-none"
                    />
                    <button
                      className="text-muted-foreground hover:text-destructive"
                      title="Excluir etapa"
                      onClick={() =>
                        updatePipeline({ stages: localStages.filter((st) => st.id !== s.id) })
                      }
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
            {!isCrmPipeline && (
              <Button variant="outline" size="sm" onClick={addLocalStage}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Etapa
              </Button>
            )}
          </div>
        </div>

        {/* Board com barra de controle fixa (estilo RD/Salesforce) */}
        <div className="rounded-2xl border bg-card overflow-x-auto">
          <div className="flex flex-wrap items-center gap-2 border-b px-4 sm:px-6 py-3">
            <div className="flex items-baseline gap-2 min-w-0">
              <h2 className="text-sm font-semibold">{activePipeline.name}</h2>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {visibleCards.length} contato(s) · {formatBRL(stats.totalValue) || 'R$ 0'} · arraste para mover
              </span>
            </div>
            <div className="flex flex-1 flex-wrap items-center gap-2 justify-end">
              <div className="relative flex-1 min-w-[200px] max-w-[320px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar por contato, empresa ou responsável…"
                  className="h-9 pl-9"
                />
              </div>
              <Select value={filter} onValueChange={(v) => setFilter(v as BoardFilter)}>
                <SelectTrigger className="h-9 w-[160px]" aria-label="Filtro">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os contatos</SelectItem>
                  <SelectItem value="quentes">Quentes</SelectItem>
                  <SelectItem value="frios">Parados 7d+</SelectItem>
                  <SelectItem value="sem_valor">Sem valor definido</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sort} onValueChange={(v) => setSort(v as BoardSort)}>
                <SelectTrigger className="h-9 w-[180px]" aria-label="Ordenar">
                  <ArrowDownUp className="h-4 w-4 mr-2 opacity-60" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="atividade">Ordenar: atividade</SelectItem>
                  <SelectItem value="valor">Ordenar: maior valor</SelectItem>
                  <SelectItem value="empresa">Ordenar: empresa</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                clique num card para ver a negociação
              </span>
            </div>
          </div>
          <FunnelKanban
            columns={stages.map((s) => ({ id: s.id, title: s.title, color: s.color }))}
            cards={visibleCards}
            sort={sort}
            showUnmapped={isCrmPipeline && unmapped.length > 0}
            unmappedCount={unmapped.length}
            showConfigColumn={isCrmPipeline}
            onMove={moveTo}
            onOpen={(id) => setLead(leadState(id, isCrmPipeline ? 'crm' : 'local', visibleCards.map((c) => c.id)))}
            onAdd={(stageId) => setLead({ kind: 'add', stageId })}
            onConfigure={() => setConfigOpen(true)}
          />
        </div>
      </div>

      <LeadModalHost
        data={data}
        state={lead}
        onState={setLead}
        onOpenCRM={() => navigate('/dashboard/crm-ello')}
      />

      <KanbanColumnConfig
        open={configOpen}
        onOpenChange={setConfigOpen}
        columns={columns}
        onColumnsChange={saveColumns}
      />

      <NewPipelineDialog
        open={pipelineDialog}
        onOpenChange={setPipelineDialog}
        hasCrmPipeline={pipelines.some((p) => p.crmSync)}
        onCreate={(name, template, crmSync) => {
          const created = createPipeline(name, template, crmSync);
          if (created) toast({ title: 'Pipeline criado', description: created.name });
        }}
      />
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border bg-card px-3.5 py-2.5">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <span className="text-[11px]">{icon}</span>
        <span className="text-[11px] font-medium">{label}</span>
      </div>
      <p className={`mt-0.5 text-lg font-bold tabular-nums leading-tight ${accent || ''}`}>
        {value}
      </p>
    </div>
  );
}

export default PipelinesPage;
