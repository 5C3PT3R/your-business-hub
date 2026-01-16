import { Workflow, WorkflowStatus, TriggerType } from '@/types/workflows';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Play,
  Pause,
  MoreHorizontal,
  Zap,
  Mail,
  UserPlus,
  Target,
  Calendar,
  CheckCircle,
  Clock,
  AlertCircle,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';

interface WorkflowCardProps {
  workflow: Workflow;
  onClick: () => void;
  onToggleStatus: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

const triggerIcons: Record<TriggerType, any> = {
  contact_created: UserPlus,
  deal_stage_changed: Target,
  email_received: Mail,
  form_submitted: Zap,
  meeting_scheduled: Calendar,
  task_completed: CheckCircle,
};

const triggerLabels: Record<TriggerType, string> = {
  contact_created: 'New Contact',
  deal_stage_changed: 'Deal Stage Change',
  email_received: 'Email Received',
  form_submitted: 'Form Submitted',
  meeting_scheduled: 'Meeting Scheduled',
  task_completed: 'Task Completed',
};

const statusConfig: Record<WorkflowStatus, { color: string; bgColor: string; label: string }> = {
  draft: { color: 'text-gray-600', bgColor: 'bg-gray-100', label: 'Draft' },
  active: { color: 'text-green-600', bgColor: 'bg-green-100', label: 'Active' },
  paused: { color: 'text-yellow-600', bgColor: 'bg-yellow-100', label: 'Paused' },
  error: { color: 'text-red-600', bgColor: 'bg-red-100', label: 'Error' },
};

export function WorkflowCard({
  workflow,
  onClick,
  onToggleStatus,
  onDuplicate,
  onDelete,
}: WorkflowCardProps) {
  const TriggerIcon = triggerIcons[workflow.trigger_type] || Zap;
  const status = statusConfig[workflow.status];
  const successRate = workflow.total_executions > 0
    ? Math.round((workflow.successful_executions / workflow.total_executions) * 100)
    : 0;

  return (
    <div
      onClick={onClick}
      className="group rounded-xl border border-border bg-card hover:shadow-lg transition-all duration-200 cursor-pointer overflow-hidden"
    >
      {/* Header with gradient */}
      <div className="bg-gradient-to-br from-violet-500 to-purple-600 p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
              <TriggerIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white truncate max-w-[180px]">
                {workflow.name}
              </h3>
              <p className="text-xs text-white/80">{triggerLabels[workflow.trigger_type]}</p>
            </div>
          </div>
          <div onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/20"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onToggleStatus}>
                  {workflow.status === 'active' ? (
                    <>
                      <Pause className="h-4 w-4 mr-2" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Activate
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDuplicate}>
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onDelete} className="text-destructive">
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-4">
        {/* Description */}
        {workflow.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {workflow.description}
          </p>
        )}

        {/* Status badge */}
        <div className="flex items-center justify-between">
          <Badge
            variant="outline"
            className={cn('font-medium', status.bgColor, status.color)}
          >
            {workflow.status === 'active' && (
              <span className="w-2 h-2 rounded-full bg-green-500 mr-1.5 animate-pulse" />
            )}
            {status.label}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {workflow.nodes.length} nodes
          </span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t">
          <div className="text-center">
            <p className="text-lg font-semibold text-foreground">
              {workflow.total_executions}
            </p>
            <p className="text-xs text-muted-foreground">Runs</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-green-600">
              {successRate}%
            </p>
            <p className="text-xs text-muted-foreground">Success</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-foreground">
              {workflow.last_run_at
                ? format(new Date(workflow.last_run_at), 'MMM d')
                : '-'}
            </p>
            <p className="text-xs text-muted-foreground">Last Run</p>
          </div>
        </div>
      </div>
    </div>
  );
}
