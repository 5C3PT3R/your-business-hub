import React, { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Header } from '@/components/layout/Header';
import { ActionCard } from '@/components/next-actions/ActionCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  TrendingUp,
  Clock,
  ArrowUpDown,
  X,
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
  const [sortBy, setSortBy] = useState<string>('priority');
  const [selectedActions, setSelectedActions] = useState<Set<string>>(new Set());
  const [batchMode, setBatchMode] = useState(false);

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

  // Keyboard shortcuts (moved after refetch is defined)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if not typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case 'r':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            refetch();
          }
          break;
        case 'b':
          e.preventDefault();
          setBatchMode(!batchMode);
          setSelectedActions(new Set());
          break;
        case '1':
          e.preventDefault();
          setActiveTab('pending');
          break;
        case '2':
          e.preventDefault();
          setActiveTab('completed');
          break;
        case '3':
          e.preventDefault();
          setActiveTab('skipped');
          break;
        case 'Escape':
          if (batchMode) {
            setBatchMode(false);
            setSelectedActions(new Set());
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [batchMode, refetch]);

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

  // Batch action handlers
  const handleBatchComplete = async () => {
    if (selectedActions.size === 0) return;

    try {
      const promises = Array.from(selectedActions).map(id => completeAction(id));
      await Promise.all(promises);

      toast({
        title: `✅ ${selectedActions.size} actions completed`,
        description: 'Great work! Keep it up.',
      });

      setSelectedActions(new Set());
      setBatchMode(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to complete some actions',
        variant: 'destructive',
      });
    }
  };

  const handleBatchSkip = async () => {
    if (selectedActions.size === 0) return;

    try {
      const promises = Array.from(selectedActions).map(id => skipAction(id));
      await Promise.all(promises);

      toast({
        title: `⏭️ ${selectedActions.size} actions skipped`,
        description: 'Actions moved to skipped section.',
      });

      setSelectedActions(new Set());
      setBatchMode(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to skip some actions',
        variant: 'destructive',
      });
    }
  };

  const toggleActionSelection = (actionId: string) => {
    const newSelected = new Set(selectedActions);
    if (newSelected.has(actionId)) {
      newSelected.delete(actionId);
    } else {
      newSelected.add(actionId);
    }
    setSelectedActions(newSelected);
  };

  const selectAllVisible = () => {
    const allIds = new Set(filteredActions.map(a => a.id));
    setSelectedActions(allIds);
  };

  // Client-side filtering
  const filteredActions = React.useMemo(() => {
    let result = allActions || [];

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

    // Apply sorting
    switch (sortBy) {
      case 'priority':
        result.sort((a, b) => {
          const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
          const urgencyDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
          if (urgencyDiff !== 0) return urgencyDiff;
          return (b.aiPriorityScore || 0) - (a.aiPriorityScore || 0);
        });
        break;
      case 'revenue':
        result.sort((a, b) => (b.revenueImpact || 0) - (a.revenueImpact || 0));
        break;
      case 'effort':
        result.sort((a, b) => (a.effortMinutes || 999) - (b.effortMinutes || 999));
        break;
      case 'closeProbability':
        result.sort((a, b) => (b.closeProbability || 0) - (a.closeProbability || 0));
        break;
      case 'dueDate':
        result.sort((a, b) => {
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        });
        break;
    }

    return result;
  }, [allActions, searchQuery, activeFilter, activeTab, sortBy]);

  // Group actions into priority sections
  const groupedActions = React.useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const weekEnd = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    const actions = filteredActions || [];

    return {
      urgent: actions.filter((a) => a.urgency === 'critical'),
      dueToday: actions.filter((a) => {
        if (a.urgency === 'critical') return false;
        if (!a.dueDate) return false;
        const dueDate = new Date(a.dueDate);
        return dueDate < todayEnd;
      }),
      upcoming: actions.filter((a) => {
        if (a.urgency === 'critical') return false;
        if (!a.dueDate) return false;
        const dueDate = new Date(a.dueDate);
        return dueDate >= todayEnd && dueDate < weekEnd;
      }),
      quickWins: actions.filter((a) => {
        if (a.urgency === 'critical') return false;
        if (a.dueDate && new Date(a.dueDate) < weekEnd) return false;
        return a.effortMinutes <= 15 && a.revenueImpact >= 10000;
      }),
      aiSuggested: actions.filter((a) => {
        if (a.urgency === 'critical') return false;
        if (a.dueDate && new Date(a.dueDate) < weekEnd) return false;
        if (a.effortMinutes <= 15 && a.revenueImpact >= 10000) return false;
        return a.aiPriorityScore >= 70;
      }),
      other: actions.filter((a) => {
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
          <AlertTriangle className="h-12 w-12 text-red-600 dark:text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Error loading actions</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{(error as Error).message}</p>
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
        subtitle={`${stats?.pending || 0} pending · ${stats?.completed || 0} completed today ${batchMode ? `· ${selectedActions.size} selected` : ''}`}
        actions={
          <div className="flex items-center gap-2">
            {batchMode && activeTab === 'pending' && (
              <>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleBatchComplete}
                  disabled={selectedActions.size === 0}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Complete ({selectedActions.size})
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBatchSkip}
                  disabled={selectedActions.size === 0}
                >
                  <SkipForward className="h-4 w-4 mr-1" />
                  Skip ({selectedActions.size})
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setBatchMode(false);
                    setSelectedActions(new Set());
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </>
            )}
            {!batchMode && (
              <>
                <Button variant="outline" size="sm" onClick={() => setBatchMode(true)}>
                  <Checkbox className="h-4 w-4 mr-1" />
                  Batch
                </Button>
                <Button variant="outline" onClick={() => refetch()} disabled={isLoading} size="sm">
                  <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
                  Refresh
                </Button>
              </>
            )}
          </div>
        }
      />

      <div className="p-4 md:p-6 space-y-4 md:space-y-6 relative overflow-hidden min-h-[calc(100vh-4rem)]">
        {/* Animated background gradients */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-gradient-to-br from-blue-500/20 via-purple-500/15 to-pink-500/10 dark:from-blue-500/30 dark:via-purple-500/20 dark:to-pink-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-[-30%] left-[-15%] w-[500px] h-[500px] bg-gradient-to-tr from-cyan-500/15 via-blue-500/10 to-transparent dark:from-cyan-500/20 dark:via-blue-500/15 rounded-full blur-3xl" />
          <div className="absolute top-[40%] left-[30%] w-[300px] h-[300px] bg-gradient-to-r from-violet-500/10 to-fuchsia-500/5 dark:from-violet-500/15 dark:to-fuchsia-500/10 rounded-full blur-2xl" />
        </div>

        {/* Enhanced Today's Focus Card - Only show for pending tab */}
        {activeTab === 'pending' && !isLoading && topAction && (
          <Card className="p-5 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/50 dark:via-indigo-950/50 dark:to-purple-950/50 border-2 border-blue-300 dark:border-blue-800 shadow-lg">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg">
                    <Flame className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Today's Focus</div>
                    <div className="text-sm font-bold text-gray-900 dark:text-gray-100">Most Important Action</div>
                  </div>
                </div>
                <Badge variant="destructive" className="text-xs font-bold px-2 py-1">
                  {topAction.urgency.toUpperCase()}
                </Badge>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 leading-tight">{topAction.title}</h3>
                {topAction.aiReasoning && (
                  <p className="text-sm text-gray-700 dark:text-gray-300 border-l-3 border-blue-400 dark:border-blue-600 pl-3 py-1 bg-white/50 dark:bg-gray-800/50 rounded">
                    💡 {topAction.aiReasoning}
                  </p>
                )}

                <div className="flex items-center gap-4 text-sm pt-1">
                  {topAction.effortMinutes && (
                    <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                      <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <span className="font-medium">{topAction.effortMinutes} min</span>
                    </div>
                  )}
                  {topAction.revenueImpact > 0 && (
                    <div className="flex items-center gap-1.5 text-green-700 dark:text-green-400">
                      <DollarSign className="h-4 w-4 text-green-600 dark:text-green-500" />
                      <span className="font-bold">{formatCurrency(topAction.revenueImpact)}</span>
                    </div>
                  )}
                  {topAction.closeProbability !== undefined && (
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      <span className="font-semibold text-purple-700 dark:text-purple-400">{topAction.closeProbability}% close</span>
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
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-40 h-9">
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="priority">Priority</SelectItem>
                  <SelectItem value="revenue">Revenue</SelectItem>
                  <SelectItem value="effort">Effort</SelectItem>
                  <SelectItem value="closeProbability">Close %</SelectItem>
                  <SelectItem value="dueDate">Due Date</SelectItem>
                </SelectContent>
              </Select>

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
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Filter:</span>
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

              {batchMode && filteredActions.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={selectAllVisible}
                >
                  Select All ({filteredActions.length})
                </Button>
              )}
            </div>
          )}

          {/* Tab Contents */}
          <TabsContent value="pending" className="space-y-4 mt-4">
            {isLoading ? (
              <Card className="p-8 text-center">
                <RefreshCw className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400 mx-auto mb-3" />
                <p className="text-sm text-gray-600 dark:text-gray-400">Loading actions...</p>
              </Card>
            ) : filteredActions.length === 0 ? (
              <Card className="p-8 text-center">
                <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">All caught up!</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">No pending actions. Great work! 🎉</p>
              </Card>
            ) : activeFilter === 'all' ? (
              <div className="space-y-6">
                {/* 🚨 URGENT Section */}
                {groupedActions.urgent.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b-2 border-red-200 dark:border-red-800">
                      <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                      <h3 className="text-base font-bold text-red-900 dark:text-red-300">URGENT - Do First</h3>
                      <Badge variant="destructive" className="ml-1">{groupedActions.urgent.length}</Badge>
                    </div>
                    {groupedActions.urgent.map((action) => (
                      <ActionCard
                        key={action.id}
                        action={action}
                        onAction={handleAction}
                        onComplete={handleComplete}
                        onSkip={handleSkip}
                        batchMode={batchMode}
                        isSelected={selectedActions.has(action.id)}
                        onToggleSelect={toggleActionSelection}
                      />
                    ))}
                  </div>
                )}

                {/* ⏰ DUE TODAY Section */}
                {groupedActions.dueToday.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b-2 border-orange-200 dark:border-orange-800">
                      <Calendar className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                      <h3 className="text-base font-bold text-orange-900 dark:text-orange-300">DUE TODAY - Do Soon</h3>
                      <Badge variant="secondary" className="ml-1 bg-orange-100 dark:bg-orange-900/40">{groupedActions.dueToday.length}</Badge>
                    </div>
                    {groupedActions.dueToday.map((action) => (
                      <ActionCard
                        key={action.id}
                        action={action}
                        onAction={handleAction}
                        onComplete={handleComplete}
                        onSkip={handleSkip}
                        batchMode={batchMode}
                        isSelected={selectedActions.has(action.id)}
                        onToggleSelect={toggleActionSelection}
                      />
                    ))}
                  </div>
                )}

                {/* 📅 UPCOMING Section */}
                {groupedActions.upcoming.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b-2 border-blue-200 dark:border-blue-800">
                      <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      <h3 className="text-base font-bold text-blue-900 dark:text-blue-300">UPCOMING - This Week</h3>
                      <Badge variant="secondary" className="ml-1 bg-blue-100 dark:bg-blue-900/40">{groupedActions.upcoming.length}</Badge>
                    </div>
                    {groupedActions.upcoming.map((action) => (
                      <ActionCard
                        key={action.id}
                        action={action}
                        onAction={handleAction}
                        onComplete={handleComplete}
                        onSkip={handleSkip}
                        batchMode={batchMode}
                        isSelected={selectedActions.has(action.id)}
                        onToggleSelect={toggleActionSelection}
                      />
                    ))}
                  </div>
                )}

                {/* 🎯 QUICK WINS Section */}
                {groupedActions.quickWins.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b-2 border-green-200 dark:border-green-800">
                      <Zap className="h-5 w-5 text-green-600 dark:text-green-400" />
                      <h3 className="text-base font-bold text-green-900 dark:text-green-300">QUICK WINS - Fast Money</h3>
                      <Badge variant="secondary" className="ml-1 bg-green-100 dark:bg-green-900/40">{groupedActions.quickWins.length}</Badge>
                      <span className="text-xs text-gray-600 dark:text-gray-400">≤15 min, high value</span>
                    </div>
                    {groupedActions.quickWins.map((action) => (
                      <ActionCard
                        key={action.id}
                        action={action}
                        onAction={handleAction}
                        onComplete={handleComplete}
                        onSkip={handleSkip}
                        batchMode={batchMode}
                        isSelected={selectedActions.has(action.id)}
                        onToggleSelect={toggleActionSelection}
                      />
                    ))}
                  </div>
                )}

                {/* 🔮 AI SUGGESTED Section */}
                {groupedActions.aiSuggested.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b-2 border-purple-200 dark:border-purple-800">
                      <Zap className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      <h3 className="text-base font-bold text-purple-900 dark:text-purple-300">AI SUGGESTED - Proactive</h3>
                      <Badge variant="secondary" className="ml-1 bg-purple-100 dark:bg-purple-900/40">{groupedActions.aiSuggested.length}</Badge>
                      <span className="text-xs text-gray-600 dark:text-gray-400">High AI priority</span>
                    </div>
                    {groupedActions.aiSuggested.map((action) => (
                      <ActionCard
                        key={action.id}
                        action={action}
                        onAction={handleAction}
                        onComplete={handleComplete}
                        onSkip={handleSkip}
                        batchMode={batchMode}
                        isSelected={selectedActions.has(action.id)}
                        onToggleSelect={toggleActionSelection}
                      />
                    ))}
                  </div>
                )}

                {/* Other Actions */}
                {groupedActions.other.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Other Actions</h3>
                      <Badge variant="outline" className="ml-1">{groupedActions.other.length}</Badge>
                    </div>
                    {groupedActions.other.map((action) => (
                      <ActionCard
                        key={action.id}
                        action={action}
                        onAction={handleAction}
                        onComplete={handleComplete}
                        onSkip={handleSkip}
                        batchMode={batchMode}
                        isSelected={selectedActions.has(action.id)}
                        onToggleSelect={toggleActionSelection}
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
                    batchMode={batchMode}
                    isSelected={selectedActions.has(action.id)}
                    onToggleSelect={toggleActionSelection}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-3 mt-4">
            {isLoading ? (
              <Card className="p-8 text-center">
                <RefreshCw className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400 mx-auto mb-3" />
                <p className="text-sm text-gray-600 dark:text-gray-400">Loading completed actions...</p>
              </Card>
            ) : filteredActions.length === 0 ? (
              <Card className="p-8 text-center">
                <CheckCircle2 className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">No completed actions yet</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Completed actions will appear here.</p>
              </Card>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
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
                <RefreshCw className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400 mx-auto mb-3" />
                <p className="text-sm text-gray-600 dark:text-gray-400">Loading skipped actions...</p>
              </Card>
            ) : filteredActions.length === 0 ? (
              <Card className="p-8 text-center">
                <SkipForward className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">No skipped actions</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Skipped actions will appear here.</p>
              </Card>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
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

        {/* Enhanced Stats & Keyboard Shortcuts */}
        {activeTab === 'pending' && stats && filteredActions.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Progress Widget */}
            <Card className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-200 dark:border-green-800 col-span-1 md:col-span-2">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Today's Progress</h4>
                  <div className="text-2xl">
                    {stats.completed >= (stats.today || 1) * 0.7 ? '🎯' : '💪'}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                    <span>{stats.completed} completed</span>
                    <span>{stats.pending} remaining</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-green-500 to-emerald-600 dark:from-green-600 dark:to-emerald-700 h-2 rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, ((stats.completed || 0) / ((stats.pending || 0) + (stats.completed || 0)) * 100))}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-3 gap-3 pt-2 border-t border-green-200 dark:border-green-800">
                  <div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">Revenue</div>
                    <div className="text-sm font-bold text-green-700 dark:text-green-400">
                      {formatCurrency(stats.totalRevenue)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">Urgent</div>
                    <div className="text-sm font-bold text-red-600 dark:text-red-400">{stats.urgent}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">Completion</div>
                    <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
                      {Math.round(((stats.completed || 0) / ((stats.pending || 0) + (stats.completed || 0)) * 100) || 0)}%
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Keyboard Shortcuts */}
            <Card className="p-4 bg-gray-50 dark:bg-gray-900/50">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">⌨️ Shortcuts</h4>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Refresh</span>
                  <kbd className="px-2 py-0.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-700 dark:text-gray-300 font-mono">R</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Batch Mode</span>
                  <kbd className="px-2 py-0.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-700 dark:text-gray-300 font-mono">B</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Pending/Done/Skip</span>
                  <div className="flex gap-1">
                    <kbd className="px-2 py-0.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-700 dark:text-gray-300 font-mono">1</kbd>
                    <kbd className="px-2 py-0.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-700 dark:text-gray-300 font-mono">2</kbd>
                    <kbd className="px-2 py-0.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-700 dark:text-gray-300 font-mono">3</kbd>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Exit Batch</span>
                  <kbd className="px-2 py-0.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-700 dark:text-gray-300 font-mono">ESC</kbd>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
