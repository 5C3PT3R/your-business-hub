import { Agent, getAgentTypeLabel, getAgentStatusColor } from '@/types/agents';
import {
  Bot,
  Clock,
  Play,
  Pause,
  Settings,
  TrendingUp,
  CheckCircle2,
  XCircle,
  MoreVertical,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDistanceToNow } from 'date-fns';

interface AgentCardProps {
  agent: Agent;
  onClick?: () => void;
  onToggleStatus?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  successRate?: number;
}

export function AgentCard({ agent, onClick, onToggleStatus, onEdit, onDelete, successRate = 0 }: AgentCardProps) {
  const isActive = agent.status === 'active';
  const statusColor = getAgentStatusColor(agent.status);

  // Get gradient background based on agent type
  const getGradientClass = () => {
    const gradients = {
      receptionist: 'from-blue-500 to-cyan-600',
      sdr: 'from-violet-500 to-purple-600',
      deal_analyst: 'from-orange-500 to-red-600',
      marketing_analyst: 'from-green-500 to-emerald-600',
      follow_up: 'from-pink-500 to-rose-600',
      coach: 'from-indigo-500 to-blue-600',
    };
    return gradients[agent.agent_type] || 'from-gray-500 to-gray-600';
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        'group relative rounded-lg border border-border bg-card shadow-sm transition-all duration-200 hover:shadow-md hover:border-primary/30 cursor-pointer',
        'flex flex-col h-full'
      )}
    >
      {/* Header with gradient */}
      <div className={cn('bg-gradient-to-br rounded-t-lg p-4', getGradientClass())}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="h-10 w-10 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-white truncate">{agent.name}</h3>
              <p className="text-xs text-white/80 truncate">{getAgentTypeLabel(agent.agent_type)}</p>
            </div>
          </div>

          {/* Quick Actions Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="h-8 w-8 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors">
                <MoreVertical className="h-4 w-4 text-white" />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleStatus?.();
                }}
              >
                {isActive ? (
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
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit?.();
                }}
              >
                <Settings className="h-4 w-4 mr-2" />
                Configure
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete?.();
                }}
                className="text-destructive"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* Description */}
        {agent.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {agent.description}
          </p>
        )}

        {/* Status Badge */}
        <div className="flex items-center gap-2">
          <Badge variant={statusColor} className="text-xs">
            {agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {agent.schedule_type === 'manual' ? 'Manual' : agent.schedule_type.charAt(0).toUpperCase() + agent.schedule_type.slice(1)}
          </span>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-3 mt-auto">
          {/* Last Run */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span className="text-xs">Last Run</span>
            </div>
            <span className="text-sm font-medium">
              {agent.last_run_at
                ? formatDistanceToNow(new Date(agent.last_run_at), { addSuffix: true })
                : 'Never'}
            </span>
          </div>

          {/* Success Rate */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              {successRate >= 80 ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
              ) : successRate >= 50 ? (
                <TrendingUp className="h-3.5 w-3.5 text-orange-600" />
              ) : (
                <XCircle className="h-3.5 w-3.5 text-red-600" />
              )}
              <span className="text-xs">Success Rate</span>
            </div>
            <span className="text-sm font-medium">
              {agent.total_executions > 0 ? `${successRate}%` : 'N/A'}
            </span>
          </div>
        </div>

        {/* Execution Count */}
        {agent.total_executions > 0 && (
          <div className="text-xs text-muted-foreground pt-2 border-t">
            {agent.total_executions} execution{agent.total_executions !== 1 ? 's' : ''} •{' '}
            {agent.successful_executions} successful
          </div>
        )}
      </div>

      {/* Active indicator */}
      {isActive && (
        <div className="absolute top-2 right-2">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
        </div>
      )}
    </div>
  );
}
