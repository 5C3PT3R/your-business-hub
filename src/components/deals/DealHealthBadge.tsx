import React from 'react';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DealHealthBadgeProps {
  score: number;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export function DealHealthBadge({
  score,
  showIcon = true,
  size = 'md',
  showLabel = true,
}: DealHealthBadgeProps) {
  const getHealthConfig = (score: number) => {
    if (score >= 70) {
      return {
        label: 'Healthy',
        color: 'bg-green-100 text-green-700 border-green-300',
        icon: TrendingUp,
        iconColor: 'text-green-600',
      };
    } else if (score >= 40) {
      return {
        label: 'At Risk',
        color: 'bg-yellow-100 text-yellow-700 border-yellow-300',
        icon: AlertTriangle,
        iconColor: 'text-yellow-600',
      };
    } else {
      return {
        label: 'Critical',
        color: 'bg-red-100 text-red-700 border-red-300',
        icon: TrendingDown,
        iconColor: 'text-red-600',
      };
    }
  };

  const config = getHealthConfig(score);
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'text-xs h-5',
    md: 'text-sm h-6',
    lg: 'text-base h-7',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-3.5 w-3.5',
    lg: 'h-4 w-4',
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1 font-semibold',
        config.color,
        sizeClasses[size]
      )}
    >
      {showIcon && <Icon className={cn(iconSizes[size], config.iconColor)} />}
      {score}/100
      {showLabel && <span className="ml-0.5">· {config.label}</span>}
    </Badge>
  );
}
