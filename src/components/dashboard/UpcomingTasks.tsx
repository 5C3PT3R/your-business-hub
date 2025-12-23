import { useTasks } from '@/hooks/useTasks';
import { cn } from '@/lib/utils';
import { Calendar, ArrowRight, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Checkbox } from '@/components/ui/checkbox';
import { format } from 'date-fns';

const priorityColors: Record<string, string> = {
  high: 'border-l-destructive',
  medium: 'border-l-warning',
  low: 'border-l-muted-foreground',
};

export function UpcomingTasks() {
  const { tasks, loading, updateTask } = useTasks();
  const upcomingTasks = tasks.filter((t) => t.status !== 'completed').slice(0, 4);

  const toggleComplete = async (taskId: string) => {
    await updateTask(taskId, { status: 'completed' });
  };

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

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : upcomingTasks.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No pending tasks. Great job!
        </div>
      ) : (
        <div className="space-y-3">
          {upcomingTasks.map((task) => (
            <div
              key={task.id}
              className={cn(
                'flex items-start gap-3 rounded-lg border border-border border-l-4 p-4 transition-all duration-200 hover:bg-muted/30',
                priorityColors[task.priority] || priorityColors.medium
              )}
            >
              <Checkbox 
                className="mt-0.5" 
                onCheckedChange={() => toggleComplete(task.id)}
              />
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-foreground truncate">{task.title}</h4>
                {task.description && (
                  <p className="text-sm text-muted-foreground truncate">{task.description}</p>
                )}
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  {task.due_date && (
                    <>
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{format(new Date(task.due_date), 'MMM d, yyyy')}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}