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
    }));
  }, [linkedFunnel]);

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

  /** Ids válidos para o pipeline ativo — o resto vai para "Sem etapa". */
  const knownIds = new Set(stages.map((s) => s.id));

  /* ─── Leads agrupados ────────────────────────────────────── */
  const deals = workspace?.deals || {};
  const localDeals = workspace?.localDeals || [];
  const localDealsOfPipeline = localDeals.filter((d) => d.pipelineId === activePipeline?.id);
  const crmByStage = groupByStage(rows);
  const crmFrios = friosByStage(rows);
  const localByStage: Record<string, LocalDeal[]> = {};
  localDealsOfPipeline.forEach((d) => (localByStage[d.stageId] ||= []).push(d));

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

  const itemsOfStage = (stageId: string): DealCardData[] =>
    isCrmPipeline
      ? (crmByStage[stageId] || []).map(crmCard)
      : (localByStage[stageId] || []).map(localCard);

  const countOf = (stageId: string) => itemsOfStage(stageId).length;
  const valueOf = (stageId: string) =>
    itemsOfStage(stageId).reduce((sum, c) => sum + (c.value || 0), 0);
  const frioOf = (stageId: string) =>
    isCrmPipeline
      ? crmFrios[stageId] || 0
      : (localByStage[stageId] || []).filter((d) => isFrioAt(d.updatedAt)).length;

  /**
   * Cards fora das etapas do pipeline. Acontece quando o funil vinculado não
   * tem (ou perdeu) uma etapa que existe no CRM — esses leads aparecem na
   * coluna "Sem etapa" em vez de desaparecerem da tela.
   */
  const unmapped: DealCardData[] = isCrmPipeline
    ? rows
        .filter((r) => !r.pipeline_stage || !knownIds.has(r.pipeline_stage))
        .map(crmCard)
    : localDealsOfPipeline.filter((d) => !knownIds.has(d.stageId)).map(localCard);

  const cards: DealCardData[] = [
    ...stages.flatMap((s) => itemsOfStage(s.id)),
    ...unmapped,
  ];

  /* ─── KPIs ───────────────────────────────────────────────── */
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

  const setActivePipeline = (id: string) => updateWorkspace({ activePipelineId: id });

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
    if (isCrmPipeline) {
      // O CRM só conhece as próprias colunas. Mover um lead para uma etapa que
      // só existe no funil o faria sumir do kanban do CRM, então é recusado.
      if (columns.length > 0 && !columns.some((c) => c.id === toStage)) {
        toast({
          title: 'Etapa não existe no CRM',
          description: `"${stages.find((s) => s.id === toStage)?.title ?? toStage}" é uma etapa só do funil. Escolha uma etapa sincronizada.`,
          variant: 'destructive',
        });
        return;
      }
      void updateStage(rows, setRows, cardId, toStage, 'movido no funil');
    } else {
      setLocalDeal(cardId, { stageId: toStage });
    }
  };

  const addLead = async (stageId: string, name: string, phone: string) => {
    if (!workspace) return;
    if (isCrmPipeline) {
      if (!companyId || !phone) return;
      const res = await createLeadManually({
        companyId,
        sessionId: funnel.channelId === 'ALL' ? null : funnel.channelId,
        stageId,
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
      stageId,
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
    itemsOfStage,
    countOf,
    valueOf,
    frioOf,
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
