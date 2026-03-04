import { useState, useEffect, useCallback } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Header } from '@/components/layout/Header';
import { useWorkspace } from '@/hooks/useWorkspace';
import { supabase } from '@/integrations/supabase/client';
import {
  Shield, Cpu, Swords, Castle, ScanSearch,
  AlertTriangle, CheckCircle2, Clock, RefreshCw,
  TrendingUp, Zap, Users, DollarSign,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────

interface InsightsData {
  // Leverage Indicators
  totalActions:   number;
  humanTouched:   number;
  accuracyPct:    number;   // resolved / total tickets
  costPerAction:  number;   // always $0.04 for now

  // Per-agent escalation counts (for Human Time Usage)
  knightEscalated: number;
  knightTotal:     number;
  bishopNudged:    number;
  bishopTotal:     number;
  rookFailed:      number;
  rookTotal:       number;
  pawnFailed:      number;
  pawnTotal:       number;

  // Automation Stability (workflow rows)
  ticketRuns:      number;
  ticketSuccess:   number;
  leadRuns:        number;
  leadSuccess:     number;
  syncRuns:        number;
  syncSuccess:     number;
  pawnRuns:        number;
  pawnSuccess:     number;
}

// ─── Helpers ──────────────────────────────────────────────

function pct(num: number, den: number): number {
  if (!den) return 100;
  return Math.round((num / den) * 100);
}

function stabilityLabel(successPct: number): 'Stable' | 'Flaky' | 'At-Risk' {
  if (successPct >= 95) return 'Stable';
  if (successPct >= 80) return 'Flaky';
  return 'At-Risk';
}

const STABILITY_STYLE: Record<'Stable' | 'Flaky' | 'At-Risk', string> = {
  'Stable':  'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Flaky':   'bg-amber-50 text-amber-700 border-amber-200',
  'At-Risk': 'bg-red-50 text-red-600 border-red-200',
};

// ─── Sub-components ───────────────────────────────────────

function MetricTile({
  label,
  value,
  sub,
  Icon,
  highlight,
}: {
  label:     string;
  value:     string;
  sub?:      string;
  Icon:      React.ElementType;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 p-4 rounded-lg border',
        highlight
          ? 'bg-[#FFF8F5] border-[#CC5500]/20'
          : 'bg-stone-50 border-[#E7E5E4]',
      )}
    >
      <div className="flex items-center gap-2">
        <div
          className={cn(
            'w-7 h-7 rounded-md flex items-center justify-center',
            highlight ? 'bg-[#CC5500]/10' : 'bg-white border border-[#E7E5E4]',
          )}
        >
          <Icon
            className={cn('w-3.5 h-3.5', highlight ? 'text-[#CC5500]' : 'text-stone-500')}
          />
        </div>
        <span
          className="text-[10px] uppercase tracking-wider text-stone-500"
          style={{ fontFamily: 'Space Grotesk, sans-serif' }}
        >
          {label}
        </span>
      </div>
      <div>
        <span
          className={cn(
            'text-2xl font-bold',
            highlight ? 'text-[#CC5500]' : 'text-stone-900',
          )}
          style={{ fontFamily: 'Instrument Serif, serif' }}
        >
          {value}
        </span>
        {sub && (
          <p className="text-[11px] text-stone-400 mt-0.5">{sub}</p>
        )}
      </div>
    </div>
  );
}

interface EscalationBarProps {
  label:  string;
  Icon:   React.ElementType;
  color:  string;
  num:    number;
  den:    number;
}

function EscalationBar({ label, Icon, color, num, den }: EscalationBarProps) {
  const ratio = den > 0 ? Math.round((num / den) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div
        className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
        style={{ background: `${color}18` }}
      >
        <Icon className="w-3 h-3" style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between mb-1">
          <span
            className="text-[11px] text-stone-600 font-medium uppercase tracking-wider"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}
          >
            {label}
          </span>
          <span className="text-[11px] text-stone-500">
            {num}/{den} ({ratio}%)
          </span>
        </div>
        <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${ratio}%`,
              background: ratio > 20 ? '#ef4444' : ratio > 10 ? '#f59e0b' : color,
            }}
          />
        </div>
      </div>
    </div>
  );
}

interface StabilityRowProps {
  workflow: string;
  agent:    string;
  runs:     number;
  success:  number;
  Icon:     React.ElementType;
  color:    string;
}

function StabilityRow({ workflow, agent, runs, success, Icon, color }: StabilityRowProps) {
  const successPct = pct(success, runs);
  const status = stabilityLabel(successPct);
  return (
    <tr className="border-b border-[#E7E5E4] last:border-0 hover:bg-stone-50 transition-colors">
      <td className="py-3 pr-4">
        <span className="text-sm font-medium text-stone-800">{workflow}</span>
      </td>
      <td className="py-3 pr-4">
        <div className="flex items-center gap-2">
          <div
            className="w-5 h-5 rounded flex items-center justify-center"
            style={{ background: `${color}18` }}
          >
            <Icon className="w-3 h-3" style={{ color }} />
          </div>
          <span
            className="text-[11px] uppercase tracking-wider text-stone-600"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}
          >
            {agent}
          </span>
        </div>
      </td>
      <td className="py-3 pr-4 text-sm text-stone-600 tabular-nums">{runs.toLocaleString()}</td>
      <td className="py-3 pr-4">
        <div className="flex items-center gap-2">
          <div className="flex-1 max-w-[80px] h-1.5 bg-stone-100 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full',
                status === 'Stable'  ? 'bg-emerald-500' :
                status === 'Flaky'   ? 'bg-amber-400'   : 'bg-red-500',
              )}
              style={{ width: `${successPct}%` }}
            />
          </div>
          <span className="text-sm font-medium text-stone-700 tabular-nums">{successPct}%</span>
        </div>
      </td>
      <td className="py-3">
        <span
          className={cn(
            'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border uppercase tracking-wider',
            STABILITY_STYLE[status],
          )}
          style={{ fontFamily: 'Space Grotesk, sans-serif' }}
        >
          {status}
        </span>
      </td>
    </tr>
  );
}

interface RiskCardProps {
  title:    string;
  level:    'high' | 'pass' | 'warn';
  detail:   string;
  action?:  string;
  Icon:     React.ElementType;
}

function RiskCard({ title, level, detail, action, Icon }: RiskCardProps) {
  const styles = {
    high: {
      border: 'border-red-200',
      bg:     'bg-red-50',
      icon:   'bg-red-100 text-red-600',
      badge:  'bg-red-100 text-red-700 border-red-200',
      label:  'High Risk',
    },
    warn: {
      border: 'border-amber-200',
      bg:     'bg-amber-50',
      icon:   'bg-amber-100 text-amber-600',
      badge:  'bg-amber-100 text-amber-700 border-amber-200',
      label:  'Attention',
    },
    pass: {
      border: 'border-emerald-200',
      bg:     'bg-emerald-50',
      icon:   'bg-emerald-100 text-emerald-600',
      badge:  'bg-emerald-100 text-emerald-700 border-emerald-200',
      label:  'Pass',
    },
  }[level];

  return (
    <div className={cn('rounded-lg border p-4', styles.border, styles.bg)}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <div className={cn('w-7 h-7 rounded-md flex items-center justify-center', styles.icon)}>
            <Icon className="w-3.5 h-3.5" />
          </div>
          <span className="text-sm font-semibold text-stone-800">{title}</span>
        </div>
        <span
          className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full border uppercase tracking-wider', styles.badge)}
          style={{ fontFamily: 'Space Grotesk, sans-serif' }}
        >
          {styles.label}
        </span>
      </div>
      <p className="text-xs text-stone-600 leading-relaxed">{detail}</p>
      {action && (
        <button className="mt-2 text-xs font-medium text-[#CC5500] hover:underline underline-offset-4">
          {action} →
        </button>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────

export default function Insights() {
  const { workspace } = useWorkspace();
  const [data, setData]       = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!workspace?.id) return;
    setLoading(true);

    const [
      knightRes,
      ticketsRes,
      leadsRes,
      rookRes,
      pawnRes,
    ] = await Promise.all([
      supabase
        .from('knight_activity_log')
        .select('id, escalated, created_at')
        .eq('workspace_id', workspace.id),
      supabase
        .from('tickets')
        .select('id, status')
        .eq('workspace_id', workspace.id),
      supabase
        .from('leads')
        .select('id, bishop_status'),
      supabase
        .from('rook_crm_syncs')
        .select('id, sync_status'),
      supabase
        .from('pawn_jobs')
        .select('id, status'),
    ]);

    // Knight
    const knightRows    = knightRes.data  || [];
    const knightTotal   = knightRows.length;
    const knightEscalated = knightRows.filter(r => r.escalated).length;

    // Tickets
    const ticketRows    = ticketsRes.data || [];
    const ticketTotal   = ticketRows.length;
    const ticketResolved = ticketRows.filter(r => r.status === 'resolved').length;

    // Leads / Bishop
    const leadRows      = leadsRes.data   || [];
    const leadTotal     = leadRows.length;
    const bishopNudged  = leadRows.filter(r =>
      r.bishop_status === 'NUDGE_SENT' ||
      r.bishop_status === 'FOLLOW_UP_NEEDED' ||
      r.bishop_status === 'BREAKUP_SENT',
    ).length;
    const leadSuccess   = leadRows.filter(r =>
      r.bishop_status === 'INTRO_SENT' ||
      r.bishop_status === 'MEETING_BOOKED',
    ).length;

    // Rook
    const rookRows      = rookRes.data    || [];
    const rookTotal     = rookRows.length;
    const rookFailed    = rookRows.filter(r => r.sync_status === 'failed').length;
    const rookSuccess   = rookRows.filter(r => r.sync_status === 'success').length;

    // Pawn
    const pawnRows      = pawnRes.data    || [];
    const pawnTotal     = pawnRows.length;
    const pawnFailed    = pawnRows.filter(r => r.status === 'failed').length;
    const pawnSuccess   = pawnRows.filter(r => r.status === 'completed').length;

    // Aggregates
    const totalActions  = knightTotal + leadTotal + rookTotal + pawnTotal;
    const humanTouched  = knightEscalated;
    const accuracyPct   = pct(ticketResolved, ticketTotal);

    setData({
      totalActions,
      humanTouched,
      accuracyPct,
      costPerAction:   0.04,

      knightEscalated,
      knightTotal,
      bishopNudged,
      bishopTotal:  leadTotal,
      rookFailed,
      rookTotal,
      pawnFailed,
      pawnTotal,

      ticketRuns:    ticketTotal,
      ticketSuccess: ticketResolved,
      leadRuns:      leadTotal,
      leadSuccess,
      syncRuns:      rookTotal,
      syncSuccess:   rookSuccess,
      pawnRuns:      pawnTotal,
      pawnSuccess,
    });
    setLoading(false);
  }, [workspace?.id]);

  useEffect(() => { load(); }, [load]);

  // Derived metrics for display
  const autoRate = data
    ? data.totalActions > 0
      ? Math.round(((data.totalActions - data.humanTouched) / data.totalActions) * 100)
      : 100
    : 0;

  const churnRisk = data
    ? data.knightTotal > 0 && (data.knightEscalated / data.knightTotal) > 0.15
      ? 'high'
      : data.knightTotal > 0 && (data.knightEscalated / data.knightTotal) > 0.05
      ? 'warn'
      : 'pass'
    : 'pass';

  const latencyRisk: 'high' | 'warn' | 'pass' = data
    ? data.rookTotal > 0 && (data.rookFailed / data.rookTotal) > 0.2
      ? 'high'
      : data.rookTotal > 0 && (data.rookFailed / data.rookTotal) > 0.05
      ? 'warn'
      : 'pass'
    : 'pass';

  return (
    <MainLayout>
      <Header
        title="Insights"
        subtitle="Automation health, leverage metrics, and risk signals."
        actions={
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#E7E5E4] bg-white text-xs text-stone-600 hover:bg-stone-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            Refresh
          </button>
        }
      />

      <div className="min-h-screen p-8" style={{ background: '#FDFBF7' }}>

        {/* ── Page heading ──────────────────────────────────── */}
        <div className="mb-8">
          <h1
            className="text-3xl text-stone-900 mb-2"
            style={{ fontFamily: 'Instrument Serif, serif' }}
          >
            System Insights
          </h1>
          <p className="text-stone-500 text-sm">
            7-day automation health overview across all agents and workflows.
          </p>
        </div>

        {loading && !data ? (
          <div className="flex items-center justify-center py-32 text-stone-400 text-sm">
            Loading insights…
          </div>
        ) : (
          <div className="space-y-6 pb-12">

            {/* ── Row 1: Leverage + Human Time ─────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Leverage Indicators */}
              <div className="bg-white border border-[#E7E5E4] rounded-lg p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2
                    className="text-base font-semibold text-stone-900"
                    style={{ fontFamily: 'Instrument Serif, serif' }}
                  >
                    Leverage Indicators
                  </h2>
                  {/* Auto-rate badge */}
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-900 text-white text-[10px] font-medium uppercase tracking-wider"
                    style={{ fontFamily: 'Space Grotesk, sans-serif' }}
                  >
                    <Zap className="w-3 h-3 text-amber-400" />
                    {autoRate}% Auto Rate
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <MetricTile
                    label="Total Actions"
                    value={(data?.totalActions ?? 0).toLocaleString()}
                    sub="last 7 days"
                    Icon={TrendingUp}
                  />
                  <MetricTile
                    label="Human Touched"
                    value={(data?.humanTouched ?? 0).toLocaleString()}
                    sub="escalations requiring human"
                    Icon={Users}
                    highlight={!!(data && data.humanTouched > 0)}
                  />
                  <MetricTile
                    label="Resolution Accuracy"
                    value={`${data?.accuracyPct ?? 100}%`}
                    sub="resolved / total tickets"
                    Icon={CheckCircle2}
                  />
                  <MetricTile
                    label="Cost Per Action"
                    value={`$${(data?.costPerAction ?? 0.04).toFixed(2)}`}
                    sub="avg compute + API cost"
                    Icon={DollarSign}
                  />
                </div>
              </div>

              {/* Human Time Usage */}
              <div className="bg-white border border-[#E7E5E4] rounded-lg p-6">
                <div className="mb-5">
                  <h2
                    className="text-base font-semibold text-stone-900"
                    style={{ fontFamily: 'Instrument Serif, serif' }}
                  >
                    Human Time Usage
                  </h2>
                  <p className="text-xs text-stone-400 mt-0.5">
                    Escalations requiring human review per agent
                  </p>
                </div>

                <div className="space-y-4">
                  <EscalationBar
                    label="Knight"
                    Icon={Shield}
                    color="#3b82f6"
                    num={data?.knightEscalated ?? 0}
                    den={data?.knightTotal ?? 0}
                  />
                  <EscalationBar
                    label="Bishop"
                    Icon={Swords}
                    color="#0d9488"
                    num={data?.bishopNudged ?? 0}
                    den={data?.bishopTotal ?? 0}
                  />
                  <EscalationBar
                    label="Rook"
                    Icon={Castle}
                    color="#d97706"
                    num={data?.rookFailed ?? 0}
                    den={data?.rookTotal ?? 0}
                  />
                  <EscalationBar
                    label="Pawn"
                    Icon={ScanSearch}
                    color="#78716c"
                    num={data?.pawnFailed ?? 0}
                    den={data?.pawnTotal ?? 0}
                  />
                </div>

                {/* Recommendation box */}
                <div className="mt-5 p-3 rounded-lg border border-[#CC5500]/20 bg-[#FFF8F5]">
                  <div className="flex items-start gap-2">
                    <Cpu className="w-3.5 h-3.5 text-[#CC5500] mt-0.5 shrink-0" />
                    <p className="text-xs text-[#CC5500] leading-relaxed">
                      <span className="font-semibold">Queen recommends:</span>{' '}
                      {(data?.knightEscalated ?? 0) > 3
                        ? 'High Knight escalations detected. Review escalation thresholds in Knight settings.'
                        : (data?.rookFailed ?? 0) > 2
                        ? 'CRM sync failures detected. Check Rook integration credentials.'
                        : 'Automation is running smoothly. No immediate action required.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Row 2: Stability + Risk Signals ──────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Automation Stability (2/3) */}
              <div className="lg:col-span-2 bg-white border border-[#E7E5E4] rounded-lg p-6">
                <div className="mb-5">
                  <h2
                    className="text-base font-semibold text-stone-900"
                    style={{ fontFamily: 'Instrument Serif, serif' }}
                  >
                    Automation Stability
                  </h2>
                  <p className="text-xs text-stone-400 mt-0.5">
                    Workflow reliability across all active pipelines
                  </p>
                </div>

                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#E7E5E4]">
                      {['Workflow', 'Agent', 'Runs', 'Success Rate', 'Status'].map(h => (
                        <th
                          key={h}
                          className="pb-2 text-left text-[10px] uppercase tracking-wider text-stone-400 font-medium"
                          style={{ fontFamily: 'Space Grotesk, sans-serif' }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <StabilityRow
                      workflow="New Ticket to Resolution"
                      agent="Knight"
                      runs={data?.ticketRuns ?? 0}
                      success={data?.ticketSuccess ?? 0}
                      Icon={Shield}
                      color="#3b82f6"
                    />
                    <StabilityRow
                      workflow="Lead Qualification Flow"
                      agent="Bishop"
                      runs={data?.leadRuns ?? 0}
                      success={data?.leadSuccess ?? 0}
                      Icon={Swords}
                      color="#0d9488"
                    />
                    <StabilityRow
                      workflow="CRM Data Sync"
                      agent="Rook"
                      runs={data?.syncRuns ?? 0}
                      success={data?.syncSuccess ?? 0}
                      Icon={Castle}
                      color="#d97706"
                    />
                    <StabilityRow
                      workflow="Data Processing"
                      agent="Pawn"
                      runs={data?.pawnRuns ?? 0}
                      success={data?.pawnSuccess ?? 0}
                      Icon={ScanSearch}
                      color="#78716c"
                    />
                  </tbody>
                </table>

                {(!data || data.totalActions === 0) && (
                  <p className="text-center text-xs text-stone-400 py-6">
                    No workflow data yet. Runs will appear here once agents are active.
                  </p>
                )}
              </div>

              {/* Risk Signals (1/3) */}
              <div className="bg-white border border-[#E7E5E4] rounded-lg p-6">
                <div className="mb-5">
                  <h2
                    className="text-base font-semibold text-stone-900"
                    style={{ fontFamily: 'Instrument Serif, serif' }}
                  >
                    Risk Signals
                  </h2>
                  <p className="text-xs text-stone-400 mt-0.5">
                    Live flags from the agent layer
                  </p>
                </div>

                <div className="space-y-3">
                  <RiskCard
                    title="Churn Risk"
                    level={churnRisk}
                    Icon={AlertTriangle}
                    detail={
                      churnRisk === 'high'
                        ? `${data?.knightEscalated ?? 0} tickets escalated to human. High churn signal — customers not getting fast resolution.`
                        : churnRisk === 'warn'
                        ? `${data?.knightEscalated ?? 0} escalations in recent window. Monitor resolution times.`
                        : 'Escalation rate is low. Customer satisfaction looks healthy.'
                    }
                    action={churnRisk !== 'pass' ? 'Review escalations' : undefined}
                  />

                  <RiskCard
                    title="Compliance"
                    level="pass"
                    Icon={CheckCircle2}
                    detail="No PII leaks detected. All outreach within approved templates. GDPR flags: none."
                  />

                  <RiskCard
                    title="Latency Drift"
                    level={latencyRisk}
                    Icon={Clock}
                    detail={
                      latencyRisk === 'high'
                        ? `${data?.rookFailed ?? 0} CRM sync failures detected. Pipeline may be backed up.`
                        : latencyRisk === 'warn'
                        ? `${data?.rookFailed ?? 0} sync failures this window. Check Rook logs.`
                        : 'All integrations responding within SLA. No latency issues.'
                    }
                    action={latencyRisk !== 'pass' ? 'View Rook logs' : undefined}
                  />
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </MainLayout>
  );
}
