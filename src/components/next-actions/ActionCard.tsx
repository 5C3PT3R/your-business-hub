import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Mail,
  Phone,
  Calendar,
  FileText,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  SkipForward,
  Undo2,
} from 'lucide-react';
import { NextAction } from '@/types/next-actions';
import { cn } from '@/lib/utils';

interface ActionCardProps {
  action: NextAction;
  onAction: (actionId: string, actionType: string) => void;
  onComplete: (actionId: string) => void;
  onSkip: (actionId: string) => void;
  onRestore?: (actionId: string) => void;
  compact?: boolean;
  batchMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (actionId: string) => void;
}

const urgencyConfig = {
  critical: {
    color: 'text-red-600 bg-red-50 border-red-200',
    icon: '🔴',
    label: 'Critical',
  },
  high: {
    color: 'text-orange-600 bg-orange-50 border-orange-200',
    icon: '🟠',
    label: 'High',
  },
  medium: {
    color: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    icon: '🟡',
    label: 'Medium',
  },
  low: {
    color: 'text-gray-600 bg-gray-50 border-gray-200',
    icon: '⚪',
    label: 'Low',
  },
};

const actionTypeIcons = {
  email: Mail,
  call: Phone,
  meeting: Calendar,
  follow_up: TrendingUp,
  proposal: FileText,
  contract: FileText,
  demo: Calendar,
  qualify: CheckCircle2,
  nurture: TrendingUp,
  rescue: AlertTriangle,
};

export function ActionCard({
  action,
  onAction,
  onComplete,
  onSkip,
  onRestore,
  compact = false,
  batchMode = false,
  isSelected = false,
  onToggleSelect,
}: ActionCardProps) {
  const urgency = urgencyConfig[action.urgency];
  const ActionIcon = actionTypeIcons[action.actionType] || FileText;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatTimeAgo = (dateString?: string) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    const now = new Date();
    const days = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) return 'today';
    if (days === 1) return '1 day ago';
    return `${days} days ago`;
  };

  const getSentimentIcon = () => {
    const trend = action.aiContext?.sentimentTrend;
    if (trend === 'positive') return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (trend === 'negative') return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <Minus className="h-4 w-4 text-gray-600" />;
  };

  if (compact) {
    return (
      <Card
        className={cn(
          'p-4 hover:shadow-md transition-all border-l-4',
          urgency.color
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-lg">{urgency.icon}</span>
              <h4 className="font-semibold text-gray-900">{action.title}</h4>
            </div>
            <p className="text-sm text-gray-600">{action.description}</p>
            <div className="flex items-center gap-3 text-xs text-gray-500 mt-2">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {action.effortMinutes} min
              </div>
              <div className="flex items-center gap-1 font-medium text-gray-700">
                <DollarSign className="h-3 w-3" />
                {formatCurrency(action.revenueImpact)}
              </div>
            </div>
          </div>
          {onRestore && (
            <Button variant="outline" size="sm" onClick={() => onRestore(action.id)} className="h-8 text-xs shrink-0">
              <Undo2 className="h-3 w-3 mr-1" />
              Restore
            </Button>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn('p-4 hover:shadow-md transition-all border-l-4', urgency.color, isSelected && 'ring-2 ring-blue-500 bg-blue-50/50')}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 flex-1">
          {batchMode && onToggleSelect && (
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onToggleSelect(action.id)}
              className="mt-1"
            />
          )}
          <div className="p-1.5 bg-blue-100 rounded">
            <ActionIcon className="h-4 w-4 text-blue-600" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-base">{urgency.icon}</span>
              <h3 className="text-base font-semibold text-gray-900">{action.title}</h3>
            </div>
            <p className="text-sm text-gray-600">{action.description}</p>
          </div>
        </div>
        <Badge variant="outline" className={cn(urgency.color, 'text-xs h-6')}>
          {urgency.label}
        </Badge>
      </div>

      {/* Deal Context */}
      {action.dealId && (
        <div className="flex items-center gap-4 mb-3 p-2 bg-gray-50 rounded text-sm">
          <div>
            <div className="text-xs text-gray-500">Deal</div>
            <div className="font-medium text-sm">{action.contactName || 'Unknown'}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Value</div>
            <div className="font-medium text-sm">{formatCurrency(action.dealValue || 0)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Stage</div>
            <div className="font-medium text-sm">{action.dealStage || 'N/A'}</div>
          </div>
          {action.dealHealthScore !== undefined && (
            <div>
              <div className="text-xs text-gray-500">Health</div>
              <div className="flex items-center gap-1">
                <span
                  className={cn(
                    'font-medium text-sm',
                    action.dealHealthScore >= 70
                      ? 'text-green-600'
                      : action.dealHealthScore >= 40
                      ? 'text-yellow-600'
                      : 'text-red-600'
                  )}
                >
                  {action.dealHealthScore}/100
                </span>
                {action.dealHealthScore < 50 && (
                  <AlertTriangle className="h-3 w-3 text-red-600" />
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* AI Context */}
      {action.aiContext && (
        <div className="mb-3 space-y-1.5">
          {action.aiReasoning && (
            <div className="text-sm text-gray-600 border-l-2 border-blue-200 pl-2 py-1">
              {action.aiReasoning}
            </div>
          )}

          <div className="flex flex-wrap gap-2 items-center">
            {action.aiContext.sentimentTrend && (
              <div className="flex items-center gap-1 text-xs text-gray-600">
                {getSentimentIcon()}
                <span className="capitalize">{action.aiContext.sentimentTrend}</span>
              </div>
            )}

            {action.aiContext.competitors && action.aiContext.competitors.length > 0 && (
              <Badge variant="destructive" className="text-xs py-0 h-5">
                Competitor: {action.aiContext.competitors.join(', ')}
              </Badge>
            )}

            {action.aiContext.decisionTimeline && (
              <Badge variant="default" className="text-xs py-0 h-5">
                Decision: {action.aiContext.decisionTimeline}
              </Badge>
            )}

            {action.aiContext.risks && action.aiContext.risks.length > 0 && (
              <Badge variant="destructive" className="text-xs py-0 h-5">
                ⚠️ {action.aiContext.risks.join(', ')}
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Smart Actions */}
      {action.smartActions && action.smartActions.length > 0 && (
        <div className="mb-3">
          <div className="flex flex-wrap gap-2">
            {action.smartActions.map((smartAction) => (
              <Button
                key={smartAction.id}
                onClick={() => onAction(action.id, smartAction.type)}
                variant={smartAction.primary ? 'default' : 'outline'}
                size="sm"
                className="text-xs h-7"
              >
                <span className="mr-1">{smartAction.icon}</span>
                {smartAction.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Metadata Footer */}
      <div className="flex items-center justify-between pt-3 border-t">
        <div className="flex items-center gap-4 text-xs">
          {action.effortMinutes && (
            <div className="flex items-center gap-1 text-gray-600">
              <Clock className="h-3.5 w-3.5" />
              <span>{action.effortMinutes} min</span>
            </div>
          )}
          {action.revenueImpact > 0 && (
            <div className="flex items-center gap-1 font-semibold text-green-700">
              <DollarSign className="h-3.5 w-3.5" />
              <span>{formatCurrency(action.revenueImpact)}</span>
            </div>
          )}
          {action.closeProbability !== undefined && (
            <div className="flex items-center gap-1">
              <TrendingUp className={cn(
                'h-3.5 w-3.5',
                action.closeProbability >= 70 ? 'text-green-600' :
                action.closeProbability >= 40 ? 'text-yellow-600' :
                'text-red-600'
              )} />
              <span className={cn(
                'font-semibold',
                action.closeProbability >= 70 ? 'text-green-700' :
                action.closeProbability >= 40 ? 'text-yellow-700' :
                'text-red-700'
              )}>
                {action.closeProbability}% close
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onRestore ? (
            <Button variant="outline" size="sm" onClick={() => onRestore(action.id)} className="h-8 text-xs">
              <Undo2 className="h-3 w-3 mr-1" />
              Move to Pending
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => onSkip(action.id)} className="h-8 text-xs">
                <SkipForward className="h-3 w-3 mr-1" />
                Skip
              </Button>
              <Button variant="default" size="sm" onClick={() => onComplete(action.id)} className="h-8 text-xs">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Complete
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
