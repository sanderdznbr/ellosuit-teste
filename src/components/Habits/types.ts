export type HabitNodeType = 'trigger' | 'action' | 'condition' | 'config';

export interface Position {
  x: number;
  y: number;
}

export interface HabitFlowNode {
  id: string;
  type: HabitNodeType;
  subType: string;
  position: Position;
  data: {
    label: string;
    config: Record<string, any>;
  };
}

export interface HabitFlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
}

export interface HabitBlockCategory {
  id: string;
  label: string;
  emoji: string;
  blocks: HabitBlockDefinition[];
}

export interface HabitBlockDefinition {
  type: HabitNodeType;
  subType: string;
  label: string;
  description: string;
  icon: string;
  defaultConfig: Record<string, any>;
}
