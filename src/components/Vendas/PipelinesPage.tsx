import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowDownUp,
  ArrowLeft,
  Link2,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

/** Página de pipelines de vendas: seletor de pipeline e kanban. */
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
    unmapped,
    cards,
    stats,
    updatePipeline,
    moveTo,
    deletePipeline,
    createPipeline,
    setActivePipeline,
    linkPipeline,
    funnels,
    linkedFunnel,
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

        {/* Pipelines: seletor discreto + acoes do pipeline ativo */}
        <div className="flex flex-wrap items-center gap-1.5">
          {pipelines.map((p) => {
            const isActive = p.id === activePipeline.id;
            return (
              <button
                key={p.id}
                onClick={() => setActivePipeline(p.id)}
                aria-pressed={isActive}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  isActive
                    ? 'border-primary/40 bg-primary/10 text-primary'
                    : 'border-transparent bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {p.name}
                {p.crmSync && (
                  <span
                    className={`rounded-full px-1.5 text-[9px] font-bold uppercase tracking-wide ${
                      isActive ? 'bg-primary/15 text-primary' : 'bg-emerald-500/15 text-emerald-600'
                    }`}
                  >
                    CRM
                  </span>
                )}
              </button>
            );
          })}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
                aria-label="Opções do pipeline"
                title="Opções do pipeline"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="rounded-2xl border-gray-100 p-1.5 min-w-[190px] shadow-lg">
              <DropdownMenuItem
                className="rounded-xl gap-2 cursor-pointer"
                onClick={() => {
                  const name = window.prompt('Nome do pipeline', activePipeline.name);
                  if (name && name.trim() && name.trim() !== activePipeline.name) {
                    updatePipeline({ name: name.trim() });
                    toast({ title: 'Pipeline renomeado' });
                  }
                }}
              >
                <Pencil className="h-4 w-4" />
                Renomear pipeline
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="rounded-xl gap-2 cursor-pointer">
                  <Link2 className="h-4 w-4" />
                  Vincular ao funil
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="rounded-2xl border-gray-100 p-1.5 min-w-[210px] shadow-lg">
                  <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Etapas do pipeline
                  </DropdownMenuLabel>
                  <DropdownMenuItem
                    className="rounded-xl gap-2 cursor-pointer"
                    onClick={() => {
                      linkPipeline(activePipeline.id, null);
                      toast({ title: 'Vínculo removido', description: 'O pipeline volta a usar as próprias etapas.' });
                    }}
                  >
                    Sem vínculo
                    {!linkedFunnel && <span className="ml-auto text-[10px] text-primary">atual</span>}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {funnels.map((f) => (
                    <DropdownMenuItem
                      key={f.id}
                      className="rounded-xl gap-2 cursor-pointer"
                      onClick={() => {
                        linkPipeline(activePipeline.id, f.id);
                        toast({ title: 'Pipeline vinculado', description: `Agora ele segue as etapas de ${f.name}.` });
                      }}
                    >
                      {f.name}
                      <span className="ml-auto text-[10px] text-muted-foreground">
                        {f.stages.length} etapas
                        {linkedFunnel?.id === f.id ? ' · atual' : ''}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              <DropdownMenuItem
                className="rounded-xl gap-2 cursor-pointer text-destructive focus:text-destructive"
                onClick={() => {
                  if (!deletePipeline(activePipeline.id)) {
                    toast({ title: 'O funil precisa de ao menos um pipeline', variant: 'destructive' });
                    return;
                  }
                  toast({ title: 'Pipeline excluído' });
                }}
              >
                <Trash2 className="h-4 w-4" />
                Excluir pipeline
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Board com barra de controle fixa (estilo RD/Salesforce) */}
        <div className="rounded-2xl border bg-card overflow-x-auto">
          <div className="flex flex-wrap items-center gap-2 border-b px-4 sm:px-6 py-3">
            <div className="flex items-baseline gap-2 min-w-0">
              <h2 className="text-sm font-semibold">{activePipeline.name}</h2>
              {linkedFunnel && (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary whitespace-nowrap"
                  title={`As etapas deste pipeline são as de ${linkedFunnel.name}`}
                >
                  <Link2 className="h-3 w-3" />
                  etapas de {linkedFunnel.name}
                </span>
              )}
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
        funnels={funnels}
        onCreate={(name, template, crmSync, funnelId) => {
          const created = createPipeline(name, template, crmSync, funnelId);
          if (created) toast({ title: 'Pipeline criado', description: created.name });
        }}
      />
    </div>
  );
}

export default PipelinesPage;
