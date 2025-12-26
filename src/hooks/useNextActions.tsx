/**
 * V1 MODE: Next Actions hook
 * Derives actionable items from deals and activities
 * - Stale deals (no activity > 3 days)
 * - AI suggested follow-ups
 * - At-risk deals (low intent detected)
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useWorkspace } from './useWorkspace';
import { parseAISummary, type AIAnalysis } from './useActivities';

export type ActionType = 'at_risk' | 'ai_follow_up' | 'stale';

export interface NextAction {
  id: string;
  dealId: string;
  dealTitle: string;
  company: string | null;
  type: ActionType;
  label: string;
  tooltip?: string;
  createdAt: string;
}

interface DealWithActivity {
  id: string;
  title: string;
  company: string | null;
  stage: string;
  updated_at: string;
  latestActivity?: {
    id: string;
    created_at: string;
    ai_summary: string | null;
  };
}

export function useNextActions() {
  const [actions, setActions] = useState<NextAction[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { workspace } = useWorkspace();

  const fetchNextActions = useCallback(async () => {
    if (!user || !workspace) return;

    setLoading(true);

    try {
      // Fetch all non-closed deals
      const { data: deals, error: dealsError } = await supabase
        .from('deals')
        .select('id, title, company, stage, updated_at')
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

        // Check for at-risk (low intent)
        if (aiAnalysis && aiAnalysis.intent_level === 'low') {
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

        // Check for AI suggested follow-ups
        if (aiAnalysis && aiAnalysis.next_actions && aiAnalysis.next_actions.length > 0) {
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

        // Check for stale deals (no activity > 3 days)
        if (lastActivityDate < threeDaysAgo) {
          derivedActions.push({
            id: `stale-${deal.id}`,
            dealId: deal.id,
            dealTitle: deal.title,
            company: deal.company,
            type: 'stale',
            label: 'Needs follow-up',
            tooltip: `No activity for ${Math.floor((now.getTime() - lastActivityDate.getTime()) / (24 * 60 * 60 * 1000))} days`,
            createdAt: lastActivityDate.toISOString(),
          });
        }
      });

      // Sort by priority: at_risk > ai_follow_up > stale
      const priorityOrder: Record<ActionType, number> = {
        at_risk: 0,
        ai_follow_up: 1,
        stale: 2,
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

  useEffect(() => {
    fetchNextActions();
  }, [fetchNextActions]);

  return { actions, loading, refetch: fetchNextActions };
}
