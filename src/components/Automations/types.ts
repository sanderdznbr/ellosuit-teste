
export interface AutomationNode {
  id: string;
  type: string;
  label: string;
  position: { x: number; y: number };
  data: Record<string, any>;
  config?: Record<string, any>;
}

export interface AutomationEdge {
  id: string;
  source: string;
  target: string;
  sourceField?: string;
  targetField?: string;
  label?: string;
}

export interface Automation {
  id: string;
  company_id: string;
  created_by: string;
  name: string;
  description: string | null;
  trigger_type: string;
  trigger_config: Record<string, any>;
  actions: Record<string, any>[];
  nodes: AutomationNode[];
  edges: AutomationEdge[];
  is_active: boolean | null;
  execution_count: number | null;
  last_executed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AutomationBlockDefinition {
  type: string;
  label: string;
  description: string;
  category: 'trigger' | 'action' | 'condition' | 'transform';
  icon: string;
  color: string;
  defaultConfig: Record<string, any>;
}

export const AUTOMATION_BLOCKS: AutomationBlockDefinition[] = [
  // Triggers
  {
    type: 'webhook',
    label: 'Webhook',
    description: 'Recebe dados via HTTP POST',
    category: 'trigger',
    icon: 'Globe',
    color: '#374DA4',
    defaultConfig: { method: 'POST', path: '' },
  },
  {
    type: 'new_client',
    label: 'Novo Cliente',
    description: 'Quando um cliente é adicionado',
    category: 'trigger',
    icon: 'UserPlus',
    color: '#10B981',
    defaultConfig: { clientType: 'any' },
  },
  {
    type: 'client_updated',
    label: 'Cliente Atualizado',
    description: 'Quando dados do cliente mudam',
    category: 'trigger',
    icon: 'UserCog',
    color: '#8B5CF6',
    defaultConfig: { fields: [] },
  },
  {
    type: 'schedule',
    label: 'Agendamento',
    description: 'Executa em horário definido',
    category: 'trigger',
    icon: 'Clock',
    color: '#F59E0B',
    defaultConfig: { cron: '0 9 * * *' },
  },
  {
    type: 'proposal_status',
    label: 'Status Proposta',
    description: 'Quando proposta muda de status',
    category: 'trigger',
    icon: 'FileCheck',
    color: '#EC4899',
    defaultConfig: { status: 'approved' },
  },

  // Actions
  {
    type: 'create_client',
    label: 'Criar Cliente',
    description: 'Adiciona cliente na base',
    category: 'action',
    icon: 'UserPlus',
    color: '#10B981',
    defaultConfig: { fieldMapping: {} },
  },
  {
    type: 'send_email',
    label: 'Enviar Email',
    description: 'Envia email com template',
    category: 'action',
    icon: 'Mail',
    color: '#EF4444',
    defaultConfig: { templateId: '', subject: '', to: '' },
  },
  {
    type: 'send_whatsapp',
    label: 'Enviar WhatsApp',
    description: 'Envia mensagem WhatsApp',
    category: 'action',
    icon: 'MessageCircle',
    color: '#25D366',
    defaultConfig: { message: '', to: '' },
  },
  {
    type: 'update_client',
    label: 'Atualizar Cliente',
    description: 'Modifica dados do cliente',
    category: 'action',
    icon: 'UserCog',
    color: '#6366F1',
    defaultConfig: { fields: {} },
  },
  {
    type: 'create_task',
    label: 'Criar Tarefa',
    description: 'Cria tarefa no calendário',
    category: 'action',
    icon: 'CalendarPlus',
    color: '#0EA5E9',
    defaultConfig: { title: '', dueDate: '' },
  },
  {
    type: 'http_request',
    label: 'Requisição HTTP',
    description: 'Faz chamada a API externa',
    category: 'action',
    icon: 'Globe',
    color: '#64748B',
    defaultConfig: { url: '', method: 'POST', headers: {}, body: '' },
  },
  {
    type: 'create_proposal',
    label: 'Criar Ordem de Serviço',
    description: 'Gera ordem de serviço automaticamente',
    category: 'action',
    icon: 'FileText',
    color: '#374DA4',
    defaultConfig: { templateId: '' },
  },
  {
    type: 'create_receipt',
    label: 'Criar Recibo',
    description: 'Gera recibo e envia ao cliente',
    category: 'action',
    icon: 'Receipt',
    color: '#059669',
    defaultConfig: { title: '', amount: '', payment_method: 'PIX', send_method: 'none', description: '' },
  },
  {
    type: 'publish_instagram',
    label: 'Publicar no Instagram',
    description: 'Gera carrossel e publica no Instagram',
    category: 'action',
    icon: 'Instagram',
    color: '#E1306C',
    defaultConfig: { topic: '', cardCount: 7, connectionId: '', autoCaption: true },
  },
  {
    type: 'publish_facebook',
    label: 'Publicar no Facebook',
    description: 'Gera carrossel e publica no Facebook',
    category: 'action',
    icon: 'Facebook',
    color: '#1877F2',
    defaultConfig: { topic: '', cardCount: 7, connectionId: '', autoCaption: true },
  },

  // Conditions
  {
    type: 'condition',
    label: 'Condição',
    description: 'Roteamento condicional',
    category: 'condition',
    icon: 'GitBranch',
    color: '#374DA4',
    defaultConfig: { field: '', operator: 'equals', value: '' },
  },
  {
    type: 'filter',
    label: 'Filtro',
    description: 'Filtra dados por critério',
    category: 'condition',
    icon: 'Filter',
    color: '#A855F7',
    defaultConfig: { conditions: [] },
  },

  // Transform
  {
    type: 'transform_data',
    label: 'Transformar Dados',
    description: 'Mapeia e transforma campos',
    category: 'transform',
    icon: 'Shuffle',
    color: '#14B8A6',
    defaultConfig: { mappings: [] },
  },
  {
    type: 'delay',
    label: 'Aguardar',
    description: 'Espera antes de continuar',
    category: 'transform',
    icon: 'Timer',
    color: '#78716C',
    defaultConfig: { duration: 5, unit: 'minutes' },
  },
];
