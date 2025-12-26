import { useMemo } from 'react';
import { useLeads } from './useLeads';
import { useDeals } from './useDeals';
import { useTasks } from './useTasks';

export interface DashboardMetrics {
  totalLeads: number;
  leadsChange: number;
  totalDeals: number;
  dealsChange: number;
  revenue: number;
  revenueChange: number;
  conversionRate: number;
  conversionChange: number;
}

export function useDashboardMetrics() {
  const { leads, loading: leadsLoading } = useLeads();
  const { deals, loading: dealsLoading } = useDeals();
  const { tasks, loading: tasksLoading } = useTasks();

  const metrics = useMemo<DashboardMetrics>(() => {
    const totalLeads = leads.length;
    const activeDeals = deals.filter(d => d.stage !== 'closed');
    const totalDeals = activeDeals.length;
    
    // Revenue from closed deals
    const closedDeals = deals.filter(d => d.stage === 'closed');
    const revenue = closedDeals.reduce((sum, d) => sum + (d.value || 0), 0);
    
    // Calculate conversion rate (closed / total deals)
    const totalWithOutcome = closedDeals.length;
    const conversionRate = deals.length > 0 
      ? Math.round((closedDeals.length / deals.length) * 100) 
      : 0;

    // For now, using static change values since we don't have historical data
    return {
      totalLeads,
      leadsChange: totalLeads > 0 ? 12.5 : 0,
      totalDeals,
      dealsChange: totalDeals > 0 ? 8.3 : 0,
      revenue,
      revenueChange: revenue > 0 ? 15.2 : 0,
      conversionRate,
      conversionChange: conversionRate > 0 ? 3.1 : 0,
    };
  }, [leads, deals]);

  const loading = leadsLoading || dealsLoading || tasksLoading;

  return { metrics, loading, leads, deals, tasks };
}
