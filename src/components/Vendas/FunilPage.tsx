import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Pencil, Plus, Settings2, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FunnelBuilder } from './FunnelBuilder';
import { FunnelChart } from './FunnelChart';
import { formatBRL } from './FunnelKanban';
import { useFunnelData } from './useFunnelData';
import { defaultWeight, loadCrmColumns, type PipelineColumn } from './types';

/**
 * Página do funil: criação e edição via builder drag-and-drop (boca → saída)
 * mais o desenho. Clique numa etapa para abrir a lista de contatos daquela
 * coluna. Configuração, KPIs, automações e integrações moram em páginas
 * próprias (/vendas/...).
 */
export function FunilPage() {
  const navigate = useNavigate();
  const data = useFunnelData();
  const { funnel, stages, stageRows, create, saveColumns, update } = data;
  const [newName, setNewName] = useState('');
  // Rascunho do funil antes de existir: parte das etapas atuais do CRM.
  const [draft, setDraft] = useState<PipelineColumn[]>(() => loadCrmColumns());
  const [editing, setEditing] = useState(false);

  if (!funnel) {
    const handleCreate = () => {
      if (draft.length < 2) return;
      // Persiste as etapas ANTES de criar: newFunnel() lê loadCrmColumns().
      saveColumns(draft);
      create(newName.trim() || 'Meu Funil');
    };

    return (
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
          <div className="rounded-3xl border bg-card p-5 sm:p-7 shadow-sm space-y-5">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Criar funil de vendas</h1>
                <p className="text-sm text-muted-foreground">
                  Monte as etapas da boca até a saída — depois é só arrastar para reordenar.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="novo-funil">Nome do funil</Label>
              <Input
                id="novo-funil"
                autoFocus
                placeholder="Ex.: Funil de conversão 2026"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-end justify-between gap-3">
                <Label>Etapas</Label>
                <span className="text-[11px] text-muted-foreground">
                  arraste pela alça para posicionar
                </span>
              </div>
              <FunnelBuilder stages={draft} onChange={setDraft} />
            </div>

            <div className="rounded-2xl border bg-muted/30 p-3 sm:p-5">
              <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Prévia do funil
              </p>
              <FunnelChart
                stages={draft.map((s) => ({ id: s.id, title: s.title, color: s.color }))}
                counts={draft.map(() => 0)}
                weights={draft.map((_, i) => defaultWeight(i, draft.length))}
                showNumbers={false}
              />
            </div>

            <div className="rounded-xl bg-muted/50 p-3.5 text-xs text-muted-foreground space-y-1.5">
              <p className="flex items-center gap-2">
                <TrendingUp className="h-3.5 w-3.5" /> O funil em um único lugar, sem ruído
              </p>
              <p className="flex items-center gap-2">
                <Settings2 className="h-3.5 w-3.5" /> Etapas, KPIs e automações em páginas próprias
              </p>
            </div>

            <Button className="w-full" onClick={handleCreate} disabled={draft.length < 2}>
              <Plus className="h-4 w-4 mr-2" />
              Criar funil
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const goToStage = (stageId: string) => navigate(`/dashboard/vendas/funil/${stageId}`);

  /* ─── Builder: escreve no pipeline ativo ───────────────────── */
  const builderStages: PipelineColumn[] = data.isCrmPipeline
    ? data.columns
    : (data.activePipeline?.stages || []).map(({ id, title, color }) => ({ id, title, color }));

  const applyStages = (next: PipelineColumn[]) => {
    if (next.length < 2) return;
    if (data.isCrmPipeline) {
      saveColumns(next);
      const stageConfig = { ...(funnel.stageConfig || {}) };
      next.forEach((c, i) => {
        stageConfig[c.id] = {
          ...(stageConfig[c.id] || { weight: 100 }),
          weight: defaultWeight(i, next.length),
        };
      });
      update({ stageConfig });
    } else {
      const previous = new Map(
        (data.activePipeline?.stages || []).map((s) => [s.id, s] as const),
      );
      data.updatePipeline({
        stages: next.map((s, i) => ({
          ...(previous.get(s.id) || {}),
          ...s,
          weight: defaultWeight(i, next.length),
        })),
      });
    }
  };

  const countsByStage = Object.fromEntries(stageRows.map((r) => [r.id, r.count]));

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 space-y-6">
        {/* Título */}
        <div className="text-center space-y-2">
          <h1
            className="text-2xl sm:text-3xl font-bold cursor-text outline-none"
            title="Clique duplo para renomear"
            onDoubleClick={() => {
              const name = window.prompt('Nome do funil', funnel.name);
              if (name && name.trim()) data.update({ name: name.trim() });
            }}
          >
            {funnel.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {data.stats.total}{' '}
            {data.stats.total === 1 ? 'contato' : 'contatos'} ·{' '}
            <span className="font-semibold text-emerald-600">
              {formatBRL(data.stats.totalValue) || 'R$ 0'}
            </span>{' '}
            em negociação
          </p>
          <Button
            variant={editing ? 'default' : 'outline'}
            size="sm"
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? (
              <>
                <Check className="h-4 w-4 mr-1.5" />
                Concluir edição
              </>
            ) : (
              <>
                <Pencil className="h-4 w-4 mr-1.5" />
                Editar etapas
              </>
            )}
          </Button>
        </div>

        {/* Builder (só em modo de edição) */}
        {editing && (
          <div className="rounded-3xl border bg-card p-4 sm:p-6 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold">Monte o funil</h2>
                <p className="text-xs text-muted-foreground">
                  Da boca (topo) até a saída — arraste, insira e renomeie à vontade.
                </p>
              </div>
              <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-medium text-emerald-600">
                {data.isCrmPipeline ? 'Pipeline sincronizado com o CRM' : 'Pipeline próprio'}
              </span>
            </div>
            <FunnelBuilder
              stages={builderStages}
              onChange={applyStages}
              counts={countsByStage}
            />
          </div>
        )}

        {/* O funil */}
        {stages.length === 0 ? (
          <div className="rounded-2xl border border-dashed py-16 text-center">
            <p className="text-sm text-muted-foreground">Este pipeline ainda não tem etapas.</p>
            <Button className="mt-4" onClick={() => setEditing(true)}>
              <Settings2 className="h-4 w-4 mr-2" />
              Montar etapas
            </Button>
          </div>
        ) : (
          <div className="rounded-3xl border bg-card p-4 sm:p-8">
            <FunnelChart
              stages={stages.map((s) => ({ id: s.id, title: s.title, color: s.color }))}
              counts={stageRows.map((r) => r.count)}
              frios={stageRows.map((r) => r.frio)}
              weights={stages.map((s) => s.weight)}
              showNumbers
              onSelectStage={goToStage}
            />
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Clique numa etapa para ver os contatos dela
            </p>
            <p className="mt-1 text-center text-[11px] text-muted-foreground/70 sm:hidden">
              Arraste o funil para o lado para ver todas as etapas
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default FunilPage;
