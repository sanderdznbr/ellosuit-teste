export type ChartStyle = 'cone' | 'stacked' | 'bars';

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
  /** true = as etapas são as colunas do kanban do CRM (estado sincronizado). */
  crmSync: boolean;
  /** Etapas próprias (usadas quando crmSync = false). */
  stages: PipelineStage[];
  webhookStageId?: string | null;
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
  stageConfig: Record<string, FunnelStageConfig>;
  webhook: { stageId: string | null };
  /** Dados comerciais por lead do CRM (chave = conversation id). */
  deals: Record<string, FunnelDeal>;
  /** Vários pipelines; o primeiro (crmSync) é o sincronizado com o CRM. */
  pipelines: Pipeline[];
  activePipelineId: string;
  /** Leads dos pipelines não-CRM. */
  localDeals: LocalDeal[];
  sources: FunnelSource[];
  automations: FunnelAutomation[];
  integrations: FunnelIntegration[];
  createdAt: string;
  updatedAt: string;
}

export const STORAGE_KEY = 'ello_sales_funil_v2';
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

export function buildStages(titles: string[]): PipelineStage[] {
  const palette = ['#374DA4', '#4D7CFF', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#6B7280'];
  const n = Math.max(titles.length - 1, 1);
  return titles.map((title, i) => ({
    id: uid(),
    title,
    color: palette[i % palette.length],
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

export function newFunnel(name: string): SalesFunnel {
  const now = new Date().toISOString();
  const columns = loadCrmColumns();
  const stageConfig: Record<string, FunnelStageConfig> = {};
  columns.forEach((c, i) => {
    stageConfig[c.id] = { weight: defaultWeight(i, columns.length) };
  });
  return {
    id: uid(),
    name,
    description: '',
    chartStyle: 'cone',
    showNumbers: true,
    syncCrm: true,
    channelId: 'ALL',
    periodDays: 0,
    stageConfig,
    webhook: { stageId: columns[0]?.id || null },
    deals: {},
    pipelines: [
      { id: 'crm', name: 'Pipeline Principal', crmSync: true, stages: [], webhookStageId: columns[0]?.id || null },
    ],
    activePipelineId: 'crm',
    localDeals: [],
    sources: defaultSources(),
    automations: [],
    integrations: defaultIntegrations(),
    createdAt: now,
    updatedAt: now,
  };
}

/** Migra o modelo v1 (stages próprios) para v2 (etapas = colunas do CRM). */
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

function migrateV1(raw: LegacyFunnel): SalesFunnel {
  const columns = loadCrmColumns();
  const base = newFunnel(raw?.name || 'Meu Funil');
  const stageConfig: Record<string, FunnelStageConfig> = {};
  const idMap: Record<string, string> = {};
  const oldStages = Array.isArray(raw?.stages) ? raw.stages : [];

  oldStages.forEach((s, i) => {
    const col = columns[i];
    if (!col) return;
    idMap[s.id] = col.id;
    stageConfig[col.id] = { weight: s.weight ?? defaultWeight(i, columns.length) };
  });
  columns.forEach((c, i) => {
    if (!stageConfig[c.id]) stageConfig[c.id] = { weight: defaultWeight(i, columns.length) };
  });

  return {
    ...base,
    id: raw?.id || base.id,
    name: raw?.name || base.name,
    description: raw?.description || '',
    chartStyle: raw?.chartStyle || 'cone',
    showNumbers: raw?.showNumbers ?? true,
    syncCrm: raw?.syncCrm ?? true,
    stageConfig,
    sources: Array.isArray(raw?.sources) && raw.sources.length ? raw.sources : base.sources,
    integrations: Array.isArray(raw?.integrations) && raw.integrations.length ? raw.integrations : base.integrations,
    automations: (Array.isArray(raw?.automations) ? raw.automations : [])
      .map((a) => ({ ...a, stageId: idMap[a.stageId] || columns[0]?.id }))
      .filter((a) => !!a.stageId),
    createdAt: raw?.createdAt || base.createdAt,
    updatedAt: new Date().toISOString(),
  };
}

export function loadFunnel(): SalesFunnel | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && parsed.id) {
        // preenche campos novos que possam faltar em funis salvos antes do v2.2
        parsed.deals = parsed.deals || {};
        parsed.stageConfig = parsed.stageConfig || {};
        parsed.webhook = parsed.webhook || { stageId: null };
        if (!Array.isArray(parsed.pipelines) || !parsed.pipelines.length) {
          parsed.pipelines = [
            { id: 'crm', name: 'Pipeline Principal', crmSync: true, stages: [], webhookStageId: parsed.webhook?.stageId || null },
          ];
        }
        parsed.activePipelineId =
          parsed.activePipelineId || parsed.pipelines[0]?.id || 'crm';
        parsed.localDeals = Array.isArray(parsed.localDeals) ? parsed.localDeals : [];
        return parsed as SalesFunnel;
      }
    }
    // migração v1 → v2 (pega o primeiro funil criado)
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
      const arr = JSON.parse(legacy);
      if (Array.isArray(arr) && arr.length > 0) {
        const migrated = migrateV1(arr[0]);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      }
    }
  } catch {
    // ignora
  }
  return null;
}

export function saveFunnel(funnel: SalesFunnel) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(funnel));
  } catch {
    // storage indisponível — mantém apenas em memória
  }
}
