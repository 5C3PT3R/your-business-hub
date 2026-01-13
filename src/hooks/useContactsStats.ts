import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ContactsStats {
  total: number;
  hotLeads: number;
  customers: number;
  inactive: number;
}

export function useContactsStats() {
  const [stats, setStats] = useState<ContactsStats>({
    total: 0,
    hotLeads: 0,
    customers: 0,
    inactive: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();

    // Subscribe to real-time updates
    const setupSubscription = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        const subscription = supabase
          .channel('contacts_stats_changes')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'contacts',
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
        setStats({ total: 0, hotLeads: 0, customers: 0, inactive: 0 });
        return;
      }

      // Fetch all contacts for this user
      const { data: contacts, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('user_id', session.user.id);

      if (error) throw error;

      const allContacts = contacts || [];
      const total = allContacts.length;

      // Calculate stats based on contact properties
      const hotLeads = allContacts.filter((c: any) =>
        c.status === 'hot' || c.lead_score > 80
      ).length;

      const customers = allContacts.filter((c: any) =>
        c.status === 'customer' || c.is_customer === true
      ).length;

      const inactive = allContacts.filter((c: any) => {
        if (!c.last_contact_date) return true;
        const daysSinceContact = Math.floor(
          (Date.now() - new Date(c.last_contact_date).getTime()) / (1000 * 60 * 60 * 24)
        );
        return daysSinceContact > 90;
      }).length;

      setStats({ total, hotLeads, customers, inactive });
    } catch (error) {
      console.error('Error fetching contacts stats:', error);
    } finally {
      setLoading(false);
    }
  }

  return { stats, loading, refresh: fetchStats };
}
