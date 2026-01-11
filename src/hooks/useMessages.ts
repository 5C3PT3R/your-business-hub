import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { UnifiedMessage, Platform } from '@/types/inbox';

interface UseMessagesOptions {
  channel?: Platform | 'all';
  unreadOnly?: boolean;
  limit?: number;
}

export function useMessages(options: UseMessagesOptions = {}) {
  const { channel = 'all', unreadOnly = false, limit = 100 } = options;

  const [messages, setMessages] = useState<UnifiedMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    fetchMessages();

    // Set up real-time subscription
    let subscription: any = null;

    const setupSubscription = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        subscription = supabase
          .channel('conversations_changes')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'conversations',
              filter: `user_id=eq.${session.user.id}`,
            },
            (payload) => {
              console.log('Message change detected:', payload);
              // Refresh messages when changes occur
              fetchMessages();
            }
          )
          .subscribe();
      }
    };

    setupSubscription();

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [channel, unreadOnly, limit]);

  async function fetchMessages() {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setMessages([]);
        return;
      }

      // Build query
      let query = supabase
        .from('conversations')
        .select('*')
        .eq('user_id', session.user.id)
        .order('sent_at', { ascending: false })
        .limit(limit);

      // Filter by channel if not 'all'
      if (channel !== 'all') {
        query = query.eq('channel', channel);
      }

      // Filter by unread if requested
      if (unreadOnly) {
        query = query.eq('is_read', false);
      }

      const { data: conversations, error: fetchError } = await query;

      if (fetchError) {
        throw fetchError;
      }

      // Transform conversations to UnifiedMessage format
      const transformedMessages: UnifiedMessage[] = (conversations || []).map((conv) => ({
        id: conv.id,
        externalId: conv.external_id || '',
        platform: mapChannelToPlatform(conv.channel),

        conversationId: conv.external_thread_id || conv.id,
        threadId: conv.external_thread_id,

        from: {
          email: conv.from_email || '',
          name: conv.from_name || conv.from_email || 'Unknown',
          company: conv.metadata?.company,
        },
        to: (conv.to_emails || []).map((email: string) => ({
          email,
          name: email,
        })),
        cc: (conv.cc_emails || []).map((email: string) => ({
          email,
          name: email,
        })),

        subject: conv.subject,
        body: conv.plain_text || conv.body || '',
        bodyHtml: conv.html_body,
        preview: conv.plain_text ? conv.plain_text.substring(0, 150) : '',

        direction: conv.direction === 'inbound' ? 'incoming' : 'outgoing',
        status: 'delivered',

        attachments: Array.isArray(conv.attachments) ? conv.attachments : [],

        sentiment: mapSentiment(conv.sentiment),
        intent: conv.intent,
        topics: conv.topics || [],
        aiExtracted: {
          nextSteps: conv.next_action_suggested ? [conv.next_action_suggested] : undefined,
        },

        isRead: conv.is_read,
        isStarred: conv.is_starred,
        isUrgent: conv.is_urgent,

        timestamp: conv.sent_at,
        syncedAt: conv.created_at,
        lastUpdatedAt: conv.updated_at,
      }));

      setMessages(transformedMessages);
    } catch (err) {
      console.error('Error fetching messages:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch messages'));
    } finally {
      setLoading(false);
    }
  }


  async function markAsRead(messageId: string) {
    try {
      const { error } = await supabase
        .from('conversations')
        .update({ is_read: true })
        .eq('id', messageId);

      if (error) throw error;

      // Update local state
      setMessages((prev) =>
        prev.map((msg) => (msg.id === messageId ? { ...msg, isRead: true } : msg))
      );
    } catch (err) {
      console.error('Error marking message as read:', err);
    }
  }

  async function toggleStar(messageId: string) {
    try {
      const message = messages.find((m) => m.id === messageId);
      if (!message) return;

      const { error } = await supabase
        .from('conversations')
        .update({ is_starred: !message.isStarred })
        .eq('id', messageId);

      if (error) throw error;

      // Update local state
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId ? { ...msg, isStarred: !msg.isStarred } : msg
        )
      );
    } catch (err) {
      console.error('Error toggling star:', err);
    }
  }

  return {
    messages,
    loading,
    error,
    refreshMessages: fetchMessages,
    markAsRead,
    toggleStar,
  };
}

// Helper function to map database channel to Platform type
function mapChannelToPlatform(channel: string): Platform {
  const channelMap: Record<string, Platform> = {
    'email': 'gmail',
    'linkedin': 'linkedin',
    'whatsapp': 'whatsapp',
    'call': 'twilio_sms', // Map call to a messaging platform
    'sms': 'twilio_sms',
    'twitter': 'twitter',
  };

  return (channelMap[channel] as Platform) || 'gmail';
}

// Helper function to map sentiment
function mapSentiment(sentiment: string | null): 'positive' | 'neutral' | 'negative' | undefined {
  if (!sentiment) return undefined;

  if (sentiment === 'very_positive' || sentiment === 'positive') return 'positive';
  if (sentiment === 'very_negative' || sentiment === 'negative') return 'negative';
  return 'neutral';
}
