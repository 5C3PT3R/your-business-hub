/**
 * V1 MODE: Next Actions hook
 * Derives actionable items from deals and activities
 * 
 * AGENTS IMPLEMENTED:
 * - Agent 5: Risk Detection (at_risk deals)
 * - Agent 6: Stale Deal (no activity > 3 days)
 * - Agent 7: Next Actions aggregation
 * - Agent 10: Deal Hygiene (missing fields, stuck deals)
 * - Agent 11: Deal Velocity (time in stage)
 * - Agent 13: Duplicate Intent detection
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useWorkspace } from './useWorkspace';
import { parseAISummary, type AIAnalysis } from './useActivities';

export type ActionType = 
  | 'at_risk' 
  | 'ai_follow_up' 
  | 'stale' 
  | 'missing_info'
  | 'stuck_stage'
  | 'possible_duplicate';

export interface NextAction {
  id: string;
  dealId: string;
  dealTitle: string;
  company: string | null;
  type: ActionType;
  label: string;
  tooltip?: string;
  createdAt: string;
  followUpMessage?: string;
}

// Stage velocity thresholds (days)
const STAGE_VELOCITY_THRESHOLDS: Record<string, number> = {
  lead: 7,
  qualified: 14,
  proposal: 10,
};

export function useNextActions() {
  const [actions, setActions] = useState<NextAction[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { workspace } = useWorkspace();

  const fetchNextActions = useCallback(async () => {
    if (!user || !workspace) return;

    setLoading(true);

    try {
      // Fetch all non-closed deals with new fields
      const { data: deals, error: dealsError } = await supabase
        .from('deals')
        .select('id, title, company, stage, updated_at, at_risk, stage_changed_at, follow_up_completed')
        .eq('workspace_id', workspace.id)
        .neq('stage', 'closed');

      if (dealsError) throw dealsError;

      // Fetch latest activity for each deal
      const { data: activities, error: activitiesError } = await supabase
        .from('activities')
        .select('id, related_deal_id, created_at, ai_summary')
        .eq('workspace_id', workspace.id)
        .not('related_deal_id', 'is', null)
        .order('created_at', { ascending: false });

      if (activitiesError) throw activitiesError;

      // Group activities by deal - get latest per deal
      const latestActivityByDeal = new Map<string, typeof activities[0]>();
      activities?.forEach((activity) => {
        if (activity.related_deal_id && !latestActivityByDeal.has(activity.related_deal_id)) {
          latestActivityByDeal.set(activity.related_deal_id, activity);
        }
      });

      // Agent 13: Track companies for duplicate detection
      const companyCounts = new Map<string, string[]>();
      deals?.forEach((deal) => {
        if (deal.company) {
          const normalizedCompany = deal.company.toLowerCase().trim();
          if (!companyCounts.has(normalizedCompany)) {
            companyCounts.set(normalizedCompany, []);
          }
          companyCounts.get(normalizedCompany)!.push(deal.id);
        }
      });

      const derivedActions: NextAction[] = [];
      const now = new Date();
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

      deals?.forEach((deal) => {
        const latestActivity = latestActivityByDeal.get(deal.id);
        const lastActivityDate = latestActivity 
          ? new Date(latestActivity.created_at)
          : new Date(deal.updated_at);

        // Parse AI analysis if available
        let aiAnalysis: AIAnalysis | null = null;
        if (latestActivity?.ai_summary) {
          aiAnalysis = parseAISummary(latestActivity.ai_summary);
        }

        // Agent 5: At-risk deals (from database flag)
        if (deal.at_risk) {
          derivedActions.push({
            id: `risk-${deal.id}`,
            dealId: deal.id,
            dealTitle: deal.title,
            company: deal.company,
            type: 'at_risk',
            label: 'At risk',
            tooltip: 'Low intent detected in last conversation',
            createdAt: latestActivity?.created_at || deal.updated_at,
          });
        }

        // Agent 4 + 7: AI suggested follow-ups (not completed)
        if (aiAnalysis && !deal.follow_up_completed) {
          // Check for follow_up_message in analysis
          const followUpMessage = (aiAnalysis as any).follow_up_message;
          if (followUpMessage) {
            derivedActions.push({
              id: `ai-${deal.id}`,
              dealId: deal.id,
              dealTitle: deal.title,
              company: deal.company,
              type: 'ai_follow_up',
              label: 'AI suggested follow-up',
              tooltip: aiAnalysis.next_actions?.[0]?.action || 'Follow up based on conversation',
              createdAt: latestActivity?.created_at || deal.updated_at,
              followUpMessage,
            });
          } else if (aiAnalysis.next_actions && aiAnalysis.next_actions.length > 0) {
            derivedActions.push({
              id: `ai-${deal.id}`,
              dealId: deal.id,
              dealTitle: deal.title,
              company: deal.company,
              type: 'ai_follow_up',
              label: 'AI suggested follow-up',
              tooltip: aiAnalysis.next_actions[0]?.action,
              createdAt: latestActivity?.created_at || deal.updated_at,
            });
          }
        }

        // Agent 6: Stale deals (no activity > 3 days)
        if (lastActivityDate < threeDaysAgo) {
          const daysSinceActivity = Math.floor((now.getTime() - lastActivityDate.getTime()) / (24 * 60 * 60 * 1000));
          derivedActions.push({
            id: `stale-${deal.id}`,
            dealId: deal.id,
            dealTitle: deal.title,
            company: deal.company,
            type: 'stale',
            label: 'Needs follow-up',
            tooltip: `No activity for ${daysSinceActivity} days`,
            createdAt: lastActivityDate.toISOString(),
          });
        }

        // Agent 10: Deal Hygiene - Missing basic info
        if (!deal.title || deal.title.trim() === '' || !deal.company) {
          derivedActions.push({
            id: `missing-${deal.id}`,
            dealId: deal.id,
            dealTitle: deal.title || 'Untitled Deal',
            company: deal.company,
            type: 'missing_info',
            label: 'Missing info',
            tooltip: !deal.company ? 'No company name set' : 'Missing required fields',
            createdAt: deal.updated_at,
          });
        }

        // Agent 11: Deal Velocity - Stuck in stage too long
        if (deal.stage_changed_at && deal.stage) {
          const stageChangedDate = new Date(deal.stage_changed_at);
          const daysInStage = Math.floor((now.getTime() - stageChangedDate.getTime()) / (24 * 60 * 60 * 1000));
          const threshold = STAGE_VELOCITY_THRESHOLDS[deal.stage] || 14;
          
          if (daysInStage > threshold) {
            derivedActions.push({
              id: `stuck-${deal.id}`,
              dealId: deal.id,
              dealTitle: deal.title,
              company: deal.company,
              type: 'stuck_stage',
              label: 'Slow progress',
              tooltip: `${daysInStage} days in ${deal.stage} stage (expected: ${threshold} days)`,
              createdAt: deal.stage_changed_at,
            });
          }
        }

        // Agent 13: Duplicate Detection
        if (deal.company) {
          const normalizedCompany = deal.company.toLowerCase().trim();
          const duplicates = companyCounts.get(normalizedCompany) || [];
          if (duplicates.length > 1 && duplicates[0] === deal.id) {
            // Only show once per company group
            derivedActions.push({
              id: `dup-${deal.id}`,
              dealId: deal.id,
              dealTitle: deal.title,
              company: deal.company,
              type: 'possible_duplicate',
              label: 'Possible duplicate',
              tooltip: `${duplicates.length} deals for ${deal.company}`,
              createdAt: deal.updated_at,
            });
          }
        }
      });

      // Sort by priority: at_risk > ai_follow_up > stale > stuck > missing > duplicate
      const priorityOrder: Record<ActionType, number> = {
        at_risk: 0,
        ai_follow_up: 1,
        stale: 2,
        stuck_stage: 3,
        missing_info: 4,
        possible_duplicate: 5,
      };

      derivedActions.sort((a, b) => {
        const priorityDiff = priorityOrder[a.type] - priorityOrder[b.type];
        if (priorityDiff !== 0) return priorityDiff;
        // Within same priority, sort by date (newest first)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      // Deduplicate - one action per deal, highest priority wins
      const seenDeals = new Set<string>();
      const deduplicatedActions = derivedActions.filter((action) => {
        if (seenDeals.has(action.dealId)) return false;
        seenDeals.add(action.dealId);
        return true;
      });

      setActions(deduplicatedActions);
    } catch (error) {
      console.error('Error fetching next actions:', error);
    } finally {
      setLoading(false);
    }
  }, [user, workspace]);

  // Mark follow-up as completed
  const markFollowUpCompleted = useCallback(async (dealId: string) => {
    const { error } = await supabase
      .from('deals')
      .update({ follow_up_completed: true })
      .eq('id', dealId);

    if (!error) {
      fetchNextActions(); // Refresh list
    }
    return !error;
  }, [fetchNextActions]);

  useEffect(() => {
    fetchNextActions();
  }, [fetchNextActions]);

  return { actions, loading, refetch: fetchNextActions, markFollowUpCompleted };
}
