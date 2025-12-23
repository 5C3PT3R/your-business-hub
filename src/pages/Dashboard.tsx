import { MainLayout } from '@/components/layout/MainLayout';
import { Header } from '@/components/layout/Header';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { RevenueChart } from '@/components/dashboard/RevenueChart';
import { LeadSourceChart } from '@/components/dashboard/LeadSourceChart';
import { RecentDeals } from '@/components/dashboard/RecentDeals';
import { UpcomingTasks } from '@/components/dashboard/UpcomingTasks';
import { mockMetrics } from '@/data/mockData';
import { Users, Briefcase, DollarSign, TrendingUp } from 'lucide-react';

export default function Dashboard() {
  return (
    <MainLayout>
      <Header
        title="Dashboard"
        subtitle="Welcome back, John! Here's what's happening today."
      />
      
      <div className="p-6 space-y-6">
        {/* Metrics Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 animate-fade-in">
          <MetricCard
            title="Total Leads"
            value={mockMetrics.totalLeads.toString()}
            change={mockMetrics.leadsChange}
            icon={<Users className="h-6 w-6 text-primary-foreground" />}
          />
          <MetricCard
            title="Active Deals"
            value={mockMetrics.totalDeals.toString()}
            change={mockMetrics.dealsChange}
            icon={<Briefcase className="h-6 w-6 text-primary-foreground" />}
            iconBg="gradient-success"
          />
          <MetricCard
            title="Revenue"
            value={`$${(mockMetrics.revenue / 1000).toFixed(0)}k`}
            change={mockMetrics.revenueChange}
            icon={<DollarSign className="h-6 w-6 text-primary-foreground" />}
            iconBg="gradient-warm"
          />
          <MetricCard
            title="Conversion Rate"
            value={`${mockMetrics.conversionRate}%`}
            change={mockMetrics.conversionChange}
            icon={<TrendingUp className="h-6 w-6 text-primary-foreground" />}
            iconBg="bg-info"
          />
        </div>

        {/* Charts Row */}
        <div className="grid gap-6 lg:grid-cols-3 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="lg:col-span-2">
            <RevenueChart />
          </div>
          <LeadSourceChart />
        </div>

        {/* Activity Row */}
        <div className="grid gap-6 lg:grid-cols-2 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <RecentDeals />
          <UpcomingTasks />
        </div>
      </div>
    </MainLayout>
  );
}
