import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface DealsStats {
  totalValue: number;
  totalCount: number;
  hotDeals: number;
  atRisk: number;
  stalled: number;
  closedWon: number;
}

export function useDealsStats() {
  const [stats, setStats] = useState<DealsStats>({
    totalValue: 0,
    totalCount: 0,
    hotDeals: 0,
    atRisk: 0,
    stalled: 0,
    closedWon: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();

    // Subscribe to real-time updates
    const setupSubscription = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        const subscription = supabase
          .channel('deals_stats_changes')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'deals',
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
          totalValue: 0,
          totalCount: 0,
          hotDeals: 0,
          atRisk: 0,
          stalled: 0,
          closedWon: 0,
        });
        return;
      }

      // Fetch all deals for this user
      const { data: deals, error } = await supabase
        .from('deals')
        .select('*')
        .eq('user_id', session.user.id);

      if (error) throw error;

      const allDeals = deals || [];
      const totalCount = allDeals.length;
      const totalValue = allDeals.reduce((sum: number, deal: any) => sum + (deal.value || 0), 0);

      // Calculate stats based on deal properties
      const hotDeals = allDeals.filter((d: any) =>
        d.health_score > 80 || d.probability > 70
      ).length;

      const atRisk = allDeals.filter((d: any) =>
        d.health_score < 40 && d.stage !== 'won' && d.stage !== 'lost'
      ).length;

      const stalled = allDeals.filter((d: any) => {
        if (!d.updated_at) return false;
        const daysSinceUpdate = Math.floor(
          (Date.now() - new Date(d.updated_at).getTime()) / (1000 * 60 * 60 * 24)
        );
        return daysSinceUpdate > 30 && d.stage !== 'won' && d.stage !== 'lost';
      }).length;

      const closedWon = allDeals.filter((d: any) =>
        d.stage === 'won' || d.status === 'closed_won'
      ).length;

      setStats({
        totalValue,
        totalCount,
        hotDeals,
        atRisk,
        stalled,
        closedWon,
      });
    } catch (error) {
      console.error('Error fetching deals stats:', error);
    } finally {
      setLoading(false);
    }
  }

  return { stats, loading, refresh: fetchStats };
}
