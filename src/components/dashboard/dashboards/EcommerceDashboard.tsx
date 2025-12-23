import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useEcommerceMetrics, useEcommerceTickets } from '@/hooks/useEcommerceData';
import { 
  ShoppingCart, Ticket, AlertTriangle, Clock, Users, DollarSign,
  TrendingUp, CheckCircle2, Timer, Package, Loader2
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';

export function EcommerceDashboard() {
  const metrics = useEcommerceMetrics();
  const { data: tickets = [], isLoading } = useEcommerceTickets();

  const openTickets = tickets.filter(t => ['new', 'in_progress', 'waiting'].includes(t.status)).slice(0, 5);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className={metrics.openTickets > 10 ? 'bg-amber-500/10 border-amber-500/20' : ''}>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Open Tickets</p>
                <p className="text-3xl font-bold mt-1">{metrics.openTickets}</p>
                <p className="text-xs text-muted-foreground mt-1">Awaiting resolution</p>
              </div>
              <div className="p-3 rounded-xl bg-background/50">
                <Ticket className="h-6 w-6 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={metrics.urgentTickets > 0 ? 'bg-red-500/10 border-red-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Urgent Tickets</p>
                <p className="text-3xl font-bold mt-1">{metrics.urgentTickets}</p>
                <p className="text-xs text-muted-foreground mt-1">Need immediate attention</p>
              </div>
              <div className="p-3 rounded-xl bg-background/50">
                <AlertTriangle className={`h-6 w-6 ${metrics.urgentTickets > 0 ? 'text-red-500' : 'text-emerald-500'}`} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Today's Orders</p>
                <p className="text-3xl font-bold mt-1">{metrics.todayOrders}</p>
              </div>
              <div className="p-3 rounded-xl bg-background/50">
                <ShoppingCart className="h-6 w-6 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-emerald-500/10 border-emerald-500/20">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-3xl font-bold mt-1">${metrics.totalRevenue.toLocaleString()}</p>
              </div>
              <div className="p-3 rounded-xl bg-background/50">
                <DollarSign className="h-6 w-6 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ticket Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Ticket className="h-5 w-5 text-orange-500" />
              Active Ticket Queue
            </CardTitle>
            <Badge variant="secondary">{metrics.openTickets} open</Badge>
          </CardHeader>
          <CardContent>
            {openTickets.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-emerald-500/50" />
                <p>No open tickets</p>
              </div>
            ) : (
              <div className="space-y-3">
                {openTickets.map((ticket) => (
                  <div key={ticket.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                    <div className={`w-2 h-2 rounded-full ${ticket.priority === 'urgent' ? 'bg-red-500' : ticket.priority === 'high' ? 'bg-orange-500' : 'bg-yellow-500'}`} />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-sm truncate block">{ticket.subject}</span>
                      <span className="text-xs text-muted-foreground">#{ticket.ticket_number}</span>
                    </div>
                    <Badge variant="secondary">{ticket.status.replace('_', ' ')}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Ticket Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {[
                { name: 'New', count: metrics.ticketsByStatus.new, color: 'bg-blue-500' },
                { name: 'In Progress', count: metrics.ticketsByStatus.in_progress, color: 'bg-yellow-500' },
                { name: 'Waiting', count: metrics.ticketsByStatus.waiting, color: 'bg-orange-500' },
                { name: 'Resolved', count: metrics.ticketsByStatus.resolved, color: 'bg-emerald-500' },
              ].map((status) => (
                <div key={status.name} className="text-center p-4 rounded-lg bg-muted/50">
                  <div className={`w-3 h-3 rounded-full ${status.color} mx-auto mb-2`} />
                  <p className="text-2xl font-bold">{status.count}</p>
                  <p className="text-xs text-muted-foreground">{status.name}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
