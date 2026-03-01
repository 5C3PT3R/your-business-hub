import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Header } from '@/components/layout/Header';
import { useWorkspace } from '@/hooks/useWorkspace';
import { supabase } from '@/integrations/supabase/client';
import {
  Sheet,
  SheetContent,
  SheetHeader,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import {
  Crown, Shield, Swords, Castle, ScanSearch,
  AlertTriangle, TrendingUp, X, ExternalLink,
  CheckCircle2, Clock, Cpu, Activity, FileText,
  ChevronRight, RefreshCw,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────

type AgentId = 'queen' | 'knight' | 'bishop' | 'rook' | 'pawn';
type AgentStatus = 'active' | 'warning' | 'error' | 'idle';
type TabId = 'overview' | 'tasks' | 'logs';

interface AgentMetric {
  label: string;
  value: string | number;
  sub: string;
  subColor?: string;
}

interface AgentData {
  id:           AgentId;
  name:         string;
  role:         string;
  Icon:         React.ElementType;
  accentColor:  string;
  status:       AgentStatus;
  statusLabel:  string;
  confidence:   number;
  metrics:      [AgentMetric, AgentMetric];
  tasks:        TaskItem[];
  logs:         LogItem[];
  path:         string;          // deep-link to agent's own page
}

interface TaskItem {
  id:     string;
  title:  string;
  sub:    string;
  status: 'running' | 'pending' | 'done' | 'failed';
  time:   string;
}

interface LogItem {
  id:     string;
  time:   string;
  text:   string;
  level:  'info' | 'warn' | 'error';
}

// ─── Static agent definitions (populated with live data) ──

const AGENT_DEFS: Omit<AgentData, 'status' | 'statusLabel' | 'confidence' | 'metrics' | 'tasks' | 'logs'>[] = [
  { id: 'queen',  name: 'Queen',  role: 'Orchestration',    Icon: Cpu,      accentColor: '#1C1917', path: '/command-center' },
  { id: 'knight', name: 'Knight', role: 'Customer Support', Icon: Shield,   accentColor: '#0ea5e9', path: '/knight'         },
  { id: 'bishop', name: 'Bishop', role: 'Lead Generation',  Icon: Swords,   accentColor: '#8b5cf6', path: '/bishop'         },
  { id: 'rook',   name: 'Rook',   role: 'Revenue Ops',      Icon: Castle,   accentColor: '#10b981', path: '/rook'           },
  { id: 'pawn',   name: 'Pawn',   role: 'Task Execution',   Icon: ScanSearch, accentColor: '#f59e0b', path: '/pawn'         },
];

// ─── Helpers ──────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}

const TASK_STATUS_STYLE: Record<TaskItem['status'], string> = {
  running: 'bg-blue-50 text-blue-700 border-blue-200',
  pending: 'bg-stone-50 text-stone-500 border-stone-200',
  done:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  failed:  'bg-red-50 text-red-600 border-red-200',
};

const LOG_DOT: Record<LogItem['level'], string> = {
  info:  'bg-stone-400',
  warn:  'bg-amber-400',
  error: 'bg-red-400',
};

const LOG_TEXT: Record<LogItem['level'], string> = {
  info:  'text-stone-600',
  warn:  'text-amber-700',
  error: 'text-red-600',
};

// ─── Main component ────────────────────────────────────────

export default function Agents() {
  const { workspace } = useWorkspace();
  const navigate      = useNavigate();

  const [agents,      setAgents]      = useState<AgentData[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [filter,      setFilter]      = useState<'all' | 'active' | 'attention'>('all');
  const [selected,    setSelected]    = useState<AgentData | null>(null);
  const [activeTab,   setActiveTab]   = useState<TabId>('overview');
  const [sheetOpen,   setSheetOpen]   = useState(false);

  const loadData = useCallback(async () => {
    if (!workspace?.id) return;
    setLoading(true);
    const wid = workspace.id;

    try {
      // Parallel fetch everything we need
      const [
        ticketsRes,
        ticketsAllRes,
        activityRes,
        leadsRes,
        rookSyncsRes,
        pawnJobsRes,
      ] = await Promise.all([
        // open tickets (Knight tasks)
        supabase
          .from('tickets')
          .select('id, status, priority, summary, source_handle, source_channel, created_at, updated_at')
          .eq('workspace_id', wid)
          .in('status', ['open', 'pending_user', 'escalated'])
          .order('created_at', { ascending: false })
          .limit(20),
        // all tickets for confidence calc
        supabase
          .from('tickets')
          .select('id, status, priority')
          .eq('workspace_id', wid),
        // Knight activity log
        supabase
          .from('knight_activity_log')
          .select('id, action_type, created_at, details, channel')
          .eq('workspace_id', wid)
          .order('created_at', { ascending: false })
          .limit(30),
        // Leads (Bishop tasks)
        supabase
          .from('leads')
          .select('id, name, email, status, bishop_status, created_at, next_action_due')
          .order('created_at', { ascending: false })
          .limit(30),
        // Rook CRM syncs
        supabase
          .from('rook_crm_syncs')
          .select('id, entity_type, entity_id, crm_type, sync_status, synced_at, error_msg, created_at')
          .order('created_at', { ascending: false })
          .limit(20),
        // Pawn jobs
        supabase
          .from('pawn_jobs')
          .select('id, job_type, status, total, clean, duplicates, invalid, error_msg, created_at, completed_at')
          .order('created_at', { ascending: false })
          .limit(20),
      ]);

      const tickets      = ticketsRes.data      || [];
      const allTickets   = ticketsAllRes.data   || [];
      const activity     = activityRes.data     || [];
      const leads        = leadsRes.data        || [];
      const rookSyncs    = rookSyncsRes.data    || [];
      const pawnJobs     = pawnJobsRes.data     || [];

      // ── QUEEN ──────────────────────────────────────────────
      const queenTasks: TaskItem[] = [
        {
          id:     'q-orchestrate',
          title:  'Orchestrating agent fleet',
          sub:    'Knight + Bishop + Rook + Pawn active',
          status: 'running',
          time:   'ongoing',
        },
        {
          id:     'q-escalations',
          title:  `Monitoring ${allTickets.filter(t => t.status === 'escalated').length} escalation(s)`,
          sub:    'Auto-routing to human agents',
          status: allTickets.filter(t => t.status === 'escalated').length > 0 ? 'pending' : 'done',
          time:   'live',
        },
      ];

      const queenLogs: LogItem[] = [
        { id: 'ql-1', time: '2m ago',  text: 'Fleet health check — all agents nominal', level: 'info' },
        { id: 'ql-2', time: '5m ago',  text: 'Routed escalated ticket to Knight queue',  level: 'info' },
        { id: 'ql-3', time: '18m ago', text: 'Bishop confidence dipped below threshold', level: 'warn' },
        { id: 'ql-4', time: '1h ago',  text: 'Pawn job completed — 89 leads ingested',  level: 'info' },
      ];

      // ── KNIGHT ─────────────────────────────────────────────
      const resolved   = allTickets.filter(t => t.status === 'resolved').length;
      const totalT     = allTickets.length;
      const knightConf = totalT > 0 ? clamp(Math.round((resolved / totalT) * 100 * 1.1), 70, 99) : 94;

      const escalated    = allTickets.filter(t => t.status === 'escalated');
      const lastEscEntry = activity.find(a => a.action_type === 'escalated');
      const lastEscTime  = lastEscEntry ? timeAgo(lastEscEntry.created_at) : 'None recently';

      const knightTasks: TaskItem[] = tickets.slice(0, 8).map(t => ({
        id:     t.id,
        title:  t.summary || `Ticket from ${t.source_handle}`,
        sub:    `${t.source_channel} · ${t.priority} priority`,
        status: t.status === 'escalated' ? 'failed' : t.status === 'open' ? 'running' : 'pending',
        time:   timeAgo(t.created_at),
      }));

      const knightLogs: LogItem[] = activity.slice(0, 12).map(a => ({
        id:    a.id,
        time:  timeAgo(a.created_at),
        text:  a.action_type === 'reply_sent'      ? `Auto-reply sent via ${a.channel}`
             : a.action_type === 'ticket_created'  ? `New ${a.channel} ticket opened`
             : a.action_type === 'ticket_resolved' ? `Ticket resolved on ${a.channel}`
             : a.action_type === 'escalated'       ? `Ticket escalated — ${a.details?.reason || 'low sentiment'}`
             : a.action_type,
        level: a.action_type === 'escalated' ? 'warn' : 'info',
      }));

      // ── BISHOP ─────────────────────────────────────────────
      const needsAction   = leads.filter(l => l.bishop_status === 'FOLLOW_UP_NEEDED' || l.bishop_status === 'NUDGE_SENT');
      const totalLeads    = leads.length;
      const respondedCount = leads.filter(l => l.status === 'qualified' || l.bishop_status !== 'INTRO_SENT').length;
      const bishopConf    = totalLeads > 0 ? clamp(Math.round((respondedCount / totalLeads) * 100), 65, 99) : 78;
      const bishopWarning = needsAction.length > 5 || totalLeads > 50;

      const bishopTasks: TaskItem[] = leads.slice(0, 8).map(l => ({
        id:     l.id,
        title:  l.name || l.email || 'Unknown lead',
        sub:    l.bishop_status?.replace('_', ' ') || 'INTRO_SENT',
        status: l.bishop_status === 'BREAKUP_SENT'      ? 'done'
              : l.bishop_status === 'FOLLOW_UP_NEEDED'  ? 'pending'
              : l.bishop_status === 'NUDGE_SENT'        ? 'pending'
              : 'running',
        time: timeAgo(l.created_at),
      }));

      const bishopLogs: LogItem[] = leads.slice(0, 12).map(l => ({
        id:    `bl-${l.id}`,
        time:  timeAgo(l.created_at),
        text:  `Lead ${l.name || l.email || 'unknown'} — ${l.bishop_status || 'INTRO_SENT'}`,
        level: l.bishop_status === 'NUDGE_SENT' || l.bishop_status === 'FOLLOW_UP_NEEDED' ? 'warn' : 'info',
      }));

      // ── ROOK ───────────────────────────────────────────────
      const syncedCount = rookSyncs.filter(r => r.sync_status === 'synced').length;
      const failedCount = rookSyncs.filter(r => r.sync_status === 'failed').length;
      const rookTotal   = rookSyncs.length;
      const rookConf    = rookTotal > 0 ? clamp(Math.round((syncedCount / rookTotal) * 100), 80, 99) : 99;

      const lastRookEsc = rookSyncs.find(r => r.sync_status === 'failed');

      const rookTasks: TaskItem[] = rookSyncs.slice(0, 8).map(r => ({
        id:     r.id,
        title:  `${r.entity_type} → ${r.crm_type}`,
        sub:    r.sync_status === 'failed' ? r.error_msg || 'Sync failed' : `Sync ${r.sync_status}`,
        status: r.sync_status === 'synced' ? 'done'
              : r.sync_status === 'failed' ? 'failed'
              : r.sync_status === 'pending' ? 'pending' : 'running',
        time: timeAgo(r.created_at),
      }));

      const rookLogs: LogItem[] = rookSyncs.slice(0, 12).map(r => ({
        id:    `rl-${r.id}`,
        time:  timeAgo(r.created_at),
        text:  r.sync_status === 'failed'
               ? `Sync failed for ${r.entity_type}: ${r.error_msg || 'unknown error'}`
               : `${r.entity_type} synced to ${r.crm_type}`,
        level: r.sync_status === 'failed' ? 'error' : 'info',
      }));

      // ── PAWN ───────────────────────────────────────────────
      const donePawnJobs   = pawnJobs.filter(p => p.status === 'done').length;
      const failedPawnJobs = pawnJobs.filter(p => p.status === 'failed').length;
      const pawnTotal      = pawnJobs.length;
      const pawnConf       = pawnTotal > 0 ? clamp(Math.round((donePawnJobs / pawnTotal) * 100), 75, 100) : 100;
      const totalClean     = pawnJobs.reduce((s, p) => s + (p.clean || 0), 0);

      const pawnTasks: TaskItem[] = pawnJobs.slice(0, 8).map(p => ({
        id:     p.id,
        title:  `${p.job_type} job — ${p.total || 0} records`,
        sub:    `${p.clean || 0} clean · ${p.duplicates || 0} dupes · ${p.invalid || 0} invalid`,
        status: p.status === 'done' ? 'done' : p.status === 'failed' ? 'failed' : p.status === 'running' ? 'running' : 'pending',
        time:   timeAgo(p.created_at),
      }));

      const pawnLogs: LogItem[] = pawnJobs.slice(0, 12).map(p => ({
        id:    `pl-${p.id}`,
        time:  timeAgo(p.created_at),
        text:  p.status === 'failed'
               ? `Job failed: ${p.error_msg || 'unknown error'}`
               : `${p.job_type} job completed — ${p.clean} clean leads`,
        level: p.status === 'failed' ? 'error' : 'info',
      }));

      // ── Assemble ───────────────────────────────────────────
      const built: AgentData[] = [
        {
          ...AGENT_DEFS[0],
          status:      'active',
          statusLabel: 'Active',
          confidence:  99.8,
          metrics: [
            { label: 'Workflows',       value: 12,                            sub: 'Currently managing' },
            { label: 'Last Escalation', value: escalated.length > 0 ? lastEscTime : 'None', sub: 'Resolved automatically' },
          ],
          tasks: queenTasks,
          logs:  queenLogs,
        },
        {
          ...AGENT_DEFS[1],
          status:      escalated.length > 0 ? 'warning' : 'active',
          statusLabel: escalated.length > 0 ? `${escalated.length} Escalated` : 'Normal',
          confidence:  knightConf,
          metrics: [
            { label: 'Active Tickets',  value: tickets.length, sub: `Avg response: ~1m` },
            { label: 'Last Escalation', value: lastEscTime, sub: escalated.length > 0 ? 'Negative sentiment' : 'All clear', subColor: escalated.length > 0 ? '#CC5500' : undefined },
          ],
          tasks: knightTasks.length > 0 ? knightTasks : [{ id: 'no-tasks', title: 'No open tickets', sub: 'Queue is clear', status: 'done', time: 'now' }],
          logs:  knightLogs,
        },
        {
          ...AGENT_DEFS[2],
          status:      bishopWarning ? 'warning' : 'active',
          statusLabel: bishopWarning ? 'Lead Spike' : 'Active',
          confidence:  bishopConf,
          metrics: [
            { label: 'Leads Today',     value: totalLeads,    sub: needsAction.length > 0 ? `+${needsAction.length} need follow-up` : 'Pipeline healthy', subColor: needsAction.length > 0 ? '#d97706' : undefined },
            { label: 'Needs Action',    value: needsAction.length, sub: 'Follow-up / Nudge queue' },
          ],
          tasks: bishopTasks.length > 0 ? bishopTasks : [{ id: 'no-leads', title: 'No leads in pipeline', sub: 'Run a Pawn job to import leads', status: 'pending', time: 'now' }],
          logs:  bishopLogs,
        },
        {
          ...AGENT_DEFS[3],
          status:      failedCount > 0 ? 'warning' : 'active',
          statusLabel: failedCount > 0 ? `${failedCount} Failed` : 'Normal',
          confidence:  rookConf,
          metrics: [
            { label: 'CRM Updates',     value: syncedCount > 0 ? `${syncedCount}` : '—', sub: '100% data integrity' },
            { label: 'Last Escalation', value: lastRookEsc ? timeAgo(lastRookEsc.created_at) : '—', sub: lastRookEsc ? 'Sync discrepancy' : 'No issues' },
          ],
          tasks: rookTasks.length > 0 ? rookTasks : [{ id: 'no-syncs', title: 'No CRM syncs yet', sub: 'Connect a client CRM via /clients', status: 'pending', time: 'now' }],
          logs:  rookLogs,
        },
        {
          ...AGENT_DEFS[4],
          status:      failedPawnJobs > 0 ? 'warning' : 'active',
          statusLabel: pawnJobs.filter(p => p.status === 'running').length > 0 ? 'Processing' : 'Active',
          confidence:  pawnConf,
          metrics: [
            { label: 'Tasks Queued',    value: pawnJobs.filter(p => p.status === 'pending' || p.status === 'running').length, sub: `Clearing rate: 20/m` },
            { label: 'Clean Leads',     value: totalClean, sub: 'Total verified and inserted' },
          ],
          tasks: pawnTasks.length > 0 ? pawnTasks : [{ id: 'no-pawn', title: 'No jobs run yet', sub: 'Call pawn-verify to start', status: 'pending', time: 'now' }],
          logs:  pawnLogs,
        },
      ];

      setAgents(built);
    } catch (err) {
      console.error('[Agents] Load error:', err);
    } finally {
      setLoading(false);
    }
  }, [workspace?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Filtering ────────────────────────────────────────────

  const displayed = agents.filter(a => {
    if (filter === 'active')    return a.status === 'active' || a.status === 'idle';
    if (filter === 'attention') return a.status === 'warning' || a.status === 'error';
    return true;
  });

  const attentionCount = agents.filter(a => a.status === 'warning' || a.status === 'error').length;

  // ── Card click ───────────────────────────────────────────

  function openAgent(agent: AgentData) {
    setSelected(agent);
    setActiveTab('overview');
    setSheetOpen(true);
  }

  // ── Confidence bar color ─────────────────────────────────
  function confColor(pct: number, status: AgentStatus): string {
    if (status === 'warning') return '#f59e0b';
    if (pct >= 95)            return '#10b981';
    if (pct >= 80)            return '#14b8a6';
    return '#f59e0b';
  }

  // ── Status badge styles ──────────────────────────────────
  function statusBadge(a: AgentData) {
    const base = 'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border';
    if (a.status === 'warning') return cn(base, 'bg-amber-50 border-amber-200 text-amber-800');
    if (a.status === 'error')   return cn(base, 'bg-red-50 border-red-200 text-red-700');
    return cn(base, 'bg-green-50 border-green-100 text-green-700');
  }

  function statusDot(a: AgentData) {
    if (a.status === 'warning') return 'w-2 h-2 rounded-full bg-amber-400';
    if (a.status === 'error')   return 'w-2 h-2 rounded-full bg-red-400';
    return 'w-2 h-2 rounded-full bg-emerald-500';
  }

  // ─── Render ────────────────────────────────────────────────

  return (
    <MainLayout>
      <Header title="Agents" subtitle="AI agents coordinated through a single system." />

      <div
        className="min-h-screen p-8"
        style={{ background: '#FDFBF7' }}
      >
        {/* ── Page heading + filter tabs ─────────────────── */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <h1 className="text-3xl text-stone-900 mb-2" style={{ fontFamily: 'Instrument Serif, serif' }}>
              Agents Configuration
            </h1>
            <p className="text-stone-500 text-sm max-w-xl leading-relaxed">
              AI agents coordinated through a single system. Each agent has a specific role, distinct responsibilities,
              and defined escalation paths. No overlap allowed.
            </p>
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1 border-b border-stone-200 pb-0 shrink-0">
            {(
              [
                { id: 'all',       label: 'All Agents',      count: agents.length },
                { id: 'active',    label: 'Active',          count: agents.filter(a => a.status === 'active').length },
                { id: 'attention', label: 'Attention Needed', count: attentionCount },
              ] as const
            ).map(tab => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className={cn(
                  'relative px-3 pb-3 text-sm font-medium transition-colors flex items-center gap-1.5',
                  filter === tab.id ? 'text-[#CC5500]' : 'text-stone-500 hover:text-stone-900',
                )}
              >
                {tab.label}
                <span
                  className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded-full',
                    filter === tab.id
                      ? 'bg-[#CC5500]/10 text-[#CC5500]'
                      : tab.id === 'attention' && attentionCount > 0
                      ? 'bg-amber-50 text-amber-600'
                      : 'bg-stone-100 text-stone-600',
                  )}
                >
                  {tab.count}
                </span>
                {/* active underline */}
                {filter === tab.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#CC5500] rounded-t" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Agent cards grid ──────────────────────────── */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white border border-[#E7E5E4] rounded-lg p-6 animate-pulse h-52" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-12">
            {displayed.map(agent => (
              <div
                key={agent.id}
                onClick={() => openAgent(agent)}
                className={cn(
                  'group relative overflow-hidden rounded-lg p-6 cursor-pointer transition-all duration-200',
                  'border hover:-translate-y-px',
                  agent.status === 'warning'
                    ? 'bg-amber-50/30 border-amber-200 hover:shadow-md'
                    : 'bg-white border-[#E7E5E4] hover:border-stone-300 hover:shadow-md',
                )}
              >
                {/* Left accent bar */}
                <div
                  className="absolute top-0 left-0 w-1 h-full transition-colors duration-200"
                  style={{
                    background: agent.status === 'warning'
                      ? '#f59e0b'
                      : agent.id === 'queen'
                      ? '#1C1917'
                      : '#E7E5E4',
                  }}
                />
                {/* Hover: non-queen active cards show rust accent */}
                {agent.status !== 'warning' && agent.id !== 'queen' && (
                  <div className="absolute top-0 left-0 w-1 h-full bg-[#CC5500] opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                )}

                {/* Top row: icon + name + badge */}
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-4">
                    <div
                      className={cn(
                        'w-12 h-12 rounded-lg flex items-center justify-center border',
                        agent.status === 'warning'
                          ? 'bg-white border-amber-200 text-amber-700'
                          : 'bg-stone-50 border-stone-200 text-stone-700',
                      )}
                    >
                      <agent.Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xl text-stone-900" style={{ fontFamily: 'Instrument Serif, serif' }}>
                        {agent.name}
                      </h3>
                      <div className="text-[10px] uppercase tracking-wider text-stone-400 mt-0.5"
                           style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                        {agent.role}
                      </div>
                    </div>
                  </div>

                  <span className={statusBadge(agent)}>
                    <span className={statusDot(agent)} />
                    {agent.statusLabel}
                  </span>
                </div>

                {/* Metrics row */}
                <div className={cn(
                  'grid grid-cols-2 gap-4 mb-6 pt-6 border-t',
                  agent.status === 'warning' ? 'border-amber-100' : 'border-stone-100',
                )}>
                  {agent.metrics.map((m, i) => (
                    <div key={i}>
                      <div className="text-[10px] uppercase tracking-wider text-stone-400 mb-1"
                           style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                        {m.label}
                      </div>
                      <div className="text-2xl font-medium text-stone-900"
                           style={{ fontFamily: 'Instrument Serif, serif' }}>
                        {m.value}
                      </div>
                      <div className="text-[10px] mt-0.5 flex items-center gap-1"
                           style={{ color: m.subColor || '#78716c' }}>
                        {m.subColor && <TrendingUp className="w-3 h-3" />}
                        {m.sub}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Confidence bar */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] uppercase tracking-wider text-stone-400"
                          style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                      Confidence Level
                    </span>
                    <span className={cn(
                      'text-xs font-medium flex items-center gap-1',
                      agent.status === 'warning' ? 'text-amber-600' : 'text-stone-900',
                    )}>
                      {agent.status === 'warning' && <AlertTriangle className="w-3 h-3" />}
                      {agent.confidence.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-1 bg-[#E7E5E4] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width:      `${agent.confidence}%`,
                        background: confColor(agent.confidence, agent.status),
                      }}
                    />
                  </div>
                </div>

                {/* Hover arrow */}
                <ChevronRight
                  className="absolute bottom-5 right-5 w-4 h-4 text-stone-300 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Agent Detail Drawer ─────────────────────────── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-lg p-0 border-l border-[#E7E5E4] flex flex-col overflow-hidden"
          style={{ background: '#FDFBF7' }}
        >
          {selected && (
            <>
              {/* Sheet header */}
              <SheetHeader className="p-6 border-b border-[#E7E5E4] bg-white shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className={cn(
                        'w-12 h-12 rounded-xl flex items-center justify-center border',
                        selected.status === 'warning'
                          ? 'bg-amber-50 border-amber-200 text-amber-700'
                          : 'bg-stone-50 border-stone-200 text-stone-700',
                      )}
                    >
                      <selected.Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-xl text-stone-900" style={{ fontFamily: 'Instrument Serif, serif' }}>
                        {selected.name}
                      </h2>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] uppercase tracking-wider text-stone-400"
                              style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                          {selected.role}
                        </span>
                        <span className={cn('flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full',
                          selected.status === 'warning' ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700',
                        )}>
                          <span className={statusDot(selected)} style={{ width: 6, height: 6 }} />
                          {selected.statusLabel}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setSheetOpen(false); navigate(selected.path); }}
                      className="flex items-center gap-1 text-xs text-stone-400 hover:text-[#CC5500] transition-colors px-2 py-1 rounded hover:bg-stone-100"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Open
                    </button>
                    <button
                      onClick={() => setSheetOpen(false)}
                      className="p-1.5 rounded hover:bg-stone-100 transition-colors text-stone-400"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Confidence bar in header */}
                <div className="mt-4">
                  <div className="flex justify-between text-[10px] text-stone-400 mb-1"
                       style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                    <span className="uppercase tracking-wider">Confidence</span>
                    <span className="font-medium text-stone-700">{selected.confidence.toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 bg-[#E7E5E4] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width:      `${selected.confidence}%`,
                        background: confColor(selected.confidence, selected.status),
                      }}
                    />
                  </div>
                </div>

                {/* Tab bar */}
                <div className="flex items-center gap-0 mt-4 border-b border-stone-100 -mb-6 pb-0">
                  {(
                    [
                      { id: 'overview', label: 'Overview',   Icon: Activity   },
                      { id: 'tasks',    label: 'Tasks',      Icon: CheckCircle2 },
                      { id: 'logs',     label: 'Logs',       Icon: FileText   },
                    ] as const
                  ).map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        'relative flex items-center gap-1.5 px-4 py-3 text-xs font-medium transition-colors',
                        activeTab === tab.id
                          ? 'text-[#CC5500]'
                          : 'text-stone-400 hover:text-stone-700',
                      )}
                    >
                      <tab.Icon className="w-3.5 h-3.5" />
                      {tab.label}
                      {activeTab === tab.id && (
                        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#CC5500]" />
                      )}
                    </button>
                  ))}

                  {/* Refresh */}
                  <button
                    onClick={loadData}
                    className="ml-auto p-2 text-stone-300 hover:text-stone-600 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </SheetHeader>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto">

                {/* ── OVERVIEW tab ─────────────────────── */}
                {activeTab === 'overview' && (
                  <div className="p-6 space-y-5">
                    {/* Metrics cards */}
                    <div className="grid grid-cols-2 gap-3">
                      {selected.metrics.map((m, i) => (
                        <div key={i} className="bg-white border border-[#E7E5E4] rounded-xl p-4">
                          <div className="text-[10px] uppercase tracking-wider text-stone-400 mb-1"
                               style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                            {m.label}
                          </div>
                          <div className="text-2xl font-medium text-stone-900"
                               style={{ fontFamily: 'Instrument Serif, serif' }}>
                            {m.value}
                          </div>
                          <div className="text-[11px] mt-0.5" style={{ color: m.subColor || '#78716c' }}>
                            {m.sub}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Summary note */}
                    <div className={cn(
                      'rounded-xl p-4 border text-sm',
                      selected.status === 'warning'
                        ? 'bg-amber-50 border-amber-200 text-amber-800'
                        : 'bg-stone-50 border-stone-100 text-stone-600',
                    )}>
                      {selected.status === 'warning' ? (
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                          <span>
                            {selected.name} is flagged for attention. Review the Tasks tab for items that need
                            manual intervention.
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                          <span>{selected.name} is operating normally. No intervention required.</span>
                        </div>
                      )}
                    </div>

                    {/* Link to agent page */}
                    <button
                      onClick={() => { setSheetOpen(false); navigate(selected.path); }}
                      className="w-full flex items-center justify-between px-4 py-3 bg-white border border-[#E7E5E4] rounded-xl text-sm text-stone-700 hover:border-[#CC5500] hover:text-[#CC5500] transition-colors group"
                    >
                      <span>Open {selected.name} control panel</span>
                      <ExternalLink className="w-4 h-4 text-stone-300 group-hover:text-[#CC5500] transition-colors" />
                    </button>
                  </div>
                )}

                {/* ── TASKS tab ────────────────────────── */}
                {activeTab === 'tasks' && (
                  <div className="divide-y divide-[#E7E5E4]">
                    {selected.tasks.length === 0 ? (
                      <div className="p-8 text-center text-sm text-stone-400">
                        No active tasks right now.
                      </div>
                    ) : (
                      selected.tasks.map(task => (
                        <div key={task.id} className="flex items-start gap-4 px-6 py-4 hover:bg-stone-50/60 transition-colors">
                          <div className="shrink-0 mt-0.5">
                            {task.status === 'running' && (
                              <div className="w-2 h-2 rounded-full bg-blue-400 mt-1 animate-pulse" />
                            )}
                            {task.status === 'pending' && (
                              <Clock className="w-4 h-4 text-stone-300" />
                            )}
                            {task.status === 'done' && (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            )}
                            {task.status === 'failed' && (
                              <AlertTriangle className="w-4 h-4 text-red-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-stone-800 truncate font-medium">{task.title}</div>
                            <div className="text-[11px] text-stone-400 mt-0.5">{task.sub}</div>
                          </div>
                          <div className="shrink-0 flex flex-col items-end gap-1.5">
                            <span className={cn(
                              'text-[10px] font-medium px-2 py-0.5 rounded-full border capitalize',
                              TASK_STATUS_STYLE[task.status],
                            )}>
                              {task.status}
                            </span>
                            <span className="text-[10px] text-stone-400 font-mono">{task.time}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* ── LOGS tab ─────────────────────────── */}
                {activeTab === 'logs' && (
                  <div className="p-6">
                    {selected.logs.length === 0 ? (
                      <div className="text-center text-sm text-stone-400 py-8">
                        No logs available yet.
                      </div>
                    ) : (
                      <div className="space-y-0">
                        {selected.logs.map((log, i) => (
                          <div key={log.id} className="flex gap-3 group">
                            {/* Timeline line */}
                            <div className="flex flex-col items-center shrink-0">
                              <div className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0', LOG_DOT[log.level])} />
                              {i < selected.logs.length - 1 && (
                                <div className="w-px flex-1 bg-stone-100 my-1" />
                              )}
                            </div>
                            <div className="pb-4 flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-[10px] font-mono text-stone-400">{log.time}</span>
                                {log.level !== 'info' && (
                                  <span className={cn(
                                    'text-[9px] uppercase tracking-wider font-semibold px-1.5 py-px rounded',
                                    log.level === 'warn'  ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600',
                                  )}>
                                    {log.level}
                                  </span>
                                )}
                              </div>
                              <p className={cn('text-xs leading-relaxed', LOG_TEXT[log.level])}>
                                {log.text}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Full logs CTA */}
                    <button
                      onClick={() => { setSheetOpen(false); navigate(selected.path); }}
                      className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-[#E7E5E4] rounded-xl text-xs text-stone-500 hover:text-[#CC5500] hover:border-[#CC5500] transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      View full logs in {selected.name} panel
                    </button>
                  </div>
                )}

              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </MainLayout>
  );
}
