import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Link2, Pencil, Plus, Settings2, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FunnelBuilder } from './FunnelBuilder';
import { FunnelChart } from './FunnelChart';
import { FunnelStylePicker } from './FunnelStylePicker';
import { FunnelSwitcher } from './FunnelSwitcher';
import { StageAutomationChat } from './StageAutomationChat';
import { formatBRL } from './FunnelKanban';
import { useFunnelData, type StageView } from './useFunnelData';
import { useToast } from '@/hooks/use-toast';
import { defaultWeight, loadCrmColumns, resolveChartStyle, type PipelineColumn } from './types';

/**
 * Página do funil: criação e edição via builder drag-and-drop (boca → saída)
 * mais o desenho. Clique numa etapa para abrir a lista de contatos daquela
 * coluna. Configuração, KPIs, automações e integrações moram em páginas
 * próprias (/vendas/...).
 */
export function FunilPage() {
  const navigate = useNavigate();
  const data = useFunnelData();
  const {
    funnel,
    funnels,
    funnelStages,
    create,
    createFunnel,
    deleteFunnel,
    setActiveFunnel,
    updateFunnelById,
    update,
  } = data;
  const { toast } = useToast();
  const [newName, setNewName] = useState('');
  // Rascunho do funil antes de existir: parte das etapas atuais do CRM.
  const [draft, setDraft] = useState<PipelineColumn[]>(() => loadCrmColumns());
  const [editing, setEditing] = useState(false);
  // Etapa cujo chat de automação está aberto (null = fechado).
  const [automationStage, setAutomationStage] = useState<PipelineColumn | null>(null);

  if (!funnel) {
    const handleCreate = () => {
      if (draft.length < 2) return;
      // As etapas montadas aqui são as do PRÓPRIO funil; o kanban do CRM não é
      // mais reescrito ao criar um funil.
      create(
        newName.trim() || 'Meu Funil',
        draft.map((s, i) => ({
          id: s.id,
          title: s.title,
          color: s.color,
          weight: defaultWeight(i, draft.length),
        })),
      );
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

  /* ─── Builder: escreve nas etapas DO FUNIL ───────────────── */
  /**
   * As etapas do funil são a fonte da verdade (nome, ordem, cor e peso) — é o
   * que o desenho mostra e o que o pipeline vinculado espelha. O builder não
   * mexe mais nas colunas do kanban do CRM.
   */
  const builderStages: PipelineColumn[] = (funnel.stages || []).map(({ id, title, color }) => ({
    id,
    title,
    color,
  }));

  const applyStages = (next: PipelineColumn[]) => {
    if (next.length < 2) return;
    const previous = new Map((funnel.stages || []).map((s) => [s.id, s] as const));
    update({
      stages: next.map((s, i) => ({
        ...(previous.get(s.id) || {}),
        id: s.id,
        title: s.title,
        color: s.color,
        weight: defaultWeight(i, next.length),
      })),
    });
  };

  /** Pipeline que segue ESTE funil (as etapas dele são as daqui). */
  const linkedPipeline = data.pipelines.find((p) => p.funnelId === funnel.id) || null;

  /* ─── Números e etapas DESTE funil ───────────────────────── */
  /**
   * Tudo aqui sai das etapas do funil aberto (não do pipeline ativo): editar o
   * funil muda a tela na hora, que é o que se espera desta página.
   */
  const rowsOfFunnel = data.rowsForStages(funnelStages);
  const statsOfFunnel = data.statsForStages(funnelStages);
  const countsByStage = Object.fromEntries(rowsOfFunnel.map((r) => [r.id, r.count]));

  /** Texto do vínculo das etapas compartilhadas ("Comercial › Orçamento"). */
  const linkTextOf = (stage: StageView): string | null => {
    if (!stage.sourceStageId) return null;
    const sourceFunnel = funnels.find((f) => f.id === stage.sourceFunnelId);
    const sourceStage = sourceFunnel?.stages.find((s) => s.id === stage.sourceStageId);
    return `${sourceFunnel?.name ?? 'outro funil'} › ${sourceStage?.title ?? 'etapa'}`;
  };
  const linksByStage: Record<string, string> = {};
  funnelStages.forEach((s) => {
    const text = linkTextOf(s);
    if (text) linksByStage[s.id] = text;
  });
  /** Etapas de OUTROS funis — destinos possíveis de um vínculo. */
  const sourceOptions = funnels
    .filter((f) => f.id !== funnel.id)
    .flatMap((f) =>
      (f.stages || []).map((s) => ({ value: `${f.id}::${s.id}`, label: `${f.name} › ${s.title}` })),
    );
  const chartStyle = resolveChartStyle(funnel.chartStyle);
  const automationCounts = (funnel.automations || []).reduce<Record<string, number>>((acc, a) => {
    if (a.active) acc[a.stageId] = (acc[a.stageId] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 space-y-6">
        {/* Vários funis: um deles é o ativo em todas as páginas de Vendas */}
        <FunnelSwitcher
          funnels={funnels}
          activeFunnelId={funnel.id}
          onSelect={setActiveFunnel}
          onCreate={(name) => {
            createFunnel(name);
            toast({ title: 'Funil criado', description: name });
          }}
          onRename={(id, name) => {
            updateFunnelById(id, { name });
            toast({ title: 'Funil renomeado', description: name });
          }}
          onDelete={(id) => {
            if (!deleteFunnel(id)) {
              toast({
                title: 'Não é possível excluir',
                description: 'O módulo precisa de ao menos um funil.',
                variant: 'destructive',
              });
              return false;
            }
            toast({ title: 'Funil excluído' });
            return true;
          }}
        />

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
            {statsOfFunnel.total}{' '}
            {statsOfFunnel.total === 1 ? 'contato' : 'contatos'} ·{' '}
            <span className="font-semibold text-emerald-600">
              {formatBRL(statsOfFunnel.totalValue) || 'R$ 0'}
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
              <span
                className={
                  linkedPipeline
                    ? 'rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-medium text-emerald-600'
                    : 'rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground'
                }
              >
                {linkedPipeline
                  ? `O pipeline “${linkedPipeline.name}” segue este funil`
                  : 'Nenhum pipeline vinculado a este funil'}
              </span>
            </div>
            <FunnelBuilder
              stages={builderStages}
              onChange={applyStages}
              counts={countsByStage}
              automationCounts={automationCounts}
              links={linksByStage}
              onAutomate={(stageId) => {
                const stage = builderStages.find((s) => s.id === stageId);
                if (stage) setAutomationStage(stage);
              }}
            />

            {/* Etapa compartilhada: mesmo lead em dois funis. */}
            <div className="space-y-2 rounded-2xl border bg-muted/20 p-3 sm:p-4">
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                Etapas compartilhadas com outro funil
              </div>
              <p className="text-[11px] text-muted-foreground">
                Escolha uma etapa de outro funil para esta etapa mostrar os mesmos leads dela.
                Movendo o lead em qualquer um dos dois funis, ele anda nos dois.
              </p>
              {sourceOptions.length === 0 ? (
                <p className="text-[11px] text-muted-foreground/70">
                  Crie outro funil para poder compartilhar etapas.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {funnelStages.map((s) => {
                    const linked = !!s.sourceStageId;
                    return (
                      <div key={s.id} className="flex items-center gap-2">
                        <span className="flex min-w-0 flex-1 items-center gap-2 text-xs">
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: s.color }}
                          />
                          <span className="truncate">{s.title || 'Etapa'}</span>
                        </span>
                        <Select
                          value={
                            linked ? `${s.sourceFunnelId}::${s.sourceStageId}` : 'none'
                          }
                          onValueChange={(value) => {
                            if (value === 'none') {
                              data.setStageSource(s.id, null);
                              toast({
                                title: 'Etapa desvinculada',
                                description:
                                  'Agora ela é uma etapa só deste funil: os leads chegam aqui quando forem movidos para ela.',
                              });
                              return;
                            }
                            const [byFunnel, byStage] = value.split('::');
                            const ok = data.setStageSource(s.id, {
                              funnelId: byFunnel,
                              stageId: byStage,
                            });
                            if (!ok) {
                              toast({
                                title: 'Não foi possível vincular',
                                description: 'A etapa de origem não existe mais.',
                                variant: 'destructive',
                              });
                            }
                          }}
                        >
                          <SelectTrigger
                            className="h-8 w-[46%] min-w-[150px] text-xs"
                            aria-label={`Etapa de origem de ${s.title || 'etapa'}`}
                          >
                            <SelectValue placeholder="Sem vínculo" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sem vínculo</SelectItem>
                            {sourceOptions.map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {linkedPipeline && (
              <p className="text-center text-[11px] text-muted-foreground">
                Nome, ordem e cor das etapas valem também no pipeline “{linkedPipeline.name}”.
              </p>
            )}
            <p className="text-center text-[11px] text-muted-foreground/80">
              Toque no ⚡ de uma etapa para automatizá-la conversando com a IA
            </p>
          </div>
        )}

        {/* O funil */}
        {funnelStages.length === 0 ? (
          <div className="rounded-2xl border border-dashed py-16 text-center">
            <p className="text-sm text-muted-foreground">Este pipeline ainda não tem etapas.</p>
            <Button className="mt-4" onClick={() => setEditing(true)}>
              <Settings2 className="h-4 w-4 mr-2" />
              Montar etapas
            </Button>
          </div>
        ) : (
          <div className="space-y-5 rounded-3xl border bg-card p-4 sm:p-8">
            <FunnelStylePicker
              value={chartStyle}
              onChange={(next) => data.update({ chartStyle: next })}
            />
            <FunnelChart
              variant={chartStyle}
              stages={funnelStages.map((s) => ({ id: s.id, title: s.title, color: s.color }))}
              counts={rowsOfFunnel.map((r) => r.count)}
              frios={rowsOfFunnel.map((r) => r.frio)}
              weights={funnelStages.map((s) => s.weight)}
              showNumbers
              onSelectStage={goToStage}
            />
            <p className="text-center text-xs text-muted-foreground">
              Clique numa etapa para ver os contatos dela
            </p>
            {Object.keys(linksByStage).length > 0 && (
              <p className="text-center text-[11px] text-muted-foreground">
                Etapas compartilhadas:{' '}
                {funnelStages
                  .filter((s) => linksByStage[s.id])
                  .map((s) => `${s.title} (${linksByStage[s.id]})`)
                  .join(' · ')}
              </p>
            )}
            <p className="mt-1 text-center text-[11px] text-muted-foreground/70 sm:hidden">
              Arraste o funil para o lado para ver todas as etapas
            </p>
          </div>
        )}
      </div>

      <StageAutomationChat
        open={!!automationStage}
        onOpenChange={(v) => !v && setAutomationStage(null)}
        stage={automationStage}
        stages={builderStages}
        automations={funnel.automations || []}
        webhookStageId={funnel.webhook?.stageId}
        onAutomationsChange={(automations) => update({ automations })}
        funnelId={funnel.id}
        funnels={funnels.map((f) => ({
          id: f.id,
          name: f.name,
          stages: (f.stages || []).map((s) => ({ id: s.id, title: s.title })),
        }))}
        sharedStages={funnelStages
          .filter((s) => !!linksByStage[s.id])
          .map((s) => ({ title: s.title, origin: linksByStage[s.id] }))}
        onLinkStages={(links) => {
          const applied = links.filter((l) =>
            data.setStageSource(l.stageId, { funnelId: l.funnelId, stageId: l.sourceStageId }),
          );
          toast(
            applied.length
              ? {
                  title:
                    applied.length > 1
                      ? `${applied.length} etapas compartilhadas`
                      : 'Etapa compartilhada',
                  description: 'Os leads da etapa de origem aparecem aqui também.',
                }
              : {
                  title: 'Não foi possível vincular',
                  description: 'Confira o funil e a etapa de origem.',
                  variant: 'destructive',
                },
          );
        }}
      />
    </div>
  );
}

export default FunilPage;
