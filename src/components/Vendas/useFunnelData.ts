import { useMemo } from 'react';
import {
  buildStages,
  defaultWeight,
  FunnelDeal,
  LocalDeal,
  Pipeline,
  PIPELINE_TEMPLATES,
  SOURCE_LABELS,
  SourceType,
  uid,
} from './types';
import { useToast } from '@/hooks/use-toast';
import {
  createLeadManually,
  CrmLead,
  friosByStage,
  groupByStage,
  useCompany,
  useCrmLeads,
  useCrmSessions,
  usePipelineColumns,
  useSalesWorkspace,
  useStageUpdater,
} from './useFunis';
import type { DealCardData } from './FunnelKanban';
import type { FunnelStats, StageRow } from './KpiView';

const DAY = 86400000;
export const isFrioAt = (iso?: string | null) =>
  !!iso && Date.now() - new Date(iso).getTime() > 7 * DAY;

export interface StageView {
  id: string;
  title: string;
  color: string;
  weight: number;
  /** Etapa compartilhada: mostra os mesmos leads de uma etapa de outro funil. */
  sourceFunnelId?: string | null;
  sourceStageId?: string | null;
  sourcePipelineId?: string | null;
}

export type Drawer =
  | { mode: 'stage'; stageId: string }
  | { mode: 'crm'; leadId: string }
  | { mode: 'local'; dealId: string }
  | null;

/**
 * Fonte única de verdade do funil: registro salvo + leads do CRM + Derivados
 * (etapas, cards, KPIs). Usado por todas as páginas de Vendas para não repetir
 * cálculo nem buscas.
 */
export function useFunnelData() {
  const { toast } = useToast();
  const {
    workspace,
    activeFunnel: funnel,
    loading: workspaceLoading,
    error: workspaceError,
    update,
    updateFunnelById,
    updateWorkspace,
    createFunnel,
    deleteFunnel,
    setActiveFunnel,
  } = useSalesWorkspace();
  const companyId = useCompany();
  const { columns, save: saveColumns } = usePipelineColumns();
  const { sessions, connected, refresh: refreshSessions } = useCrmSessions(companyId);

  const sessionId = funnel?.channelId || 'ALL';
  const periodDays = funnel?.periodDays ?? 0;
  const { rows, setRows, loading, error, refresh } = useCrmLeads({
    companyId,
    sessionId,
    periodDays,
  });
  const { updateStage, saving: savingStage } = useStageUpdater(companyId);

  /* ─── Pipelines, vínculo com funil e etapas ──────────────── */
  const funnels = workspace?.funnels || [];
  const pipelines = workspace?.pipelines || [];
  const activePipeline: Pipeline | undefined =
    pipelines.find((p) => p.id === workspace?.activePipelineId) || pipelines[0];
  const isCrmPipeline = !!activePipeline?.crmSync;

  /**
   * Funil vinculado ao pipeline ativo. Quando existe, o pipeline é IGUAL ao
   * funil: as etapas (nome, ordem, cor, peso) vêm dele.
   */
  const linkedFunnel =
    (activePipeline?.funnelId
      ? funnels.find((f) => f.id === activePipeline.funnelId)
      : null) ?? null;

  const funnelStages: StageView[] = useMemo(() => {
    const own = linkedFunnel?.stages || [];
    return own.map((s, i) => ({
      id: s.id,
      title: s.title,
      color: s.color,
      weight: s.weight ?? defaultWeight(i, own.length),
      sourceFunnelId: s.sourceFunnelId ?? null,
      sourceStageId: s.sourceStageId ?? null,
      sourcePipelineId: s.sourcePipelineId ?? null,
    }));
  }, [linkedFunnel]);

  /**
   * Etapas DO funil ativo (compartilhadas inclusive). A página do funil desenha
   * estas — e não as do pipeline ativo —, senão editar o funil não mudava nada
   * na tela quando o pipeline ativo era outro.
   */
  const ownFunnelStages: StageView[] = useMemo(() => {
    const own = funnel?.stages || [];
    return own.map((s, i) => ({
      id: s.id,
      title: s.title,
      color: s.color,
      weight: s.weight ?? defaultWeight(i, own.length),
      sourceFunnelId: s.sourceFunnelId ?? null,
      sourceStageId: s.sourceStageId ?? null,
      sourcePipelineId: s.sourcePipelineId ?? null,
    }));
  }, [funnel]);

  /** Colunas do kanban do CRM: usadas por pipeline do CRM sem funil vinculado. */
  const crmStages: StageView[] = useMemo(
    () =>
      columns.map((c, i) => ({
        id: c.id,
        title: c.title,
        color: c.color,
        weight: funnel?.stageConfig?.[c.id]?.weight ?? defaultWeight(i, columns.length),
      })),
    [columns, funnel?.stageConfig],
  );

  const localStages: StageView[] = activePipeline?.stages || [];
  const stages: StageView[] = linkedFunnel
    ? funnelStages
    : isCrmPipeline
      ? crmStages
      : localStages;

  /** Ids das etapas exibidas (inclui a etapa de origem das compartilhadas). */
  const knownIds = new Set(
    stages.flatMap((s) => [s.id, ...(s.sourceStageId ? [s.sourceStageId] : [])]),
  );

  /* ─── Leads agrupados ────────────────────────────────────── */
  const deals = workspace?.deals || {};
  const localDeals = workspace?.localDeals || [];
  const localDealsOfPipeline = localDeals.filter((d) => d.pipelineId === activePipeline?.id);
  const crmByStage = groupByStage(rows);
  const crmFrios = friosByStage(rows);

  /** Lead do CRM → card do kanban. */
  const crmCard = (lead: CrmLead): DealCardData => {
    const deal: FunnelDeal = deals[lead.id] || {};
    return {
      id: lead.id,
      stageId: lead.pipeline_stage || '__none__',
      title: deal.contact || lead.contact_name || lead.contact_phone,
      company: deal.company,
      value: deal.value,
      temperature: deal.temperature || lead.temperature_stage || null,
      owner: deal.owner,
      notes: deal.notes,
      preview: lead.last_message || undefined,
      lastAt: lead.last_message_at,
      unread: lead.unread_count || 0,
      isFrio: isFrioAt(lead.last_message_at),
    };
  };

  /** Lead de pipeline próprio → card do kanban. */
  const localCard = (d: LocalDeal): DealCardData => ({
    id: d.id,
    stageId: d.stageId,
    title: d.contact || d.name,
    company: d.company,
    value: d.value,
    temperature: d.temperature || null,
    owner: d.owner,
    notes: d.notes,
    lastAt: d.updatedAt,
    isFrio: isFrioAt(d.updatedAt),
  });

  /**
   * De onde saem os leads de uma etapa exibida: a própria etapa, no pipeline
   * ativo, ou a etapa de origem quando a etapa é compartilhada com outro funil.
   */
  const sourceOf = (stage?: StageView) => {
    if (stage?.sourceStageId) {
      const owner = pipelines.find((p) => p.id === stage.sourcePipelineId);
      return {
        pipelineId: stage.sourcePipelineId ?? null,
        stageId: stage.sourceStageId,
        isCrm: owner ? !!owner.crmSync : true,
      };
    }
    return {
      pipelineId: activePipeline?.id ?? null,
      stageId: stage?.id ?? '',
      isCrm: isCrmPipeline,
    };
  };

  const cardsOfSource = (src: {
    pipelineId: string | null;
    stageId: string;
    isCrm: boolean;
  }): DealCardData[] => {
    if (!src.stageId) return [];
    if (src.isCrm) return (crmByStage[src.stageId] || []).map(crmCard);
    return localDeals
      .filter((d) => d.pipelineId === src.pipelineId && d.stageId === src.stageId)
      .map(localCard);
  };

  /** Leads de uma etapa da lista informada (resolve etapa compartilhada). */
  const itemsFor = (list: StageView[], stageId: string): DealCardData[] => {
    const stage = list.find((s) => s.id === stageId);
    const src = sourceOf(stage);
    const items = cardsOfSource(src);
    // Uma etapa compartilhada também mostra o que estiver parado nela: um lead
    // criado direto nesse id (webhook, importação) não pode ficar invisível.
    if (stage?.sourceStageId && stage.id !== src.stageId) {
      return [
        ...items,
        ...cardsOfSource({ pipelineId: activePipeline?.id ?? null, stageId: stage.id, isCrm: isCrmPipeline }),
      ];
    }
    return items;
  };

  /**
   * Leads de uma etapa. Procura entre as etapas do pipeline ativo e, se não
   * achar, entre as do funil aberto — a página da etapa é aberta pelo funil.
   */
  const itemsOfStage = (stageId: string): DealCardData[] => {
    const inPipeline = stages.find((s) => s.id === stageId);
    if (inPipeline) return cardsOfSource(sourceOf(inPipeline));
    const inFunnel = ownFunnelStages.find((s) => s.id === stageId);
    if (inFunnel) return cardsOfSource(sourceOf(inFunnel));
    return cardsOfSource({ pipelineId: activePipeline?.id ?? null, stageId, isCrm: isCrmPipeline });
  };

  const countOf = (stageId: string) => itemsOfStage(stageId).length;
  const valueOf = (stageId: string) =>
    itemsOfStage(stageId).reduce((sum, c) => sum + (c.value || 0), 0);
  const frioOf = (stageId: string) => {
    const src = sourceOf(stages.find((s) => s.id === stageId));
    return src.isCrm
      ? crmFrios[src.stageId] || 0
      : localDeals.filter(
          (d) =>
            d.pipelineId === src.pipelineId && d.stageId === src.stageId && isFrioAt(d.updatedAt),
        ).length;
  };

  /**
   * Cards fora das etapas exibidas. Ficam de fora as etapas compartilhadas (elas
   * mostram os leads do funil de origem) e as etapas de outro funil — assim um
   * funil novo não nasce entupido de leads que pertencem a outros funis.
   */
  const ownedElsewhere = new Set(
    funnels
      .filter((f) => f.id !== funnel?.id)
      .flatMap((f) => (f.stages || []).map((s) => s.id)),
  );
  // O quadro de um funil não recebe os leads que moram em outro funil; o quadro
  // do CRM continua mostrando tudo o que não está nas colunas dele.
  const boardOfFunnel = !!linkedFunnel;
  const unmapped: DealCardData[] = isCrmPipeline
    ? rows
        .filter(
          (r) =>
            !r.pipeline_stage ||
            (!knownIds.has(r.pipeline_stage) &&
              !(boardOfFunnel && ownedElsewhere.has(r.pipeline_stage))),
        )
        .map(crmCard)
    : localDealsOfPipeline
        .filter(
          (d) =>
            !knownIds.has(d.stageId) &&
            !(boardOfFunnel && ownedElsewhere.has(d.stageId)),
        )
        .map(localCard);

  /**
   * Cards do quadro. O `stageId` do card é o da COLUNA que o mostra — numa etapa
   * compartilhada isso é a própria etapa (o lead mora na etapa de origem, mas
   * quem o exibe aqui é a coluna compartilhada), senão o card ficaria fora da
   * coluna e sumiria do kanban.
   */
  const cards: DealCardData[] = [
    ...stages.flatMap((s) => itemsOfStage(s.id).map((c) => ({ ...c, stageId: s.id }))),
    ...unmapped,
  ];

  /* ─── KPIs ───────────────────────────────────────────────── */
  /**
   * Linhas de KPI de qualquer lista de etapas. É o mesmo cálculo usado no kanban
   * do pipeline e no desenho do funil.
   */
  const rowsForStages = (list: StageView[]): StageRow[] => {
    const built: StageRow[] = list.map((s, i) => {
      const items = itemsFor(list, s.id);
      const count = items.length;
      const prev = i > 0 ? itemsFor(list, list[i - 1].id).length : 0;
      const src = sourceOf(s);
      const frio = src.isCrm
        ? crmFrios[src.stageId] || 0
        : localDeals.filter(
            (d) =>
              d.pipelineId === src.pipelineId &&
              d.stageId === src.stageId &&
              isFrioAt(d.updatedAt),
          ).length;
      return {
        id: s.id,
        title: s.title,
        color: s.color,
        count,
        frio,
        value: items.reduce((sum, c) => sum + (c.value || 0), 0),
        share: 0,
        conversion: prev > 0 ? count / prev : null,
      };
    });
    const total = built.reduce((sum, r) => sum + r.count, 0);
    built.forEach((r) => (r.share = total ? r.count / total : 0));
    return built;
  };

  const stageRows: StageRow[] = stages.map((s, i) => {
    const items = itemsOfStage(s.id);
    const count = items.length;
    const prev = i > 0 ? countOf(stages[i - 1].id) : 0;
    return {
      id: s.id,
      title: s.title,
      color: s.color,
      count,
      frio: frioOf(s.id),
      value: valueOf(s.id),
      share: 0,
      conversion: prev > 0 ? count / prev : null,
    };
  });
  const total = stageRows.reduce((sum, r) => sum + r.count, 0);
  stageRows.forEach((r) => (r.share = total ? r.count / total : 0));
  const totalValue = stageRows.reduce((sum, r) => sum + r.value, 0);
  const withValue = isCrmPipeline
    ? Object.values(deals).filter((d) => (d.value || 0) > 0).length
    : localDealsOfPipeline.filter((d) => (d.value || 0) > 0).length;
  const todayStart = new Date().setHours(0, 0, 0, 0);
  const todayCount = isCrmPipeline
    ? rows.filter((r) => r.last_message_at && new Date(r.last_message_at).getTime() >= todayStart)
        .length
    : localDealsOfPipeline.filter((d) => new Date(d.createdAt).getTime() >= todayStart).length;

  const stats: FunnelStats = {
    total,
    conversion:
      stageRows.length > 1 && stageRows[0].count > 0
        ? stageRows[stageRows.length - 1].count / stageRows[0].count
        : null,
    totalValue,
    ticket: withValue > 0 ? totalValue / withValue : null,
    frios: stageRows.reduce((sum, r) => sum + r.frio, 0),
    today: todayCount,
  };

  /** KPIs de uma lista de etapas (o desenho do funil usa as etapas do funil). */
  const statsForStages = (list: StageView[]): FunnelStats => {
    const rowsOf = rowsForStages(list);
    const all = list.flatMap((s) => itemsFor(list, s.id));
    const value = rowsOf.reduce((sum, r) => sum + r.value, 0);
    const withValueOf = all.filter((c) => (c.value || 0) > 0).length;
    const todayStart = new Date().setHours(0, 0, 0, 0);
    return {
      total: all.length,
      conversion:
        rowsOf.length > 1 && rowsOf[0].count > 0
          ? rowsOf[rowsOf.length - 1].count / rowsOf[0].count
          : null,
      totalValue: value,
      ticket: withValueOf > 0 ? value / withValueOf : null,
      frios: rowsOf.reduce((sum, r) => sum + r.frio, 0),
      today: all.filter((c) => c.lastAt && new Date(c.lastAt).getTime() >= todayStart).length,
    };
  };

  /* ─── Ações ──────────────────────────────────────────────── */
  const stageConfigFor = (id: string) => funnel?.stageConfig?.[id] || { weight: 100 };

  const updatePipeline = (patch: Partial<Pipeline>) => {
    if (!activePipeline) return;
    updateWorkspace({
      pipelines: pipelines.map((p) => (p.id === activePipeline.id ? { ...p, ...patch } : p)),
    });
  };

  /** Vincula (ou desvincula, com null) o pipeline ativo a um funil. */
  const linkPipeline = (pipelineId: string, funnelId: string | null) => {
    updateWorkspace({
      pipelines: pipelines.map((p) => (p.id === pipelineId ? { ...p, funnelId } : p)),
    });
  };

  const setActivePipeline = (id: string) => {
    const next = pipelines.find((p) => p.id === id);
    // Escolher o pipeline leva o funil dele junto: as telas de Vendas inteiras
    // passam a falar do mesmo par funil + pipeline.
    updateWorkspace({
      activePipelineId: id,
      ...(next?.funnelId ? { activeFunnelId: next.funnelId } : {}),
    });
  };

  /**
   * Liga ou desliga a etapa compartilhada: a etapa `stageId` do funil ativo
   * passa a mostrar os mesmos leads da etapa de origem (outro funil). Com
   * `source` nulo a etapa volta a ter os leads dela.
   */
  const setStageSource = (
    stageId: string,
    source: { funnelId: string; stageId: string } | null,
  ): boolean => {
    if (!funnel) return false;
    const clearLink = (s: (typeof funnel.stages)[number]) => ({
      id: s.id,
      title: s.title,
      color: s.color,
      weight: s.weight,
      description: s.description,
    });
    if (!source) {
      // Desvincular é ficar dono da etapa: se o id ainda é o de uma etapa de
      // outro funil, a etapa ganha id próprio (e começa vazia).
      const idIsShared = funnels.some(
        (f) => f.id !== funnel.id && (f.stages || []).some((o) => o.id === stageId),
      );
      const freshId = idIsShared ? uid() : stageId;
      updateFunnelById(funnel.id, {
        stages: (funnel.stages || []).map((s) =>
          s.id === stageId ? { ...clearLink(s), id: freshId } : s,
        ),
        // Quem apontava para a etapa (webhook e automações) passa a apontar para
        // o id novo, senão ficaria apontando para uma etapa que não existe mais.
        ...(freshId !== stageId
          ? {
              webhook:
                funnel.webhook?.stageId === stageId
                  ? { ...funnel.webhook, stageId: freshId }
                  : funnel.webhook,
              automations: (funnel.automations || []).map((a) =>
                a.stageId === stageId ? { ...a, stageId: freshId } : a,
              ),
            }
          : {}),
      });
      return true;
    }
    const sourceFunnel = funnels.find((f) => f.id === source.funnelId);
    const sourceStage = sourceFunnel?.stages.find((s) => s.id === source.stageId);
    if (!sourceFunnel || !sourceStage || sourceFunnel.id === funnel.id) return false;
    // Se a origem já é compartilhada, o vínculo aponta para a raiz da corrente.
    const origin =
      sourceStage.sourceStageId && sourceStage.sourceFunnelId
        ? { funnelId: sourceStage.sourceFunnelId, stageId: sourceStage.sourceStageId }
        : { funnelId: sourceFunnel.id, stageId: sourceStage.id };
    const owner = pipelines.find((p) => p.funnelId === origin.funnelId);
    updateFunnelById(funnel.id, {
      stages: (funnel.stages || []).map((s) =>
        s.id === stageId
          ? {
              ...s,
              sourceFunnelId: origin.funnelId,
              sourceStageId: origin.stageId,
              sourcePipelineId: owner?.id ?? null,
            }
          : s,
      ),
    });
    return true;
  };

  const setDeal = (leadId: string, patch: Partial<FunnelDeal>) => {
    const current: FunnelDeal = deals[leadId] || {};
    updateWorkspace({
      deals: {
        ...deals,
        [leadId]: { ...current, ...patch, updatedAt: new Date().toISOString() },
      },
    });
  };

  const setLocalDeal = (dealId: string, patch: Partial<LocalDeal>) => {
    updateWorkspace({
      localDeals: localDeals.map((d) =>
        d.id === dealId ? { ...d, ...patch, updatedAt: new Date().toISOString() } : d,
      ),
    });
  };

  const deleteLocalDeal = (dealId: string) => {
    updateWorkspace({ localDeals: localDeals.filter((d) => d.id !== dealId) });
  };

  const moveTo = (cardId: string, toStage: string) => {
    if (toStage === '__none__') return;
    const stage = stages.find((s) => s.id === toStage);
    if (!stage) return;
    // Etapa compartilhada move no funil de origem: o lead anda nos dois funis.
    const src = sourceOf(stage);
    const crmLead = rows.find((r) => r.id === cardId);
    if (crmLead) {
      if (!src.isCrm) {
        toast({
          title: 'Etapa de outro pipeline',
          description: `"${stage.title}" guarda leads próprios e não recebe contatos do CRM.`,
          variant: 'destructive',
        });
        return;
      }
      void updateStage(rows, setRows, cardId, src.stageId, 'movido no funil');
      return;
    }
    const deal = localDeals.find((d) => d.id === cardId);
    // Lead próprio de outro pipeline só anda dentro do pipeline dele.
    if (deal && src.pipelineId && src.pipelineId !== deal.pipelineId) {
      toast({
        title: 'Lead de outro pipeline',
        description: `"${stage.title}" mostra leads de outro funil; mova o lead por lá.`,
        variant: 'destructive',
      });
      return;
    }
    setLocalDeal(cardId, { stageId: src.stageId });
  };

  /**
   * Etapa EXIBIDA que mostra um lead que está na etapa `dataStageId`. Numa etapa
   * compartilhada o lead mora na etapa de origem, mas quem o mostra é a coluna
   * compartilhada — é essa que a tela precisa selecionar.
   */
  const displayStageIdOf = (dataStageId?: string | null): string | null => {
    if (!dataStageId) return null;
    const own = stages.find((s) => s.id === dataStageId);
    if (own) return own.id;
    const shared = stages.find((s) => s.sourceStageId === dataStageId);
    return shared?.id ?? null;
  };

  /** Etapa onde o lead realmente fica (a de origem, se a etapa for compartilhada). */
  const resolveStageId = (stageId: string): string => {
    const stage =
      stages.find((s) => s.id === stageId) ?? ownFunnelStages.find((s) => s.id === stageId);
    return stage ? sourceOf(stage).stageId : stageId;
  };

  const addLead = async (stageId: string, name: string, phone: string) => {
    if (!workspace) return;
    const targetStage = resolveStageId(stageId);
    if (isCrmPipeline) {
      if (!companyId || !phone) return;
      const res = await createLeadManually({
        companyId,
        sessionId: funnel.channelId === 'ALL' ? null : funnel.channelId,
        stageId: targetStage,
        name,
        phone,
        source: 'manual',
      });
      if (!res.ok) return { ok: false as const, error: res.error };
      refresh();
      return { ok: true as const };
    }
    const now = new Date().toISOString();
    const deal: LocalDeal = {
      id: uid(),
      pipelineId: activePipeline?.id || '',
      stageId: targetStage,
      name: name.trim() || 'Novo lead',
      phone: phone.trim() || undefined,
      source: 'manual',
      createdAt: now,
      updatedAt: now,
    };
    updateWorkspace({ localDeals: [...localDeals, deal] });
    return { ok: true as const };
  };

  const redrawFromLeads = () => {
    const max = Math.max(...stageRows.map((r) => r.count), 0);
    if (max <= 0 || !funnel) return false;
    const weightOf = (i: number) =>
      Math.max(14, Math.round((stageRows[i].count / max) * 100));
    // O peso mora nas etapas: do funil vinculado, ou próprias do pipeline local.
    const target = linkedFunnel ?? (isCrmPipeline ? funnel : null);
    if (target) {
      updateFunnelById(target.id, {
        stages: target.stages.map((s, i) => ({ ...s, weight: weightOf(i) })),
      });
    } else {
      updatePipeline({ stages: localStages.map((s, i) => ({ ...s, weight: weightOf(i) })) });
    }
    return true;
  };

  const createPipeline = (
    name: string,
    templateId: string,
    crmSync: boolean,
    funnelId?: string | null,
  ) => {
    const template =
      PIPELINE_TEMPLATES.find((t) => t.id === templateId) || PIPELINE_TEMPLATES[0];
    const pipeline: Pipeline = {
      id: uid(),
      name: name.trim() || 'Novo pipeline',
      crmSync,
      stages: crmSync || funnelId ? [] : buildStages(template.stages),
      webhookStageId: null,
      funnelId: funnelId ?? null,
    };
    updateWorkspace({ pipelines: [...pipelines, pipeline], activePipelineId: pipeline.id });
    return pipeline;
  };

  const deletePipeline = (id: string) => {
    if (pipelines.length <= 1) return false;
    const rest = pipelines.filter((p) => p.id !== id);
    updateWorkspace({
      pipelines: rest,
      activePipelineId: workspace?.activePipelineId === id ? rest[0].id : workspace?.activePipelineId,
      localDeals: (workspace?.localDeals || []).filter((d) => d.pipelineId !== id),
    });
    return true;
  };

  const addLocalStage = () => {
    const stage = buildStages([`Etapa ${localStages.length + 1}`, 'Fechado'])[0];
    updatePipeline({
      stages: [
        ...localStages,
        { ...stage, weight: Math.max(40, localStages[localStages.length - 1]?.weight ?? 60) },
      ],
    });
  };

  const addSource = (type: SourceType) => {
    if (!funnel) return;

    update({
      sources: [
        ...(funnel.sources || []),
        { id: uid(), type, label: SOURCE_LABELS[type], enabled: true },
      ],
    });
  };

  /** Etapas de todos os contextos, sem repetir id — usado pelos seletores. */
  const stagesForSelectors = [
    ...columns,
    ...funnels.flatMap((f) => f.stages || []),
    ...pipelines.flatMap((p) => p.stages || []),
  ]
    .map((s) => ({ id: s.id, title: s.title, color: s.color }))
    .filter((s, i, all) => all.findIndex((o) => o.id === s.id) === i);

  return {
    funnel,
    funnels,
    workspace,
    workspaceLoading,
    workspaceError,
    update,
    updateFunnelById,
    updateWorkspace,
    create: createFunnel,
    createFunnel,
    deleteFunnel,
    setActiveFunnel,
    companyId,
    deals,
    localDeals,
    columns,
    saveColumns,
    sessions,
    connected,
    refreshSessions,
    rows,
    setRows,
    loading,
    error,
    refresh,
    savingStage,
    pipelines,
    activePipeline,
    linkedFunnel,
    isCrmPipeline,
    setActivePipeline,
    linkPipeline,
    stages,
    localStages,
    crmStages,
    /** Etapas do funil ativo — a página do funil desenha estas. */
    funnelStages: ownFunnelStages,
    itemsOfStage,
    itemsFor,
    countOf,
    valueOf,
    frioOf,
    rowsForStages,
    statsForStages,
    setStageSource,
    resolveStageId,
    displayStageIdOf,
    cards,
    unmapped,
    stageRows,
    stats,
    stageConfigFor,
    updatePipeline,
    setDeal,
    setLocalDeal,
    deleteLocalDeal,
    moveTo,
    addLead,
    redrawFromLeads,
    createPipeline,
    deletePipeline,
    addLocalStage,
    addSource,
    stagesForSelectors,
  };
}

export type FunnelData = ReturnType<typeof useFunnelData>;
