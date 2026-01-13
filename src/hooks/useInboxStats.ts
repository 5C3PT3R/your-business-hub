import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface InboxStats {
  total: number;
  unread: number;
  urgent: number;
  starred: number;
  ai: number;
  byChannel: {
    email: number;
    linkedin: number;
    calls: number;
    [key: string]: number;
  };
}

export function useInboxStats() {
  const [stats, setStats] = useState<InboxStats>({
    total: 0,
    unread: 0,
    urgent: 0,
    starred: 0,
    ai: 0,
    byChannel: {
      email: 0,
      linkedin: 0,
      calls: 0,
    },
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();

    // Subscribe to real-time updates
    const setupSubscription = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        const subscription = supabase
          .channel('inbox_stats_changes')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'conversations',
              filter: `user_id=eq.${session.user.id}`,
            },
            () => {
              fetchStats();
            }
          )
          .subscribe();

        return () => {
          subscription.unsubscribe();
        };
      }
    };

    setupSubscription();
  }, []);

  async function fetchStats() {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) {
        setStats({
          total: 0,
          unread: 0,
          urgent: 0,
          starred: 0,
          ai: 0,
          byChannel: { email: 0, linkedin: 0, calls: 0 },
        });
        return;
      }

      // Fetch all conversations for this user
      const { data: conversations, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', session.user.id);

      if (error) throw error;

      const messages = conversations || [];

      // Calculate stats
      const total = messages.length;
      const unread = messages.filter((m: any) => !m.is_read).length;
      const urgent = messages.filter((m: any) => m.is_urgent).length;
      const starred = messages.filter((m: any) => m.is_starred).length;
      const ai = messages.filter((m: any) => m.sentiment || m.intent).length;

      // Calculate by channel
      const byChannel: { [key: string]: number } = {
        email: 0,
        linkedin: 0,
        calls: 0,
      };

      messages.forEach((m: any) => {
        const channel = m.channel || '';

        // Map channels to our categories
        if (channel === 'email') {
          byChannel.email++;
        } else if (channel === 'linkedin') {
          byChannel.linkedin++;
        } else if (channel === 'call' || channel === 'phone') {
          byChannel.calls++;
        } else if (channel) {
          // Store other channels too
          byChannel[channel] = (byChannel[channel] || 0) + 1;
        }
      });

      setStats({
        total,
        unread,
        urgent,
        starred,
        ai,
        byChannel,
      });
    } catch (error) {
      console.error('Error fetching inbox stats:', error);
    } finally {
      setLoading(false);
    }
  }

  return { stats, loading, refresh: fetchStats };
}
