/**
 * Notification Types for Intelligent Notification Center
 */

export type NotificationType =
  | 'deal_update'
  | 'task_due'
  | 'lead_activity'
  | 'mention'
  | 'ai_insight'
  | 'system'
  | 'team_update'
  | 'goal_progress'
  | 'contact_activity'
  | 'email_received'
  | 'meeting_reminder';

export type NotificationPriority = 'critical' | 'high' | 'medium' | 'low';

export type NotificationSource = 'system' | 'ai_agent' | 'user' | 'integration';

export interface SuggestedAction {
  action: string;
  label: string;
  params?: Record<string, any>;
  icon?: string;
}

export interface Notification {
  id: string;
  user_id: string;
  workspace_id: string;
  type: NotificationType;
  source: NotificationSource | null;
  title: string;
  message: string;
  ai_summary: string | null;
  ai_priority: NotificationPriority | null;
  ai_suggested_actions: SuggestedAction[];
  related_entity_type: string | null;
  related_entity_id: string | null;
  is_read: boolean;
  is_archived: boolean;
  is_actioned: boolean;
  actioned_at: string | null;
  group_key: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface NotificationPreferences {
  id: string;
  user_id: string;
  email_enabled: boolean;
  push_enabled: boolean;
  in_app_enabled: boolean;
  enabled_types: NotificationType[];
  ai_summarization_enabled: boolean;
  ai_priority_enabled: boolean;
  ai_suggestions_enabled: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  batch_notifications: boolean;
  batch_frequency: 'instant' | 'hourly' | 'daily';
  created_at: string;
  updated_at: string;
}

export interface NotificationGroup {
  group_key: string;
  notifications: Notification[];
  latest_at: string;
  count: number;
}

// Helper functions
export function getNotificationTypeLabel(type: NotificationType): string {
  const labels: Record<NotificationType, string> = {
    deal_update: 'Deal Update',
    task_due: 'Task Due',
    lead_activity: 'Lead Activity',
    mention: 'Mention',
    ai_insight: 'AI Insight',
    system: 'System',
    team_update: 'Team Update',
    goal_progress: 'Goal Progress',
    contact_activity: 'Contact Activity',
    email_received: 'Email Received',
    meeting_reminder: 'Meeting Reminder',
  };
  return labels[type] || type;
}

export function getNotificationTypeIcon(type: NotificationType): string {
  const icons: Record<NotificationType, string> = {
    deal_update: 'TrendingUp',
    task_due: 'CheckSquare',
    lead_activity: 'UserPlus',
    mention: 'AtSign',
    ai_insight: 'Sparkles',
    system: 'Settings',
    team_update: 'Users',
    goal_progress: 'Target',
    contact_activity: 'User',
    email_received: 'Mail',
    meeting_reminder: 'Calendar',
  };
  return icons[type] || 'Bell';
}

export function getPriorityColor(priority: NotificationPriority | null): string {
  if (!priority) return 'text-muted-foreground';
  const colors: Record<NotificationPriority, string> = {
    critical: 'text-red-500',
    high: 'text-orange-500',
    medium: 'text-yellow-500',
    low: 'text-gray-500',
  };
  return colors[priority];
}

export function getPriorityBadgeVariant(priority: NotificationPriority | null): 'destructive' | 'secondary' | 'outline' | 'default' {
  if (!priority) return 'outline';
  const variants: Record<NotificationPriority, 'destructive' | 'secondary' | 'outline' | 'default'> = {
    critical: 'destructive',
    high: 'default',
    medium: 'secondary',
    low: 'outline',
  };
  return variants[priority];
}
