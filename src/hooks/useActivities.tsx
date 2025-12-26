/**
 * V1 MODE: Activities hook - manages conversations
 * Auto-triggers AI analysis after conversation creation
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useWorkspace } from './useWorkspace';
import { useToast } from './use-toast';

export interface AIAnalysis {
  summary: string;
  intent_level: 'low' | 'medium' | 'high';
  key_points: string[];
  evidence_quote: string;
  next_actions: Array<{ action: string; due_in_days: number }>;
  recommended_stage: string;
  confidence: number;
}

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

// Parse the AI summary JSON stored in the database
export function parseAISummary(aiSummary: string | null): AIAnalysis | null {
  if (!aiSummary) return null;
  try {
    return JSON.parse(aiSummary) as AIAnalysis;
  } catch {
    // If it's not JSON, return a simple summary object
    return {
      summary: aiSummary,
      intent_level: 'medium',
      key_points: [],
      evidence_quote: '',
      next_actions: [],
      recommended_stage: '',
      confidence: 0,
    };
  }
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

  // Trigger AI analysis in background (non-blocking)
  const triggerAIAnalysis = async (activityId: string) => {
    try {
      console.log('Triggering AI analysis for activity:', activityId);
      
      const { data, error } = await supabase.functions.invoke('analyze-conversation', {
        body: { activity_id: activityId },
      });

      if (error) {
        console.error('AI analysis error:', error);
        toast({
          title: "AI Analysis",
          description: "Analysis is processing. Refresh to see results.",
        });
        return;
      }

      if (data?.success) {
        console.log('AI analysis completed:', data);
        
        // Show toast about stage update if applicable
        if (data.stage_updated) {
          toast({
            title: "AI Updated Deal Stage",
            description: `Stage changed to ${data.analysis.recommended_stage} (${Math.round(data.analysis.confidence * 100)}% confidence)`,
          });
        } else {
          toast({
            title: "AI Analysis Complete",
            description: "Conversation has been analyzed.",
          });
        }

        // Refresh activities to get the updated data
        await fetchActivities();
      }
    } catch (error) {
      console.error('Error triggering AI analysis:', error);
      // Non-blocking error - don't show destructive toast
      toast({
        title: "AI Analysis",
        description: "Analysis will complete in the background.",
      });
    }
  };

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
      title: "Conversation saved",
      description: "AI is now analyzing your conversation...",
    });
    
    const newActivity = data as Activity;
    setActivities(prev => [newActivity, ...prev]);

    // V1: Automatically trigger AI analysis (non-blocking)
    // Don't await - let it run in background
    triggerAIAnalysis(newActivity.id);

    return newActivity;
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
