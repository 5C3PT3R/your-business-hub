import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useWorkspace } from './useWorkspace';
import { useToast } from './use-toast';

export type DealStage = 'lead' | 'qualified' | 'proposal' | 'closed';
export type SentimentTrend = 'positive' | 'neutral' | 'negative';

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
  workspace_id: string | null;

  // AI-powered fields
  health_score?: number; // 0-100
  days_in_stage?: number;
  last_activity_at?: string;
  stage_entered_at?: string;
  lost_reason?: string | null;
  owner_id?: string | null;
  company_logo_url?: string | null;
  ai_risk_factors?: string[];
  ai_next_actions?: string[];
  sentiment_trend?: SentimentTrend | null;
}

export function useDeals() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { workspace } = useWorkspace();
  const { toast } = useToast();

  const fetchDeals = async () => {
    if (!user || !workspace) {
      setLoading(false);
      return;
    }

    const QUERY_TIMEOUT = 8000; // 8 seconds
    setLoading(true);
    console.log('[useDeals] Fetching deals for workspace:', workspace.id);

    try {
      // Race against timeout
      const queryPromise = supabase
        .from('deals')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false });

      const timeoutPromise = new Promise<{ data: null; error: { message: string } }>((resolve) => {
        setTimeout(() => resolve({ data: null, error: { message: 'Query timeout' } }), QUERY_TIMEOUT);
      });

      const { data, error } = await Promise.race([queryPromise, timeoutPromise]);

      if (error) {
        console.warn('[useDeals] Query error/timeout:', error.message);
        // Don't show toast for timeout - just log it and show empty state
        if (error.message !== 'Query timeout') {
          toast({
            title: "Error fetching deals",
            description: error.message,
            variant: "destructive",
          });
        }
        // Keep existing deals or show empty
        setDeals(prev => prev.length > 0 ? prev : []);
      } else {
        console.log('[useDeals] Fetched', data?.length || 0, 'deals');
        setDeals((data as Deal[]) || []);
      }
    } catch (err) {
      console.error('[useDeals] Fetch error:', err);
      setDeals([]);
    }

    setLoading(false);
  };

  useEffect(() => {
    if (user && workspace?.id) {
      fetchDeals();
    } else {
      setDeals([]);
      setLoading(false);
    }
  }, [user, workspace?.id]);

  const addDeal = async (deal: Omit<Deal, 'id' | 'created_at' | 'workspace_id'>) => {
    if (!user || !workspace) return;

    const { data, error } = await supabase
      .from('deals')
      .insert([{ ...deal, user_id: user.id, workspace_id: workspace.id }])
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
    
    setDeals(prev => [(data as Deal), ...prev]);
    return data as Deal;
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

    setDeals(prev => prev.map(d => d.id === id ? (data as Deal) : d));
    return data as Deal;
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

  const getDealById = async (id: string): Promise<Deal | null> => {
    const { data, error } = await supabase
      .from('deals')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      toast({
        title: "Error fetching deal",
        description: error.message,
        variant: "destructive",
      });
      return null;
    }

    return data as Deal | null;
  };

  return { deals, loading, fetchDeals, addDeal, updateDeal, deleteDeal, getDealById };
}
