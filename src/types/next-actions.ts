/**
 * TypeScript types for Next Actions feature
 */

export type ActionUrgency = 'critical' | 'high' | 'medium' | 'low';
export type ActionType =
  | 'email'
  | 'call'
  | 'meeting'
  | 'follow_up'
  | 'proposal'
  | 'contract'
  | 'demo'
  | 'qualify'
  | 'nurture'
  | 'rescue';
export type ActionStatus = 'pending' | 'in_progress' | 'completed' | 'snoozed' | 'skipped';
export type DueCategory = 'overdue' | 'today' | 'this_week' | 'this_month' | 'future';

export interface AIContext {
  lastMessage?: string;
  sentimentTrend?: 'positive' | 'neutral' | 'negative';
  competitors?: string[];
  risks?: string[];
  opportunities?: string[];
  buyingSignals?: string[];
  championStatus?: 'engaged' | 'ghosting' | 'neutral';
  decisionTimeline?: string;
}

export interface SmartAction {
  id: string;
  type: ActionType;
  label: string;
  icon: string;
  primary?: boolean;
  aiDraft?: string;
  templateId?: string;
  estimatedMinutes?: number;
}

export interface NextAction {
  id: string;
  userId: string;
  workspaceId?: string;

  // Action details
  title: string;
  description?: string;
  actionType: ActionType;

  // Related entities
  contactId?: string;
  contactName?: string;
  contactEmail?: string;
  dealId?: string;
  dealValue?: number;
  dealStage?: string;
  leadId?: string;

  // Priority & urgency
  urgency: ActionUrgency;
  aiPriorityScore: number; // 0-100

  // Effort & impact
  effortMinutes: number;
  revenueImpact: number;
  closeProbability?: number; // 0-100

  // Due dates
  dueDate?: string;
  dueCategory?: DueCategory;

  // AI context
  aiContext?: AIContext;
  aiReasoning?: string;
  aiDraftContent?: string;

  // Status
  status: ActionStatus;
  completedAt?: string;
  snoozedUntil?: string;

  // Source
  source: 'ai' | 'user' | 'workflow' | 'system';

  // Deal health (if deal-related)
  dealHealthScore?: number;

  // Timestamps
  createdAt: string;
  updatedAt: string;

  // Smart actions
  smartActions?: SmartAction[];
}

export interface ActionFilters {
  urgency?: ActionUrgency[];
  actionType?: ActionType[];
  status?: ActionStatus[];
  dueCategory?: DueCategory[];
  search?: string;
}

export interface ActionSortOption {
  field: 'aiPriorityScore' | 'dueDate' | 'revenueImpact' | 'effortMinutes';
  direction: 'asc' | 'desc';
}

export interface DayProgress {
  totalActions: number;
  completedActions: number;
  revenueImpacted: number;
  timeSpent: number; // minutes
  onTrack: boolean;
}
