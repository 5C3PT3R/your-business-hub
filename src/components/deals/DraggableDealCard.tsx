import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Deal } from '@/hooks/useDeals';
import { Calendar, GripVertical, Building } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface DraggableDealCardProps {
  deal: Deal;
  isDragging?: boolean;
  onClick?: () => void;
}

export function DraggableDealCard({ deal, isDragging, onClick }: DraggableDealCardProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: deal.id,
  });

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
      }
    : undefined;

  const handleClick = (e: React.MouseEvent) => {
    // Only trigger click if we haven't been dragging
    if (!transform && onClick) {
      e.stopPropagation();
      onClick();
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={handleClick}
      className={cn(
        'group relative rounded-lg border border-border bg-card p-4 shadow-sm transition-all duration-200 hover:shadow-md hover:border-primary/30 cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-50 shadow-lg scale-105'
      )}
    >
      <div className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-50 transition-opacity">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      
      <div className="pl-4">
        <h4 className="font-medium text-foreground line-clamp-1">{deal.title}</h4>
        {deal.company && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
            <Building className="h-3 w-3" />
            <span>{deal.company}</span>
          </div>
        )}
        
        <div className="mt-3 flex items-center justify-between">
          <span className="text-lg font-semibold text-foreground">
            ${deal.value.toLocaleString()}
          </span>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
            {deal.probability}%
          </span>
        </div>

        {deal.expected_close_date && (
          <div className="mt-3 pt-3 border-t border-border flex items-center text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5 mr-1" />
            <span>{format(new Date(deal.expected_close_date), 'MMM d, yyyy')}</span>
          </div>
        )}
      </div>
    </div>
  );
}
