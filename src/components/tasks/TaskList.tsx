import { useState } from 'react';
import { mockTasks } from '@/data/mockData';
import { Task } from '@/types/crm';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Calendar, User, MoreHorizontal, Flag } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const priorityConfig = {
  high: { color: 'text-destructive', bg: 'bg-destructive/10', label: 'High' },
  medium: { color: 'text-warning', bg: 'bg-warning/10', label: 'Medium' },
  low: { color: 'text-muted-foreground', bg: 'bg-muted', label: 'Low' },
};

const statusConfig = {
  pending: { color: 'bg-muted text-muted-foreground', label: 'Pending' },
  'in-progress': { color: 'bg-info/10 text-info', label: 'In Progress' },
  completed: { color: 'bg-success/10 text-success', label: 'Completed' },
};

interface TaskListProps {
  filter: 'all' | 'pending' | 'in-progress' | 'completed';
}

export function TaskList({ filter }: TaskListProps) {
  const [tasks, setTasks] = useState(mockTasks);

  const filteredTasks = filter === 'all' 
    ? tasks 
    : tasks.filter((task) => task.status === filter);

  const toggleComplete = (taskId: string) => {
    setTasks(tasks.map((task) => 
      task.id === taskId 
        ? { ...task, status: task.status === 'completed' ? 'pending' : 'completed' as Task['status'] }
        : task
    ));
  };

  return (
    <div className="space-y-3">
      {filteredTasks.map((task, index) => {
        const priority = priorityConfig[task.priority];
        const status = statusConfig[task.status];

        return (
          <div
            key={task.id}
            className={cn(
              'group flex items-start gap-4 rounded-xl border border-border bg-card p-4 transition-all duration-200 hover:shadow-md hover:border-primary/30 animate-fade-in',
              task.status === 'completed' && 'opacity-60'
            )}
            style={{ animationDelay: `${index * 0.05}s` }}
          >
            <Checkbox
              checked={task.status === 'completed'}
              onCheckedChange={() => toggleComplete(task.id)}
              className="mt-1"
            />

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h4 className={cn(
                    'font-medium text-foreground',
                    task.status === 'completed' && 'line-through'
                  )}>
                    {task.title}
                  </h4>
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                    {task.description}
                  </p>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>Edit Task</DropdownMenuItem>
                    <DropdownMenuItem>Change Priority</DropdownMenuItem>
                    <DropdownMenuItem>Reassign</DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                <span className={cn('rounded-full px-2.5 py-1 font-medium', status.color)}>
                  {status.label}
                </span>
                <span className={cn('flex items-center gap-1 rounded-full px-2.5 py-1', priority.bg, priority.color)}>
                  <Flag className="h-3 w-3" />
                  {priority.label}
                </span>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  {task.dueDate}
                </span>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <User className="h-3.5 w-3.5" />
                  {task.assignee}
                </span>
                {task.relatedTo && (
                  <span className="text-muted-foreground">
                    • {task.relatedTo}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {filteredTasks.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No tasks found.</p>
        </div>
      )}
    </div>
  );
}
