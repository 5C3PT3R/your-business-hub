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
}

const stageColors: Record<DealStage, string> = {
  discovery: 'bg-muted text-muted-foreground border-muted',
  proposal: 'bg-info/10 text-info border-info/20',
  negotiation: 'bg-warning/10 text-warning border-warning/20',
  contract: 'bg-primary/10 text-primary border-primary/20',
  closed_won: 'bg-success/10 text-success border-success/20',
  closed_lost: 'bg-destructive/10 text-destructive border-destructive/20',
};

export function DealsTable({ deals, stages, onUpdateDeal }: DealsTableProps) {
  const handleStageChange = async (id: string, stage: DealStage) => {
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
            <TableRow key={deal.id} className="hover:bg-muted/30">
              <TableCell className="font-medium">{deal.title}</TableCell>
              <TableCell>{deal.company || '-'}</TableCell>
              <TableCell className="font-semibold">${deal.value.toLocaleString()}</TableCell>
              <TableCell>
                <Select 
                  value={deal.stage} 
                  onValueChange={(value) => handleStageChange(deal.id, value as DealStage)}
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
