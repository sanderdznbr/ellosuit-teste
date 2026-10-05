import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  Flame,
  MessageSquare,
  Phone,
  Search,
  Snowflake,
  Timer,
  UserPlus,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { leadState, LeadHostState, LeadModalHost } from './LeadModalHost';
import { formatBRL, relativeTime, TEMP_COLORS } from './FunnelKanban';
import { useFunnelData } from './useFunnelData';

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

const DAY = 86400000;

type TimeBand = 'hoje' | '7d' | '15d' | '30d';
type ViewMode = 'list' | 'kanban';
type SortMode = 'recent' | 'old' | 'activity';

/** Agrupa um card por faixa de tempo baseada no lastAt. */
function bandOf(card: { lastAt?: string | null }): TimeBand {
  const ts = card.lastAt ? new Date(card.lastAt).getTime() : 0;
  if (!ts) return '30d';
  const ago = Date.now() - ts;
  if (ago < DAY) return 'hoje';
  if (ago < 7 * DAY) return '7d';
  if (ago < 15 * DAY) return '15d';
  return '30d';
}

const bandLabel: Record<TimeBand, string> = {
  hoje: 'Hoje',
  '7d': 'Últimos 7d',
  '15d': 'Últimos 15d',
  '30d': '30 dias+',
};

/** Lista de contatos de uma etapa do funil — lista ou kanban por tempo. */
export function EtapaPage() {
  const { stageId = '' } = useParams<{ stageId: string }>();
  const navigate = useNavigate();
  const data = useFunnelData();
  const [lead, setLead] = useState<LeadHostState>({ kind: 'closed' });
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'todos' | 'frios' | 'quentes' | 'time'>('todos');
  const [band, setBand] = useState<TimeBand | 'todos'>('todos');
  const [view, setView] = useState<ViewMode>('list');
  const [sort, setSort] = useState<SortMode>('recent');

  const { funnel, stages, itemsOfStage, isCrmPipeline, activePipeline } = data;
  const stage = stages.find((s) => s.id === stageId);

  /** Busca + frios/quentes (sem filtro de tempo — o tempo filtra só a lista). */
  const searchItems = useMemo(() => {
    const list = itemsOfStage(stageId);
    const q = norm(query.trim());
    return list.filter((c) => {
      if (filter === 'frios') return c.isFrio;
      if (filter === 'quentes') return c.temperature === 'quente' || c.temperature === 'negociando';
      return true;
    }).filter((c) => {
      if (!q) return true;
      return (
        norm(c.title || '').includes(q) ||
        norm(c.company || '').includes(q) ||
        norm(c.preview || '').includes(q)
      );
    });
  }, [filter, itemsOfStage, query, stageId]);

  /** Itens da lista: aplica faixa de tempo (quando selecionada) e ordenação. */
  const listItems = useMemo(() => {
    const arr = searchItems.filter(
      (c) => filter !== 'time' || band === 'todos' || bandOf(c) === band,
    );
    if (sort === 'recent') arr.sort((a, b) => (b.lastAt || '').localeCompare(a.lastAt || ''));
    else if (sort === 'old') arr.sort((a, b) => (a.lastAt || '').localeCompare(b.lastAt || ''));
    return arr;
  }, [searchItems, filter, band, sort]);

  /** Contagem por faixa para os pills (independente do filtro ativo). */
  const bandCounts = useMemo(() => {
    const counts: Record<TimeBand, number> = { hoje: 0, '7d': 0, '15d': 0, '30d': 0 };
    searchItems.forEach((c) => { counts[bandOf(c)]++; });
    return counts;
  }, [searchItems]);

  /** Kanban: todas as faixas sempre visíveis; a faixa selecionada fica em destaque. */
  const kanbanItems = useMemo(() => {
    const cols: TimeBand[] = ['hoje', '7d', '15d', '30d'];
    const map: Record<TimeBand, typeof searchItems> = { hoje: [], '7d': [], '15d': [], '30d': [] };
    searchItems.forEach((c) => { map[bandOf(c)].push(c); });
    cols.forEach((b) => map[b].sort((a, b2) => (b2.lastAt || '').localeCompare(a.lastAt || '')));
    return cols.map((b) => ({ band: b, items: map[b] }));
  }, [searchItems]);

  /** Ordem de navegação do modal: todos os itens visíveis (lista ou kanban). */
  const navIds = useMemo(
    () => (view === 'kanban' ? searchItems.map((c) => c.id) : listItems.map((c) => c.id)),
    [view, searchItems, listItems],
  );

  if (!funnel) return null;

  if (!stage) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-sm text-muted-foreground">Etapa não encontrada.</p>
        <Button onClick={() => navigate('/dashboard/vendas/funil')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar ao funil
        </Button>
      </div>
    );
  }

  const totalValue = itemsOfStage(stageId).reduce((sum, c) => sum + (c.value || 0), 0);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 space-y-5">
        {/* Cabeçalho */}
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            title="Voltar ao funil"
            onClick={() => navigate('/dashboard/vendas/funil')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <span
            className="h-3.5 w-3.5 rounded-full mt-2 shrink-0"
            style={{ backgroundColor: stage.color }}
          />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-bold truncate">{stage.title}</h1>
            <p className="text-xs text-muted-foreground">
              {itemsOfStage(stageId).length}{' '}
              {itemsOfStage(stageId).length === 1 ? 'contato' : 'contatos'} ·{' '}
              {formatBRL(totalValue) || 'R$ 0'} em negociação
              {activePipeline && !isCrmPipeline ? ` · ${activePipeline.name}` : ''}
            </p>
          </div>
        </div>

        {/* Buscar / filtrar / visualização */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar contato…"
              className="h-9 pl-9"
            />
          </div>
          <Select
            value={filter}
            onValueChange={(v) => {
              setFilter(v as typeof filter);
              setBand('todos');
            }}
          >
            <SelectTrigger className="h-9 w-[160px]" aria-label="Filtro">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="frios">Só frios</SelectItem>
              <SelectItem value="quentes">Quentes</SelectItem>
              <SelectItem value="time">Por tempo</SelectItem>
            </SelectContent>
          </Select>
          {filter === 'time' && (
            <div className="flex items-center gap-1">
              {(['hoje', '7d', '15d', '30d'] as TimeBand[]).map((b) => (
                <button
                  key={b}
                  onClick={() => setBand(b)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    band === b
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                  }`}
                >
                  {bandLabel[b]}
                  <span className="ml-1 opacity-60">({bandCounts[b]})</span>
                </button>
              ))}
            </div>
          )}
          <Select value={sort} onValueChange={(v) => setSort(v as SortMode)}>
            <SelectTrigger className="h-9 w-[160px]" aria-label="Ordenar">
              <Clock className="h-4 w-4 mr-2 opacity-60" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Mais recentes</SelectItem>
              <SelectItem value="old">Mais antigos</SelectItem>
              <SelectItem value="activity">Mais atividade</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1 ml-auto">
            <Button
              variant={view === 'list' ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setView('list')}
              className="gap-1.5"
            >
              <Layers className="h-3.5 w-3.5" /> Lista
            </Button>
            <Button
              variant={view === 'kanban' ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setView('kanban')}
              className="gap-1.5"
            >
              <MessageSquare className="h-3.5 w-3.5" /> Kanban
            </Button>
          </div>
        </div>

        {/* Lista */}
        {view === 'list' && (
          <>
            {listItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed py-16 text-center text-sm text-muted-foreground">
                Nenhum contato {query || filter !== 'todos' ? 'com esse filtro' : 'nesta etapa'}.
                <br />
                Adicione pelo formulário abaixo.
              </div>
            ) : (
              <ul className="rounded-2xl border bg-card divide-y overflow-hidden">
                {listItems.map((c) => (
                  <li key={c.id}>
                    <button
                      className="w-full text-left px-4 py-3.5 hover:bg-muted/50 transition-colors flex items-start gap-3"
                      onClick={() =>
                        setLead(leadState(c.id, isCrmPipeline ? 'crm' : 'local', navIds))
                      }
                    >
                      <span
                        className="h-10 w-10 shrink-0 rounded-full flex items-center justify-center text-xs font-bold text-white"
                        style={{ backgroundColor: stage.color }}
                      >
                        {(c.title || '?').slice(0, 2).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium truncate">{c.title}</span>
                          <span className="shrink-0 text-xs font-semibold tabular-nums text-emerald-600">
                            {formatBRL(c.value)}
                          </span>
                        </span>
                        {c.company && (
                          <span className="block text-xs text-muted-foreground truncate">{c.company}</span>
                        )}
                        <span className="mt-1 flex flex-wrap items-center gap-1.5">
                          {c.temperature && (
                            <span
                              className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                              style={{
                                backgroundColor: `${TEMP_COLORS[c.temperature] || '#6B7280'}1f`,
                                color: TEMP_COLORS[c.temperature] || '#6B7280',
                              }}
                            >
                              {c.temperature === 'quente' || c.temperature === 'pagou' ? (
                                <Flame className="h-2.5 w-2.5" />
                              ) : c.temperature === 'frio' ? (
                                <Snowflake className="h-2.5 w-2.5" />
                              ) : null}
                              {c.temperature}
                            </span>
                          )}
                          {c.isFrio && (
                            <span className="rounded-full bg-sky-500/10 px-1.5 py-0.5 text-[10px] text-sky-500">
                              7d+ parado
                            </span>
                          )}
                          {!!c.unread && (
                            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                              {c.unread} nova(s)
                            </span>
                          )}
              <span className="text-[11px] text-muted-foreground">
                {relativeTime(c.lastAt)}
              </span>
              {c.lastAt && (
                <span className="text-[10px] text-muted-foreground/60">
                  · {bandLabel[bandOf(c)]}
                </span>
              )}
                        </span>
                        {c.preview && (
                          <span className="mt-1 block truncate text-[11px] italic text-muted-foreground">
                            {c.preview}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {/* Kanban por tempo */}
        {view === 'kanban' && (
          <div className="flex gap-3 overflow-x-auto overflow-y-hidden rounded-2xl border bg-card p-4">
            {kanbanItems.map(({ band: b, items: colItems }) => (
              <div
                key={b}
                className={`flex w-[260px] shrink-0 flex-col rounded-xl border bg-muted/30 ${
                  filter === 'time' && band === b ? 'ring-2 ring-primary/50' : ''
                }`}
              >
                <div className="flex items-center gap-2 px-3 py-2.5 border-b">
                  <Timer className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate text-sm font-semibold">{bandLabel[b]}</span>
                  <Badge variant="secondary" className="text-[11px] tabular-nums">
                    {colItems.length}
                  </Badge>
                </div>
                <div className="flex-1 space-y-2 p-2 min-h-[120px] max-h-[480px] overflow-y-auto">
                  {colItems.length === 0 ? (
                    <div className="rounded-xl border border-dashed p-4 text-center text-[11px] text-muted-foreground">
                      Nenhum contato neste período
                    </div>
                  ) : (
                    colItems.map((c) => (
                      <button
                        key={c.id}
                        className="w-full text-left rounded-xl border bg-background p-2.5 hover:bg-muted/50 transition-colors"
                        onClick={() =>
                          setLead(leadState(c.id, isCrmPipeline ? 'crm' : 'local', navIds))
                        }
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-[13px] font-semibold leading-tight line-clamp-2">{c.title}</span>
                          {c.value && formatBRL(c.value) && (
                            <span className="shrink-0 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[11px] font-bold text-emerald-600 tabular-nums">
                              {formatBRL(c.value)}
                            </span>
                          )}
                        </div>
                        {c.company && (
                          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground truncate">
                            <Phone className="h-3 w-3 shrink-0" />
                            {c.company}
                          </p>
                        )}
                        <div className="mt-1.5 flex flex-wrap items-center gap-1">
                          {c.temperature && (
                            <span
                              className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                              style={{
                                backgroundColor: `${TEMP_COLORS[c.temperature] || '#6B7280'}1f`,
                                color: TEMP_COLORS[c.temperature] || '#6B7280',
                              }}
                            >
                              {c.temperature === 'quente' || c.temperature === 'pagou' ? (
                                <Flame className="h-2.5 w-2.5" />
                              ) : c.temperature === 'frio' ? (
                                <Snowflake className="h-2.5 w-2.5" />
                              ) : null}
                              {c.temperature}
                            </span>
                          )}
                          {c.isFrio && (
                            <span className="rounded-full bg-sky-500/10 px-1.5 py-0.5 text-[10px] text-sky-500">
                              7d+ parado
                            </span>
                          )}
                          <span className="text-[10px] text-muted-foreground/70">
                            {relativeTime(c.lastAt)}
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
                <button
                  className="mt-auto m-2 flex items-center gap-1.5 rounded-lg px-2 py-2 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  onClick={() => setLead({ kind: 'add', stageId })}
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Adicionar contato
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Adicionar contato */}
        <div className="rounded-2xl border bg-card p-4 flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <UserPlus className="h-3.5 w-3.5" />
            Adicionar contato em {stage.title}
          </p>
          <Button size="sm" onClick={() => setLead({ kind: 'add', stageId })}>
            Novo contato
          </Button>
        </div>
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

export default EtapaPage;
