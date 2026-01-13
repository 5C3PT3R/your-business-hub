import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  TrendingUp,
  DollarSign,
  Target,
  Activity,
  Calendar,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { useDeals, DealStage } from '@/hooks/useDeals';
import { cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, addMonths, isWithinInterval } from 'date-fns';

type ForecastPeriod = 'current_month' | 'next_month' | 'current_quarter' | 'next_quarter';

export default function Forecast() {
  const navigate = useNavigate();
  const { deals, loading } = useDeals();
  const [period, setPeriod] = useState<ForecastPeriod>('current_month');

  // Calculate date ranges
  const getDateRange = (period: ForecastPeriod) => {
    const now = new Date();
    switch (period) {
      case 'current_month':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'next_month':
        return { start: startOfMonth(addMonths(now, 1)), end: endOfMonth(addMonths(now, 1)) };
      case 'current_quarter': {
        const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        const quarterEnd = endOfMonth(addMonths(quarterStart, 2));
        return { start: quarterStart, end: quarterEnd };
      }
      case 'next_quarter': {
        const nextQuarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 + 3, 1);
        const nextQuarterEnd = endOfMonth(addMonths(nextQuarterStart, 2));
        return { start: nextQuarterStart, end: nextQuarterEnd };
      }
    }
  };

  const dateRange = getDateRange(period);

  // Filter deals closing in the selected period
  const dealsInPeriod = useMemo(() => {
    return deals.filter((deal) => {
      if (!deal.expected_close_date || deal.stage === 'closed') return false;
      const closeDate = new Date(deal.expected_close_date);
      return isWithinInterval(closeDate, { start: dateRange.start, end: dateRange.end });
    });
  }, [deals, dateRange]);

  // Calculate forecast metrics
  const forecasts = useMemo(() => {
    // Weighted Pipeline Value = Sum of (deal_value × probability)
    const weightedPipeline = dealsInPeriod.reduce(
      (sum, deal) => sum + deal.value * (deal.probability / 100),
      0
    );

    // Commit Forecast (90%+ probability)
    const commitDeals = dealsInPeriod.filter((deal) => deal.probability >= 90);
    const commitValue = commitDeals.reduce((sum, deal) => sum + deal.value, 0);

    // Most Likely Forecast (50%+ probability)
    const mostLikelyDeals = dealsInPeriod.filter((deal) => deal.probability >= 50);
    const mostLikelyValue = mostLikelyDeals.reduce((sum, deal) => sum + deal.value, 0);

    // Best Case Forecast (30%+ probability)
    const bestCaseDeals = dealsInPeriod.filter((deal) => deal.probability >= 30);
    const bestCaseValue = bestCaseDeals.reduce((sum, deal) => sum + deal.value, 0);

    // Total Pipeline (all deals in period)
    const totalPipeline = dealsInPeriod.reduce((sum, deal) => sum + deal.value, 0);

    // Average deal size
    const avgDealSize = dealsInPeriod.length > 0 ? totalPipeline / dealsInPeriod.length : 0;

    // Stage breakdown
    const stageBreakdown = {
      lead: dealsInPeriod.filter((d) => d.stage === 'lead').length,
      qualified: dealsInPeriod.filter((d) => d.stage === 'qualified').length,
      proposal: dealsInPeriod.filter((d) => d.stage === 'proposal').length,
    };

    return {
      weightedPipeline,
      commitValue,
      commitCount: commitDeals.length,
      mostLikelyValue,
      mostLikelyCount: mostLikelyDeals.length,
      bestCaseValue,
      bestCaseCount: bestCaseDeals.length,
      totalPipeline,
      totalDeals: dealsInPeriod.length,
      avgDealSize,
      stageBreakdown,
    };
  }, [dealsInPeriod]);

  // Health score distribution
  const healthDistribution = useMemo(() => {
    const healthy = dealsInPeriod.filter((d) => (d.health_score ?? 50) >= 80).length;
    const atRisk = dealsInPeriod.filter((d) => {
      const score = d.health_score ?? 50;
      return score >= 50 && score < 80;
    }).length;
    const critical = dealsInPeriod.filter((d) => (d.health_score ?? 50) < 50).length;

    return { healthy, atRisk, critical };
  }, [dealsInPeriod]);

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Header
        title="Revenue Forecast"
        subtitle="AI-powered revenue predictions and pipeline analytics"
        action={{
          label: 'View Pipeline',
          onClick: () => navigate('/deals'),
        }}
      />

      <div className="p-4 md:p-6 space-y-6">
        {/* Period Selector */}
        <div className="flex items-center justify-between animate-fade-in">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Forecast Period: {format(dateRange.start, 'MMM d')} - {format(dateRange.end, 'MMM d, yyyy')}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {forecasts.totalDeals} deals expected to close
            </p>
          </div>
          <Select value={period} onValueChange={(value) => setPeriod(value as ForecastPeriod)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current_month">Current Month</SelectItem>
              <SelectItem value="next_month">Next Month</SelectItem>
              <SelectItem value="current_quarter">Current Quarter</SelectItem>
              <SelectItem value="next_quarter">Next Quarter</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Main Forecast Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-slide-up">
          {/* Commit Forecast */}
          <Card className="border-2 border-success/30 bg-success/5">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="h-5 w-5 text-success" />
                <span className="text-success">Commit</span>
              </CardTitle>
              <p className="text-xs text-muted-foreground">90%+ Probability</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-3xl font-bold text-foreground">
                  ${forecasts.commitValue.toLocaleString()}
                </p>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/30">
                    {forecasts.commitCount} deals
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Most Likely Forecast */}
          <Card className="border-2 border-primary/30 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <span className="text-primary">Most Likely</span>
              </CardTitle>
              <p className="text-xs text-muted-foreground">50%+ Probability</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-3xl font-bold text-foreground">
                  ${forecasts.mostLikelyValue.toLocaleString()}
                </p>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
                    {forecasts.mostLikelyCount} deals
                  </Badge>
                  {forecasts.mostLikelyCount > forecasts.commitCount && (
                    <span className="text-xs text-muted-foreground">
                      +{forecasts.mostLikelyCount - forecasts.commitCount} upside
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Best Case Forecast */}
          <Card className="border-2 border-orange-200 bg-orange-50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ArrowUpRight className="h-5 w-5 text-orange-600" />
                <span className="text-orange-600">Best Case</span>
              </CardTitle>
              <p className="text-xs text-muted-foreground">30%+ Probability</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-3xl font-bold text-foreground">
                  ${forecasts.bestCaseValue.toLocaleString()}
                </p>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs bg-orange-100 text-orange-600 border-orange-300">
                    {forecasts.bestCaseCount} deals
                  </Badge>
                  {forecasts.bestCaseCount > forecasts.mostLikelyCount && (
                    <span className="text-xs text-muted-foreground">
                      +{forecasts.bestCaseCount - forecasts.mostLikelyCount} stretch
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pipeline Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-slide-up" style={{ animationDelay: '100ms' }}>
          {/* Weighted Pipeline */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Weighted Pipeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">
                ${forecasts.weightedPipeline.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Probability-adjusted value
              </p>
            </CardContent>
          </Card>

          {/* Total Pipeline */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Total Pipeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">
                ${forecasts.totalPipeline.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {forecasts.totalDeals} deals in period
              </p>
            </CardContent>
          </Card>

          {/* Average Deal Size */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Target className="h-4 w-4" />
                Avg Deal Size
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">
                ${forecasts.avgDealSize.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Per closed deal
              </p>
            </CardContent>
          </Card>

          {/* Close Date Coverage */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Coverage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">
                {Math.round((dealsInPeriod.length / Math.max(deals.length, 1)) * 100)}%
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Of total pipeline
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Deal Health & Stage Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-slide-up" style={{ animationDelay: '150ms' }}>
          {/* Health Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Deal Health Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 border border-green-200">
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 rounded-full bg-green-600" />
                    <span className="font-medium text-foreground">Healthy (80-100)</span>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-foreground">{healthDistribution.healthy}</p>
                    <p className="text-xs text-muted-foreground">
                      {Math.round((healthDistribution.healthy / Math.max(forecasts.totalDeals, 1)) * 100)}%
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-orange-50 border border-orange-200">
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 rounded-full bg-orange-600" />
                    <span className="font-medium text-foreground">At Risk (50-79)</span>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-foreground">{healthDistribution.atRisk}</p>
                    <p className="text-xs text-muted-foreground">
                      {Math.round((healthDistribution.atRisk / Math.max(forecasts.totalDeals, 1)) * 100)}%
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-red-50 border border-red-200">
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 rounded-full bg-red-600" />
                    <span className="font-medium text-foreground">Critical (&lt;50)</span>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-foreground">{healthDistribution.critical}</p>
                    <p className="text-xs text-muted-foreground">
                      {Math.round((healthDistribution.critical / Math.max(forecasts.totalDeals, 1)) * 100)}%
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stage Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Pipeline Stage Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 rounded-full bg-muted" />
                    <span className="font-medium text-foreground">Lead</span>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-foreground">{forecasts.stageBreakdown.lead}</p>
                    <p className="text-xs text-muted-foreground">
                      {Math.round((forecasts.stageBreakdown.lead / Math.max(forecasts.totalDeals, 1)) * 100)}%
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 rounded-full bg-info" />
                    <span className="font-medium text-foreground">Qualified</span>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-foreground">{forecasts.stageBreakdown.qualified}</p>
                    <p className="text-xs text-muted-foreground">
                      {Math.round((forecasts.stageBreakdown.qualified / Math.max(forecasts.totalDeals, 1)) * 100)}%
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 rounded-full bg-warning" />
                    <span className="font-medium text-foreground">Proposal</span>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-foreground">{forecasts.stageBreakdown.proposal}</p>
                    <p className="text-xs text-muted-foreground">
                      {Math.round((forecasts.stageBreakdown.proposal / Math.max(forecasts.totalDeals, 1)) * 100)}%
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Empty State */}
        {forecasts.totalDeals === 0 && (
          <Card className="animate-slide-up" style={{ animationDelay: '200ms' }}>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                No deals closing in this period
              </h3>
              <p className="text-muted-foreground mb-4">
                Try selecting a different forecast period or add expected close dates to your deals.
              </p>
              <Button onClick={() => navigate('/deals')}>View Pipeline</Button>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
