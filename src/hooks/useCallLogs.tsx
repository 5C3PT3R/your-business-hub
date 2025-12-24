import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useToast } from '@/hooks/use-toast';

export interface CallLog {
  id: string;
  lead_id: string | null;
  user_id: string;
  workspace_id: string | null;
  phone_number: string | null;
  duration_seconds: number | null;
  recording_url: string | null;
  transcription: string | null;
  summary: string | null;
  sentiment: 'positive' | 'negative' | 'neutral' | null;
  sentiment_score: number | null;
  follow_ups: Array<{ description: string; suggestedDate: string | null; rawText: string }>;
  action_items: string[];
  key_topics: string[];
  twilio_call_sid: string | null;
  call_status: string | null;
  created_at: string;
  updated_at: string;
}

interface CallAnalysis {
  summary: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  sentimentScore: number;
  followUps: Array<{
    description: string;
    suggestedDate: string | null;
    suggestedTime: string | null;
    rawText: string;
  }>;
  actionItems: string[];
  keyTopics: string[];
  nextSteps: string;
}

export const useCallLogs = (leadId?: string) => {
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { workspace } = useWorkspace();
  const { toast } = useToast();

  const fetchCallLogs = useCallback(async () => {
    if (!user || !workspace) {
      setCallLogs([]);
      setLoading(false);
      return;
    }

    try {
      let query = supabase
        .from('call_logs')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false });

      if (leadId) {
        query = query.eq('lead_id', leadId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Type-safe conversion
      const typedLogs: CallLog[] = (data || []).map(log => ({
        ...log,
        sentiment: log.sentiment as CallLog['sentiment'],
        follow_ups: Array.isArray(log.follow_ups) ? log.follow_ups as CallLog['follow_ups'] : [],
        action_items: Array.isArray(log.action_items) ? log.action_items as string[] : [],
        key_topics: Array.isArray(log.key_topics) ? log.key_topics as string[] : [],
      }));

      setCallLogs(typedLogs);
    } catch (error) {
      console.error('Error fetching call logs:', error);
    } finally {
      setLoading(false);
    }
  }, [user, workspace, leadId]);

  useEffect(() => {
    fetchCallLogs();
  }, [fetchCallLogs]);

  const saveCallLog = async (data: {
    leadId: string;
    phoneNumber: string;
    durationSeconds: number;
    transcription: string;
    analysis: CallAnalysis;
    twilioCallSid?: string;
  }) => {
    if (!user || !workspace) {
      toast({
        title: 'Error',
        description: 'You must be logged in to save call logs',
        variant: 'destructive',
      });
      return null;
    }

    try {
      const { data: newLog, error } = await supabase
        .from('call_logs')
        .insert({
          lead_id: data.leadId,
          user_id: user.id,
          workspace_id: workspace.id,
          phone_number: data.phoneNumber,
          duration_seconds: data.durationSeconds,
          transcription: data.transcription,
          summary: data.analysis.summary,
          sentiment: data.analysis.sentiment,
          sentiment_score: data.analysis.sentimentScore,
          follow_ups: data.analysis.followUps,
          action_items: data.analysis.actionItems,
          key_topics: data.analysis.keyTopics,
          twilio_call_sid: data.twilioCallSid || null,
          call_status: 'completed',
        })
        .select()
        .single();

      if (error) throw error;

      // Add to local state
      const typedLog: CallLog = {
        ...newLog,
        sentiment: newLog.sentiment as CallLog['sentiment'],
        follow_ups: Array.isArray(newLog.follow_ups) ? newLog.follow_ups as CallLog['follow_ups'] : [],
        action_items: Array.isArray(newLog.action_items) ? newLog.action_items as string[] : [],
        key_topics: Array.isArray(newLog.key_topics) ? newLog.key_topics as string[] : [],
      };
      
      setCallLogs(prev => [typedLog, ...prev]);

      toast({
        title: 'Call Logged',
        description: 'Call recording and analysis saved successfully',
      });

      return typedLog;
    } catch (error) {
      console.error('Error saving call log:', error);
      toast({
        title: 'Error',
        description: 'Failed to save call log',
        variant: 'destructive',
      });
      return null;
    }
  };

  return {
    callLogs,
    loading,
    saveCallLog,
    refetch: fetchCallLogs,
  };
};
