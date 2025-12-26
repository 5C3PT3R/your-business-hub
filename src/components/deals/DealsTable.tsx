import { Deal, DealStage } from '@/hooks/useDeals';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface DealsTableProps {
  deals: Deal[];
  stages: { id: DealStage; name: string; color: string }[];
  onUpdateDeal: (id: string, updates: Partial<Deal>) => Promise<Deal | null>;
  onDealClick?: (dealId: string) => void;
}

const stageColors: Record<DealStage, string> = {
  lead: 'bg-muted text-muted-foreground border-muted',
  qualified: 'bg-info/10 text-info border-info/20',
  proposal: 'bg-warning/10 text-warning border-warning/20',
  closed: 'bg-success/10 text-success border-success/20',
};

export function DealsTable({ deals, stages, onUpdateDeal, onDealClick }: DealsTableProps) {
  const handleStageChange = async (id: string, stage: DealStage, e: React.MouseEvent) => {
    e.stopPropagation();
    await onUpdateDeal(id, { stage });
  };

  return (
    <div className="rounded-xl border border-border bg-card shadow-card animate-slide-up overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>Title</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Value</TableHead>
            <TableHead>Stage</TableHead>
            <TableHead>Probability</TableHead>
            <TableHead>Expected Close</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {deals.map((deal) => (
            <TableRow 
              key={deal.id} 
              className="hover:bg-muted/30 cursor-pointer"
              onClick={() => onDealClick?.(deal.id)}
            >
              <TableCell className="font-medium">{deal.title}</TableCell>
              <TableCell>{deal.company || '-'}</TableCell>
              <TableCell className="font-semibold">${deal.value.toLocaleString()}</TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <Select 
                  value={deal.stage} 
                  onValueChange={(value) => onUpdateDeal(deal.id, { stage: value as DealStage })}
                >
                  <SelectTrigger className="h-7 w-32 border-0 p-0">
                    <Badge variant="outline" className={cn(stageColors[deal.stage])}>
                      {stages.find(s => s.id === deal.stage)?.name || deal.stage}
                    </Badge>
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map((stage) => (
                      <SelectItem key={stage.id} value={stage.id}>
                        {stage.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>{deal.probability}%</TableCell>
              <TableCell className="text-muted-foreground">
                {deal.expected_close_date 
                  ? format(new Date(deal.expected_close_date), 'MMM d, yyyy')
                  : '-'
                }
              </TableCell>
              <TableCell className="text-muted-foreground">
                {format(new Date(deal.created_at), 'MMM d, yyyy')}
              </TableCell>
            </TableRow>
          ))}
          {deals.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                No deals found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
