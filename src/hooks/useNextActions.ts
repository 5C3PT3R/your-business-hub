import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { NextAction } from '@/types/next-actions';
import { useAuth } from './useAuth';

/**
 * Hook for fetching and managing Next Actions
 */
export function useNextActions(filters?: {
  urgency?: string[];
  status?: string[];
  dueCategory?: string[];
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch actions
  const {
    data: actions = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['next-actions', user?.id, filters],
    queryFn: async () => {
      if (!user?.id) return [];

      let query = supabase
        .from('next_actions')
        .select(
          `
          *,
          contact:contacts(id, name, email, phone),
          deal:deals(id, title, value, stage, health_score)
        `
        )
        .eq('user_id', user.id)
        .order('ai_priority_score', { ascending: false });

      // Apply filters
      if (filters?.urgency && filters.urgency.length > 0) {
        query = query.in('urgency', filters.urgency);
      }

      if (filters?.status && filters.status.length > 0) {
        query = query.in('status', filters.status);
      } else {
        // Default: only show pending and in_progress
        query = query.in('status', ['pending', 'in_progress']);
      }

      if (filters?.dueCategory && filters.dueCategory.length > 0) {
        query = query.in('due_category', filters.dueCategory);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Transform to NextAction type
      return (data || []).map((item: any) => ({
        id: item.id,
        userId: item.user_id,
        workspaceId: item.workspace_id,
        title: item.title,
        description: item.description,
        actionType: item.action_type,
        contactId: item.contact_id,
        contactName: item.contact?.name,
        contactEmail: item.contact?.email,
        dealId: item.deal_id,
        dealValue: item.deal?.value,
        dealStage: item.deal?.stage,
        dealHealthScore: item.deal?.health_score,
        leadId: item.lead_id,
        urgency: item.urgency,
        aiPriorityScore: item.ai_priority_score,
        effortMinutes: item.effort_minutes,
        revenueImpact: item.revenue_impact,
        closeProbability: item.close_probability,
        dueDate: item.due_date,
        dueCategory: item.due_category,
        aiContext: item.ai_context,
        aiReasoning: item.ai_reasoning,
        aiDraftContent: item.ai_draft_content,
        status: item.status,
        completedAt: item.completed_at,
        snoozedUntil: item.snoozed_until,
        source: item.source,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      })) as NextAction[];
    },
    enabled: !!user?.id,
  });

  // Complete action
  const completeAction = useMutation({
    mutationFn: async (actionId: string) => {
      const { error } = await supabase
        .from('next_actions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', actionId)
        .eq('user_id', user?.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['next-actions'] });
    },
  });

  // Skip action
  const skipAction = useMutation({
    mutationFn: async (actionId: string) => {
      const { error } = await supabase
        .from('next_actions')
        .update({
          status: 'skipped',
        })
        .eq('id', actionId)
        .eq('user_id', user?.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['next-actions'] });
    },
  });

  // Snooze action
  const snoozeAction = useMutation({
    mutationFn: async ({
      actionId,
      snoozedUntil,
    }: {
      actionId: string;
      snoozedUntil: string;
    }) => {
      const { error } = await supabase
        .from('next_actions')
        .update({
          status: 'snoozed',
          snoozed_until: snoozedUntil,
        })
        .eq('id', actionId)
        .eq('user_id', user?.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['next-actions'] });
    },
  });

  // Update action
  const updateAction = useMutation({
    mutationFn: async ({
      actionId,
      updates,
    }: {
      actionId: string;
      updates: Partial<NextAction>;
    }) => {
      const { error } = await supabase
        .from('next_actions')
        .update(updates)
        .eq('id', actionId)
        .eq('user_id', user?.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['next-actions'] });
    },
  });

  // Create new action
  const createAction = useMutation({
    mutationFn: async (action: Partial<NextAction>) => {
      const { error } = await supabase.from('next_actions').insert({
        user_id: user?.id,
        ...action,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['next-actions'] });
    },
  });

  return {
    actions,
    isLoading,
    error,
    refetch,
    completeAction: completeAction.mutateAsync,
    skipAction: skipAction.mutateAsync,
    snoozeAction: snoozeAction.mutateAsync,
    updateAction: updateAction.mutateAsync,
    createAction: createAction.mutateAsync,
    isCompletingAction: completeAction.isPending,
    isSkippingAction: skipAction.isPending,
  };
}

/**
 * Hook for action statistics
 */
export function useActionStats() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['action-stats', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('next_actions')
        .select('status, urgency, due_category, revenue_impact')
        .eq('user_id', user.id);

      if (error) throw error;

      const stats = {
        total: data.length,
        pending: data.filter((a) => a.status === 'pending').length,
        completed: data.filter((a) => a.status === 'completed').length,
        urgent: data.filter((a) => a.urgency === 'critical').length,
        today: data.filter((a) => a.due_category === 'today').length,
        totalRevenue: data
          .filter((a) => a.status === 'pending')
          .reduce((sum, a) => sum + (a.revenue_impact || 0), 0),
      };

      return stats;
    },
    enabled: !!user?.id,
  });
}
