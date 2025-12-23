import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import { ShoppingCart, Package, RotateCcw, Star, Loader2, Ticket, TrendingUp, Users } from 'lucide-react';

export function EcommerceDashboard() {
  const { metrics, loading } = useDashboardMetrics();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Metrics Grid - E-commerce themed */}
      <div className="grid gap-4 md:gap-6 grid-cols-2 lg:grid-cols-4 animate-fade-in">
        <MetricCard
          title="Open Tickets"
          value={metrics.totalLeads.toString()}
          change={metrics.leadsChange}
          icon={<Ticket className="h-5 w-5 md:h-6 md:w-6 text-white" />}
          iconBg="bg-gradient-to-br from-orange-500 to-amber-500"
        />
        <MetricCard
          title="Total Orders"
          value={metrics.totalDeals.toString()}
          change={metrics.dealsChange}
          icon={<ShoppingCart className="h-5 w-5 md:h-6 md:w-6 text-white" />}
          iconBg="bg-gradient-to-br from-amber-500 to-yellow-500"
        />
        <MetricCard
          title="Order Value"
          value={`$${(metrics.revenue / 1000).toFixed(0)}k`}
          change={metrics.revenueChange}
          icon={<Package className="h-5 w-5 md:h-6 md:w-6 text-white" />}
          iconBg="bg-gradient-to-br from-orange-600 to-red-500"
        />
        <MetricCard
          title="Resolution Rate"
          value={`${metrics.conversionRate}%`}
          change={metrics.conversionChange}
          icon={<TrendingUp className="h-5 w-5 md:h-6 md:w-6 text-white" />}
          iconBg="bg-gradient-to-br from-yellow-500 to-orange-500"
        />
      </div>

      {/* Support Queue & Customer Satisfaction */}
      <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-3 animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <Card className="lg:col-span-2 shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ticket className="h-5 w-5 text-orange-500" />
              Ticket Queue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4 text-center">
              {[
                { label: 'New', count: 5, color: 'bg-orange-500' },
                { label: 'In Progress', count: 8, color: 'bg-amber-500' },
                { label: 'Pending', count: 3, color: 'bg-yellow-500' },
                { label: 'Resolved', count: 24, color: 'bg-green-500' },
              ].map((item) => (
                <div key={item.label} className="p-4 rounded-lg bg-muted/50">
                  <div className={`h-2 w-2 rounded-full ${item.color} mx-auto mb-2`} />
                  <div className="text-2xl font-bold text-foreground">{item.count}</div>
                  <div className="text-xs text-muted-foreground mt-1">{item.label}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-orange-500" />
              Customer Satisfaction
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-4">
              <div className="text-4xl font-bold text-foreground">4.8</div>
              <div className="flex justify-center gap-1 my-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star
                    key={i}
                    className={`h-5 w-5 ${i <= 4 ? 'text-orange-500 fill-orange-500' : 'text-orange-500'}`}
                  />
                ))}
              </div>
              <div className="text-xs text-muted-foreground">Based on 0 reviews</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Returns & Recent Orders */}
      <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-2 animate-slide-up" style={{ animationDelay: '0.2s' }}>
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-orange-500" />
              Pending Returns
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <RotateCcw className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No pending returns</p>
              <p className="text-xs">All returns have been processed</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-orange-500" />
              Recent Customers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No customers yet</p>
              <p className="text-xs">Start adding customer records</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
