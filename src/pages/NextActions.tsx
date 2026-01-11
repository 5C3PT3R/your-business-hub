import React, { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Header } from '@/components/layout/Header';
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
  Undo2,
} from 'lucide-react';
import { useNextActions, useActionStats } from '@/hooks/useNextActions';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

export default function NextActions() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<string>('pending');

  // Set page title
  React.useEffect(() => {
    document.title = 'Next Actions | Upflo CRM';
  }, []);

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
    updateAction,
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

  const handleMoveToPending = async (actionId: string) => {
    try {
      // Update using raw Supabase client to ensure proper field names
      const { error } = await supabase
        .from('next_actions')
        .update({
          status: 'pending',
          completed_at: null,
        })
        .eq('id', actionId);

      if (error) throw error;

      toast({
        title: '↩️ Moved to Pending',
        description: 'Action restored to pending list.',
      });

      // Manually refetch to update UI
      refetch();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to move action',
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

  // Group actions into priority sections
  const groupedActions = React.useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const weekEnd = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    return {
      urgent: filteredActions.filter((a) => a.urgency === 'critical'),
      dueToday: filteredActions.filter((a) => {
        if (a.urgency === 'critical') return false;
        if (!a.dueDate) return false;
        const dueDate = new Date(a.dueDate);
        return dueDate < todayEnd;
      }),
      upcoming: filteredActions.filter((a) => {
        if (a.urgency === 'critical') return false;
        if (!a.dueDate) return false;
        const dueDate = new Date(a.dueDate);
        return dueDate >= todayEnd && dueDate < weekEnd;
      }),
      quickWins: filteredActions.filter((a) => {
        if (a.urgency === 'critical') return false;
        if (a.dueDate && new Date(a.dueDate) < weekEnd) return false;
        return a.effortMinutes <= 15 && a.revenueImpact >= 10000;
      }),
      aiSuggested: filteredActions.filter((a) => {
        if (a.urgency === 'critical') return false;
        if (a.dueDate && new Date(a.dueDate) < weekEnd) return false;
        if (a.effortMinutes <= 15 && a.revenueImpact >= 10000) return false;
        return a.aiPriorityScore >= 70;
      }),
      other: filteredActions.filter((a) => {
        if (a.urgency === 'critical') return false;
        if (a.dueDate) {
          const dueDate = new Date(a.dueDate);
          if (dueDate < weekEnd) return false;
        }
        if (a.effortMinutes <= 15 && a.revenueImpact >= 10000) return false;
        if (a.aiPriorityScore >= 70) return false;
        return true;
      }),
    };
  }, [filteredActions]);

  const topAction = groupedActions.urgent[0] || groupedActions.dueToday[0] || filteredActions[0];

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
      <Header
        title="Next Actions"
        subtitle={`${stats?.pending || 0} pending · ${stats?.completed || 0} completed today`}
        actions={
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading} size="sm">
            <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
            Refresh
          </Button>
        }
      />

      <div className="p-4 md:p-6 space-y-4 md:space-y-6">

        {/* Enhanced Today's Focus Card - Only show for pending tab */}
        {activeTab === 'pending' && !isLoading && topAction && (
          <Card className="p-5 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 border-2 border-blue-300 shadow-lg">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg">
                    <Flame className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-gray-600 uppercase tracking-wide">Today's Focus</div>
                    <div className="text-sm font-bold text-gray-900">Most Important Action</div>
                  </div>
                </div>
                <Badge variant="destructive" className="text-xs font-bold px-2 py-1">
                  {topAction.urgency.toUpperCase()}
                </Badge>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-bold text-gray-900 leading-tight">{topAction.title}</h3>
                {topAction.aiReasoning && (
                  <p className="text-sm text-gray-700 border-l-3 border-blue-400 pl-3 py-1 bg-white/50 rounded">
                    💡 {topAction.aiReasoning}
                  </p>
                )}

                <div className="flex items-center gap-4 text-sm pt-1">
                  {topAction.effortMinutes && (
                    <div className="flex items-center gap-1.5 text-gray-700">
                      <Clock className="h-4 w-4 text-blue-600" />
                      <span className="font-medium">{topAction.effortMinutes} min</span>
                    </div>
                  )}
                  {topAction.revenueImpact > 0 && (
                    <div className="flex items-center gap-1.5 text-green-700">
                      <DollarSign className="h-4 w-4 text-green-600" />
                      <span className="font-bold">{formatCurrency(topAction.revenueImpact)}</span>
                    </div>
                  )}
                  {topAction.closeProbability !== undefined && (
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="h-4 w-4 text-purple-600" />
                      <span className="font-semibold text-purple-700">{topAction.closeProbability}% close</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Button
                  size="sm"
                  className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 font-semibold"
                  onClick={() => handleAction(topAction.id, topAction.actionType)}
                >
                  <Zap className="h-4 w-4 mr-1.5" />
                  Start Now
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleComplete(topAction.id)}
                >
                  <CheckCircle2 className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleSkip(topAction.id)}
                >
                  <SkipForward className="h-4 w-4" />
                </Button>
              </div>
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
                Urgent ({groupedActions.urgent.length})
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
          <TabsContent value="pending" className="space-y-4 mt-4">
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
            ) : activeFilter === 'all' ? (
              <div className="space-y-6">
                {/* 🚨 URGENT Section */}
                {groupedActions.urgent.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b-2 border-red-200">
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                      <h3 className="text-base font-bold text-red-900">URGENT - Do First</h3>
                      <Badge variant="destructive" className="ml-1">{groupedActions.urgent.length}</Badge>
                    </div>
                    {groupedActions.urgent.map((action) => (
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

                {/* ⏰ DUE TODAY Section */}
                {groupedActions.dueToday.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b-2 border-orange-200">
                      <Calendar className="h-5 w-5 text-orange-600" />
                      <h3 className="text-base font-bold text-orange-900">DUE TODAY - Do Soon</h3>
                      <Badge variant="secondary" className="ml-1 bg-orange-100">{groupedActions.dueToday.length}</Badge>
                    </div>
                    {groupedActions.dueToday.map((action) => (
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

                {/* 📅 UPCOMING Section */}
                {groupedActions.upcoming.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b-2 border-blue-200">
                      <Calendar className="h-5 w-5 text-blue-600" />
                      <h3 className="text-base font-bold text-blue-900">UPCOMING - This Week</h3>
                      <Badge variant="secondary" className="ml-1 bg-blue-100">{groupedActions.upcoming.length}</Badge>
                    </div>
                    {groupedActions.upcoming.map((action) => (
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

                {/* 🎯 QUICK WINS Section */}
                {groupedActions.quickWins.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b-2 border-green-200">
                      <Zap className="h-5 w-5 text-green-600" />
                      <h3 className="text-base font-bold text-green-900">QUICK WINS - Fast Money</h3>
                      <Badge variant="secondary" className="ml-1 bg-green-100">{groupedActions.quickWins.length}</Badge>
                      <span className="text-xs text-gray-600">≤15 min, high value</span>
                    </div>
                    {groupedActions.quickWins.map((action) => (
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

                {/* 🔮 AI SUGGESTED Section */}
                {groupedActions.aiSuggested.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b-2 border-purple-200">
                      <Zap className="h-5 w-5 text-purple-600" />
                      <h3 className="text-base font-bold text-purple-900">AI SUGGESTED - Proactive</h3>
                      <Badge variant="secondary" className="ml-1 bg-purple-100">{groupedActions.aiSuggested.length}</Badge>
                      <span className="text-xs text-gray-600">High AI priority</span>
                    </div>
                    {groupedActions.aiSuggested.map((action) => (
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

                {/* Other Actions */}
                {groupedActions.other.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
                      <h3 className="text-sm font-semibold text-gray-700">Other Actions</h3>
                      <Badge variant="outline" className="ml-1">{groupedActions.other.length}</Badge>
                    </div>
                    {groupedActions.other.map((action) => (
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
              </div>
            ) : (
              <div className="space-y-3">
                {filteredActions.map((action) => (
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
                    onRestore={handleMoveToPending}
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
                    onRestore={handleMoveToPending}
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
