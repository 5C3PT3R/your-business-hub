import { MetricCard } from '@/components/dashboard/MetricCard';
import { RevenueChart } from '@/components/dashboard/RevenueChart';
import { LeadSourceChart } from '@/components/dashboard/LeadSourceChart';
import { RecentDeals } from '@/components/dashboard/RecentDeals';
import { UpcomingTasks } from '@/components/dashboard/UpcomingTasks';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import { Users, Briefcase, DollarSign, TrendingUp, Loader2 } from 'lucide-react';

export function SalesDashboard() {
  const { metrics, loading } = useDashboardMetrics();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Metrics Grid */}
      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 animate-fade-in">
        <MetricCard
          title="Total Leads"
          value={metrics.totalLeads.toString()}
          change={metrics.leadsChange}
          icon={<Users className="h-5 w-5 md:h-6 md:w-6 text-primary-foreground" />}
        />
        <MetricCard
          title="Active Deals"
          value={metrics.totalDeals.toString()}
          change={metrics.dealsChange}
          icon={<Briefcase className="h-5 w-5 md:h-6 md:w-6 text-primary-foreground" />}
          iconBg="gradient-success"
        />
        <MetricCard
          title="Revenue"
          value={`$${(metrics.revenue / 1000).toFixed(0)}k`}
          change={metrics.revenueChange}
          icon={<DollarSign className="h-5 w-5 md:h-6 md:w-6 text-primary-foreground" />}
          iconBg="gradient-warm"
        />
        <MetricCard
          title="Conversion"
          value={`${metrics.conversionRate}%`}
          change={metrics.conversionChange}
          icon={<TrendingUp className="h-5 w-5 md:h-6 md:w-6 text-primary-foreground" />}
          iconBg="bg-info"
        />
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3 animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <div className="lg:col-span-2">
          <RevenueChart />
        </div>
        <LeadSourceChart />
      </div>

      {/* Activity Row */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2 animate-slide-up" style={{ animationDelay: '0.2s' }}>
        <RecentDeals />
        <UpcomingTasks />
      </div>
    </div>
  );
}
