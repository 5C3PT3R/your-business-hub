import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import { Building2, Users, Calendar, MapPin, Loader2, Home, TrendingUp, DollarSign } from 'lucide-react';

export function RealEstateDashboard() {
  const { metrics, loading } = useDashboardMetrics();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Metrics Grid - Real Estate themed */}
      <div className="grid gap-4 md:gap-6 grid-cols-2 lg:grid-cols-4 animate-fade-in">
        <MetricCard
          title="Active Listings"
          value={metrics.totalDeals.toString()}
          change={metrics.dealsChange}
          icon={<Home className="h-5 w-5 md:h-6 md:w-6 text-white" />}
          iconBg="bg-gradient-to-br from-emerald-500 to-teal-600"
        />
        <MetricCard
          title="Client Inquiries"
          value={metrics.totalLeads.toString()}
          change={metrics.leadsChange}
          icon={<Users className="h-5 w-5 md:h-6 md:w-6 text-white" />}
          iconBg="bg-gradient-to-br from-teal-500 to-cyan-600"
        />
        <MetricCard
          title="Bookings Value"
          value={`$${(metrics.revenue / 1000).toFixed(0)}k`}
          change={metrics.revenueChange}
          icon={<DollarSign className="h-5 w-5 md:h-6 md:w-6 text-white" />}
          iconBg="bg-gradient-to-br from-green-500 to-emerald-600"
        />
        <MetricCard
          title="Conversion"
          value={`${metrics.conversionRate}%`}
          change={metrics.conversionChange}
          icon={<TrendingUp className="h-5 w-5 md:h-6 md:w-6 text-white" />}
          iconBg="bg-gradient-to-br from-cyan-500 to-blue-600"
        />
      </div>

      {/* Property Pipeline */}
      <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-3 animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <Card className="lg:col-span-2 shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-emerald-500" />
              Property Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4 text-center">
              {['Listed', 'Viewing', 'Negotiation', 'Closed'].map((stage, i) => (
                <div key={stage} className="p-4 rounded-lg bg-muted/50">
                  <div className="text-2xl font-bold text-foreground">{Math.floor(Math.random() * 10) + 1}</div>
                  <div className="text-xs text-muted-foreground mt-1">{stage}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-emerald-500" />
              Today's Site Visits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                    <MapPin className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">Property Visit #{i}</div>
                    <div className="text-xs text-muted-foreground">{10 + i}:00 AM</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Hot Leads & Recent Bookings */}
      <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-2 animate-slide-up" style={{ animationDelay: '0.2s' }}>
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-emerald-500" />
              Hot Leads
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No leads yet</p>
              <p className="text-xs">Start adding client inquiries</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-emerald-500" />
              Recent Bookings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No bookings yet</p>
              <p className="text-xs">Close your first property deal</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
