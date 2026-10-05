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
import {
  createLeadManually,
  CrmLead,
  friosByStage,
  groupByStage,
  useCompany,
  useCrmLeads,
  useCrmSessions,
  useFunnel,
  usePipelineColumns,
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
  const { funnel, update, create } = useFunnel();
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

  /* ─── Pipelines e etapas ─────────────────────────────────── */
  const pipelines = funnel?.pipelines || [];
  const activePipeline: Pipeline | undefined =
    pipelines.find((p) => p.id === funnel?.activePipelineId) || pipelines[0];
  const isCrmPipeline = !!activePipeline?.crmSync;

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
  const stages: StageView[] = isCrmPipeline ? crmStages : localStages;

  /* ─── Leads agrupados ────────────────────────────────────── */
  const localDeals = funnel?.localDeals || [];
  const localDealsOfPipeline = localDeals.filter((d) => d.pipelineId === activePipeline?.id);
  const crmByStage = groupByStage(rows);
  const crmFrios = friosByStage(rows);
  const localByStage: Record<string, LocalDeal[]> = {};
  localDealsOfPipeline.forEach((d) => (localByStage[d.stageId] ||= []).push(d));

  const itemsOfStage = (stageId: string): DealCardData[] =>
    isCrmPipeline
      ? (crmByStage[stageId] || []).map((lead) => {
          const deal: FunnelDeal = funnel?.deals?.[lead.id] || {};
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
        })
      : (localByStage[stageId] || []).map((d) => ({
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
        }));

  const countOf = (stageId: string) => itemsOfStage(stageId).length;
  const valueOf = (stageId: string) =>
    itemsOfStage(stageId).reduce((sum, c) => sum + (c.value || 0), 0);
  const frioOf = (stageId: string) =>
    isCrmPipeline
      ? crmFrios[stageId] || 0
      : (localByStage[stageId] || []).filter((d) => isFrioAt(d.updatedAt)).length;

  const cards: DealCardData[] = stages.flatMap((s) => itemsOfStage(s.id));

  const knownIds = new Set(stages.map((s) => s.id));
  const unmapped = isCrmPipeline
    ? rows.filter((r: CrmLead) => !r.pipeline_stage || !knownIds.has(r.pipeline_stage))
    : [];

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
    ? Object.values(funnel?.deals || {}).filter((d) => (d.value || 0) > 0).length
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
    if (!funnel || !activePipeline) return;
    update({
      pipelines: pipelines.map((p) => (p.id === activePipeline.id ? { ...p, ...patch } : p)),
    });
  };

  const setDeal = (leadId: string, patch: Partial<FunnelDeal>) => {
    if (!funnel) return;
    const current: FunnelDeal = funnel.deals?.[leadId] || {};
    update({
      deals: {
        ...(funnel.deals || {}),
        [leadId]: { ...current, ...patch, updatedAt: new Date().toISOString() },
      },
    });
  };

  const setLocalDeal = (dealId: string, patch: Partial<LocalDeal>) => {
    if (!funnel) return;
    update({
      localDeals: (funnel.localDeals || []).map((d) =>
        d.id === dealId ? { ...d, ...patch, updatedAt: new Date().toISOString() } : d,
      ),
    });
  };

  const deleteLocalDeal = (dealId: string) => {
    if (!funnel) return;
    update({ localDeals: (funnel.localDeals || []).filter((d) => d.id !== dealId) });
  };

  const moveTo = (cardId: string, toStage: string) => {
    if (toStage === '__none__') return;
    if (isCrmPipeline) {
      void updateStage(rows, setRows, cardId, toStage, 'movido no funil');
    } else {
      setLocalDeal(cardId, { stageId: toStage });
    }
  };

  const addLead = async (stageId: string, name: string, phone: string) => {
    if (!funnel) return;
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
    update({ localDeals: [...(funnel.localDeals || []), deal] });
    return { ok: true as const };
  };

  const redrawFromLeads = () => {
    const max = Math.max(...stageRows.map((r) => r.count), 0);
    if (max <= 0 || !funnel) return false;
    const weightOf = (i: number) =>
      Math.max(14, Math.round((stageRows[i].count / max) * 100));
    if (isCrmPipeline) {
      const nextConfig = { ...funnel.stageConfig };
      stages.forEach((s, i) => {
        nextConfig[s.id] = { ...stageConfigFor(s.id), weight: weightOf(i) };
      });
      update({ stageConfig: nextConfig });
    } else {
      updatePipeline({ stages: localStages.map((s, i) => ({ ...s, weight: weightOf(i) })) });
    }
    return true;
  };

  const createPipeline = (name: string, templateId: string, crmSync: boolean) => {
    if (!funnel) return;
    const template =
      PIPELINE_TEMPLATES.find((t) => t.id === templateId) || PIPELINE_TEMPLATES[0];
    const pipeline: Pipeline = {
      id: uid(),
      name: name.trim() || 'Novo pipeline',
      crmSync,
      stages: crmSync ? [] : buildStages(template.stages),
      webhookStageId: null,
    };
    update({ pipelines: [...pipelines, pipeline], activePipelineId: pipeline.id });
    return pipeline;
  };

  const deletePipeline = (id: string) => {
    if (!funnel) return false;
    if (pipelines.length <= 1) return false;
    const rest = pipelines.filter((p) => p.id !== id);
    update({
      pipelines: rest,
      activePipelineId: funnel.activePipelineId === id ? rest[0].id : funnel.activePipelineId,
      localDeals: (funnel.localDeals || []).filter((d) => d.pipelineId !== id),
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

  const stagesForSelectors = [
    ...columns,
    ...pipelines.flatMap((p) => p.stages || []).map((s) => ({ id: s.id, title: s.title, color: s.color })),
  ];

  return {
    funnel,
    update,
    create,
    companyId,
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
    isCrmPipeline,
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
