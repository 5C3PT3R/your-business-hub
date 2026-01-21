import React from 'react';
import { Zap, AlertCircle, Infinity } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { useWallet } from '@/hooks/use-wallet';
import { cn } from '@/lib/utils';

interface CreditsBadgeProps {
  workspaceId?: string;
  className?: string;
  showTooltip?: boolean;
  variant?: 'default' | 'compact' | 'detailed';
}

export function CreditsBadge({ 
  workspaceId, 
  className,
  showTooltip = true,
  variant = 'default'
}: CreditsBadgeProps) {
  const { wallet, isLoading, formattedCredits, creditStatus, aiUsage, planType } = useWallet(workspaceId);

  // Loading state
  if (isLoading) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
    );
  }

  // Error or no wallet state
  if (!wallet) {
    return (
      <Badge 
        variant="outline" 
        className={cn("gap-1.5 border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300", className)}
      >
        <AlertCircle className="h-3 w-3" />
        <span className="text-xs">No Wallet</span>
      </Badge>
    );
  }

  // Determine badge color based on credit status
  const getBadgeVariant = () => {
    switch (creditStatus) {
      case 'low':
        return {
          variant: 'destructive' as const,
          className: 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300'
        };
      case 'medium':
        return {
          variant: 'outline' as const,
          className: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300'
        };
      case 'high':
        return {
          variant: 'default' as const,
          className: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
        };
      default:
        return {
          variant: 'outline' as const,
          className: ''
        };
    }
  };

  const badgeStyle = getBadgeVariant();

  // Compact variant (just icon and number)
  if (variant === 'compact') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant={badgeStyle.variant}
              className={cn("h-6 gap-1 px-2", badgeStyle.className, className)}
            >
              <Zap className="h-3 w-3" />
              <span className="text-xs font-medium">{formattedCredits}</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-1 text-sm">
              <p className="font-medium">{formattedCredits} Data Credits</p>
              <p className="text-xs text-muted-foreground">
                AI Drafts: {aiUsage} <Infinity className="inline h-3 w-3" />
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Detailed variant (with text)
  if (variant === 'detailed') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn("flex items-center gap-2 rounded-lg border px-3 py-2", badgeStyle.className, className)}>
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                <div>
                  <p className="text-sm font-medium">{formattedCredits} Credits</p>
                  <p className="text-xs opacity-70">Plan: {planType}</p>
                </div>
              </div>
              {creditStatus === 'low' && (
                <AlertCircle className="h-4 w-4 text-red-500" />
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-2">
              <div>
                <p className="font-medium">Credit Balance</p>
                <p className="text-sm text-muted-foreground">Used for enrichment operations</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="font-medium">Data Credits</p>
                  <p className="text-lg">{formattedCredits}</p>
                </div>
                <div>
                  <p className="font-medium">AI Drafts</p>
                  <p className="text-lg flex items-center gap-1">
                    {aiUsage} <Infinity className="h-4 w-4" />
                  </p>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                <p>Status: {creditStatus?.toUpperCase()}</p>
                <p>Plan: {planType}</p>
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Default variant
  const badgeContent = (
    <Badge 
      variant={badgeStyle.variant}
      className={cn("h-7 gap-1.5 px-2.5 py-1", badgeStyle.className, className)}
    >
      <Zap className="h-3.5 w-3.5" />
      <span className="text-sm font-medium">{formattedCredits} Credits</span>
      {creditStatus === 'low' && (
        <AlertCircle className="h-3 w-3" />
      )}
    </Badge>
  );

  if (!showTooltip) {
    return badgeContent;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badgeContent}
        </TooltipTrigger>
        <TooltipContent className="w-64">
          <div className="space-y-2">
            <div>
              <p className="font-medium">Wallet Balance</p>
              <p className="text-sm text-muted-foreground">Track your usage and credits</p>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Data Credits</p>
                <div className="flex items-center gap-1">
                  <Zap className="h-4 w-4 text-emerald-500" />
                  <p className="text-lg font-bold">{formattedCredits}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  For enrichment operations
                </p>
              </div>
              
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">AI Drafts</p>
                <div className="flex items-center gap-1">
                  <Infinity className="h-4 w-4 text-blue-500" />
                  <p className="text-lg font-bold">{aiUsage}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Unlimited usage
                </p>
              </div>
            </div>
            
            <div className="pt-2 border-t">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Plan</span>
                <span className="font-medium">{planType}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                <span className={cn(
                  "font-medium",
                  creditStatus === 'low' && 'text-red-500',
                  creditStatus === 'medium' && 'text-amber-500',
                  creditStatus === 'high' && 'text-emerald-500'
                )}>
                  {creditStatus?.toUpperCase()}
                </span>
              </div>
            </div>
            
            {creditStatus === 'low' && (
              <div className="rounded bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
                <p className="font-medium">Low Credit Warning</p>
                <p>Consider adding more credits for enrichment operations</p>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Simple version for inline usage
export function SimpleCreditsBadge({ workspaceId }: { workspaceId?: string }) {
  const { wallet, isLoading, formattedCredits } = useWallet(workspaceId);

  if (isLoading || !wallet) {
    return null;
  }

  return (
    <span className="inline-flex items-center gap-1 text-sm">
      <Zap className="h-3 w-3 text-amber-500" />
      <span className="font-medium">{formattedCredits}</span>
    </span>
  );
}