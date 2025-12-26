/**
 * V1 MODE: Next Actions page
 * Daily inbox answering "What should I do today?"
 * Derived, opinionated - not stored data
 */

import { MainLayout } from '@/components/layout/MainLayout';
import { Header } from '@/components/layout/Header';
import { useNextActions, type ActionType } from '@/hooks/useNextActions';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Brain, Clock, ArrowRight, PartyPopper } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const actionConfig: Record<ActionType, {
  icon: typeof AlertTriangle;
  iconClass: string;
  labelClass: string;
}> = {
  at_risk: {
    icon: AlertTriangle,
    iconClass: 'text-destructive',
    labelClass: 'bg-destructive/10 text-destructive',
  },
  ai_follow_up: {
    icon: Brain,
    iconClass: 'text-primary',
    labelClass: 'bg-primary/10 text-primary',
  },
  stale: {
    icon: Clock,
    iconClass: 'text-warning',
    labelClass: 'bg-warning/10 text-warning-foreground',
  },
};

export default function Actions() {
  const { actions, loading } = useNextActions();
  const navigate = useNavigate();

  return (
    <MainLayout>
      <div className="flex flex-col h-full">
        <Header title="Next Actions" />
        
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-2xl mx-auto">
            {/* Page description */}
            <p className="text-sm text-muted-foreground mb-6">
              Your daily focus. Start here.
            </p>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-16 rounded-lg bg-muted/50 animate-pulse"
                  />
                ))}
              </div>
            ) : actions.length === 0 ? (
              <div className="text-center py-16">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-success/10 mb-4">
                  <PartyPopper className="h-6 w-6 text-success" />
                </div>
                <h3 className="text-lg font-medium mb-1">All caught up</h3>
                <p className="text-sm text-muted-foreground">
                  No follow-ups or risks right now.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {actions.map((action) => {
                  const config = actionConfig[action.type];
                  const Icon = config.icon;

                  return (
                    <div
                      key={action.id}
                      className="group flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer"
                      onClick={() => navigate(`/deal/${action.dealId}`)}
                    >
                      {/* Icon */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="shrink-0">
                            <Icon className={cn('h-4 w-4', config.iconClass)} />
                          </div>
                        </TooltipTrigger>
                        {action.tooltip && (
                          <TooltipContent side="left">
                            <p className="max-w-xs text-xs">{action.tooltip}</p>
                          </TooltipContent>
                        )}
                      </Tooltip>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">
                            {action.dealTitle}
                          </span>
                          <span className={cn(
                            'shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded',
                            config.labelClass
                          )}>
                            {action.label}
                          </span>
                        </div>
                        {action.company && (
                          <p className="text-xs text-muted-foreground truncate">
                            {action.company}
                          </p>
                        )}
                      </div>

                      {/* Action */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/deal/${action.dealId}`);
                        }}
                      >
                        View Deal
                        <ArrowRight className="h-3 w-3 ml-1" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
