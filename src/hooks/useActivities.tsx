import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useWorkspace } from './useWorkspace';
import { useToast } from './use-toast';

export interface Activity {
  id: string;
  type: string;
  description: string | null;
  raw_text: string | null;
  ai_summary: string | null;
  ai_processed: boolean;
  related_deal_id: string | null;
  related_contact_id: string | null;
  related_lead_id: string | null;
  created_at: string;
  user_id: string;
  workspace_id: string | null;
}

export function useActivities(dealId?: string) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { workspace } = useWorkspace();
  const { toast } = useToast();

  const fetchActivities = useCallback(async () => {
    if (!user || !workspace) return;
    
    setLoading(true);
    let query = supabase
      .from('activities')
      .select('*')
      .eq('workspace_id', workspace.id)
      .order('created_at', { ascending: false });
    
    if (dealId) {
      query = query.eq('related_deal_id', dealId);
    }

    const { data, error } = await query;

    if (error) {
      toast({
        title: "Error fetching activities",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setActivities((data as Activity[]) || []);
    }
    setLoading(false);
  }, [user, workspace, dealId, toast]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  const addActivity = async (activity: {
    type: string;
    description?: string;
    raw_text?: string;
    related_deal_id?: string;
    related_contact_id?: string;
    related_lead_id?: string;
  }) => {
    if (!user || !workspace) {
      toast({
        title: "Error",
        description: "You must be logged in to add activities.",
        variant: "destructive",
      });
      return null;
    }

    const { data, error } = await supabase
      .from('activities')
      .insert([{
        ...activity,
        user_id: user.id,
        workspace_id: workspace.id,
        ai_processed: false,
      }])
      .select()
      .single();

    if (error) {
      toast({
        title: "Error adding activity",
        description: error.message,
        variant: "destructive",
      });
      return null;
    }

    // Update deal's last_activity_at if linked to a deal
    if (activity.related_deal_id) {
      await supabase
        .from('deals')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', activity.related_deal_id);
    }

    toast({
      title: "Activity added",
      description: "Your conversation has been saved.",
    });
    
    setActivities(prev => [(data as Activity), ...prev]);
    return data as Activity;
  };

  const deleteActivity = async (id: string) => {
    const { error } = await supabase
      .from('activities')
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        title: "Error deleting activity",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }

    toast({
      title: "Activity deleted",
      description: "The activity has been removed.",
    });
    
    setActivities(prev => prev.filter(a => a.id !== id));
    return true;
  };

  return { activities, loading, fetchActivities, addActivity, deleteActivity };
}
