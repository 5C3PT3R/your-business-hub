import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import { Shield, FileCheck, RefreshCw, DollarSign, Loader2, Users, TrendingUp, AlertTriangle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

export function InsuranceDashboard() {
  const { metrics, loading } = useDashboardMetrics();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-rose-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Metrics Grid - Insurance themed */}
      <div className="grid gap-4 md:gap-6 grid-cols-2 lg:grid-cols-4 animate-fade-in">
        <MetricCard
          title="Active Claims"
          value={metrics.totalDeals.toString()}
          change={metrics.dealsChange}
          icon={<FileCheck className="h-5 w-5 md:h-6 md:w-6 text-white" />}
          iconBg="bg-gradient-to-br from-rose-500 to-pink-600"
        />
        <MetricCard
          title="Quote Requests"
          value={metrics.totalLeads.toString()}
          change={metrics.leadsChange}
          icon={<Users className="h-5 w-5 md:h-6 md:w-6 text-white" />}
          iconBg="bg-gradient-to-br from-pink-500 to-fuchsia-600"
        />
        <MetricCard
          title="Premium Collected"
          value={`$${(metrics.revenue / 1000).toFixed(0)}k`}
          change={metrics.revenueChange}
          icon={<DollarSign className="h-5 w-5 md:h-6 md:w-6 text-white" />}
          iconBg="bg-gradient-to-br from-rose-600 to-red-600"
        />
        <MetricCard
          title="Claim Approval"
          value={`${metrics.conversionRate}%`}
          change={metrics.conversionChange}
          icon={<TrendingUp className="h-5 w-5 md:h-6 md:w-6 text-white" />}
          iconBg="bg-gradient-to-br from-fuchsia-500 to-purple-600"
        />
      </div>

      {/* Claims Overview & Policy Renewals */}
      <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-3 animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <Card className="lg:col-span-2 shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-rose-500" />
              Claims Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-3 text-center">
              {[
                { label: 'Filed', count: 8, color: 'bg-rose-500' },
                { label: 'Under Review', count: 12, color: 'bg-pink-500' },
                { label: 'Investigation', count: 4, color: 'bg-fuchsia-500' },
                { label: 'Approved', count: 6, color: 'bg-green-500' },
                { label: 'Settled', count: 18, color: 'bg-emerald-500' },
              ].map((item) => (
                <div key={item.label} className="p-3 rounded-lg bg-muted/50">
                  <div className={`h-2 w-2 rounded-full ${item.color} mx-auto mb-2`} />
                  <div className="text-xl font-bold text-foreground">{item.count}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">{item.label}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-rose-500" />
              Renewals This Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="text-center mb-4">
                <div className="text-3xl font-bold text-foreground">0</div>
                <div className="text-xs text-muted-foreground">Policies due</div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Renewed</span>
                  <span className="font-medium">0%</span>
                </div>
                <Progress value={0} className="h-2" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Agent Performance & Alerts */}
      <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-2 animate-slide-up" style={{ animationDelay: '0.2s' }}>
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-rose-500" />
              Policy Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-4 rounded-lg bg-muted/30">
                <div className="text-2xl font-bold text-foreground">0</div>
                <div className="text-xs text-muted-foreground">Active Policies</div>
              </div>
              <div className="p-4 rounded-lg bg-muted/30">
                <div className="text-2xl font-bold text-foreground">0</div>
                <div className="text-xs text-muted-foreground">Pending Quotes</div>
              </div>
              <div className="p-4 rounded-lg bg-muted/30">
                <div className="text-2xl font-bold text-foreground">0</div>
                <div className="text-xs text-muted-foreground">Lapsed</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-rose-500" />
              Priority Claims
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No priority claims</p>
              <p className="text-xs">All high-priority claims resolved</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
