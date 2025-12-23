import { MainLayout } from '@/components/layout/MainLayout';
import { Header } from '@/components/layout/Header';
import { RevenueChart } from '@/components/dashboard/RevenueChart';
import { LeadSourceChart } from '@/components/dashboard/LeadSourceChart';
import { SalesChart } from '@/components/reports/SalesChart';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { mockMetrics } from '@/data/mockData';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Download, Calendar, TrendingUp, Target, Users, DollarSign } from 'lucide-react';

export default function Reports() {
  return (
    <MainLayout>
      <Header
        title="Reports"
        subtitle="Analytics and performance insights"
      />
      
      <div className="p-6 space-y-6">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-4 animate-fade-in">
          <div className="flex items-center gap-3">
            <Select defaultValue="30">
              <SelectTrigger className="w-48">
                <Calendar className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Time period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="365">Last year</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
        </div>

        {/* Summary Metrics */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 animate-fade-in">
          <MetricCard
            title="Total Revenue"
            value={`$${(mockMetrics.revenue / 1000).toFixed(0)}k`}
            change={mockMetrics.revenueChange}
            icon={<DollarSign className="h-6 w-6 text-primary-foreground" />}
            iconBg="gradient-primary"
          />
          <MetricCard
            title="Win Rate"
            value={`${mockMetrics.conversionRate}%`}
            change={mockMetrics.conversionChange}
            icon={<Target className="h-6 w-6 text-primary-foreground" />}
            iconBg="gradient-success"
          />
          <MetricCard
            title="Active Deals"
            value={mockMetrics.totalDeals.toString()}
            change={mockMetrics.dealsChange}
            icon={<TrendingUp className="h-6 w-6 text-primary-foreground" />}
            iconBg="gradient-warm"
          />
          <MetricCard
            title="New Leads"
            value={mockMetrics.totalLeads.toString()}
            change={mockMetrics.leadsChange}
            icon={<Users className="h-6 w-6 text-primary-foreground" />}
            iconBg="bg-info"
          />
        </div>

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-2 animate-slide-up">
          <RevenueChart />
          <SalesChart />
        </div>

        <div className="grid gap-6 lg:grid-cols-3 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="lg:col-span-1">
            <LeadSourceChart />
          </div>
          <div className="lg:col-span-2 rounded-xl bg-card p-6 shadow-card">
            <h3 className="text-lg font-semibold text-foreground mb-4">Performance Summary</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="text-sm text-muted-foreground">Average Deal Size</p>
                <p className="text-2xl font-bold text-foreground mt-1">$42,500</p>
                <p className="text-sm text-success mt-1">↑ 12% from last month</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="text-sm text-muted-foreground">Sales Cycle</p>
                <p className="text-2xl font-bold text-foreground mt-1">28 days</p>
                <p className="text-sm text-success mt-1">↓ 3 days faster</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="text-sm text-muted-foreground">Lead Response Time</p>
                <p className="text-2xl font-bold text-foreground mt-1">2.4 hours</p>
                <p className="text-sm text-success mt-1">↓ 15% improvement</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="text-sm text-muted-foreground">Customer Retention</p>
                <p className="text-2xl font-bold text-foreground mt-1">94%</p>
                <p className="text-sm text-success mt-1">↑ 2% increase</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
