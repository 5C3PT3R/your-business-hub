import { useState, useEffect, useCallback, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Header } from '@/components/layout/Header';
import { useWorkspace } from '@/hooks/useWorkspace';
import { supabase } from '@/integrations/supabase/client';
import {
  Search, Calendar, Shield, Cpu, Swords, Castle,
  ScanSearch, ChevronDown, RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────

type AgentName = 'Queen' | 'Knight' | 'Bishop' | 'Rook' | 'Pawn';
type OutcomeKey =
  | 'Success' | 'Handed Off' | 'Human Review' | 'Completed'
  | 'Queued'  | 'Synced'     | 'Flagged'      | 'Failed'
  | 'Resolved' | 'Sent';

interface ActivityEvent {
  id:          string;
  timestamp:   string;       // ISO
  agent:       AgentName;
  description: string;
  workflow:    string;
  outcome:     OutcomeKey;
  escalated:   boolean;
}

// ─── Agent styling ────────────────────────────────────────

const AGENT_STYLE: Record<AgentName, { bg: string; text: string; Icon: React.ElementType }> = {
  Queen:  { bg: 'bg-purple-100', text: 'text-purple-600', Icon: Cpu       },
  Knight: { bg: 'bg-blue-100',   text: 'text-blue-600',   Icon: Shield    },
  Bishop: { bg: 'bg-teal-100',   text: 'text-teal-600',   Icon: Swords    },
  Rook:   { bg: 'bg-amber-100',  text: 'text-amber-600',  Icon: Castle    },
  Pawn:   { bg: 'bg-stone-100',  text: 'text-stone-600',  Icon: ScanSearch },
};

// ─── Outcome badge styling ────────────────────────────────

const OUTCOME_STYLE: Record<OutcomeKey, string> = {
  Success:      'bg-emerald-50 text-emerald-700 border-emerald-200',
  Resolved:     'bg-emerald-50 text-emerald-700 border-emerald-200',
  Synced:       'bg-emerald-50 text-emerald-700 border-emerald-200',
  Queued:       'bg-emerald-50 text-emerald-600 border-emerald-200',
  Completed:    'bg-stone-100 text-stone-600 border-stone-200',
  'Handed Off': 'bg-blue-50 text-blue-700 border-blue-200',
  Sent:         'bg-blue-50 text-blue-700 border-blue-200',
  'Human Review': 'bg-orange-50 text-[#CC5500] border-orange-200',
  Flagged:      'bg-orange-50 text-[#CC5500] border-orange-200',
  Failed:       'bg-red-50 text-red-600 border-red-200',
};

// ─── Helpers ──────────────────────────────────────────────

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const diff  = Math.floor((today.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const DATE_RANGES = [
  { id: '1h',  label: 'Last Hour'    },
  { id: '24h', label: 'Last 24 Hours' },
  { id: '7d',  label: 'Last 7 Days'  },
  { id: 'all', label: 'All Time'     },
] as const;
type DateRange = typeof DATE_RANGES[number]['id'];

function cutoffFor(range: DateRange): Date | null {
  const now = new Date();
  if (range === '1h')  return new Date(now.getTime() - 3600_000);
  if (range === '24h') return new Date(now.getTime() - 86400_000);
  if (range === '7d')  return new Date(now.getTime() - 7 * 86400_000);
  return null;
}

// ─── Main component ────────────────────────────────────────

export default function Activity() {
  const { workspace } = useWorkspace();

  const [events,  setEvents]  = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search,      setSearch]      = useState('');
  const [agentFilter, setAgentFilter] = useState<AgentName | 'All'>('All');
  const [dateRange,   setDateRange]   = useState<DateRange>('24h');
  const [escOnly,     setEscOnly]     = useState(false);
  const [dateOpen,    setDateOpen]    = useState(false);

  const loadData = useCallback(async () => {
    if (!workspace?.id) return;
    setLoading(true);

    const cutoff = cutoffFor(dateRange);
    const cutoffIso = cutoff?.toISOString();

    try {
      const [activityRes, leadsRes, rookRes, pawnRes] = await Promise.all([
        supabase
          .from('knight_activity_log')
          .select('id, action_type, created_at, details, channel, ticket_id')
          .eq('workspace_id', workspace.id)
          .order('created_at', { ascending: false })
          .limit(200),
        supabase
          .from('leads')
          .select('id, name, email, bishop_status, status, created_at')
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('rook_crm_syncs')
          .select('id, entity_type, entity_id, crm_type, sync_status, error_msg, created_at')
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('pawn_jobs')
          .select('id, job_type, status, total, clean, created_at')
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      const all: ActivityEvent[] = [];

      // ── Knight / Queen events ───────────────────────────
      const ACTION_DESC: Record<string, (d: any) => string> = {
        reply_sent:         d => `Auto-reply sent via ${d?.channel || 'WhatsApp'}`,
        escalated:          d => `Ticket escalated — ${d?.reason || 'sentiment risk'}`,
        ticket_created:     d => `New ${d?.channel || ''} ticket opened`,
        ticket_resolved:    d => `Ticket resolved ${d?.resolution_note ? `(${d.resolution_note})` : 'automatically'}`,
        sentiment_analyzed: () => `Sentiment analysis complete`,
        voice_call:         () => `Voice call initiated`,
      };
      const ACTION_WORKFLOW: Record<string, string> = {
        reply_sent:         'Support Triage',
        escalated:          'Escalation Routing',
        ticket_created:     'Support Triage',
        ticket_resolved:    'Support Triage',
        sentiment_analyzed: 'Sentiment Analysis',
        voice_call:         'Support Triage',
      };
      const ACTION_OUTCOME: Record<string, OutcomeKey> = {
        reply_sent:         'Sent',
        escalated:          'Human Review',
        ticket_created:     'Queued',
        ticket_resolved:    'Resolved',
        sentiment_analyzed: 'Completed',
        voice_call:         'Sent',
      };

      for (const log of activityRes.data || []) {
        const isEscalation = log.action_type === 'escalated';
        all.push({
          id:          log.id,
          timestamp:   log.created_at,
          agent:       'Knight',
          description: (ACTION_DESC[log.action_type] || (d => log.action_type))(log.details),
          workflow:    ACTION_WORKFLOW[log.action_type] || 'Support Triage',
          outcome:     ACTION_OUTCOME[log.action_type] || 'Completed',
          escalated:   isEscalation,
        });
      }

      // ── Bishop lead events ──────────────────────────────
      const BISHOP_DESC: Record<string, string> = {
        INTRO_SENT:       'Intro email sent',
        FOLLOW_UP_NEEDED: 'Follow-up queued for review',
        NUDGE_SENT:       'Nudge email sent',
        BREAKUP_SENT:     'Break-up email sent',
      };
      const BISHOP_OUTCOME: Record<string, OutcomeKey> = {
        INTRO_SENT:       'Sent',
        FOLLOW_UP_NEEDED: 'Queued',
        NUDGE_SENT:       'Sent',
        BREAKUP_SENT:     'Sent',
      };

      for (const lead of leadsRes.data || []) {
        const status = lead.bishop_status || 'INTRO_SENT';
        all.push({
          id:          `bishop-${lead.id}`,
          timestamp:   lead.created_at,
          agent:       'Bishop',
          description: `Lead ${lead.name || lead.email || 'unknown'} — ${BISHOP_DESC[status] || status}`,
          workflow:    'Lead Qualification',
          outcome:     lead.status === 'qualified' ? 'Handed Off' : (BISHOP_OUTCOME[status] || 'Queued'),
          escalated:   false,
        });
      }

      // ── Rook CRM events ─────────────────────────────────
      for (const sync of rookRes.data || []) {
        const failed = sync.sync_status === 'failed';
        all.push({
          id:          `rook-${sync.id}`,
          timestamp:   sync.created_at,
          agent:       'Rook',
          description: failed
            ? `Sync failed for ${sync.entity_type}: ${sync.error_msg || 'unknown error'}`
            : `${sync.entity_type} synced to ${sync.crm_type}`,
          workflow:    'CRM Data Sync',
          outcome:     failed ? 'Failed' : 'Synced',
          escalated:   failed,
        });
      }

      // ── Pawn batch events ───────────────────────────────
      for (const job of pawnRes.data || []) {
        all.push({
          id:          `pawn-${job.id}`,
          timestamp:   job.created_at,
          agent:       'Pawn',
          description: job.status === 'done'
            ? `${job.job_type} job completed — ${job.clean} clean leads from ${job.total} records`
            : `${job.job_type} batch job ${job.status}`,
          workflow:    'Outreach Automation',
          outcome:     job.status === 'done' ? 'Completed' : job.status === 'failed' ? 'Failed' : 'Queued',
          escalated:   false,
        });
      }

      // Sort all by timestamp desc
      all.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      // Apply date cutoff
      const filtered = cutoffIso
        ? all.filter(e => e.timestamp >= cutoffIso)
        : all;

      setEvents(filtered);
    } catch (err) {
      console.error('[Activity] Load error:', err);
    } finally {
      setLoading(false);
    }
  }, [workspace?.id, dateRange]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Client-side filtering ─────────────────────────────────
  const displayed = useMemo(() => {
    let list = events;
    if (agentFilter !== 'All') list = list.filter(e => e.agent === agentFilter);
    if (escOnly)                list = list.filter(e => e.escalated);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e =>
        e.description.toLowerCase().includes(q) ||
        e.workflow.toLowerCase().includes(q)    ||
        e.agent.toLowerCase().includes(q),
      );
    }
    return list;
  }, [events, agentFilter, escOnly, search]);

  // Group by date for the table header rows
  const groups = useMemo(() => {
    const map = new Map<string, ActivityEvent[]>();
    for (const ev of displayed) {
      const key = fmtDate(ev.timestamp);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    }
    return map;
  }, [displayed]);

  const escalationCount = events.filter(e => e.escalated).length;
  const selectedDateLabel = DATE_RANGES.find(r => r.id === dateRange)?.label ?? 'Last 24 Hours';

  // ─── Render ─────────────────────────────────────────────

  return (
    <MainLayout>
      <Header title="Activity" subtitle="Full audit trail of every agent action across the system." />

      <div className="min-h-screen p-8" style={{ background: '#FDFBF7' }}>

        {/* ── Page heading ─────────────────────────────────── */}
        <div className="mb-6">
          <h1 className="text-3xl text-stone-900 mb-1" style={{ fontFamily: 'Instrument Serif, serif' }}>
            Activity Monitor
          </h1>
          <p className="text-stone-500 text-sm">
            Real-time log of every action, handoff, and escalation across the Regent fleet.
          </p>
        </div>

        {/* ── Filter bar ───────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex flex-wrap items-center gap-2">

            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
              <input
                type="text"
                placeholder="Search logs…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 bg-white border border-[#E7E5E4] rounded-lg text-sm focus:outline-none focus:border-stone-400 w-56"
              />
            </div>

            {/* Agent filter */}
            <select
              value={agentFilter}
              onChange={e => setAgentFilter(e.target.value as AgentName | 'All')}
              className="px-3 py-2 bg-white border border-[#E7E5E4] rounded-lg text-sm text-stone-600 focus:outline-none focus:border-stone-400"
            >
              <option value="All">All Agents</option>
              {(['Queen', 'Knight', 'Bishop', 'Rook', 'Pawn'] as AgentName[]).map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>

            {/* Date range */}
            <div className="relative">
              <button
                onClick={() => setDateOpen(o => !o)}
                className="flex items-center gap-2 px-3 py-2 bg-white border border-[#E7E5E4] rounded-lg text-sm text-stone-600 hover:bg-stone-50"
              >
                <Calendar className="w-4 h-4" />
                {selectedDateLabel}
                <ChevronDown className="w-3 h-3 text-stone-400" />
              </button>
              {dateOpen && (
                <div className="absolute top-full mt-1 left-0 z-20 bg-white border border-[#E7E5E4] rounded-lg shadow-md py-1 min-w-[160px]">
                  {DATE_RANGES.map(r => (
                    <button
                      key={r.id}
                      onClick={() => { setDateRange(r.id); setDateOpen(false); }}
                      className={cn(
                        'w-full text-left px-4 py-2 text-sm transition-colors',
                        dateRange === r.id
                          ? 'bg-stone-50 text-[#CC5500] font-medium'
                          : 'text-stone-600 hover:bg-stone-50',
                      )}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Refresh */}
            <button
              onClick={loadData}
              className="p-2 bg-white border border-[#E7E5E4] rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-50 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Escalations only toggle */}
          <label className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer select-none transition-colors',
            escOnly
              ? 'bg-[#FFF8F5] border-[#CC5500]/20'
              : 'bg-white border-[#E7E5E4] hover:bg-stone-50',
          )}>
            <div className="relative w-9 h-5 shrink-0">
              <input
                type="checkbox"
                checked={escOnly}
                onChange={e => setEscOnly(e.target.checked)}
                className="sr-only peer"
              />
              <div className={cn(
                'w-9 h-5 rounded-full transition-colors',
                escOnly ? 'bg-[#CC5500]' : 'bg-stone-200',
              )} />
              <div className={cn(
                'absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform',
                escOnly && 'translate-x-4',
              )} />
            </div>
            <span className={cn('text-sm font-medium', escOnly ? 'text-[#CC5500]' : 'text-stone-500')}>
              Escalations Only
              {escalationCount > 0 && (
                <span className="ml-1.5 text-[10px] bg-orange-100 text-[#CC5500] px-1.5 py-0.5 rounded-full font-semibold">
                  {escalationCount}
                </span>
              )}
            </span>
          </label>
        </div>

        {/* ── Activity table ───────────────────────────────── */}
        <div className="bg-white border border-[#E7E5E4] rounded-lg overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E7E5E4] bg-stone-50/60">
                {['Timestamp', 'Agent', 'Action Description', 'Workflow', 'Outcome'].map((h, i) => (
                  <th
                    key={h}
                    className={cn(
                      'py-3 px-5 text-[10px] font-semibold uppercase tracking-wider text-stone-400',
                      i === 4 && 'text-right',
                    )}
                    style={{ fontFamily: 'Space Grotesk, sans-serif' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E7E5E4] text-sm bg-white">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-stone-400">
                    Loading activity…
                  </td>
                </tr>
              ) : displayed.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-stone-400">
                    {search || agentFilter !== 'All' || escOnly
                      ? 'No events match your filters.'
                      : 'No activity recorded yet.'}
                  </td>
                </tr>
              ) : (
                Array.from(groups.entries()).map(([dateLabel, evs]) => (
                  <>
                    {/* Date group header */}
                    <tr key={`hdr-${dateLabel}`} className="bg-stone-50/80">
                      <td
                        colSpan={5}
                        className="px-5 py-2 text-[10px] font-semibold uppercase tracking-widest text-stone-400"
                        style={{ fontFamily: 'Space Grotesk, sans-serif' }}
                      >
                        {dateLabel}
                      </td>
                    </tr>

                    {evs.map(ev => {
                      const a = AGENT_STYLE[ev.agent];
                      return (
                        <tr
                          key={ev.id}
                          className={cn(
                            'group hover:bg-stone-50/80 transition-colors',
                            ev.escalated && 'bg-[#FFF8F5]',
                          )}
                        >
                          {/* Timestamp */}
                          <td
                            className={cn(
                              'py-4 px-5 text-xs font-mono whitespace-nowrap',
                              ev.escalated ? 'text-[#CC5500]' : 'text-stone-400',
                            )}
                          >
                            {fmtTime(ev.timestamp)}
                          </td>

                          {/* Agent */}
                          <td className="py-4 px-5">
                            <div className="flex items-center gap-2">
                              <div className={cn(
                                'w-6 h-6 rounded-full flex items-center justify-center shrink-0',
                                a.bg,
                              )}>
                                <a.Icon className={cn('w-3 h-3', a.text)} />
                              </div>
                              <span className="font-medium text-stone-700">{ev.agent}</span>
                            </div>
                          </td>

                          {/* Description */}
                          <td className={cn(
                            'py-4 px-5 text-stone-900 max-w-xs truncate',
                            ev.escalated && 'font-medium',
                          )}>
                            {ev.description}
                          </td>

                          {/* Workflow */}
                          <td className="py-4 px-5 text-stone-500 text-xs whitespace-nowrap">
                            {ev.workflow}
                          </td>

                          {/* Outcome */}
                          <td className="py-4 px-5 text-right">
                            <span className={cn(
                              'inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border',
                              OUTCOME_STYLE[ev.outcome],
                            )}>
                              {ev.outcome}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </>
                ))
              )}
            </tbody>
          </table>

          {/* Footer count */}
          {!loading && displayed.length > 0 && (
            <div className="px-5 py-3 border-t border-[#E7E5E4] bg-stone-50/60 flex items-center justify-between">
              <span
                className="text-[11px] text-stone-400"
                style={{ fontFamily: 'Space Grotesk, sans-serif' }}
              >
                Showing {displayed.length} event{displayed.length !== 1 ? 's' : ''}
                {agentFilter !== 'All' ? ` · ${agentFilter}` : ''}
                {escOnly ? ' · Escalations only' : ''}
              </span>
              <button
                onClick={loadData}
                className="text-[11px] text-stone-400 hover:text-[#CC5500] transition-colors flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                Refresh
              </button>
            </div>
          )}
        </div>

      </div>
    </MainLayout>
  );
}
