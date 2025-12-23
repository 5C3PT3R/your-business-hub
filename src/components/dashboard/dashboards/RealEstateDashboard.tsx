import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useRealEstateMetrics, useRealEstateSiteVisits, useRealEstateProperties } from '@/hooks/useRealEstateData';
import { 
  Building2, Users, Calendar, MapPin, Loader2, Home, TrendingUp, DollarSign, Flame, Clock
} from 'lucide-react';
import { format, isToday, isTomorrow, parseISO } from 'date-fns';

export function RealEstateDashboard() {
  const metrics = useRealEstateMetrics();
  const { data: siteVisits = [], isLoading } = useRealEstateSiteVisits();
  const { data: properties = [] } = useRealEstateProperties();

  const upcoming = siteVisits.filter(sv => sv.status === 'scheduled' && new Date(sv.scheduled_at) >= new Date()).slice(0, 4);
  const available = properties.filter(p => p.status === 'available').slice(0, 4);

  const formatPrice = (price: number) => {
    if (price >= 10000000) return `₹${(price / 10000000).toFixed(1)}Cr`;
    if (price >= 100000) return `₹${(price / 100000).toFixed(1)}L`;
    return `₹${price.toLocaleString()}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-orange-500/10 border-orange-500/20">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Hot Clients</p>
                <p className="text-3xl font-bold mt-1">{metrics.hotClients}</p>
                <p className="text-xs text-muted-foreground mt-1">Ready to book</p>
              </div>
              <div className="p-3 rounded-xl bg-background/50">
                <Flame className="h-6 w-6 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Today's Visits</p>
                <p className="text-3xl font-bold mt-1">{metrics.todaySiteVisits}</p>
              </div>
              <div className="p-3 rounded-xl bg-background/50">
                <Calendar className="h-6 w-6 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Properties</p>
                <p className="text-3xl font-bold mt-1">{metrics.availableProperties}</p>
                <p className="text-xs text-muted-foreground mt-1">Available</p>
              </div>
              <div className="p-3 rounded-xl bg-background/50">
                <Building2 className="h-6 w-6 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-emerald-500/10 border-emerald-500/20">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pipeline Value</p>
                <p className="text-3xl font-bold mt-1">{formatPrice(metrics.totalPipelineValue)}</p>
              </div>
              <div className="p-3 rounded-xl bg-background/50">
                <DollarSign className="h-6 w-6 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Site Visits & Properties */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Calendar className="h-5 w-5 text-emerald-500" />
              Upcoming Site Visits
            </CardTitle>
            <Badge variant="secondary">{metrics.upcomingSiteVisits} scheduled</Badge>
          </CardHeader>
          <CardContent>
            {upcoming.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-2 text-muted-foreground/50" />
                <p>No upcoming site visits</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcoming.map((visit) => {
                  const visitDate = parseISO(visit.scheduled_at);
                  let dateLabel = format(visitDate, 'MMM d, h:mm a');
                  if (isToday(visitDate)) dateLabel = `Today, ${format(visitDate, 'h:mm a')}`;
                  if (isTomorrow(visitDate)) dateLabel = `Tomorrow, ${format(visitDate, 'h:mm a')}`;
                  return (
                    <div key={visit.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                      <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                        <Home className="h-5 w-5 text-emerald-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-sm truncate block">{visit.property?.title || 'Property'}</span>
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{visit.property?.location}</span>
                        </div>
                      </div>
                      <Badge variant={isToday(visitDate) ? 'default' : 'secondary'}>
                        <Clock className="h-3 w-3 mr-1" />
                        {dateLabel}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Building2 className="h-5 w-5 text-emerald-500" />
              Available Properties
            </CardTitle>
          </CardHeader>
          <CardContent>
            {available.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Home className="h-10 w-10 mx-auto mb-2 text-muted-foreground/50" />
                <p className="text-sm">No properties listed</p>
              </div>
            ) : (
              <div className="space-y-3">
                {available.map((property) => (
                  <div key={property.id} className="p-3 rounded-lg bg-muted/50">
                    <div className="flex items-start justify-between">
                      <p className="font-medium text-sm">{property.title}</p>
                      <Badge variant="secondary">{formatPrice(property.price)}</Badge>
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{property.location}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Client Intent */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Client Intent Levels</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {[
              { name: 'Hot', count: metrics.clientsByIntent.hot, icon: Flame, color: 'text-red-500' },
              { name: 'Warm', count: metrics.clientsByIntent.warm, icon: TrendingUp, color: 'text-yellow-500' },
              { name: 'Cold', count: metrics.clientsByIntent.cold, icon: Users, color: 'text-blue-500' },
            ].map((intent) => (
              <div key={intent.name} className="text-center p-4 rounded-lg bg-muted/50">
                <intent.icon className={`h-6 w-6 mx-auto mb-2 ${intent.color}`} />
                <p className="text-2xl font-bold">{intent.count}</p>
                <p className="text-xs text-muted-foreground">{intent.name}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
