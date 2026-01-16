// Workflow Types for AI-Powered Automations

export type WorkflowStatus = 'draft' | 'active' | 'paused' | 'error';

export type NodeType = 'trigger' | 'action' | 'condition' | 'ai_processor' | 'delay';

export type TriggerType =
  | 'contact_created'
  | 'deal_stage_changed'
  | 'email_received'
  | 'form_submitted'
  | 'meeting_scheduled'
  | 'task_completed';

export type ActionType =
  | 'draft_email'
  | 'send_email'
  | 'update_field'
  | 'create_task'
  | 'create_deal'
  | 'send_notification'
  | 'webhook';

export type AIModel = 'gpt-4o' | 'gpt-4o-mini';

export interface Position {
  x: number;
  y: number;
}

export interface WorkflowNode {
  id: string;
  type: NodeType;
  position: Position;
  data: {
    label: string;
    description?: string;
    // Trigger config
    triggerType?: TriggerType;
    triggerConditions?: Record<string, any>;
    // Action config
    actionType?: ActionType;
    actionConfig?: Record<string, any>;
    // AI Processor config
    contextSource?: string;
    instruction?: string;
    model?: AIModel;
    outputVariable?: string;
    // Condition config
    conditionField?: string;
    conditionOperator?: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'is_empty' | 'is_not_empty';
    conditionValue?: string;
    // Delay config
    delayAmount?: number;
    delayUnit?: 'minutes' | 'hours' | 'days';
  };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
  type?: string;
}

export interface Workflow {
  id: string;
  user_id: string;
  workspace_id: string | null;
  name: string;
  description: string | null;
  status: WorkflowStatus;
  trigger_type: TriggerType;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  is_template: boolean;
  total_executions: number;
  successful_executions: number;
  failed_executions: number;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export type ExecutionStatus = 'pending' | 'running' | 'processing_ai' | 'waiting_approval' | 'completed' | 'failed' | 'cancelled';

export interface WorkflowExecution {
  id: string;
  workflow_id: string;
  workspace_id: string;
  status: ExecutionStatus;
  trigger_data: Record<string, any>;
  current_node_id: string | null;
  execution_path: string[];
  node_outputs: Record<string, any>;
  ai_tokens_used: number;
  ai_model_used: AIModel | null;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

// Pre-built workflow templates
export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: 'lead_management' | 'deal_acceleration' | 'communication' | 'productivity';
  icon: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  trigger_type: TriggerType;
}

// Node palette items for the builder
export interface NodePaletteItem {
  type: NodeType;
  label: string;
  description: string;
  icon: string;
  category: 'triggers' | 'ai' | 'actions' | 'logic';
  defaultData: Partial<WorkflowNode['data']>;
}

// Workflow builder state
export interface WorkflowBuilderState {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  selectedNode: string | null;
  isDirty: boolean;
}
