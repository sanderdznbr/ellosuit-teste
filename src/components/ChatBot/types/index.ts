export type NodeType = 
  | 'trigger' 
  | 'message' 
  | 'condition' 
  | 'action' 
  | 'delay';

export type TriggerType = 
  | 'whatsapp_channel'
  | 'email_channel'
  | 'keyword'
  | 'conversation_start'
  | 'inactivity'
  | 'schedule'
  | 'webhook';

export type MessageType = 
  | 'text'
  | 'buttons'
  | 'list'
  | 'image'
  | 'file';

export type ConditionType = 
  | 'if_else'
  | 'check_variable'
  | 'check_time'
  | 'check_tag';

export type ActionType = 
  | 'assign_tag'
  | 'transfer_human'
  | 'transfer_ai_agent'
  | 'save_crm'
  | 'send_email'
  | 'call_api'
  | 'set_variable'
  | 'lookup_account';

export type DelayType = 
  | 'wait_seconds'
  | 'wait_response'
  | 'wait_business_hours';

export interface Position {
  x: number;
  y: number;
}

export interface FlowNode {
  id: string;
  type: NodeType;
  subType: string;
  position: Position;
  data: {
    label: string;
    config: Record<string, any>;
  };
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
}

export interface ChatBotFlow {
  id: string;
  company_id: string;
  name: string;
  description?: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  trigger_config?: Record<string, any>;
  is_active: boolean;
  execution_count: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ChatBotExecution {
  id: string;
  flow_id: string;
  conversation_id?: string;
  contact_phone?: string;
  started_at: string;
  completed_at?: string;
  status: 'running' | 'completed' | 'failed' | 'paused';
  current_node_id?: string;
  variables: Record<string, any>;
  execution_path: string[];
}

export interface BlockCategory {
  id: string;
  label: string;
  color: string;
  blocks: BlockDefinition[];
}

export interface BlockDefinition {
  type: NodeType;
  subType: string;
  label: string;
  description: string;
  icon: string;
  defaultConfig: Record<string, any>;
  locked?: boolean;
}
