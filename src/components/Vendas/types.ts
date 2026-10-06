/** Formas do desenho do funil. Escolhidas pelo usuário e salvas em chartStyle. */
export type ChartStyle = 'cone' | 'steps' | 'chevrons' | 'bars' | 'cards';

export interface FunnelVariantInfo {
  id: ChartStyle;
  name: string;
  hint: string;
}

/** Catálogo das formas disponíveis — fonte única para o seletor e para o desenho. */
export const FUNNEL_VARIANTS: FunnelVariantInfo[] = [
  { id: 'cone', name: 'Funil', hint: 'Cunha clássica com legenda' },
  { id: 'steps', name: 'Degraus', hint: 'Blocos que estreitam na descida' },
  { id: 'chevrons', name: 'Setas', hint: 'Fluxo descendente em pontas' },
  { id: 'bars', name: 'Barras', hint: 'Nomes completos, mais legível' },
  { id: 'cards', name: 'Cartões', hint: 'Um cartão por etapa com conversão' },
];

/** Formas antigas que podem estar salvas em funis criados antes do seletor. */
const LEGACY_CHART_STYLE: Record<string, ChartStyle> = { stacked: 'steps' };

/** Normaliza o valor salvo: mantém formas válidas e converte as antigas. */
export function resolveChartStyle(value?: string | null): ChartStyle {
  if (!value) return 'cone';
  if (LEGACY_CHART_STYLE[value]) return LEGACY_CHART_STYLE[value];
  return FUNNEL_VARIANTS.some((v) => v.id === value) ? (value as ChartStyle) : 'cone';
}

/** Configuração do funil POR etapa — a etapa em si vive no kanban do CRM (whatsapp_kanban_columns). */
export interface FunnelStageConfig {
  /** Largura/altura relativa da etapa no desenho (0–100). 100 = cunha padrão. */
  weight: number;
  description?: string;
}

export type AutomationTrigger =
  | 'on_enter' // quando o lead entra na etapa
  | 'after_days' // após X dias na etapa
  | 'no_response_days' // lead sem resposta há X dias
  | 'moved'; // quando movido manualmente

export type AutomationAction =
  | 'send_whatsapp'
  | 'start_chatbot'
  | 'create_task'
  | 'send_email'
  | 'advance_stage'
  | 'notify_team'
  | 'webhook';

export interface FunnelAutomation {
  id: string;
  /** id da etapa = id da coluna do kanban do CRM. */
  stageId: string;
  trigger: AutomationTrigger;
  days?: number;
  action: AutomationAction;
  config?: string;
  active: boolean;
}

export type SourceType =
  | 'crm_whatsapp'
  | 'webhook'
  | 'landing_form'
  | 'lead_capture'
  | 'csv'
  | 'api'
  | 'instagram'
  | 'manual';

export interface FunnelSource {
  id: string;
  type: SourceType;
  label: string;
  enabled: boolean;
  config?: string;
}

export interface FunnelIntegration {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
}

/**
 * Dados comerciais do lead/negociação — ficam no funil (o CRM só fornece o
 * estado: etapa, temperatura da IA e última atividade).
 * Chave = id da conversa no CRM.
 */
export interface FunnelDeal {
  company?: string;
  contact?: string;
  email?: string;
  /** Valor da negociação em BRL. */
  value?: number;
  /** Orçamento informado pelo cliente (BRL) — diferente do valor fechado. */
  budget?: number;
  /** Probabilidade de fechar: 0–100. */
  probability?: number;
  /** Previsão de fechamento (YYYY-MM-DD). */
  expectedClose?: string;
  /** Etiquetas livres (ex.: "indicação", "urgente"). */
  tags?: string[];
  /** Override manual da temperatura; vazio = usar temperature_stage do CRM (IA). */
  temperature?: string;
  /** Observações da negociação (anotações da IA + equipe). */
  notes?: string;
  /** Nome do responsável. */
  owner?: string;
  /** id do usuário responsável (company_users.user_id) quando atribuído pelo time. */
  ownerId?: string;
  /** produto/serviço em negociação. */
  product?: string;
  /** origem do lead dentro do funil. */
  origin?: string;
  updatedAt?: string;
}

/** Etapa de um pipeline independente (não sincronizado com o CRM). */
export interface PipelineStage {
  id: string;
  title: string;
  color: string;
  /** Largura no desenho do funil (0–100). */
  weight: number;
  description?: string;
}

export interface Pipeline {
  id: string;
  name: string;
  /** true = os cards vêm das conversas do CRM (whatsapp_conversations). */
  crmSync: boolean;
  /** Etapas próprias — usadas apenas quando não há funil vinculado. */
  stages: PipelineStage[];
  webhookStageId?: string | null;
  /**
   * Funil vinculado, opcional. Quando definido, as etapas do pipeline são as
   * etapas daquele funil (mesmos nomes, ordem, cores e pesos) — o pipeline fica
   * igual ao funil. Sem vínculo, o pipeline usa as colunas do CRM (crmSync) ou
   * as próprias etapas.
   */
  funnelId?: string | null;
}

/** Lead/negociação de um pipeline não-CRM (criado manualmente ou via webhook local). */
export interface LocalDeal {
  id: string;
  pipelineId: string;
  stageId: string;
  name: string;
  company?: string;
  contact?: string;
  email?: string;
  phone?: string;
  value?: number;
  budget?: number;
  probability?: number;
  expectedClose?: string;
  tags?: string[];
  temperature?: string;
  notes?: string;
  owner?: string;
  ownerId?: string;
  product?: string;
  origin?: string;
  source?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SalesFunnel {
  id: string;
  name: string;
  description: string;
  chartStyle: ChartStyle;
  showNumbers: boolean;
  /** Puxa leads e conversas do CRM WhatsApp. */
  syncCrm: boolean;
  /** 'ALL' ou id do canal (whatsapp_sessions) conectado. */
  channelId: string;
  /** Período dos números: 0 = tudo, 1 = hoje, 7/30 dias. */
  periodDays: number;
  /**
   * Etapas do funil — fonte única de nome, ordem, cor e peso.
   * Nasce como cópia das colunas do kanban do CRM (mantendo os mesmos ids, para
   * os leads do CRM continuarem mapeados) e depois evolui por conta própria.
   */
  stages: PipelineStage[];
  /** Extras do desenho por etapa (descrição). O peso mora em `stages[].weight`. */
  stageConfig: Record<string, FunnelStageConfig>;
  webhook: { stageId: string | null };
  sources: FunnelSource[];
  automations: FunnelAutomation[];
  integrations: FunnelIntegration[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Documento do módulo de Vendas, um por empresa (tabela sales_workspaces).
 *
 * Vários funis convivem aqui e os pipelines ficam no mesmo nível, cada um com
 * vínculo opcional a um funil (`Pipeline.funnelId`). Os dados comerciais
 * (`deals`, `localDeals`) são do documento, não do funil, para não dividir a
 * negociação de um lead quando ele muda de funil.
 */
export interface SalesWorkspace {
  version: 3;
  funnels: SalesFunnel[];
  activeFunnelId: string;
  pipelines: Pipeline[];
  activePipelineId: string;
  deals: Record<string, FunnelDeal>;
  localDeals: LocalDeal[];
}

/** v3: vários funis + pipelines com vínculo opcional (novo formato). */
export const WORKSPACE_STORAGE_KEY = 'ello_sales_workspace_v3';
/** v2: um funil só. Mantido para migrar quem já usava. */
export const STORAGE_KEY = 'ello_sales_funil_v2';
/** v1: lista de funis. */
export const LEGACY_STORAGE_KEY = 'ello_sales_funis_v1';
export const COLUMNS_STORAGE_KEY = 'whatsapp_kanban_columns';

export const uid = () => Math.random().toString(36).slice(2, 10);

export const PIPELINE_TEMPLATES: { id: string; name: string; stages: string[] }[] = [
  {
    id: 'padrao',
    name: 'Pipeline padrão',
    stages: ['Prospecção', 'Contato feito', 'Negociação', 'Proposta enviada', 'Fechado'],
  },
  {
    id: 'inbound',
    name: 'Inbound (RD Station)',
    stages: ['Novo lead', 'Lead qualificado', 'Oportunidade', 'Proposta', 'Fechado ganho'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    stages: ['Descoberta', 'Reunião', 'Diagnóstico', 'Proposta', 'Contrato', 'Onboarding'],
  },
];

/** Paleta padrão das etapas — usada por buildStages e pelo builder do funil. */
export const STAGE_PALETTE = [
  '#374DA4',
  '#4D7CFF',
  '#0EA5E9',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#6B7280',
];

export function buildStages(titles: string[]): PipelineStage[] {
  const n = Math.max(titles.length - 1, 1);
  return titles.map((title, i) => ({
    id: uid(),
    title,
    color: STAGE_PALETTE[i % STAGE_PALETTE.length],
    weight: Math.max(40, Math.round(100 - i * (55 / n))),
  }));
}

export const SOURCE_LABELS: Record<SourceType, string> = {
  crm_whatsapp: 'CRM WhatsApp',
  webhook: 'Webhook (API)',
  landing_form: 'Formulário / Landing Page',
  lead_capture: 'Captura de Leads',
  csv: 'Importação CSV',
  api: 'API Pública',
  instagram: 'Instagram / Meta',
  manual: 'Cadastro manual',
};

export const TRIGGER_LABELS: Record<AutomationTrigger, string> = {
  on_enter: 'Ao entrar na etapa',
  after_days: 'Após X dias na etapa',
  no_response_days: 'Lead sem resposta há X dias',
  moved: 'Ao ser movido manualmente',
};

export const ACTION_LABELS: Record<AutomationAction, string> = {
  send_whatsapp: 'Enviar mensagem no WhatsApp',
  start_chatbot: 'Iniciar chatbot',
  create_task: 'Criar tarefa para a equipe',
  send_email: 'Enviar email',
  advance_stage: 'Avançar para a próxima etapa',
  notify_team: 'Notificar equipe',
  webhook: 'Chamar webhook',
};

/** Colunas do kanban do CRM (mesmo fallback do WhatsAppCRM). */
export const DEFAULT_CRM_COLUMNS = [
  { id: 'novo', title: 'Novos', color: '#374DA4' },
  { id: 'em_atendimento', title: 'Em Atendimento', color: '#F59E0B' },
  { id: 'aguardando', title: 'Aguardando', color: '#8B5CF6' },
  { id: 'qualificado', title: 'Qualificados', color: '#10B981' },
  { id: 'finalizado', title: 'Finalizados', color: '#6B7280' },
];

export type PipelineColumn = { id: string; title: string; color: string };

export function loadCrmColumns(): PipelineColumn[] {
  try {
    const raw = localStorage.getItem(COLUMNS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // ignora
  }
  return DEFAULT_CRM_COLUMNS;
}

export function saveCrmColumns(columns: PipelineColumn[]) {
  localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(columns));
  window.dispatchEvent(new Event('ello-pipeline-changed'));
}

/** Largura padrão da etapa no desenho (cunha decrescente). */
export function defaultWeight(index: number, total: number): number {
  if (total <= 1) return 100;
  return Math.max(40, Math.round(100 - index * (55 / (total - 1))));
}

const defaultIntegrations = (): FunnelIntegration[] => [
  { id: 'crm', label: 'CRM WhatsApp', description: 'Puxa leads, etapas e conversas do kanban do CRM', enabled: true },
  { id: 'webhook', label: 'Webhook de entrada', description: 'Recebe leads externos direto na etapa escolhida', enabled: true },
  { id: 'email', label: 'Email Marketing', description: 'Dispara campanhas por etapa', enabled: false },
  { id: 'meta', label: 'Instagram / Meta', description: 'Leads vindos dos anúncios e direct', enabled: false },
  { id: 'sheets', label: 'Google Sheets', description: 'Espelha os leads em planilhas', enabled: false },
  { id: 'api', label: 'API Pública', description: 'Acesse o funil pelo endpoint da API', enabled: false },
];

const defaultSources = (): FunnelSource[] => [
  { id: uid(), type: 'crm_whatsapp', label: 'Conversas do CRM WhatsApp', enabled: true },
  { id: uid(), type: 'webhook', label: 'Webhook de entrada', enabled: true },
  { id: uid(), type: 'manual', label: 'Cadastro manual pela equipe', enabled: true },
];

/**
 * Etapas iniciais de um funil: cópia das colunas do kanban do CRM.
 * Os ids são os mesmos das colunas, então os leads do CRM já nascem mapeados.
 */
export function stagesFromCrmColumns(): PipelineStage[] {
  const columns = loadCrmColumns();
  return columns.map((c, i) => ({
    id: c.id,
    title: c.title,
    color: c.color,
    weight: defaultWeight(i, columns.length),
  }));
}

export function newFunnel(name: string, stages?: PipelineStage[]): SalesFunnel {
  const now = new Date().toISOString();
  const ownStages = stages && stages.length ? stages : stagesFromCrmColumns();
  return {
    id: uid(),
    name,
    description: '',
    chartStyle: 'cone',
    showNumbers: true,
    syncCrm: true,
    channelId: 'ALL',
    periodDays: 0,
    stages: ownStages,
    stageConfig: {},
    webhook: { stageId: ownStages[0]?.id || null },
    sources: defaultSources(),
    automations: [],
    integrations: defaultIntegrations(),
    createdAt: now,
    updatedAt: now,
  };
}

/** Pipeline do CRM: cards das conversas e etapas do funil vinculado. */
export function newCrmPipeline(funnel: SalesFunnel): Pipeline {
  return {
    id: uid(),
    name: 'Pipeline Principal',
    crmSync: true,
    stages: [],
    webhookStageId: funnel.stages[0]?.id || null,
    funnelId: funnel.id,
  };
}

export function emptyWorkspace(): SalesWorkspace {
  return {
    version: 3,
    funnels: [],
    activeFunnelId: '',
    pipelines: [],
    activePipelineId: '',
    deals: {},
    localDeals: [],
  };
}

/* ─── Snapshot v2, migrações e documento v3 ──────────────────── */

/** Formato v1: lista de funis, cada um com etapas próprias. */
interface LegacyFunnel {
  id?: string;
  name?: string;
  description?: string;
  chartStyle?: ChartStyle;
  showNumbers?: boolean;
  syncCrm?: boolean;
  sources?: FunnelSource[];
  integrations?: FunnelIntegration[];
  automations?: FunnelAutomation[];
  stages?: { id: string; weight?: number }[];
  createdAt?: string;
}

/**
 * Formato v2 (um funil só, com pipelines e negociações dentro dele).
 * É também o que a migração da v1 produz, para existir um caminho único até a v3.
 */
export type FunnelSnapshot = Partial<SalesFunnel> & {
  pipelines?: Pipeline[];
  activePipelineId?: string;
  deals?: Record<string, FunnelDeal>;
  localDeals?: LocalDeal[];
};

/**
 * Migra o v1 para o snapshot v2: os ids das etapas antigas são remapeados para
 * as colunas do CRM, então as automações continuam apontando para etapas reais.
 */
export function migrateV1(raw: LegacyFunnel): FunnelSnapshot {
  const columns = loadCrmColumns();
  const oldStages = Array.isArray(raw?.stages) ? raw.stages : [];
  const idMap: Record<string, string> = {};
  const stages: PipelineStage[] = columns.map((c, i) => {
    const old = oldStages[i];
    if (old) idMap[old.id] = c.id;
    return {
      id: c.id,
      title: c.title,
      color: c.color,
      weight: old?.weight ?? defaultWeight(i, columns.length),
    };
  });

  return {
    id: raw?.id,
    name: raw?.name || 'Meu Funil',
    description: raw?.description || '',
    chartStyle: resolveChartStyle(raw?.chartStyle),
    showNumbers: raw?.showNumbers ?? true,
    syncCrm: raw?.syncCrm ?? true,
    stages,
    sources: Array.isArray(raw?.sources) && raw.sources.length ? raw.sources : defaultSources(),
    integrations:
      Array.isArray(raw?.integrations) && raw.integrations.length
        ? raw.integrations
        : defaultIntegrations(),
    automations: (Array.isArray(raw?.automations) ? raw.automations : [])
      .map((a) => ({ ...a, stageId: idMap[a.stageId] || columns[0]?.id }))
      .filter((a) => !!a.stageId),
    createdAt: raw?.createdAt,
  };
}

/** Converte um snapshot (v2 ou v1 migrado) no documento v3. */
export function workspaceFromV2(raw: FunnelSnapshot): SalesWorkspace {
  const stages =
    Array.isArray(raw.stages) && raw.stages.length
      ? raw.stages
      : stagesFromCrmColumns().map((s) => ({
          ...s,
          weight: raw.stageConfig?.[s.id]?.weight ?? s.weight,
        }));

  const funnel: SalesFunnel = {
    ...newFunnel(raw.name || 'Meu Funil', stages),
    id: raw.id || uid(),
    name: raw.name || 'Meu Funil',
    description: raw.description || '',
    chartStyle: resolveChartStyle(raw.chartStyle),
    showNumbers: raw.showNumbers ?? true,
    syncCrm: raw.syncCrm ?? true,
    channelId: raw.channelId || 'ALL',
    periodDays: raw.periodDays ?? 0,
    stages,
    stageConfig: raw.stageConfig || {},
    webhook: raw.webhook || { stageId: stages[0]?.id || null },
    sources: raw.sources?.length ? raw.sources : defaultSources(),
    integrations: raw.integrations?.length ? raw.integrations : defaultIntegrations(),
    automations: Array.isArray(raw.automations) ? raw.automations : [],
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const rawPipelines =
    Array.isArray(raw.pipelines) && raw.pipelines.length
      ? raw.pipelines
      : [newCrmPipeline(funnel)];

  // O pipeline do CRM passa a seguir o funil (as etapas são as mesmas colunas,
  // então nada muda na tela). Pipelines locais mantêm as etapas próprias e
  // ficam sem vínculo: vincular é escolha de quem usa.
  const pipelines: Pipeline[] = rawPipelines.map((p) => ({
    ...p,
    stages: Array.isArray(p.stages) ? p.stages : [],
    funnelId: p.crmSync ? funnel.id : null,
  }));

  return {
    version: 3,
    funnels: [funnel],
    activeFunnelId: funnel.id,
    pipelines,
    activePipelineId: raw.activePipelineId || pipelines[0].id,
    deals: raw.deals || {},
    localDeals: Array.isArray(raw.localDeals) ? raw.localDeals : [],
  };
}

/** Completa campos que podem faltar em um funil salvo por uma versão anterior. */
function normalizeFunnel(raw: Partial<SalesFunnel>): SalesFunnel {
  const stages =
    Array.isArray(raw.stages) && raw.stages.length ? raw.stages : stagesFromCrmColumns();
  return {
    ...newFunnel(raw.name || 'Meu Funil', stages),
    ...raw,
    stages,
    chartStyle: resolveChartStyle(raw.chartStyle),
    stageConfig: raw.stageConfig || {},
    webhook: raw.webhook || { stageId: stages[0]?.id || null },
    sources: raw.sources?.length ? raw.sources : defaultSources(),
    integrations: raw.integrations?.length ? raw.integrations : defaultIntegrations(),
    automations: Array.isArray(raw.automations) ? raw.automations : [],
  } as SalesFunnel;
}

/** Valida e completa o documento lido do banco ou do cache local. */
export function normalizeWorkspace(raw: unknown): SalesWorkspace | null {
  if (!raw || typeof raw !== 'object') return null;
  const ws = raw as Partial<SalesWorkspace>;

  const funnels = (Array.isArray(ws.funnels) ? ws.funnels : [])
    .filter((f) => !!f && typeof f === 'object')
    .map((f) => normalizeFunnel(f as Partial<SalesFunnel>));
  if (!funnels.length) return null;

  const pipelines = (Array.isArray(ws.pipelines) ? ws.pipelines : [])
    .filter((p): p is Pipeline => !!p && typeof p === 'object' && !!p.id)
    .map((p) => ({
      ...p,
      stages: Array.isArray(p.stages) ? p.stages : [],
      funnelId: p.funnelId ?? null,
    }));
  const list = pipelines.length ? pipelines : [newCrmPipeline(funnels[0])];

  const activeFunnelId = funnels.some((f) => f.id === ws.activeFunnelId)
    ? (ws.activeFunnelId as string)
    : funnels[0].id;

  return {
    version: 3,
    funnels,
    activeFunnelId,
    pipelines: list,
    activePipelineId: list.some((p) => p.id === ws.activePipelineId)
      ? (ws.activePipelineId as string)
      : list[0].id,
    deals:
      ws.deals && typeof ws.deals === 'object'
        ? (ws.deals as Record<string, FunnelDeal>)
        : {},
    localDeals: Array.isArray(ws.localDeals) ? ws.localDeals : [],
  };
}

/**
 * Depois que o documento v3 existe, as chaves antigas só confundiriam numa
 * eventual releitura — o banco é a fonte de verdade.
 */
function dropLegacyKeys() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // storage indisponível — nada a limpar
  }
}

/**
 * Documento do cache local, já migrado de v2/v1 quando necessário.
 * O banco é a fonte de verdade; o cache existe para a tela abrir sem esperar.
 */
export function loadWorkspace(): SalesWorkspace | null {
  try {
    const raw = localStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (raw) {
      const parsed = normalizeWorkspace(JSON.parse(raw));
      if (parsed) {
        dropLegacyKeys();
        return parsed;
      }
    }

    const v2 = localStorage.getItem(STORAGE_KEY);
    if (v2) {
      const parsed = JSON.parse(v2);
      if (parsed && typeof parsed === 'object' && parsed.id) {
        const migrated = workspaceFromV2(parsed);
        saveWorkspace(migrated);
        dropLegacyKeys();
        return migrated;
      }
    }

    const v1 = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (v1) {
      const arr = JSON.parse(v1);
      if (Array.isArray(arr) && arr.length > 0) {
        const migrated = workspaceFromV2(migrateV1(arr[0]));
        saveWorkspace(migrated);
        dropLegacyKeys();
        return migrated;
      }
    }
  } catch {
    // cache corrompido — segue vazio e o banco decide
  }
  return null;
}

export function saveWorkspace(workspace: SalesWorkspace) {
  try {
    localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(workspace));
  } catch {
    // storage indisponível — mantém apenas em memória
  }
}
