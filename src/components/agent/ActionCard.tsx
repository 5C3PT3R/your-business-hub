import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, AlertTriangle, Zap } from 'lucide-react';
import { PlannedAction, actionLabels } from '@/types/agent';
import { cn } from '@/lib/utils';

interface ActionCardProps {
  action: PlannedAction;
  onApprove: () => void;
  onReject: () => void;
  isExecuted: boolean;
  isExecuting: boolean;
}

export function ActionCard({ action, onApprove, onReject, isExecuted, isExecuting }: ActionCardProps) {
  const confidenceColor = action.confidence >= 0.85 
    ? 'text-emerald-500' 
    : action.confidence >= 0.7 
      ? 'text-amber-500' 
      : 'text-rose-500';

  const confidenceLabel = action.confidence >= 0.85 
    ? 'High' 
    : action.confidence >= 0.7 
      ? 'Medium' 
      : 'Low';

  return (
    <Card className={cn(
      "p-4 border transition-all",
      isExecuted && "bg-emerald-500/10 border-emerald-500/30",
      isExecuting && "animate-pulse"
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="h-4 w-4 text-primary shrink-0" />
            <span className="font-medium text-sm truncate">
              {actionLabels[action.action] || action.action}
            </span>
            {action.requires_approval && (
              <Badge variant="outline" className="text-xs shrink-0">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Approval Required
              </Badge>
            )}
          </div>
          
          {action.record_type && (
            <p className="text-xs text-muted-foreground mb-1">
              {action.record_type}: {action.record_id?.slice(0, 8)}...
            </p>
          )}
          
          {action.reason && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {action.reason}
            </p>
          )}
          
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-muted-foreground">Confidence:</span>
            <span className={cn("text-xs font-medium", confidenceColor)}>
              {(action.confidence * 100).toFixed(0)}% ({confidenceLabel})
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {isExecuted ? (
            <Badge className="bg-emerald-500">
              <Check className="h-3 w-3 mr-1" />
              Done
            </Badge>
          ) : (
            <>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10"
                onClick={onApprove}
                disabled={isExecuting}
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                onClick={onReject}
                disabled={isExecuting}
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}