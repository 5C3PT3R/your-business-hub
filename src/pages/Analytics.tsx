/**
 * Analytics Page - Revenue, Attribution & Team Performance
 * Kinetic Minimalist design with Recharts visualizations
 */

import { useState } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  Percent,
  Clock,
  Trophy,
  Users,
  Lightbulb,
  AlertTriangle,
  Info,
  ChevronUp,
  ChevronDown,
  Minus,
  ArrowUpRight,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  revenueData,
  funnelData,
  kpiData,
  attributionDataFirstTouch,
  attributionDataLastTouch,
  attributionDataLinear,
  teamPerformanceData,
  aiInsights,
  AttributionRow,
} from '@/data/mock-analytics-data';

// Spotlight Card Component
function SpotlightCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-xl border bg-card transition-all duration-300',
        'hover:shadow-lg hover:shadow-primary/5 hover:border-primary/20',
        'before:absolute before:inset-0 before:bg-gradient-to-br before:from-primary/5 before:to-transparent before:opacity-0 before:transition-opacity before:duration-300',
        'hover:before:opacity-100',
        className
      )}
    >
      {children}
    </div>
  );
}

// KPI Card Component
function KPICard({
  title,
  value,
  change,
  changeType,
  period,
  icon: Icon,
  format = 'number',
}: {
  title: string;
  value: number;
  change: number;
  changeType: 'positive' | 'negative';
  period: string;
  icon: React.ElementType;
  format?: 'number' | 'currency' | 'percent' | 'days';
}) {
  const formatValue = (val: number) => {
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(val);
      case 'percent':
        return `${val}%`;
      case 'days':
        return `${val} days`;
      default:
        return new Intl.NumberFormat('en-US').format(val);
    }
  };

  const isPositive = changeType === 'positive';

  return (
    <SpotlightCard>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold tracking-tight">{formatValue(value)}</p>
            <div className="flex items-center gap-2">
              <Badge
                variant="secondary"
                className={cn(
                  'text-xs font-medium',
                  isPositive
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                )}
              >
                {isPositive ? (
                  <TrendingUp className="h-3 w-3 mr-1" />
                ) : (
                  <TrendingDown className="h-3 w-3 mr-1" />
                )}
                {isPositive ? '+' : ''}
                {change}
                {format === 'percent' || format === 'days' ? '' : '%'}
              </Badge>
              <span className="text-xs text-muted-foreground">{period}</span>
            </div>
          </div>
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Icon className="h-6 w-6 text-primary" />
          </div>
        </div>
      </CardContent>
    </SpotlightCard>
  );
}

// AI Insight Card
function InsightCard({
  insight,
}: {
  insight: {
    type: string;
    title: string;
    description: string;
    impact: string;
    metric: string;
  };
}) {
  const iconMap = {
    opportunity: Lightbulb,
    warning: AlertTriangle,
    info: Info,
  };
  const Icon = iconMap[insight.type as keyof typeof iconMap] || Info;

  const colorMap = {
    opportunity: 'text-emerald-500 bg-emerald-500/10',
    warning: 'text-amber-500 bg-amber-500/10',
    info: 'text-blue-500 bg-blue-500/10',
  };
  const colorClass = colorMap[insight.type as keyof typeof colorMap] || colorMap.info;

  return (
    <div className="flex gap-3 p-3 rounded-lg border bg-card/50 hover:bg-card transition-colors">
      <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center shrink-0', colorClass)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium leading-tight">{insight.title}</p>
          <Badge variant="outline" className="shrink-0 text-xs">
            {insight.metric}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{insight.description}</p>
      </div>
    </div>
  );
}

// Revenue Tab Content
function RevenueTab() {
  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Revenue"
          value={kpiData.totalRevenue.value}
          change={kpiData.totalRevenue.change}
          changeType={kpiData.totalRevenue.changeType}
          period={kpiData.totalRevenue.period}
          icon={DollarSign}
          format="currency"
        />
        <KPICard
          title="Pipeline Value"
          value={kpiData.pipelineValue.value}
          change={kpiData.pipelineValue.change}
          changeType={kpiData.pipelineValue.changeType}
          period={kpiData.pipelineValue.period}
          icon={Target}
          format="currency"
        />
        <KPICard
          title="Win Rate"
          value={kpiData.winRate.value}
          change={kpiData.winRate.change}
          changeType={kpiData.winRate.changeType}
          period={kpiData.winRate.period}
          icon={Percent}
          format="percent"
        />
        <KPICard
          title="Avg Sales Cycle"
          value={kpiData.salesCycle.value}
          change={kpiData.salesCycle.change}
          changeType={kpiData.salesCycle.changeType}
          period={kpiData.salesCycle.period}
          icon={Clock}
          format="days"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue vs Target Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Revenue vs Target</CardTitle>
            <CardDescription>Monthly revenue performance against targets</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorPipeline" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" tick={{ fill: 'currentColor' }} />
                <YAxis
                  className="text-xs"
                  tick={{ fill: 'currentColor' }}
                  tickFormatter={(value) => `$${value / 1000}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) =>
                    new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: 'USD',
                    }).format(value)
                  }
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#10b981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorRevenue)"
                  name="Revenue"
                />
                <Area
                  type="monotone"
                  dataKey="target"
                  stroke="#6b7280"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  fill="none"
                  name="Target"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* AI Insights */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-primary" />
              AI Insights
            </CardTitle>
            <CardDescription>Patterns discovered in your data</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {aiInsights.map((insight) => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Funnel Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Funnel Conversion Rates</CardTitle>
          <CardDescription>Progression through sales stages</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={funnelData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
              <XAxis type="number" tick={{ fill: 'currentColor' }} className="text-xs" />
              <YAxis
                dataKey="stage"
                type="category"
                tick={{ fill: 'currentColor' }}
                className="text-xs"
                width={100}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                formatter={(value: number, name: string) => [
                  name === 'count' ? value.toLocaleString() : `${value}%`,
                  name === 'count' ? 'Count' : 'Conversion Rate',
                ]}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {funnelData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

// Attribution Tab Content
function AttributionTab() {
  const [model, setModel] = useState<'first' | 'last' | 'linear'>('first');

  const dataMap = {
    first: attributionDataFirstTouch,
    last: attributionDataLastTouch,
    linear: attributionDataLinear,
  };

  const data = dataMap[model];

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(value);

  const formatROI = (roi: number) => {
    if (roi === Infinity) return '∞';
    return `${roi.toFixed(1)}x`;
  };

  return (
    <div className="space-y-6">
      {/* Model Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Channel Attribution</h3>
          <p className="text-sm text-muted-foreground">
            Analyze which channels drive the most revenue
          </p>
        </div>
        <Select value={model} onValueChange={(v) => setModel(v as typeof model)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Attribution Model" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="first">First Touch</SelectItem>
            <SelectItem value="last">Last Touch</SelectItem>
            <SelectItem value="linear">Linear</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Model Description */}
      <Card className="bg-muted/50">
        <CardContent className="py-3 px-4">
          <p className="text-sm text-muted-foreground">
            {model === 'first' && (
              <>
                <strong>First Touch:</strong> Credits 100% of the revenue to the first channel that
                brought the customer.
              </>
            )}
            {model === 'last' && (
              <>
                <strong>Last Touch:</strong> Credits 100% of the revenue to the last channel before
                conversion.
              </>
            )}
            {model === 'linear' && (
              <>
                <strong>Linear:</strong> Distributes credit equally across all touchpoints in the
                customer journey.
              </>
            )}
          </p>
        </CardContent>
      </Card>

      {/* Attribution Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Channel</TableHead>
                <TableHead className="text-right">Leads</TableHead>
                <TableHead className="text-right">Spend</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Deals</TableHead>
                <TableHead className="text-right">Conv. Rate</TableHead>
                <TableHead className="text-right">ROI</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data
                .sort((a, b) => b.revenue - a.revenue)
                .map((row) => (
                  <TableRow key={row.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">{row.channel}</TableCell>
                    <TableCell className="text-right">{row.leads.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {row.spend === 0 ? '-' : formatCurrency(row.spend)}
                    </TableCell>
                    <TableCell className="text-right font-medium text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(row.revenue)}
                    </TableCell>
                    <TableCell className="text-right">{row.deals}</TableCell>
                    <TableCell className="text-right">{row.conversionRate.toFixed(1)}%</TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant="secondary"
                        className={cn(
                          row.roi >= 20
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : row.roi >= 10
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        )}
                      >
                        {formatROI(row.roi)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SpotlightCard>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Best ROI Channel</p>
            <p className="text-xl font-bold mt-1">
              {data.filter((d) => d.roi !== Infinity).sort((a, b) => b.roi - a.roi)[0]?.channel ||
                'Webinars'}
            </p>
            <p className="text-sm text-emerald-600 dark:text-emerald-400">
              {formatROI(
                data.filter((d) => d.roi !== Infinity).sort((a, b) => b.roi - a.roi)[0]?.roi || 31
              )}{' '}
              return
            </p>
          </CardContent>
        </SpotlightCard>
        <SpotlightCard>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Highest Revenue</p>
            <p className="text-xl font-bold mt-1">
              {data.sort((a, b) => b.revenue - a.revenue)[0]?.channel || 'LinkedIn Ads'}
            </p>
            <p className="text-sm text-blue-600 dark:text-blue-400">
              {formatCurrency(data.sort((a, b) => b.revenue - a.revenue)[0]?.revenue || 850000)}
            </p>
          </CardContent>
        </SpotlightCard>
        <SpotlightCard>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Best Conversion</p>
            <p className="text-xl font-bold mt-1">
              {data.sort((a, b) => b.conversionRate - a.conversionRate)[0]?.channel || 'Referrals'}
            </p>
            <p className="text-sm text-violet-600 dark:text-violet-400">
              {data.sort((a, b) => b.conversionRate - a.conversionRate)[0]?.conversionRate.toFixed(
                1
              ) || '16.9'}
              % rate
            </p>
          </CardContent>
        </SpotlightCard>
      </div>
    </div>
  );
}

// Team Performance Tab Content
function TeamTab() {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(value);

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase();

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <ChevronUp className="h-4 w-4 text-emerald-500" />;
      case 'down':
        return <ChevronDown className="h-4 w-4 text-rose-500" />;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  // Sort by revenue
  const sortedTeam = [...teamPerformanceData].sort((a, b) => b.revenue - a.revenue);

  return (
    <div className="space-y-6">
      {/* Top Performers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {sortedTeam.slice(0, 3).map((member, index) => (
          <SpotlightCard key={member.id}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={member.avatar || undefined} />
                    <AvatarFallback
                      className={cn(
                        index === 0
                          ? 'bg-amber-100 text-amber-700'
                          : index === 1
                          ? 'bg-slate-100 text-slate-700'
                          : 'bg-orange-100 text-orange-700'
                      )}
                    >
                      {getInitials(member.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div
                    className={cn(
                      'absolute -top-1 -right-1 h-5 w-5 rounded-full flex items-center justify-center text-xs font-bold',
                      index === 0
                        ? 'bg-amber-500 text-white'
                        : index === 1
                        ? 'bg-slate-400 text-white'
                        : 'bg-orange-500 text-white'
                    )}
                  >
                    {index + 1}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{member.name}</p>
                  <p className="text-xs text-muted-foreground">{member.role}</p>
                </div>
                {getTrendIcon(member.trend)}
              </div>
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Revenue</span>
                  <span className="font-medium">{formatCurrency(member.revenue)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Progress
                    value={(member.revenue / member.quota) * 100}
                    className="flex-1 h-2"
                  />
                  <span className="text-xs text-muted-foreground w-12 text-right">
                    {Math.round((member.revenue / member.quota) * 100)}%
                  </span>
                </div>
              </div>
            </CardContent>
          </SpotlightCard>
        ))}
      </div>

      {/* Full Team Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Team Leaderboard</CardTitle>
          <CardDescription>Performance metrics for all team members</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">#</TableHead>
                <TableHead>Rep</TableHead>
                <TableHead className="text-right">Deals Won</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Quota %</TableHead>
                <TableHead className="text-right">Win Rate</TableHead>
                <TableHead className="text-right">Avg Cycle</TableHead>
                <TableHead className="text-right">Trend</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedTeam.map((member, index) => (
                <TableRow key={member.id} className="hover:bg-muted/50">
                  <TableCell>
                    <span
                      className={cn(
                        'font-bold',
                        index === 0
                          ? 'text-amber-500'
                          : index === 1
                          ? 'text-slate-400'
                          : index === 2
                          ? 'text-orange-500'
                          : 'text-muted-foreground'
                      )}
                    >
                      {index + 1}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={member.avatar || undefined} />
                        <AvatarFallback className="text-xs">
                          {getInitials(member.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm">{member.name}</p>
                        <p className="text-xs text-muted-foreground">{member.role}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">{member.dealsWon}</TableCell>
                  <TableCell className="text-right font-medium text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(member.revenue)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge
                      variant="secondary"
                      className={cn(
                        member.revenue >= member.quota
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : member.revenue >= member.quota * 0.9
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                          : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                      )}
                    >
                      {Math.round((member.revenue / member.quota) * 100)}%
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{member.winRate}%</TableCell>
                  <TableCell className="text-right">{member.avgSaleCycle}d</TableCell>
                  <TableCell className="text-right">{getTrendIcon(member.trend)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// Main Analytics Page
export default function Analytics() {
  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground">
            Track revenue, attribution, and team performance
          </p>
        </div>
        <Select defaultValue="this-quarter">
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Time period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="this-month">This Month</SelectItem>
            <SelectItem value="this-quarter">This Quarter</SelectItem>
            <SelectItem value="this-year">This Year</SelectItem>
            <SelectItem value="last-quarter">Last Quarter</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="revenue" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="revenue" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Revenue
          </TabsTrigger>
          <TabsTrigger value="attribution" className="flex items-center gap-2">
            <ArrowUpRight className="h-4 w-4" />
            Attribution
          </TabsTrigger>
          <TabsTrigger value="team" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Team
          </TabsTrigger>
        </TabsList>

        <TabsContent value="revenue">
          <RevenueTab />
        </TabsContent>

        <TabsContent value="attribution">
          <AttributionTab />
        </TabsContent>

        <TabsContent value="team">
          <TeamTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
