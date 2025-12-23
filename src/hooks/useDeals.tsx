import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export type DealStage = 'discovery' | 'proposal' | 'negotiation' | 'contract' | 'closed_won' | 'closed_lost';

export interface Deal {
  id: string;
  title: string;
  value: number;
  stage: DealStage;
  company: string | null;
  contact_id: string | null;
  expected_close_date: string | null;
  probability: number;
  created_at: string;
}

export function useDeals() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchDeals = async () => {
    if (!user) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from('deals')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        title: "Error fetching deals",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setDeals(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDeals();
  }, [user]);

  const addDeal = async (deal: Omit<Deal, 'id' | 'created_at'>) => {
    if (!user) return;

    const { data, error } = await supabase
      .from('deals')
      .insert([{ ...deal, user_id: user.id }])
      .select()
      .single();

    if (error) {
      toast({
        title: "Error adding deal",
        description: error.message,
        variant: "destructive",
      });
      return null;
    }

    toast({
      title: "Deal added",
      description: `${deal.title} has been added to your pipeline.`,
    });
    
    setDeals(prev => [data, ...prev]);
    return data;
  };

  const updateDeal = async (id: string, updates: Partial<Deal>) => {
    const { data, error } = await supabase
      .from('deals')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      toast({
        title: "Error updating deal",
        description: error.message,
        variant: "destructive",
      });
      return null;
    }

    setDeals(prev => prev.map(d => d.id === id ? data : d));
    return data;
  };

  const deleteDeal = async (id: string) => {
    const { error } = await supabase
      .from('deals')
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        title: "Error deleting deal",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }

    toast({
      title: "Deal deleted",
      description: "The deal has been removed.",
    });
    
    setDeals(prev => prev.filter(d => d.id !== id));
    return true;
  };

  return { deals, loading, fetchDeals, addDeal, updateDeal, deleteDeal };
}