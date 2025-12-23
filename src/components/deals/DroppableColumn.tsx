import { useDroppable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface DroppableColumnProps {
  id: string;
  name: string;
  color: string;
  count: number;
  value: number;
  children: ReactNode;
}

export function DroppableColumn({ id, name, color, count, value, children }: DroppableColumnProps) {
  const { isOver, setNodeRef } = useDroppable({
    id,
  });

  return (
    <div className="flex-shrink-0 w-80 flex flex-col">
      {/* Stage Header */}
      <div className="rounded-t-xl bg-card border border-border border-b-0 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn('h-3 w-3 rounded-full', color)} />
            <h3 className="font-semibold text-foreground">{name}</h3>
          </div>
          <span className="text-sm text-muted-foreground">{count}</span>
        </div>
        <p className="mt-1 text-sm font-medium text-muted-foreground">
          ${value.toLocaleString()}
        </p>
      </div>

      {/* Stage Content */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 rounded-b-xl border border-border bg-muted/30 p-3 space-y-3 min-h-[400px] transition-colors',
          isOver && 'bg-primary/10 border-primary/30'
        )}
      >
        {children}
        
        {count === 0 && (
          <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
            No deals in this stage
          </div>
        )}
      </div>
    </div>
  );
}
