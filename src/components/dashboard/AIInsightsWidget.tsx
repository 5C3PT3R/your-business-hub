import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Lightbulb,
  Target,
  DollarSign,
  Users,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { useNextActions, useActionStats } from '@/hooks/useNextActions';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

export function AIInsightsWidget() {
  const navigate = useNavigate();
  const { data: stats } = useActionStats();
  const { actions } = useNextActions({ status: ['pending'], urgency: ['critical'] });

  const urgentActions = actions.slice(0, 3);

  const insights = [
    {
      id: '1',
      type: 'opportunity',
      icon: Target,
      color: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30',
      title: 'High-Value Quick Wins',
      description: `${stats?.pending || 0} actions could close ${formatCurrency(stats?.totalRevenue || 0)} in revenue`,
      action: 'View Actions',
      onClick: () => navigate('/next-actions'),
    },
    {
      id: '2',
      type: 'risk',
      icon: AlertTriangle,
      color: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30',
      title: 'At-Risk Deals',
      description: `${stats?.urgent || 0} urgent actions need immediate attention`,
      action: 'Take Action',
      onClick: () => navigate('/next-actions?filter=urgent'),
    },
    {
      id: '3',
      type: 'trend',
      icon: TrendingUp,
      color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30',
      title: 'Productivity Trend',
      description: `${stats?.completed || 0} actions completed today`,
      action: 'View Progress',
      onClick: () => navigate('/next-actions?tab=completed'),
    },
  ];

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  return (
    <div className="space-y-4">
      {/* AI Insights Header Card */}
      <Card className="p-5 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30 border-amber-200 dark:border-amber-800">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">AI Insights</h3>
              <Badge className="bg-amber-600 dark:bg-amber-700">Live</Badge>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Real-time recommendations to maximize your revenue
            </p>
          </div>
        </div>
      </Card>

      {/* Insights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {insights.map((insight) => {
          const Icon = insight.icon;
          return (
            <Card
              key={insight.id}
              className="p-4 hover:shadow-lg transition-all cursor-pointer group"
              onClick={insight.onClick}
            >
              <div className="space-y-3">
                <div
                  className={cn(
                    'p-2 rounded-lg w-fit',
                    insight.color
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">{insight.title}</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{insight.description}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-between group-hover:bg-gray-100 dark:group-hover:bg-gray-800"
                >
                  {insight.action}
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Top Urgent Actions */}
      {urgentActions.length > 0 && (
        <Card className="p-4 border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/30">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              <h4 className="font-semibold text-gray-900 dark:text-gray-100">Urgent Actions</h4>
              <Badge variant="destructive">{urgentActions.length}</Badge>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/next-actions')}>
              View All
            </Button>
          </div>

          <div className="space-y-2">
            {urgentActions.map((action) => (
              <div
                key={action.id}
                className="flex items-center justify-between p-3 bg-white dark:bg-gray-900 rounded-lg border border-red-100 dark:border-red-900 hover:border-red-200 dark:hover:border-red-800 transition-colors cursor-pointer"
                onClick={() => navigate('/next-actions')}
              >
                <div className="flex-1">
                  <div className="font-medium text-gray-900 dark:text-gray-100 text-sm mb-0.5">
                    {action.title}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
                    {action.effortMinutes && (
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {action.effortMinutes} min
                      </div>
                    )}
                    {action.revenueImpact > 0 && (
                      <div className="flex items-center gap-1 font-semibold text-green-700 dark:text-green-400">
                        <DollarSign className="h-3 w-3" />
                        {formatCurrency(action.revenueImpact)}
                      </div>
                    )}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-gray-400 dark:text-gray-500" />
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
