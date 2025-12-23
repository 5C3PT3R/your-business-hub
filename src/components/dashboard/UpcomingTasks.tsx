import { mockTasks } from '@/data/mockData';
import { cn } from '@/lib/utils';
import { Calendar, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Checkbox } from '@/components/ui/checkbox';

const priorityColors = {
  high: 'border-l-destructive',
  medium: 'border-l-warning',
  low: 'border-l-muted-foreground',
};

export function UpcomingTasks() {
  const upcomingTasks = mockTasks.filter((t) => t.status !== 'completed').slice(0, 4);

  return (
    <div className="rounded-xl bg-card p-6 shadow-card">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Upcoming Tasks</h3>
          <p className="text-sm text-muted-foreground">Your pending items</p>
        </div>
        <Link
          to="/tasks"
          className="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
        >
          View all
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="space-y-3">
        {upcomingTasks.map((task) => (
          <div
            key={task.id}
            className={cn(
              'flex items-start gap-3 rounded-lg border border-border border-l-4 p-4 transition-all duration-200 hover:bg-muted/30',
              priorityColors[task.priority]
            )}
          >
            <Checkbox className="mt-0.5" />
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-foreground truncate">{task.title}</h4>
              <p className="text-sm text-muted-foreground truncate">{task.description}</p>
              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                <span>{task.dueDate}</span>
                {task.relatedTo && (
                  <>
                    <span>•</span>
                    <span>{task.relatedTo}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
