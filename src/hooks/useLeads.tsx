import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useWorkspace } from './useWorkspace';
import { useToast } from './use-toast';

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'lost';

export interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  source: string | null;
  status: LeadStatus;
  value: number;
  created_at: string;
  workspace_id: string | null;
}

export function useLeads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { workspace } = useWorkspace();
  const { toast } = useToast();

  const fetchLeads = async () => {
    if (!user || !workspace) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('workspace_id', workspace.id)
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        title: "Error fetching leads",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setLeads(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLeads();
  }, [user, workspace?.id]);

  const addLead = async (lead: Omit<Lead, 'id' | 'created_at' | 'workspace_id'>) => {
    if (!user || !workspace) return;

    const { data, error } = await supabase
      .from('leads')
      .insert([{ ...lead, user_id: user.id, workspace_id: workspace.id }])
      .select()
      .single();

    if (error) {
      toast({
        title: "Error adding lead",
        description: error.message,
        variant: "destructive",
      });
      return null;
    }

    toast({
      title: "Lead added",
      description: `${lead.name} has been added to your leads.`,
    });
    
    setLeads(prev => [data, ...prev]);
    return data;
  };

  const updateLead = async (id: string, updates: Partial<Lead>) => {
    const { data, error } = await supabase
      .from('leads')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      toast({
        title: "Error updating lead",
        description: error.message,
        variant: "destructive",
      });
      return null;
    }

    setLeads(prev => prev.map(l => l.id === id ? data : l));
    return data;
  };

  const deleteLead = async (id: string) => {
    const { error } = await supabase
      .from('leads')
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        title: "Error deleting lead",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }

    toast({
      title: "Lead deleted",
      description: "The lead has been removed.",
    });
    
    setLeads(prev => prev.filter(l => l.id !== id));
    return true;
  };

  return { leads, loading, fetchLeads, addLead, updateLead, deleteLead };
}