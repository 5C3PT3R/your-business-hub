import React, { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { ActionCard } from '@/components/next-actions/ActionCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Search,
  Zap,
  Flame,
  Calendar,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  SkipForward,
  Archive,
} from 'lucide-react';
import { useNextActions, useActionStats } from '@/hooks/useNextActions';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function NextActions() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<string>('pending');

  // Fetch actions based on active tab
  const filters = React.useMemo(() => {
    const result: any = { status: [activeTab] };

    if (activeTab === 'pending') {
      if (activeFilter === 'urgent') {
        result.urgency = ['critical'];
      } else if (activeFilter === 'today') {
        result.dueCategory = ['today', 'overdue'];
      }
    }

    return result;
  }, [activeFilter, activeTab]);

  const {
    actions: allActions,
    isLoading,
    error,
    refetch,
    completeAction,
    skipAction,
  } = useNextActions(filters);

  const { data: stats } = useActionStats();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleAction = (actionId: string, actionType: string) => {
    toast({
      title: 'Opening action handler',
      description: `${actionType} workflow - Coming soon!`,
    });
  };

  const handleComplete = async (actionId: string) => {
    try {
      await completeAction(actionId);
      toast({
        title: '✅ Action completed',
        description: 'Great job! The action has been marked as done.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to complete action',
        variant: 'destructive',
      });
    }
  };

  const handleSkip = async (actionId: string) => {
    try {
      await skipAction(actionId);
      toast({
        title: '⏭️ Action skipped',
        description: 'Action moved to skipped section.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to skip action',
        variant: 'destructive',
      });
    }
  };

  // Client-side filtering
  const filteredActions = React.useMemo(() => {
    let result = allActions;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (action) =>
          action.title.toLowerCase().includes(query) ||
          action.description?.toLowerCase().includes(query) ||
          action.contactName?.toLowerCase().includes(query)
      );
    }

    if (activeTab === 'pending') {
      if (activeFilter === 'high-value') {
        result = result.filter((action) => action.revenueImpact >= 50000);
      }
      if (activeFilter === 'at-risk') {
        result = result.filter((action) => (action.dealHealthScore || 100) < 50);
      }
    }

    return result;
  }, [allActions, searchQuery, activeFilter, activeTab]);

  const urgentActions = filteredActions.filter((a) => a.urgency === 'critical');
  const topAction = urgentActions[0] || filteredActions[0];

  if (error) {
    return (
      <MainLayout>
        <Card className="p-8 text-center">
          <AlertTriangle className="h-12 w-12 text-red-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Error loading actions</h3>
          <p className="text-gray-600 mb-4">{(error as Error).message}</p>
          <Button onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </Card>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Next Actions</h1>
            <p className="text-muted-foreground mt-1">
              {stats?.pending || 0} pending · {stats?.completed || 0} completed today
            </p>
          </div>
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
            Refresh
          </Button>
        </div>

        {/* Compact Focus Card - Only show for pending tab */}
        {activeTab === 'pending' && !isLoading && topAction && (
          <Card className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Flame className="h-5 w-5 text-orange-600" />
                  <span className="text-sm font-semibold text-gray-900">TOP PRIORITY</span>
                  <Badge variant="destructive" className="text-xs">{topAction.urgency}</Badge>
                </div>
                <h3 className="text-base font-medium text-gray-900 mb-1">{topAction.title}</h3>
                <p className="text-sm text-gray-600">{topAction.aiReasoning}</p>
              </div>
              <Button size="sm" onClick={() => handleAction(topAction.id, topAction.actionType)}>
                Work on This
              </Button>
            </div>
          </Card>
        )}

        {/* Tabs for different sections */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <TabsList>
              <TabsTrigger value="pending" className="gap-2">
                <Zap className="h-4 w-4" />
                Pending
                {stats?.pending ? (
                  <Badge variant="secondary" className="ml-1">{stats.pending}</Badge>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="completed" className="gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Completed
              </TabsTrigger>
              <TabsTrigger value="skipped" className="gap-2">
                <SkipForward className="h-4 w-4" />
                Skipped
              </TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-2">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search actions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
            </div>
          </div>

          {/* Filters - Only show for pending tab */}
          {activeTab === 'pending' && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Filter:</span>
              <Button
                variant={activeFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveFilter('all')}
              >
                All
              </Button>
              <Button
                variant={activeFilter === 'urgent' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveFilter('urgent')}
              >
                <Flame className="h-3 w-3 mr-1" />
                Urgent ({urgentActions.length})
              </Button>
              <Button
                variant={activeFilter === 'today' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveFilter('today')}
              >
                <Calendar className="h-3 w-3 mr-1" />
                Today
              </Button>
              <Button
                variant={activeFilter === 'high-value' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveFilter('high-value')}
              >
                <DollarSign className="h-3 w-3 mr-1" />
                High Value
              </Button>
              <Button
                variant={activeFilter === 'at-risk' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveFilter('at-risk')}
              >
                <AlertTriangle className="h-3 w-3 mr-1" />
                At Risk
              </Button>
            </div>
          )}

          {/* Tab Contents */}
          <TabsContent value="pending" className="space-y-3 mt-4">
            {isLoading ? (
              <Card className="p-8 text-center">
                <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-3" />
                <p className="text-sm text-gray-600">Loading actions...</p>
              </Card>
            ) : filteredActions.length === 0 ? (
              <Card className="p-8 text-center">
                <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-gray-900 mb-1">All caught up!</h3>
                <p className="text-sm text-gray-600">No pending actions. Great work! 🎉</p>
              </Card>
            ) : (
              <>
                {urgentActions.length > 0 && activeFilter === 'all' && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-gray-900">🔴 URGENT</h3>
                      <Badge variant="destructive" className="text-xs">{urgentActions.length}</Badge>
                    </div>
                    {urgentActions.map((action) => (
                      <ActionCard
                        key={action.id}
                        action={action}
                        onAction={handleAction}
                        onComplete={handleComplete}
                        onSkip={handleSkip}
                      />
                    ))}
                  </div>
                )}

                {(activeFilter !== 'all' || urgentActions.length === 0) && (
                  <div className="space-y-3">
                    {filteredActions
                      .filter((a) => activeFilter !== 'all' || a.urgency !== 'critical')
                      .map((action) => (
                        <ActionCard
                          key={action.id}
                          action={action}
                          onAction={handleAction}
                          onComplete={handleComplete}
                          onSkip={handleSkip}
                        />
                      ))}
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-3 mt-4">
            {isLoading ? (
              <Card className="p-8 text-center">
                <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-3" />
                <p className="text-sm text-gray-600">Loading completed actions...</p>
              </Card>
            ) : filteredActions.length === 0 ? (
              <Card className="p-8 text-center">
                <CheckCircle2 className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-gray-900 mb-1">No completed actions yet</h3>
                <p className="text-sm text-gray-600">Completed actions will appear here.</p>
              </Card>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900">
                    {filteredActions.length} completed action{filteredActions.length !== 1 ? 's' : ''}
                  </h3>
                </div>
                {filteredActions.map((action) => (
                  <ActionCard
                    key={action.id}
                    action={action}
                    onAction={handleAction}
                    onComplete={handleComplete}
                    onSkip={handleSkip}
                    compact
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="skipped" className="space-y-3 mt-4">
            {isLoading ? (
              <Card className="p-8 text-center">
                <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-3" />
                <p className="text-sm text-gray-600">Loading skipped actions...</p>
              </Card>
            ) : filteredActions.length === 0 ? (
              <Card className="p-8 text-center">
                <SkipForward className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-gray-900 mb-1">No skipped actions</h3>
                <p className="text-sm text-gray-600">Skipped actions will appear here.</p>
              </Card>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900">
                    {filteredActions.length} skipped action{filteredActions.length !== 1 ? 's' : ''}
                  </h3>
                </div>
                {filteredActions.map((action) => (
                  <ActionCard
                    key={action.id}
                    action={action}
                    onAction={handleAction}
                    onComplete={handleComplete}
                    onSkip={handleSkip}
                    compact
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Compact Stats - Only for pending */}
        {activeTab === 'pending' && stats && filteredActions.length > 0 && (
          <Card className="p-4 bg-gray-50">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-6">
                <div>
                  <span className="text-gray-600">Revenue potential:</span>
                  <span className="ml-2 font-semibold text-gray-900">
                    {formatCurrency(stats.totalRevenue)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Pending:</span>
                  <span className="ml-2 font-semibold text-gray-900">{stats.pending}</span>
                </div>
                <div>
                  <span className="text-gray-600">Urgent:</span>
                  <span className="ml-2 font-semibold text-red-600">{stats.urgent}</span>
                </div>
              </div>
              <div className="text-2xl">
                {stats.completed >= (stats.today || 1) * 0.7 ? '🎯' : '💪'}
              </div>
            </div>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
