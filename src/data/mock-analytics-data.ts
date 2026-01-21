/**
 * Mock Analytics Data for Breeze CRM
 * Used to populate charts and tables in the Analytics dashboard
 */

// Revenue over time data
export const revenueData = [
  { month: 'Jan', revenue: 45000, target: 50000, pipeline: 120000 },
  { month: 'Feb', revenue: 52000, target: 52000, pipeline: 135000 },
  { month: 'Mar', revenue: 48000, target: 55000, pipeline: 142000 },
  { month: 'Apr', revenue: 61000, target: 58000, pipeline: 158000 },
  { month: 'May', revenue: 55000, target: 60000, pipeline: 165000 },
  { month: 'Jun', revenue: 67000, target: 62000, pipeline: 178000 },
  { month: 'Jul', revenue: 72000, target: 65000, pipeline: 195000 },
  { month: 'Aug', revenue: 69000, target: 68000, pipeline: 210000 },
  { month: 'Sep', revenue: 78000, target: 70000, pipeline: 225000 },
  { month: 'Oct', revenue: 82000, target: 72000, pipeline: 240000 },
  { month: 'Nov', revenue: 88000, target: 75000, pipeline: 255000 },
  { month: 'Dec', revenue: 95000, target: 80000, pipeline: 280000 },
];

// Funnel conversion data
export const funnelData = [
  { stage: 'Leads', count: 1250, rate: 100, color: '#6366f1' },
  { stage: 'Qualified', count: 875, rate: 70, color: '#8b5cf6' },
  { stage: 'Opportunity', count: 438, rate: 35, color: '#a855f7' },
  { stage: 'Proposal', count: 219, rate: 17.5, color: '#d946ef' },
  { stage: 'Negotiation', count: 131, rate: 10.5, color: '#ec4899' },
  { stage: 'Closed Won', count: 88, rate: 7, color: '#10b981' },
];

// KPI summary data
export const kpiData = {
  totalRevenue: {
    value: 812000,
    change: 12.5,
    changeType: 'positive' as const,
    period: 'vs last quarter',
  },
  pipelineValue: {
    value: 2450000,
    change: 8.3,
    changeType: 'positive' as const,
    period: 'vs last quarter',
  },
  winRate: {
    value: 32.5,
    change: -2.1,
    changeType: 'negative' as const,
    period: 'vs last quarter',
  },
  avgDealSize: {
    value: 9227,
    change: 5.7,
    changeType: 'positive' as const,
    period: 'vs last quarter',
  },
  salesCycle: {
    value: 28,
    change: -3,
    changeType: 'positive' as const, // Lower is better
    period: 'vs last quarter',
  },
  dealsWon: {
    value: 88,
    change: 15,
    changeType: 'positive' as const,
    period: 'vs last quarter',
  },
};

// Attribution data by channel
export interface AttributionRow {
  id: string;
  channel: string;
  leads: number;
  spend: number;
  revenue: number;
  roi: number;
  deals: number;
  conversionRate: number;
}

export const attributionDataFirstTouch: AttributionRow[] = [
  { id: '1', channel: 'LinkedIn Ads', leads: 450, spend: 45000, revenue: 850000, roi: 17.9, deals: 32, conversionRate: 7.1 },
  { id: '2', channel: 'Organic Search', leads: 380, spend: 0, revenue: 720000, roi: Infinity, deals: 28, conversionRate: 7.4 },
  { id: '3', channel: 'Webinars', leads: 120, spend: 15000, revenue: 480000, roi: 31.0, deals: 18, conversionRate: 15.0 },
  { id: '4', channel: 'Referrals', leads: 89, spend: 0, revenue: 420000, roi: Infinity, deals: 15, conversionRate: 16.9 },
  { id: '5', channel: 'Google Ads', leads: 340, spend: 62000, revenue: 680000, roi: 10.0, deals: 24, conversionRate: 7.1 },
  { id: '6', channel: 'Cold Email', leads: 250, spend: 8000, revenue: 95000, roi: 10.9, deals: 4, conversionRate: 1.6 },
  { id: '7', channel: 'Content Marketing', leads: 180, spend: 12000, revenue: 320000, roi: 25.7, deals: 12, conversionRate: 6.7 },
  { id: '8', channel: 'Trade Shows', leads: 95, spend: 35000, revenue: 285000, roi: 7.1, deals: 10, conversionRate: 10.5 },
];

export const attributionDataLastTouch: AttributionRow[] = [
  { id: '1', channel: 'LinkedIn Ads', leads: 450, spend: 45000, revenue: 620000, roi: 12.8, deals: 24, conversionRate: 5.3 },
  { id: '2', channel: 'Organic Search', leads: 380, spend: 0, revenue: 580000, roi: Infinity, deals: 22, conversionRate: 5.8 },
  { id: '3', channel: 'Webinars', leads: 120, spend: 15000, revenue: 680000, roi: 44.3, deals: 26, conversionRate: 21.7 },
  { id: '4', channel: 'Referrals', leads: 89, spend: 0, revenue: 520000, roi: Infinity, deals: 19, conversionRate: 21.3 },
  { id: '5', channel: 'Google Ads', leads: 340, spend: 62000, revenue: 420000, roi: 5.8, deals: 16, conversionRate: 4.7 },
  { id: '6', channel: 'Cold Email', leads: 250, spend: 8000, revenue: 180000, roi: 21.5, deals: 7, conversionRate: 2.8 },
  { id: '7', channel: 'Content Marketing', leads: 180, spend: 12000, revenue: 450000, roi: 36.5, deals: 17, conversionRate: 9.4 },
  { id: '8', channel: 'Trade Shows', leads: 95, spend: 35000, revenue: 400000, roi: 10.4, deals: 14, conversionRate: 14.7 },
];

export const attributionDataLinear: AttributionRow[] = [
  { id: '1', channel: 'LinkedIn Ads', leads: 450, spend: 45000, revenue: 735000, roi: 15.3, deals: 28, conversionRate: 6.2 },
  { id: '2', channel: 'Organic Search', leads: 380, spend: 0, revenue: 650000, roi: Infinity, deals: 25, conversionRate: 6.6 },
  { id: '3', channel: 'Webinars', leads: 120, spend: 15000, revenue: 580000, roi: 37.7, deals: 22, conversionRate: 18.3 },
  { id: '4', channel: 'Referrals', leads: 89, spend: 0, revenue: 470000, roi: Infinity, deals: 17, conversionRate: 19.1 },
  { id: '5', channel: 'Google Ads', leads: 340, spend: 62000, revenue: 550000, roi: 7.9, deals: 20, conversionRate: 5.9 },
  { id: '6', channel: 'Cold Email', leads: 250, spend: 8000, revenue: 137500, roi: 16.2, deals: 5, conversionRate: 2.0 },
  { id: '7', channel: 'Content Marketing', leads: 180, spend: 12000, revenue: 385000, roi: 31.1, deals: 14, conversionRate: 7.8 },
  { id: '8', channel: 'Trade Shows', leads: 95, spend: 35000, revenue: 342500, roi: 8.8, deals: 12, conversionRate: 12.6 },
];

// Team performance data
export interface TeamMember {
  id: string;
  name: string;
  avatar: string | null;
  role: string;
  dealsWon: number;
  dealsPending: number;
  revenue: number;
  quota: number;
  avgSaleCycle: number;
  winRate: number;
  activities: number;
  trend: 'up' | 'down' | 'stable';
}

export const teamPerformanceData: TeamMember[] = [
  {
    id: '1',
    name: 'Sarah Chen',
    avatar: null,
    role: 'Senior AE',
    dealsWon: 18,
    dealsPending: 12,
    revenue: 215000,
    quota: 200000,
    avgSaleCycle: 24,
    winRate: 42,
    activities: 345,
    trend: 'up',
  },
  {
    id: '2',
    name: 'Marcus Johnson',
    avatar: null,
    role: 'Account Executive',
    dealsWon: 15,
    dealsPending: 8,
    revenue: 178000,
    quota: 180000,
    avgSaleCycle: 28,
    winRate: 38,
    activities: 298,
    trend: 'stable',
  },
  {
    id: '3',
    name: 'Emily Rodriguez',
    avatar: null,
    role: 'Senior AE',
    dealsWon: 21,
    dealsPending: 15,
    revenue: 245000,
    quota: 220000,
    avgSaleCycle: 22,
    winRate: 45,
    activities: 412,
    trend: 'up',
  },
  {
    id: '4',
    name: 'David Kim',
    avatar: null,
    role: 'Account Executive',
    dealsWon: 12,
    dealsPending: 10,
    revenue: 142000,
    quota: 160000,
    avgSaleCycle: 32,
    winRate: 31,
    activities: 256,
    trend: 'down',
  },
  {
    id: '5',
    name: 'Lisa Thompson',
    avatar: null,
    role: 'SDR Lead',
    dealsWon: 8,
    dealsPending: 6,
    revenue: 98000,
    quota: 100000,
    avgSaleCycle: 35,
    winRate: 28,
    activities: 478,
    trend: 'up',
  },
  {
    id: '6',
    name: 'James Wilson',
    avatar: null,
    role: 'Account Executive',
    dealsWon: 14,
    dealsPending: 9,
    revenue: 165000,
    quota: 170000,
    avgSaleCycle: 26,
    winRate: 36,
    activities: 312,
    trend: 'stable',
  },
];

// AI Insights for the analytics page
export const aiInsights = [
  {
    id: '1',
    type: 'opportunity',
    title: 'Webinars are your best ROI channel',
    description: 'Webinar leads convert 2.3x faster than average. Consider increasing webinar frequency.',
    impact: 'high',
    metric: '+31x ROI',
  },
  {
    id: '2',
    type: 'warning',
    title: 'Cold email performance declining',
    description: 'Conversion rate dropped 45% this quarter. Review email sequences and targeting.',
    impact: 'medium',
    metric: '-45% conversion',
  },
  {
    id: '3',
    type: 'opportunity',
    title: 'Emily Rodriguez exceeding quota',
    description: 'Top performer with 111% quota attainment. Document her playbook for team training.',
    impact: 'high',
    metric: '111% quota',
  },
  {
    id: '4',
    type: 'info',
    title: 'Deals with 3+ stakeholders close faster',
    description: 'Multi-threaded deals have 78% higher win rate. Push reps to identify more contacts.',
    impact: 'medium',
    metric: '+78% win rate',
  },
];

// Monthly targets vs actuals
export const monthlyTargets = [
  { month: 'Q1', target: 157000, actual: 145000, attainment: 92.4 },
  { month: 'Q2', target: 180000, actual: 183000, attainment: 101.7 },
  { month: 'Q3', target: 203000, actual: 219000, attainment: 107.9 },
  { month: 'Q4', target: 227000, actual: 265000, attainment: 116.7 },
];

// Deal velocity data
export const dealVelocityData = [
  { stage: 'Lead → Qualified', avgDays: 3, benchmark: 5 },
  { stage: 'Qualified → Demo', avgDays: 7, benchmark: 7 },
  { stage: 'Demo → Proposal', avgDays: 5, benchmark: 7 },
  { stage: 'Proposal → Negotiation', avgDays: 8, benchmark: 10 },
  { stage: 'Negotiation → Closed', avgDays: 5, benchmark: 7 },
];
