import { useDeals } from '@/hooks/useDeals';
import { cn } from '@/lib/utils';
import { ArrowRight, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

const stageColors: Record<string, string> = {
  discovery: 'bg-muted text-muted-foreground',
  proposal: 'bg-warning/10 text-warning',
  negotiation: 'bg-primary/10 text-primary',
  contract: 'bg-info/10 text-info',
  closed_won: 'bg-success/10 text-success',
  closed_lost: 'bg-destructive/10 text-destructive',
};

const stageLabels: Record<string, string> = {
  discovery: 'Discovery',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  contract: 'Contract',
  closed_won: 'Won',
  closed_lost: 'Lost',
};

export function RecentDeals() {
  const { deals, loading } = useDeals();
  const recentDeals = deals.slice(0, 5);

  return (
    <div className="rounded-xl bg-card p-6 shadow-card">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Recent Deals</h3>
          <p className="text-sm text-muted-foreground">Latest pipeline activity</p>
        </div>
        <Link
          to="/deals"
          className="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
        >
          View all
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : recentDeals.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No deals yet. Create your first deal!
        </div>
      ) : (
        <div className="space-y-4">
          {recentDeals.map((deal) => (
            <div
              key={deal.id}
              className="flex items-center justify-between rounded-lg border border-border p-4 transition-all duration-200 hover:border-primary/30 hover:bg-muted/30"
            >
              <div className="flex-1">
                <h4 className="font-medium text-foreground">{deal.title}</h4>
                <p className="text-sm text-muted-foreground">{deal.company || 'No company'}</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-lg font-semibold text-foreground">
                  ${(deal.value || 0).toLocaleString()}
                </span>
                <span
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-medium',
                    stageColors[deal.stage || 'discovery'] || stageColors.discovery
                  )}
                >
                  {stageLabels[deal.stage || 'discovery'] || 'Discovery'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}