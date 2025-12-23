import { Deal } from '@/types/crm';
import { cn } from '@/lib/utils';
import { Calendar, User, GripVertical } from 'lucide-react';

interface DealCardProps {
  deal: Deal;
}

export function DealCard({ deal }: DealCardProps) {
  return (
    <div className="group relative rounded-lg border border-border bg-card p-4 shadow-sm transition-all duration-200 hover:shadow-md hover:border-primary/30 cursor-grab active:cursor-grabbing">
      <div className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-50 transition-opacity">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      
      <div className="pl-4">
        <h4 className="font-medium text-foreground line-clamp-1">{deal.title}</h4>
        <p className="text-sm text-muted-foreground mt-1">{deal.company}</p>
        
        <div className="mt-3 flex items-center justify-between">
          <span className="text-lg font-semibold text-foreground">
            ${deal.value.toLocaleString()}
          </span>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
            {deal.probability}%
          </span>
        </div>

        <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            <span>{deal.expectedClose}</span>
          </div>
          <div className="flex items-center gap-1">
            <User className="h-3.5 w-3.5" />
            <span>{deal.owner}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
