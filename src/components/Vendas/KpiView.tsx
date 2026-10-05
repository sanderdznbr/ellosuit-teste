import {
  ArrowDownRight,
  Flame,
  Percent,
  Snowflake,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { FunnelChart } from './FunnelChart';
import { formatBRL } from './FunnelKanban';

export interface StageRow {
  id: string;
  title: string;
  color: string;
  count: number;
  frio: number;
  value: number;
  share: number;
  conversion: number | null;
}

export interface FunnelStats {
  total: number;
  conversion: number | null;
  totalValue: number;
  ticket: number | null;
  frios: number;
  today: number;
}

const pct = (v: number) => `${(v * 100).toFixed(1).replace('.', ',')}%`;

function KpiCard({
  icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-4 flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span
          className="flex h-7 w-7 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${accent || '#374DA4'}1a`, color: accent || '#374DA4' }}
        >
          {icon}
        </span>
      </div>
      <span className="text-2xl font-bold tabular-nums leading-tight">{value}</span>
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </div>
  );
}

/** Seção de KPIs: cartões de métricas, gráfico do funil e desempenho por etapa. */
export function KpiView({
  rows,
  stats,
  weights,
  showNumbers,
  selectedStageId,
  onSelectStage,
  onToggleNumbers,
  onRedraw,
}: {
  rows: StageRow[];
  stats: FunnelStats;
  weights: number[];
  showNumbers: boolean;
  selectedStageId: string | null;
  onSelectStage: (id: string) => void;
  onToggleNumbers: (v: boolean) => void;
  onRedraw: () => void;
}) {
  const stages = rows.map((r) => ({ id: r.id, title: r.title, color: r.color }));
  const counts = rows.map((r) => r.count);
  const frios = rows.map((r) => r.frio);

  return (
    <div className="space-y-5">
      {/* Cartões de KPI */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <KpiCard
          icon={<Users className="h-4 w-4" />}
          label="Leads no funil"
          value={String(stats.total)}
          hint={`${rows.length} etapas`}
        />
        <KpiCard
          icon={<Percent className="h-4 w-4" />}
          label="Conversão final"
          value={stats.conversion !== null ? pct(stats.conversion) : '—'}
          hint="última etapa ÷ primeira"
          accent="#10B981"
        />
        <KpiCard
          icon={<Wallet className="h-4 w-4" />}
          label="Em negociação"
          value={formatBRL(stats.totalValue) || 'R$ 0'}
          hint="soma dos valores"
          accent="#0EA5E9"
        />
        <KpiCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Ticket médio"
          value={stats.ticket !== null ? formatBRL(stats.ticket) || 'R$ 0' : '—'}
          hint="negócios com valor"
          accent="#8B5CF6"
        />
        <KpiCard
          icon={<Snowflake className="h-4 w-4" />}
          label="Leads frios"
          value={String(stats.frios)}
          hint="7 dias sem resposta"
          accent="#60A5FA"
        />
        <KpiCard
          icon={<Flame className="h-4 w-4" />}
          label="Atividade hoje"
          value={String(stats.today)}
          hint="conversas/movimentações"
          accent="#EF4444"
        />
      </div>

      {/* Gráfico do funil */}
      <div className="rounded-2xl border bg-card p-4 sm:p-6 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-baseline gap-2">
            <h2 className="text-sm font-semibold">Funil</h2>
            <span className="text-xs text-muted-foreground">
              clique numa etapa para ver os leads
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/50" />
              frios = 7 dias sem resposta
            </span>
            <label className="flex items-center gap-2 text-xs">
              <Switch checked={showNumbers} onCheckedChange={onToggleNumbers} />
              Números
            </label>
            <Button variant="outline" size="sm" onClick={onRedraw}>
              <Sparkles className="h-4 w-4 mr-2" />
              Redesenhar
            </Button>
          </div>
        </div>

        <FunnelChart
          stages={stages}
          counts={counts}
          frios={frios}
          weights={weights}
          showNumbers={showNumbers}
          selectedStageId={selectedStageId}
          onSelectStage={onSelectStage}
        />
      </div>

      {/* Desempenho por etapa */}
      <div className="rounded-2xl border bg-card overflow-hidden">
        <div className="px-4 sm:px-5 py-3 border-b">
          <h2 className="text-sm font-semibold">Desempenho por etapa</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Etapa</TableHead>
              <TableHead className="text-right">Leads</TableHead>
              <TableHead className="text-right">% do funil</TableHead>
              <TableHead className="text-right">Conversão</TableHead>
              <TableHead className="text-right">Em negociação</TableHead>
              <TableHead className="text-right">Frios</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow
                key={r.id}
                className="cursor-pointer"
                onClick={() => onSelectStage(r.id)}
              >
                <TableCell>
                  <span className="flex items-center gap-2 font-medium">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: r.color }}
                    />
                    {r.title}
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums">{r.count}</TableCell>
                <TableCell className="text-right tabular-nums">{pct(r.share)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {r.conversion !== null ? (
                    <span
                      className={`inline-flex items-center gap-1 ${
                        r.conversion >= 0.5 ? 'text-emerald-600' : 'text-amber-600'
                      }`}
                    >
                      <ArrowDownRight className="h-3 w-3" />
                      {pct(r.conversion)}
                    </span>
                  ) : (
                    '—'
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatBRL(r.value) || '—'}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {r.frio > 0 ? (
                    <span className="text-sky-600">{r.frio}</span>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default KpiView;
