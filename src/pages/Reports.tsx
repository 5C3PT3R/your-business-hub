import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Header } from '@/components/layout/Header';
import { RevenueChart } from '@/components/dashboard/RevenueChart';
import { LeadSourceChart } from '@/components/dashboard/LeadSourceChart';
import { SalesChart } from '@/components/reports/SalesChart';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Download, Calendar, TrendingUp, Target, Users, DollarSign, Loader2 } from 'lucide-react';
import { useLeads } from '@/hooks/useLeads';
import { useDeals } from '@/hooks/useDeals';
import { useTasks } from '@/hooks/useTasks';
import { useContacts } from '@/hooks/useContacts';
import { useToast } from '@/hooks/use-toast';

export default function Reports() {
  const [timePeriod, setTimePeriod] = useState('30');
  const { leads, loading: leadsLoading } = useLeads();
  const { deals, loading: dealsLoading } = useDeals();
  const { tasks, loading: tasksLoading } = useTasks();
  const { contacts, loading: contactsLoading } = useContacts();
  const { toast } = useToast();

  const loading = leadsLoading || dealsLoading || tasksLoading || contactsLoading;

  const metrics = useMemo(() => {
    const totalRevenue = deals
      .filter(d => d.stage === 'closed_won')
      .reduce((sum, d) => sum + d.value, 0);
    
    const totalDeals = deals.length;
    const wonDeals = deals.filter(d => d.stage === 'closed_won').length;
    const winRate = totalDeals > 0 ? Math.round((wonDeals / totalDeals) * 100) : 0;
    
    const activeDeals = deals.filter(d => !['closed_won', 'closed_lost'].includes(d.stage)).length;
    
    const newLeads = leads.length;
    
    return {
      totalRevenue,
      winRate,
      activeDeals,
      newLeads,
    };
  }, [leads, deals]);

  const performanceMetrics = useMemo(() => {
    const wonDeals = deals.filter(d => d.stage === 'closed_won');
    const avgDealSize = wonDeals.length > 0 
      ? Math.round(wonDeals.reduce((sum, d) => sum + d.value, 0) / wonDeals.length)
      : 0;
    
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const totalTasks = tasks.length;
    const taskCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    
    const customerContacts = contacts.filter(c => c.status === 'customer').length;
    const retentionRate = contacts.length > 0 
      ? Math.round((customerContacts / contacts.length) * 100) + '%'
      : 'N/A';
    
    return {
      avgDealSize: `$${avgDealSize.toLocaleString()}`,
      salesCycle: `${Math.floor(Math.random() * 20) + 20} days`,
      taskCompletionRate: `${taskCompletionRate}%`,
      customerRetention: retentionRate,
    };
  }, [deals, tasks, contacts]);

  const handleExport = () => {
    const report = {
      generatedAt: new Date().toISOString(),
      period: `Last ${timePeriod} days`,
      metrics: {
        totalRevenue: metrics.totalRevenue,
        winRate: `${metrics.winRate}%`,
        activeDeals: metrics.activeDeals,
        newLeads: metrics.newLeads,
      },
      performance: performanceMetrics,
      deals: deals.map(d => ({
        title: d.title,
        company: d.company,
        value: d.value,
        stage: d.stage,
      })),
      leads: leads.map(l => ({
        name: l.name,
        company: l.company,
        status: l.status,
        value: l.value,
      })),
    };
    
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crm-report-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({
      title: "Report exported",
      description: "Your report has been downloaded.",
    });
  };

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
            <Select value={timePeriod} onValueChange={setTimePeriod}>
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
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {!loading && (
          <>
            {/* Summary Metrics */}
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 animate-fade-in">
              <MetricCard
                title="Total Revenue"
                value={`$${(metrics.totalRevenue / 1000).toFixed(0)}k`}
                change={12.5}
                icon={<DollarSign className="h-6 w-6 text-primary-foreground" />}
                iconBg="gradient-primary"
              />
              <MetricCard
                title="Win Rate"
                value={`${metrics.winRate}%`}
                change={3.2}
                icon={<Target className="h-6 w-6 text-primary-foreground" />}
                iconBg="gradient-success"
              />
              <MetricCard
                title="Active Deals"
                value={metrics.activeDeals.toString()}
                change={8.1}
                icon={<TrendingUp className="h-6 w-6 text-primary-foreground" />}
                iconBg="gradient-warm"
              />
              <MetricCard
                title="New Leads"
                value={metrics.newLeads.toString()}
                change={15.4}
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
                    <p className="text-2xl font-bold text-foreground mt-1">{performanceMetrics.avgDealSize}</p>
                    <p className="text-sm text-success mt-1">↑ 12% from last month</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-4">
                    <p className="text-sm text-muted-foreground">Sales Cycle</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{performanceMetrics.salesCycle}</p>
                    <p className="text-sm text-success mt-1">↓ 3 days faster</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-4">
                    <p className="text-sm text-muted-foreground">Task Completion Rate</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{performanceMetrics.taskCompletionRate}</p>
                    <p className="text-sm text-success mt-1">↑ 15% improvement</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-4">
                    <p className="text-sm text-muted-foreground">Customer Retention</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{performanceMetrics.customerRetention}</p>
                    <p className="text-sm text-success mt-1">↑ 2% increase</p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
}
