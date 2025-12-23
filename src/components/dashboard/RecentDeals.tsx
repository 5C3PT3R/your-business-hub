import { mockDeals } from '@/data/mockData';
import { cn } from '@/lib/utils';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const stageColors = {
  prospecting: 'bg-muted text-muted-foreground',
  qualification: 'bg-info/10 text-info',
  proposal: 'bg-warning/10 text-warning',
  negotiation: 'bg-primary/10 text-primary',
  'closed-won': 'bg-success/10 text-success',
  'closed-lost': 'bg-destructive/10 text-destructive',
};

const stageLabels = {
  prospecting: 'Prospecting',
  qualification: 'Qualification',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  'closed-won': 'Won',
  'closed-lost': 'Lost',
};

export function RecentDeals() {
  const recentDeals = mockDeals.slice(0, 5);

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

      <div className="space-y-4">
        {recentDeals.map((deal) => (
          <div
            key={deal.id}
            className="flex items-center justify-between rounded-lg border border-border p-4 transition-all duration-200 hover:border-primary/30 hover:bg-muted/30"
          >
            <div className="flex-1">
              <h4 className="font-medium text-foreground">{deal.title}</h4>
              <p className="text-sm text-muted-foreground">{deal.company}</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-lg font-semibold text-foreground">
                ${deal.value.toLocaleString()}
              </span>
              <span
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-medium',
                  stageColors[deal.stage]
                )}
              >
                {stageLabels[deal.stage]}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
