import { mockDeals } from '@/data/mockData';
import { DealCard } from './DealCard';
import { cn } from '@/lib/utils';

const stages = [
  { id: 'prospecting', name: 'Prospecting', color: 'bg-muted' },
  { id: 'qualification', name: 'Qualification', color: 'bg-info' },
  { id: 'proposal', name: 'Proposal', color: 'bg-warning' },
  { id: 'negotiation', name: 'Negotiation', color: 'bg-primary' },
  { id: 'closed-won', name: 'Closed Won', color: 'bg-success' },
  { id: 'closed-lost', name: 'Closed Lost', color: 'bg-destructive' },
];

export function DealPipeline() {
  const getDealsByStage = (stageId: string) =>
    mockDeals.filter((deal) => deal.stage === stageId);

  const getStageValue = (stageId: string) =>
    getDealsByStage(stageId).reduce((sum, deal) => sum + deal.value, 0);

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {stages.map((stage) => {
        const deals = getDealsByStage(stage.id);
        const totalValue = getStageValue(stage.id);

        return (
          <div
            key={stage.id}
            className="flex-shrink-0 w-80 flex flex-col"
          >
            {/* Stage Header */}
            <div className="rounded-t-xl bg-card border border-border border-b-0 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn('h-3 w-3 rounded-full', stage.color)} />
                  <h3 className="font-semibold text-foreground">{stage.name}</h3>
                </div>
                <span className="text-sm text-muted-foreground">
                  {deals.length}
                </span>
              </div>
              <p className="mt-1 text-sm font-medium text-muted-foreground">
                ${totalValue.toLocaleString()}
              </p>
            </div>

            {/* Stage Content */}
            <div className="flex-1 rounded-b-xl border border-border bg-muted/30 p-3 space-y-3 min-h-[400px]">
              {deals.map((deal) => (
                <DealCard key={deal.id} deal={deal} />
              ))}
              
              {deals.length === 0 && (
                <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
                  No deals in this stage
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
