import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { Conversation, ConversationCreateInput } from '@/types/conversations';

export function useConversations(filters?: {
  contactId?: string;
  dealId?: string;
  leadId?: string;
  type?: string[];
  limit?: number;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: conversations = [], isLoading, error } = useQuery({
    queryKey: ['conversations', user?.id, filters],
    queryFn: async () => {
      if (!user?.id) return [];

      let query = supabase
        .from('conversations')
        .select('*')
        .eq('user_id', user.id)
        .order('occurred_at', { ascending: false });

      if (filters?.contactId) {
        query = query.eq('contact_id', filters.contactId);
      }

      if (filters?.dealId) {
        query = query.eq('deal_id', filters.dealId);
      }

      if (filters?.leadId) {
        query = query.eq('lead_id', filters.leadId);
      }

      if (filters?.type && filters.type.length > 0) {
        query = query.in('type', filters.type);
      }

      if (filters?.limit) {
        query = query.limit(filters.limit);
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data || []).map((conv) => ({
        id: conv.id,
        userId: conv.user_id,
        contactId: conv.contact_id,
        dealId: conv.deal_id,
        leadId: conv.lead_id,
        type: conv.type,
        subject: conv.subject,
        content: conv.content,
        sentiment: conv.sentiment,
        sentimentScore: conv.sentiment_score,
        keyPoints: conv.key_points,
        actionItems: conv.action_items,
        mentions: conv.mentions,
        metadata: conv.metadata,
        occurredAt: conv.occurred_at,
        createdAt: conv.created_at,
        updatedAt: conv.updated_at,
      })) as Conversation[];
    },
    enabled: !!user?.id,
  });

  const createConversation = useMutation({
    mutationFn: async (input: ConversationCreateInput) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('conversations')
        .insert({
          user_id: user.id,
          contact_id: input.contactId,
          deal_id: input.dealId,
          lead_id: input.leadId,
          type: input.type,
          subject: input.subject,
          content: input.content,
          occurred_at: input.occurredAt || new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-stats'] });
    },
  });

  return {
    conversations,
    isLoading,
    error,
    createConversation: createConversation.mutateAsync,
    isCreating: createConversation.isPending,
  };
}

export function useConversationStats(filters?: {
  contactId?: string;
  dealId?: string;
  days?: number;
}) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['conversation-stats', user?.id, filters],
    queryFn: async () => {
      if (!user?.id) return null;

      const daysAgo = filters?.days || 30;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysAgo);

      let query = supabase
        .from('conversations')
        .select('*')
        .eq('user_id', user.id)
        .gte('occurred_at', cutoffDate.toISOString());

      if (filters?.contactId) {
        query = query.eq('contact_id', filters.contactId);
      }

      if (filters?.dealId) {
        query = query.eq('deal_id', filters.dealId);
      }

      const { data, error } = await query;

      if (error) throw error;

      const conversations = data || [];

      return {
        total: conversations.length,
        byType: {
          email: conversations.filter((c) => c.type === 'email').length,
          call: conversations.filter((c) => c.type === 'call').length,
          meeting: conversations.filter((c) => c.type === 'meeting').length,
          message: conversations.filter((c) => c.type === 'message').length,
          note: conversations.filter((c) => c.type === 'note').length,
        },
        bySentiment: {
          positive: conversations.filter((c) => c.sentiment === 'positive').length,
          neutral: conversations.filter((c) => c.sentiment === 'neutral').length,
          negative: conversations.filter((c) => c.sentiment === 'negative').length,
        },
        averageSentiment:
          conversations.reduce((sum, c) => sum + (c.sentiment_score || 0), 0) /
          (conversations.length || 1),
        recentConversations: conversations.slice(0, 5),
      };
    },
    enabled: !!user?.id,
  });
}
