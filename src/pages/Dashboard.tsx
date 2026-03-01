import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Header } from '@/components/layout/Header';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { supabase } from '@/integrations/supabase/client';
import {
  Crown, Shield, Swords, Castle, ScanSearch,
  AlertTriangle, MessageSquare, Users, RefreshCw,
  Zap, ArrowRight, TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────

interface DashboardMetrics {
  ticketsHandled: number;
  leadsTotal:     number;
  crmUpdates:     number;
  tasksExecuted:  number;
  escalations:    number;
}

type AgentName = 'Queen' | 'Knight' | 'Bishop' | 'Rook' | 'Pawn';
type OutcomeKey = 'resolved' | 'escalated' | 'sent' | 'synced' | 'qualified' | 'pending';
type Severity   = 'red' | 'amber' | 'blue';

interface ActivityRow {
  id:      string;
  time:    string;
  agent:   AgentName;
  action:  string;
  outcome: OutcomeKey;
}

interface AttentionItem {
  id:       string;
  title:    string;
  subtitle: string;
  severity: Severity;
  action:   string;
  path:     string;
}

// ─── Agent config ─────────────────────────────────────────

const AGENTS: {
  id:    string;
  name:  AgentName;
  role:  string;
  Icon:  React.ElementType;
  path:  string;
  color: string;
}[] = [
  { id: 'queen',  name: 'Queen',  role: 'Orchestrator',  Icon: Crown,       path: '/command-center', color: '#CC5500' },
  { id: 'knight', name: 'Knight', role: 'Support',        Icon: Shield,      path: '/knight',         color: '#0ea5e9' },
  { id: 'bishop', name: 'Bishop', role: 'Outbound SDR',   Icon: Swords,      path: '/bishop',         color: '#8b5cf6' },
  { id: 'rook',   name: 'Rook',   role: 'Revenue Ops',    Icon: Castle,      path: '/rook',           color: '#10b981' },
  { id: 'pawn',   name: 'Pawn',   role: 'Data Scout',     Icon: ScanSearch,  path: '/pawn',           color: '#f59e0b' },
];

const AGENT_COLOR: Record<AgentName, string> = {
  Queen:  '#CC5500',
  Knight: '#0ea5e9',
  Bishop: '#8b5cf6',
  Rook:   '#10b981',
  Pawn:   '#f59e0b',
};

// ─── Helpers ──────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const OUTCOME_STYLE: Record<OutcomeKey, string> = {
  resolved:  'bg-emerald-50 text-emerald-700 border border-emerald-200',
  escalated: 'bg-red-50 text-red-700 border border-red-200',
  sent:      'bg-blue-50 text-blue-700 border border-blue-200',
  synced:    'bg-purple-50 text-purple-700 border border-purple-200',
  qualified: 'bg-amber-50 text-amber-700 border border-amber-200',
  pending:   'bg-stone-50 text-stone-500 border border-stone-200',
};

const ACTION_LABEL: Record<string, string> = {
  reply_sent:         'Sent auto-reply to customer',
  escalated:          'Escalated ticket to human agent',
  ticket_created:     'New support ticket opened',
  ticket_resolved:    'Ticket resolved automatically',
  sentiment_analyzed: 'Sentiment analysis complete',
  voice_call:         'Voice call initiated',
};

const OUTCOME_MAP: Record<string, OutcomeKey> = {
  reply_sent:         'sent',
  escalated:          'escalated',
  ticket_created:     'pending',
  ticket_resolved:    'resolved',
  sentiment_analyzed: 'qualified',
  voice_call:         'sent',
};

const SEVERITY_BORDER: Record<Severity, string> = {
  red:   'border-l-red-400',
  amber: 'border-l-amber-400',
  blue:  'border-l-blue-400',
};

const SEVERITY_BG: Record<Severity, string> = {
  red:   'bg-red-50/60',
  amber: 'bg-amber-50/60',
  blue:  'bg-blue-50/40',
};

const SEVERITY_DOT: Record<Severity, string> = {
  red:   'bg-red-400',
  amber: 'bg-amber-400',
  blue:  'bg-blue-400',
};

// ─── Component ────────────────────────────────────────────

export default function Dashboard() {
  const { user }      = useAuth();
  const { workspace } = useWorkspace();
  const navigate      = useNavigate();

  const userName = user?.user_metadata?.full_name?.split(' ')[0] || 'there';

  const [metrics,  setMetrics]  = useState<DashboardMetrics>({ ticketsHandled: 0, leadsTotal: 0, crmUpdates: 0, tasksExecuted: 0, escalations: 0 });
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [attention, setAttention] = useState<AttentionItem[]>([]);
  const [loading,  setLoading]  = useState(true);

  // Determine agent status hints from metrics
  const [agentWarnings, setAgentWarnings] = useState<Record<string, string>>({});

  useEffect(() => {
    if (workspace?.id) loadData();
  }, [workspace?.id]);

  async function loadData() {
    setLoading(true);
    const todayIso = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();

    try {
      const [ticketsRes, leadsRes, rookRes, activityRes, escalatedRes] = await Promise.all([
        supabase
          .from('tickets')
          .select('id, status, priority, summary, source_handle, created_at')
          .eq('workspace_id', workspace!.id)
          .gte('created_at', todayIso),
        supabase
          .from('leads')
          .select('id, status, name, email, bishop_status, created_at')
          .limit(500),
        supabase
          .from('rook_crm_syncs')
          .select('id, sync_status, synced_at')
          .gte('created_at', todayIso),
        supabase
          .from('knight_activity_log')
          .select('id, action_type, created_at, details')
          .eq('workspace_id', workspace!.id)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('tickets')
          .select('id, summary, source_handle, priority, created_at, status')
          .eq('workspace_id', workspace!.id)
          .in('status', ['escalated', 'open'])
          .eq('priority', 'critical')
          .limit(3),
      ]);

      const tickets        = ticketsRes.data   || [];
      const leads          = leadsRes.data     || [];
      const rookSyncs      = rookRes.data      || [];
      const activityLogs   = activityRes.data  || [];
      const escalated      = escalatedRes.data || [];

      // ── Metrics ─────────────────────────────────────────
      const resolvedCount   = tickets.filter(t => t.status === 'resolved').length;
      const openCount       = tickets.filter(t => t.status !== 'resolved').length;
      const escalationCount = tickets.filter(t => t.status === 'escalated' || (t.priority === 'critical' && t.status !== 'resolved')).length;

      setMetrics({
        ticketsHandled: resolvedCount + openCount,
        leadsTotal:     leads.length,
        crmUpdates:     rookSyncs.length,
        tasksExecuted:  activityLogs.length,
        escalations:    Math.min(escalationCount, 99),
      });

      // ── Agent warnings ───────────────────────────────────
      const warnings: Record<string, string> = {};
      if (escalationCount > 0)    warnings['knight'] = `${escalationCount} escalation${escalationCount > 1 ? 's' : ''} open`;
      if (tickets.length > 15)    warnings['bishop'] = 'High volume today';
      setAgentWarnings(warnings);

      // ── Recent Activity ──────────────────────────────────
      const rows: ActivityRow[] = activityLogs.map(log => ({
        id:      log.id,
        time:    timeAgo(log.created_at),
        agent:   'Knight' as AgentName,
        action:  ACTION_LABEL[log.action_type] || log.action_type,
        outcome: OUTCOME_MAP[log.action_type] || 'pending',
      }));

      // Blend in Bishop lead activity
      leads.slice(0, 4).forEach((lead, i) => {
        const label = lead.bishop_status === 'INTRO_SENT'       ? 'Intro email sent'
                    : lead.bishop_status === 'FOLLOW_UP_NEEDED' ? 'Follow-up queued'
                    : lead.bishop_status === 'NUDGE_SENT'        ? 'Nudge email sent'
                    : lead.bishop_status === 'BREAKUP_SENT'      ? 'Break-up email sent'
                    : 'Lead added to pipeline';
        rows.splice(i * 2 + 1, 0, {
          id:      `lead-${lead.id}`,
          time:    timeAgo(lead.created_at),
          agent:   'Bishop',
          action:  `${lead.name || lead.email || 'Lead'} — ${label}`,
          outcome: lead.status === 'qualified' ? 'qualified' : lead.bishop_status === 'INTRO_SENT' ? 'sent' : 'pending',
        });
      });

      setActivity(rows.slice(0, 10));

      // ── Attention Required ───────────────────────────────
      const items: AttentionItem[] = [];

      escalated.slice(0, 2).forEach(t => {
        items.push({
          id:       t.id,
          title:    'Escalation Required',
          subtitle: t.summary || `Critical ticket from ${t.source_handle}`,
          severity: 'red',
          action:   'View Ticket',
          path:     '/knight',
        });
      });

      const nudge = leads.filter(l => l.bishop_status === 'NUDGE_SENT' || l.bishop_status === 'FOLLOW_UP_NEEDED').length;
      if (nudge > 0) {
        items.push({
          id:       'bishop-review',
          title:    'Draft Review Needed',
          subtitle: `${nudge} lead${nudge > 1 ? 's' : ''} awaiting follow-up approval`,
          severity: 'amber',
          action:   'Review Drafts',
          path:     '/bishop',
        });
      }

      if (tickets.length > 10) {
        items.push({
          id:       'ticket-spike',
          title:    'Ticket Volume Spike',
          subtitle: `${tickets.length} tickets today — above typical volume`,
          severity: 'blue',
          action:   'View Inbox',
          path:     '/knight',
        });
      }

      if (items.length === 0) {
        items.push({
          id:       'all-clear',
          title:    'All Systems Clear',
          subtitle: 'No escalations or urgent items right now.',
          severity: 'blue',
          action:   'View Knight',
          path:     '/knight',
        });
      }

      setAttention(items.slice(0, 3));
    } catch (err) {
      console.error('[Dashboard] Load error:', err);
    } finally {
      setLoading(false);
    }
  }

  // ─── Render ───────────────────────────────────────────────

  return (
    <MainLayout>
      <Header
        title="Overview"
        subtitle={`Good morning, ${userName} — here's what's happening today.`}
      />

      {/* Grain + cream background */}
      <div
        className="min-h-screen p-6 space-y-6"
        style={{
          background: '#FDFBF7',
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23grain)' opacity='0.03'/%3E%3C/svg%3E")`,
        }}
      >
        {/* ── Agent Status Row ─────────────────────────────── */}
        <section>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-3"
             style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Agent Status
          </p>
          <div className="grid grid-cols-5 gap-3">
            {AGENTS.map(agent => {
              const warning = agentWarnings[agent.id];
              return (
                <button
                  key={agent.id}
                  onClick={() => navigate(agent.path)}
                  className={cn(
                    'bg-white border rounded-xl p-4 text-left hover:shadow-md transition-all group relative overflow-hidden',
                    warning ? 'border-amber-300' : 'border-[#E7E5E4]',
                  )}
                >
                  {/* amber left accent for warnings */}
                  {warning && (
                    <div className="absolute left-0 inset-y-0 w-0.5 bg-amber-400 rounded-l-xl" />
                  )}
                  <div className="flex items-start justify-between mb-3">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center"
                      style={{ background: `${agent.color}18` }}
                    >
                      <agent.Icon className="w-4.5 h-4.5" style={{ color: agent.color, width: 18, height: 18 }} />
                    </div>
                    <span
                      className={cn(
                        'w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0',
                        warning ? 'bg-amber-400' : 'bg-emerald-400',
                      )}
                    />
                  </div>
                  <div
                    className="font-semibold text-[#1C1917] text-sm leading-tight"
                    style={{ fontFamily: 'Instrument Serif, serif' }}
                  >
                    {agent.name}
                  </div>
                  <div className="text-[11px] text-stone-400 mt-0.5">
                    {warning || agent.role}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* ── Today at a Glance ────────────────────────────── */}
        <section>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-3"
             style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Today at a Glance
          </p>
          <div className="grid grid-cols-5 gap-3">
            {[
              {
                label:     'Tickets Handled',
                value:     metrics.ticketsHandled,
                sub:       'By Knight today',
                Icon:      MessageSquare,
                iconColor: '#0ea5e9',
                highlight: false,
              },
              {
                label:     'Total Leads',
                value:     metrics.leadsTotal,
                sub:       'In pipeline',
                Icon:      Users,
                iconColor: '#8b5cf6',
                highlight: false,
              },
              {
                label:     'CRM Updates',
                value:     metrics.crmUpdates,
                sub:       'Synced by Rook',
                Icon:      RefreshCw,
                iconColor: '#10b981',
                highlight: false,
              },
              {
                label:     'Tasks Executed',
                value:     metrics.tasksExecuted,
                sub:       'All agents',
                Icon:      Zap,
                iconColor: '#f59e0b',
                highlight: false,
              },
              {
                label:     'Escalations',
                value:     metrics.escalations,
                sub:       'Need attention',
                Icon:      AlertTriangle,
                iconColor: '#CC5500',
                highlight: metrics.escalations > 0,
              },
            ].map(card => (
              <div
                key={card.label}
                className={cn(
                  'rounded-xl p-4 border transition-all',
                  card.highlight
                    ? 'bg-orange-50/40 border-[#CC5500]/30'
                    : 'bg-white border-[#E7E5E4]',
                )}
              >
                <div className="flex items-center justify-between mb-3">
                  <span
                    className="text-[11px] text-stone-400"
                    style={{ fontFamily: 'Space Grotesk, sans-serif' }}
                  >
                    {card.label}
                  </span>
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `${card.iconColor}18` }}
                  >
                    <card.Icon style={{ color: card.iconColor, width: 14, height: 14 }} />
                  </div>
                </div>
                <div
                  className="text-2xl font-bold leading-none"
                  style={{
                    fontFamily: 'Instrument Serif, serif',
                    color: card.highlight ? '#CC5500' : '#1C1917',
                  }}
                >
                  {loading ? '—' : card.value.toLocaleString()}
                </div>
                <div className="text-[11px] text-stone-400 mt-1">{card.sub}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Recent Activity + Attention Required ─────────── */}
        <section className="grid grid-cols-3 gap-4">

          {/* Recent Activity — 2 cols */}
          <div className="col-span-2 bg-white border border-[#E7E5E4] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E7E5E4] flex items-center justify-between">
              <h3
                className="font-semibold text-[#1C1917] text-sm"
                style={{ fontFamily: 'Instrument Serif, serif' }}
              >
                Recent Activity
              </h3>
              <button
                onClick={() => navigate('/knight')}
                className="text-[11px] text-stone-400 hover:text-[#CC5500] flex items-center gap-1 transition-colors"
              >
                View all <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {loading ? (
              <div className="p-8 text-center text-sm text-stone-400">Loading activity…</div>
            ) : activity.length === 0 ? (
              <div className="p-8 text-center text-sm text-stone-400">
                No activity recorded yet today.
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#E7E5E4] bg-stone-50/60">
                    {['Time', 'Agent', 'Action', 'Outcome'].map(h => (
                      <th
                        key={h}
                        className="px-5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-stone-400"
                        style={{ fontFamily: 'Space Grotesk, sans-serif' }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activity.map((row, i) => (
                    <tr
                      key={row.id}
                      className={cn(
                        'border-b border-[#E7E5E4] last:border-0',
                        i % 2 === 1 ? 'bg-stone-50/40' : '',
                      )}
                    >
                      <td className="px-5 py-3 text-xs text-stone-400 font-mono whitespace-nowrap">
                        {row.time}
                      </td>
                      <td className="px-5 py-3">
                        <span className="flex items-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ background: AGENT_COLOR[row.agent] }}
                          />
                          <span className="text-xs font-medium text-[#1C1917]">{row.agent}</span>
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-stone-500 max-w-[220px] truncate">
                        {row.action}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded-full text-[10px] font-medium capitalize',
                            OUTCOME_STYLE[row.outcome],
                          )}
                        >
                          {row.outcome}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Attention Required — 1 col */}
          <div className="bg-white border border-[#E7E5E4] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E7E5E4] flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#CC5500]" />
              <h3
                className="font-semibold text-[#1C1917] text-sm"
                style={{ fontFamily: 'Instrument Serif, serif' }}
              >
                Attention Required
              </h3>
            </div>
            <div className="p-4 space-y-3">
              {loading ? (
                <div className="py-6 text-center text-sm text-stone-400">Loading…</div>
              ) : (
                attention.map(item => (
                  <div
                    key={item.id}
                    className={cn(
                      'border-l-4 rounded-r-lg pl-4 pr-3 py-3',
                      SEVERITY_BORDER[item.severity],
                      SEVERITY_BG[item.severity],
                    )}
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <span
                        className={cn('w-2 h-2 rounded-full mt-0.5 flex-shrink-0', SEVERITY_DOT[item.severity])}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-semibold text-[#1C1917] leading-tight">
                          {item.title}
                        </div>
                        <div className="text-[10px] text-stone-500 mt-0.5 leading-snug">
                          {item.subtitle}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => navigate(item.path)}
                      className="text-[10px] font-semibold text-[#CC5500] hover:underline"
                    >
                      {item.action} →
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

        </section>
      </div>
    </MainLayout>
  );
}
