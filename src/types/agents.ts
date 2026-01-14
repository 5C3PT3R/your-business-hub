// Type definitions for AI Agents module
// These types define the structure of agents and their executions

export type AgentType =
  | 'receptionist'
  | 'sdr'
  | 'deal_analyst'
  | 'marketing_analyst'
  | 'follow_up'
  | 'coach';

export type AgentStatus = 'active' | 'inactive' | 'paused' | 'error';

export type ScheduleType = 'manual' | 'continuous' | 'hourly' | 'daily' | 'weekly';

export interface AgentConfig {
  personality: {
    tone: 'professional' | 'friendly' | 'casual';
    style: 'concise' | 'detailed';
    greeting?: string;
  };
  capabilities: {
    can_answer: boolean;
    can_collect: boolean;
    can_update: boolean;
    can_book: boolean;
    can_send: boolean;
  };
  channels: ('email' | 'linkedin' | 'whatsapp' | 'webchat')[];
  knowledge_base?: {
    files?: string[];
    urls?: string[];
  };
  handoff_rules?: {
    trigger_conditions: string[];
    handoff_to_user_id?: string;
  };
  agent_specific?: Record<string, any>;
}

export interface Agent {
  id: string;
  user_id: string;
  workspace_id: string | null;
  name: string;
  description: string | null;
  agent_type: AgentType;
  status: AgentStatus;
  is_template: boolean;
  config: AgentConfig;
  schedule_type: ScheduleType;
  schedule_config: Record<string, any>;
  last_run_at: string | null;
  next_run_at: string | null;
  total_executions: number;
  successful_executions: number;
  failed_executions: number;
  created_at: string;
  updated_at: string;
}

export interface AgentExecution {
  id: string;
  agent_id: string;
  workspace_id: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  trigger_type: 'manual' | 'scheduled' | 'event' | 'api';
  actions_planned: number;
  actions_executed: number;
  actions_failed: number;
  input_context: Record<string, any>;
  planned_actions: any[];
  execution_results: any[];
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  error_message: string | null;
  error_details: Record<string, any> | null;
  created_at: string;
}

// Helper function to get agent type display name
export function getAgentTypeLabel(type: AgentType): string {
  const labels: Record<AgentType, string> = {
    receptionist: 'Receptionist',
    sdr: 'SDR (Sales Development)',
    deal_analyst: 'Deal Analyst',
    marketing_analyst: 'Marketing Analyst',
    follow_up: 'Follow-Up',
    coach: 'Sales Coach',
  };
  return labels[type];
}

// Helper function to get agent type description
export function getAgentTypeDescription(type: AgentType): string {
  const descriptions: Record<AgentType, string> = {
    receptionist: 'Routes conversations, captures lead info, qualifies inquiries',
    sdr: 'Qualifies leads using frameworks like BANT, books demos',
    deal_analyst: 'Monitors deal health, calculates scores, flags at-risk opportunities',
    marketing_analyst: 'Analyzes campaign performance, attribution, and ROI',
    follow_up: 'Drafts personalized follow-up emails based on context',
    coach: 'Analyzes rep performance and provides coaching feedback',
  };
  return descriptions[type];
}

// Helper function to get status badge variant
export function getAgentStatusColor(status: AgentStatus): 'success' | 'default' | 'warning' | 'destructive' {
  const colors: Record<AgentStatus, 'success' | 'default' | 'warning' | 'destructive'> = {
    active: 'success',
    inactive: 'default',
    paused: 'warning',
    error: 'destructive',
  };
  return colors[status];
}

// Helper function to get execution status color
export function getExecutionStatusColor(status: AgentExecution['status']): 'success' | 'default' | 'warning' | 'destructive' {
  const colors: Record<AgentExecution['status'], 'success' | 'default' | 'warning' | 'destructive'> = {
    completed: 'success',
    running: 'default',
    failed: 'destructive',
    cancelled: 'warning',
  };
  return colors[status];
}

// Default agent configuration for new agents
export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  personality: {
    tone: 'professional',
    style: 'concise',
  },
  capabilities: {
    can_answer: true,
    can_collect: true,
    can_update: false,
    can_book: false,
    can_send: false,
  },
  channels: ['email'],
  agent_specific: {},
};
