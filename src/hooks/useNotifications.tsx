/**
 * Enhanced Notifications Hook - AI-powered notification management
 */

import { useState, useEffect, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';

// Legacy interface for backward compatibility
export interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  createdAt: Date;
  // New AI-enhanced fields
  type?: NotificationType;
  source?: NotificationSource;
  ai_summary?: string | null;
  ai_priority?: NotificationPriority | null;
  ai_suggested_actions?: SuggestedAction[];
  related_entity_type?: string | null;
  related_entity_id?: string | null;
  is_archived?: boolean;
  is_actioned?: boolean;
}

// New types for intelligent notifications
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

const NOTIFICATIONS_KEY = 'upflo_notifications';
const READ_NOTIFICATIONS_KEY = 'upflo_read_notifications';

// AI-enhanced mock notifications
const aiEnhancedNotifications: Notification[] = [
  {
    id: 'ai-1',
    title: 'Deal moved to Negotiation',
    message: 'Acme Corp Enterprise deal has been moved to Negotiation stage.',
    time: '5m ago',
    read: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 5),
    type: 'deal_update',
    source: 'system',
    ai_summary: 'High-value deal progressing - consider scheduling a call to discuss pricing.',
    ai_priority: 'high',
    ai_suggested_actions: [
      { action: 'view_deal', label: 'View Deal', params: { deal_id: 'deal-123' }, icon: 'TrendingUp' },
      { action: 'schedule_call', label: 'Schedule Call', params: { contact_id: 'contact-456' }, icon: 'Phone' },
    ],
    related_entity_type: 'deal',
    related_entity_id: 'deal-123',
  },
  {
    id: 'ai-2',
    title: 'Task Due: Follow up with John',
    message: 'Your follow-up task with John Smith is due in 1 hour.',
    time: '30m ago',
    read: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 30),
    type: 'task_due',
    source: 'system',
    ai_summary: 'Overdue follow-up - John showed high interest last call.',
    ai_priority: 'critical',
    ai_suggested_actions: [
      { action: 'complete_task', label: 'Mark Complete', params: { task_id: 'task-789' }, icon: 'CheckCircle' },
      { action: 'call_contact', label: 'Call Now', params: { phone: '+1234567890' }, icon: 'Phone' },
      { action: 'reschedule', label: 'Reschedule', params: { task_id: 'task-789' }, icon: 'Calendar' },
    ],
    related_entity_type: 'task',
    related_entity_id: 'task-789',
  },
  {
    id: 'ai-3',
    title: 'AI Insight: Stale Deal Detected',
    message: 'The TechStart deal has had no activity for 14 days and may be at risk.',
    time: '1h ago',
    read: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 60),
    type: 'ai_insight',
    source: 'ai_agent',
    ai_summary: 'Deal health declining - immediate action recommended.',
    ai_priority: 'high',
    ai_suggested_actions: [
      { action: 'view_deal', label: 'Review Deal', params: { deal_id: 'deal-456' }, icon: 'Eye' },
      { action: 'send_email', label: 'Send Check-in', params: { template: 'check_in' }, icon: 'Mail' },
    ],
    related_entity_type: 'deal',
    related_entity_id: 'deal-456',
  },
  {
    id: 'ai-4',
    title: 'New Lead from Website',
    message: 'Emma Wilson from DataFlow Inc submitted the contact form.',
    time: '2h ago',
    read: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 120),
    type: 'lead_activity',
    source: 'integration',
    ai_summary: 'Enterprise lead - matches your ideal customer profile.',
    ai_priority: 'high',
    ai_suggested_actions: [
      { action: 'view_lead', label: 'View Lead', params: { lead_id: 'lead-321' }, icon: 'User' },
      { action: 'assign_to_me', label: 'Assign to Me', params: { lead_id: 'lead-321' }, icon: 'UserPlus' },
    ],
    related_entity_type: 'lead',
    related_entity_id: 'lead-321',
  },
  {
    id: 'ai-5',
    title: 'Sarah mentioned you',
    message: '@you Can you review the proposal for Acme Corp before the meeting?',
    time: '3h ago',
    read: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 180),
    type: 'mention',
    source: 'user',
    ai_priority: 'medium',
    ai_suggested_actions: [
      { action: 'view_deal', label: 'View Proposal', params: { deal_id: 'deal-123' }, icon: 'FileText' },
      { action: 'reply', label: 'Reply', params: {}, icon: 'MessageCircle' },
    ],
    related_entity_type: 'deal',
    related_entity_id: 'deal-123',
  },
  {
    id: 'ai-6',
    title: 'Weekly Goal: 80% Complete',
    message: "You've closed $40,000 of your $50,000 weekly target.",
    time: '5h ago',
    read: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5),
    type: 'goal_progress',
    source: 'system',
    ai_summary: 'On track to exceed target - 2 pending deals could close this week.',
    ai_priority: 'low',
    ai_suggested_actions: [
      { action: 'view_pipeline', label: 'View Pipeline', params: {}, icon: 'BarChart' },
    ],
  },
  {
    id: 'ai-7',
    title: 'Meeting in 15 minutes',
    message: 'Demo call with GlobalTech starting at 3:00 PM.',
    time: '2m ago',
    read: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 2),
    type: 'meeting_reminder',
    source: 'system',
    ai_summary: 'Prepare: They asked about API integrations in the last call.',
    ai_priority: 'critical',
    ai_suggested_actions: [
      { action: 'join_meeting', label: 'Join Call', params: { meeting_url: 'https://meet.google.com/xyz' }, icon: 'Video' },
      { action: 'view_contact', label: 'View Notes', params: { contact_id: 'contact-111' }, icon: 'FileText' },
    ],
    related_entity_type: 'contact',
    related_entity_id: 'contact-111',
  },
];

// Get initial notifications from localStorage or use AI-enhanced defaults
const getStoredNotifications = (): Notification[] => {
  try {
    const stored = localStorage.getItem(NOTIFICATIONS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.map((n: any) => ({ ...n, createdAt: new Date(n.createdAt) }));
    }
  } catch (e) {
    console.error('Error reading notifications from localStorage:', e);
  }
  return aiEnhancedNotifications;
};

const getReadNotificationIds = (): Set<string> => {
  try {
    const stored = localStorage.getItem(READ_NOTIFICATIONS_KEY);
    if (stored) {
      return new Set(JSON.parse(stored));
    }
  } catch (e) {
    console.error('Error reading read notifications from localStorage:', e);
  }
  return new Set();
};

// Singleton state to share across components
let globalNotifications: Notification[] = getStoredNotifications();
const globalReadIds: Set<string> = getReadNotificationIds();
const archivedIds: Set<string> = new Set();
const actionedIds: Set<string> = new Set();
const listeners: Set<() => void> = new Set();

const notifyListeners = () => {
  listeners.forEach(listener => listener());
};

const saveToStorage = () => {
  localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(globalNotifications));
  localStorage.setItem(READ_NOTIFICATIONS_KEY, JSON.stringify([...globalReadIds]));
};

export function useNotifications() {
  const [, forceUpdate] = useState({});

  useEffect(() => {
    const listener = () => forceUpdate({});
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const notifications = globalNotifications
    .filter(n => !archivedIds.has(n.id))
    .map(n => ({
      ...n,
      read: globalReadIds.has(n.id),
      is_archived: archivedIds.has(n.id),
      is_actioned: actionedIds.has(n.id),
    }));

  const unreadCount = notifications.filter(n => !n.read).length;
  const criticalCount = notifications.filter(n => !n.read && n.ai_priority === 'critical').length;

  const addNotification = useCallback((title: string, message: string, options?: Partial<Notification>) => {
    const newNotification: Notification = {
      id: crypto.randomUUID(),
      title,
      message,
      time: 'Just now',
      read: false,
      createdAt: new Date(),
      type: options?.type || 'system',
      source: options?.source || 'system',
      ai_priority: options?.ai_priority || 'medium',
      ai_suggested_actions: options?.ai_suggested_actions || [],
      ...options,
    };
    globalNotifications = [newNotification, ...globalNotifications];
    saveToStorage();
    notifyListeners();
    return newNotification;
  }, []);

  const markAsRead = useCallback((id: string) => {
    globalReadIds.add(id);
    saveToStorage();
    notifyListeners();
  }, []);

  const markAllAsRead = useCallback(() => {
    globalNotifications.forEach(n => globalReadIds.add(n.id));
    saveToStorage();
    notifyListeners();
    toast({
      title: 'All notifications marked as read',
    });
  }, []);

  const archiveNotification = useCallback((id: string) => {
    archivedIds.add(id);
    notifyListeners();
    toast({
      title: 'Notification archived',
    });
  }, []);

  const markAsActioned = useCallback((id: string) => {
    actionedIds.add(id);
    globalReadIds.add(id);
    saveToStorage();
    notifyListeners();
  }, []);

  const executeSuggestedAction = useCallback((notificationId: string, action: SuggestedAction) => {
    markAsActioned(notificationId);

    // Handle different action types
    switch (action.action) {
      case 'view_deal':
        if (action.params?.deal_id) {
          window.location.href = `/deal/${action.params.deal_id}`;
        }
        break;
      case 'view_lead':
        if (action.params?.lead_id) {
          window.location.href = `/leads/${action.params.lead_id}`;
        }
        break;
      case 'view_contact':
        if (action.params?.contact_id) {
          window.location.href = `/contacts/${action.params.contact_id}`;
        }
        break;
      case 'view_pipeline':
        window.location.href = '/deals';
        break;
      case 'call_contact':
        if (action.params?.phone) {
          window.location.href = `tel:${action.params.phone}`;
        }
        break;
      case 'join_meeting':
        if (action.params?.meeting_url) {
          window.open(action.params.meeting_url, '_blank');
        }
        break;
      default:
        toast({
          title: `Action: ${action.label}`,
          description: 'This action will be implemented soon.',
        });
    }
  }, [markAsActioned]);

  const clearNotification = useCallback((id: string) => {
    globalNotifications = globalNotifications.filter(n => n.id !== id);
    globalReadIds.delete(id);
    archivedIds.delete(id);
    actionedIds.delete(id);
    saveToStorage();
    notifyListeners();
  }, []);

  const clearAll = useCallback(() => {
    globalNotifications = [];
    globalReadIds.clear();
    archivedIds.clear();
    actionedIds.clear();
    saveToStorage();
    notifyListeners();
  }, []);

  // Filter by type
  const getNotificationsByType = useCallback((type: NotificationType) => {
    return notifications.filter(n => n.type === type);
  }, [notifications]);

  // Filter by priority
  const getNotificationsByPriority = useCallback((priority: NotificationPriority) => {
    return notifications.filter(n => n.ai_priority === priority);
  }, [notifications]);

  // Get unread notifications
  const getUnreadNotifications = useCallback(() => {
    return notifications.filter(n => !n.read);
  }, [notifications]);

  // Get critical notifications
  const getCriticalNotifications = useCallback(() => {
    return notifications.filter(n => !n.read && n.ai_priority === 'critical');
  }, [notifications]);

  return {
    notifications,
    unreadCount,
    criticalCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    archiveNotification,
    markAsActioned,
    executeSuggestedAction,
    clearNotification,
    clearAll,
    getNotificationsByType,
    getNotificationsByPriority,
    getUnreadNotifications,
    getCriticalNotifications,
  };
}

// Helper functions for UI
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

export function getPriorityColor(priority: NotificationPriority | null | undefined): string {
  if (!priority) return 'text-muted-foreground';
  const colors: Record<NotificationPriority, string> = {
    critical: 'text-red-500',
    high: 'text-orange-500',
    medium: 'text-yellow-500',
    low: 'text-gray-500',
  };
  return colors[priority];
}

export function getPriorityBadgeVariant(priority: NotificationPriority | null | undefined): 'destructive' | 'secondary' | 'outline' | 'default' {
  if (!priority) return 'outline';
  const variants: Record<NotificationPriority, 'destructive' | 'secondary' | 'outline' | 'default'> = {
    critical: 'destructive',
    high: 'default',
    medium: 'secondary',
    low: 'outline',
  };
  return variants[priority];
}
