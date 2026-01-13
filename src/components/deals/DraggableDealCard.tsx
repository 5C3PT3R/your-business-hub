import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Deal } from '@/hooks/useDeals';
import {
  Calendar,
  GripVertical,
  Building,
  Clock,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  MoreVertical,
  User
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface DraggableDealCardProps {
  deal: Deal;
  isDragging?: boolean;
  onClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function DraggableDealCard({ deal, isDragging, onClick, onEdit, onDelete }: DraggableDealCardProps) {
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

  // Health score color coding
  const getHealthScoreColor = (score: number = 50) => {
    if (score >= 80) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 50) return 'text-orange-600 bg-orange-50 border-orange-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  // Sentiment icon
  const getSentimentIcon = () => {
    if (deal.sentiment_trend === 'positive') return <TrendingUp className="h-3 w-3" />;
    if (deal.sentiment_trend === 'negative') return <TrendingDown className="h-3 w-3" />;
    return <Minus className="h-3 w-3" />;
  };

  const healthScore = deal.health_score ?? 50;
  const daysInStage = deal.days_in_stage ?? 0;
  const isStagnant = daysInStage > 14; // Warning if > 2 weeks in stage

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
      {/* Drag Handle */}
      <div className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-50 transition-opacity">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>

      <div className="pl-4">
        {/* Header: Company Logo/Name + Actions */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {deal.company_logo_url ? (
              <img
                src={deal.company_logo_url}
                alt={deal.company || ''}
                className="h-6 w-6 rounded object-cover"
              />
            ) : deal.company && (
              <div className="h-6 w-6 rounded bg-muted flex items-center justify-center">
                <Building className="h-3 w-3 text-muted-foreground" />
              </div>
            )}
            <span className="text-xs text-muted-foreground truncate">
              {deal.company || 'No company'}
            </span>
          </div>

          {/* Quick Actions Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-4 w-4 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit?.(); }}>
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
                className="text-red-600"
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Deal Title */}
        <h4 className="font-medium text-foreground line-clamp-2 mb-2">{deal.title}</h4>

        {/* Value + Health Score */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-lg font-semibold text-foreground">
            ${deal.value.toLocaleString()}
          </span>
          <Badge
            variant="outline"
            className={cn('text-xs font-semibold border', getHealthScoreColor(healthScore))}
          >
            {healthScore}
          </Badge>
        </div>

        {/* Status Row: Days in Stage + Sentiment */}
        <div className="flex items-center justify-between mb-2 text-xs text-muted-foreground">
          <div className={cn('flex items-center gap-1', isStagnant && 'text-orange-600')}>
            <Clock className="h-3 w-3" />
            <span>{daysInStage}d in stage</span>
            {isStagnant && <AlertTriangle className="h-3 w-3" />}
          </div>
          {deal.sentiment_trend && (
            <div className="flex items-center gap-1">
              {getSentimentIcon()}
              <span className="capitalize">{deal.sentiment_trend}</span>
            </div>
          )}
        </div>

        {/* Risk Indicators */}
        {deal.ai_risk_factors && deal.ai_risk_factors.length > 0 && (
          <div className="mb-2">
            <Badge variant="destructive" className="text-xs px-1.5 py-0.5">
              <AlertTriangle className="h-2.5 w-2.5 mr-1" />
              {deal.ai_risk_factors[0]}
            </Badge>
          </div>
        )}

        {/* Footer: Owner + Close Date */}
        <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
          {deal.expected_close_date ? (
            <div className="flex items-center text-xs text-muted-foreground">
              <Calendar className="h-3 w-3 mr-1" />
              <span>{format(new Date(deal.expected_close_date), 'MMM d')}</span>
            </div>
          ) : (
            <div />
          )}

          {deal.owner_id && (
            <Avatar className="h-5 w-5">
              <AvatarFallback className="text-xs">
                <User className="h-3 w-3" />
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      </div>
    </div>
  );
}
