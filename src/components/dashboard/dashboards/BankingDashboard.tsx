import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import { Landmark, FileText, Clock, Phone, Loader2, Users, TrendingUp, CheckCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

export function BankingDashboard() {
  const { metrics, loading } = useDashboardMetrics();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Metrics Grid - Banking themed */}
      <div className="grid gap-4 md:gap-6 grid-cols-2 lg:grid-cols-4 animate-fade-in">
        <MetricCard
          title="Active Applications"
          value={metrics.totalDeals.toString()}
          change={metrics.dealsChange}
          icon={<FileText className="h-5 w-5 md:h-6 md:w-6 text-white" />}
          iconBg="bg-gradient-to-br from-blue-500 to-indigo-600"
        />
        <MetricCard
          title="Prospects"
          value={metrics.totalLeads.toString()}
          change={metrics.leadsChange}
          icon={<Users className="h-5 w-5 md:h-6 md:w-6 text-white" />}
          iconBg="bg-gradient-to-br from-indigo-500 to-purple-600"
        />
        <MetricCard
          title="Approved Value"
          value={`$${(metrics.revenue / 1000).toFixed(0)}k`}
          change={metrics.revenueChange}
          icon={<Landmark className="h-5 w-5 md:h-6 md:w-6 text-white" />}
          iconBg="bg-gradient-to-br from-blue-600 to-blue-800"
        />
        <MetricCard
          title="Approval Rate"
          value={`${metrics.conversionRate}%`}
          change={metrics.conversionChange}
          icon={<TrendingUp className="h-5 w-5 md:h-6 md:w-6 text-white" />}
          iconBg="bg-gradient-to-br from-cyan-500 to-blue-600"
        />
      </div>

      {/* SLA Compliance & Application Status */}
      <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-3 animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-500" />
              SLA Compliance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: 'Response Time', value: 95 },
              { label: 'Resolution Time', value: 88 },
              { label: 'First Call Resolution', value: 72 },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-medium">{item.value}%</span>
                </div>
                <Progress value={item.value} className="h-2" />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-500" />
              Application Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-3 text-center">
              {[
                { label: 'Submitted', count: 12 },
                { label: 'Under Review', count: 8 },
                { label: 'Documentation', count: 5 },
                { label: 'Approval', count: 3 },
                { label: 'Disbursed', count: 15 },
              ].map((item) => (
                <div key={item.label} className="p-3 rounded-lg bg-muted/50">
                  <div className="text-xl font-bold text-foreground">{item.count}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">{item.label}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Call Metrics & Pending Approvals */}
      <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-2 animate-slide-up" style={{ animationDelay: '0.2s' }}>
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-blue-500" />
              Call Center Metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-4 rounded-lg bg-muted/30">
                <div className="text-2xl font-bold text-foreground">0</div>
                <div className="text-xs text-muted-foreground">Calls Today</div>
              </div>
              <div className="p-4 rounded-lg bg-muted/30">
                <div className="text-2xl font-bold text-foreground">0:00</div>
                <div className="text-xs text-muted-foreground">Avg Handle Time</div>
              </div>
              <div className="p-4 rounded-lg bg-muted/30">
                <div className="text-2xl font-bold text-foreground">0</div>
                <div className="text-xs text-muted-foreground">In Queue</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-blue-500" />
              Pending Approvals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No pending approvals</p>
              <p className="text-xs">All applications have been reviewed</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
