/**
 * Pawn — Gatekeeper · Scheduler · Business Intelligence
 *
 * Aggregates data from all agents and surfaces:
 * - What's wrong with the business
 * - Where leads are leaking
 * - Which sources, roles, channels perform best/worst
 * - Complaint patterns from Knight
 * - AI-generated executive narrative
 */

import { useState, useEffect, useCallback } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Shield, RefreshCw, Zap, CheckCircle2, XCircle, AlertTriangle,
  Loader2, Clock, Users, Activity, TrendingUp, CalendarCheck,
  MessageSquare, Target, Castle, Lightbulb, Info, BarChart3,
  ArrowDown, ArrowUp, Minus, Brain,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// ─── Types ────────────────────────────────────────────────────
interface PipelineHealth {
  pipeline: { NEW: number; INTRO_SENT: number; FOLLOW_UP_NEEDED: number; NUDGE_SENT: number; BREAKUP_SENT: number; booked: number };
  total_active: number; overdue: number; ready_for_sweep: number;
  overdue_leads: OverdueLead[];
  auto_verified?: { checked: number; removed: number };
  scanned_at: string;
}

interface OverdueLead {
  id: string; name: string; email: string; company: string;
  bishop_status: string; next_action_due: string | null; last_contact_date: string | null;
}

interface AgentStats {
  totalLeads: number; bookedLeads: number; sentEmails: number;
  openTickets: number; totalTickets: number; crmSyncs: number;
  pawnVerified: number; pawnBlocked: number;
}

interface Report {
  source_breakdown: { source: string; total: number; booked: number; rate: number }[];
  role_breakdown: { role: string; total: number; booked: number; rate: number }[];
  funnel: Record<string, number>;
  channel_breakdown: { channel: string; tickets: number; resolved: number; resolution_rate: number; avg_sentiment: number | null }[];
  complaint_topics: { word: string; count: number }[];
  loopholes: string[];
  narrative: string | null;
  totals: { leads: number; booked: number; rate: number; sent_emails: number; tickets: number; verified: number; blocked: number };
  generated_at: string;
}

interface VerifyStats { total: number; clean: number; duplicates: number; invalid: number; inserted: number }
interface PawnJob { id: string; created_at: string; job_type: string; total: number; clean: number; duplicates: number; invalid: number; status: string }

// ─── Constants ────────────────────────────────────────────────
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  NEW:              { label: 'New',        color: '#6366f1', bg: '#eef2ff' },
  INTRO_SENT:       { label: 'Intro',      color: '#0ea5e9', bg: '#e0f2fe' },
  FOLLOW_UP_NEEDED: { label: 'Follow Up',  color: '#f59e0b', bg: '#fef3c7' },
  NUDGE_SENT:       { label: 'Nudge',      color: '#f97316', bg: '#ffedd5' },
  BREAKUP_SENT:     { label: 'Breakup',    color: '#ef4444', bg: '#fee2e2' },
  booked:           { label: 'Booked',     color: '#22c55e', bg: '#dcfce7' },
};

function timeAgo(iso: string) {
  const d = Date.now() - new Date(iso).getTime();
  const h = Math.floor(d / 3_600_000);
  if (h > 23) return `${Math.floor(h / 24)}d ago`;
  if (h > 0) return `${h}h ago`;
  return `${Math.floor((d % 3_600_000) / 60_000)}m ago`;
}

function overdueLabel(iso: string | null) {
  if (!iso) return 'Now';
  const d = Date.now() - new Date(iso).getTime();
  const h = Math.floor(d / 3_600_000);
  if (h > 23) return `${Math.floor(h / 24)}d overdue`;
  if (h > 0) return `${h}h overdue`;
  return 'Just now';
}

function rateColor(rate: number): string {
  if (rate >= 10) return '#16a34a';
  if (rate >= 4) return '#d97706';
  return '#dc2626';
}

// ─── Component ────────────────────────────────────────────────
export default function Pawn() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [health, setHealth] = useState<PipelineHealth | null>(null);
  const [ticking, setTicking] = useState(false);
  const [sweeping, setSweeping] = useState(false);

  const [report, setReport] = useState<Report | null>(null);
  const [generating, setGenerating] = useState(false);

  const [agentStats, setAgentStats] = useState<AgentStats>({
    totalLeads: 0, bookedLeads: 0, sentEmails: 0,
    openTickets: 0, totalTickets: 0, crmSyncs: 0,
    pawnVerified: 0, pawnBlocked: 0,
  });

  const [rawInput, setRawInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyStats, setVerifyStats] = useState<VerifyStats | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<PawnJob[]>([]);

  // ── Agent stats ────────────────────────────────────────────
  const loadAgentStats = useCallback(async () => {
    if (!user) return;
    const [leadsRes, bookedRes, draftsRes, ticketsRes, openTicketsRes, syncsRes, jobsRes] = await Promise.all([
      supabase.from('leads').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('leads').select('id', { count: 'exact', head: true }).eq('user_id', user.id).not('meeting_booked_at', 'is', null),
      supabase.from('ai_drafts').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'sent'),
      supabase.from('tickets').select('id', { count: 'exact', head: true }),
      supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('status', 'open'),
      supabase.from('rook_crm_syncs').select('id', { count: 'exact', head: true }),
      supabase.from('pawn_jobs').select('clean, duplicates, invalid').order('created_at', { ascending: false }).limit(20),
    ]);
    const pj = jobsRes.data || [];
    setAgentStats({
      totalLeads: leadsRes.count ?? 0,
      bookedLeads: bookedRes.count ?? 0,
      sentEmails: draftsRes.count ?? 0,
      totalTickets: ticketsRes.count ?? 0,
      openTickets: openTicketsRes.count ?? 0,
      crmSyncs: syncsRes.count ?? 0,
      pawnVerified: pj.reduce((a, j) => a + (j.clean ?? 0), 0),
      pawnBlocked: pj.reduce((a, j) => a + (j.duplicates ?? 0) + (j.invalid ?? 0), 0),
    });
  }, [user]);

  // ── Tick ───────────────────────────────────────────────────
  const runTick = useCallback(async () => {
    if (!user) return;
    setTicking(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/pawn-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
        body: JSON.stringify({ action: 'tick', user_id: user.id }),
      });
      const data = await res.json();
      if (data.pipeline) setHealth(data);
      else if (data.error) toast({ title: 'Scan error', description: data.error, variant: 'destructive' });
    } catch (err) {
      toast({ title: 'Scan failed', description: String(err), variant: 'destructive' });
    } finally { setTicking(false); }
  }, [user, toast]);

  // ── Generate Intelligence Report ───────────────────────────
  const generateReport = useCallback(async () => {
    if (!user) return;
    setGenerating(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/pawn-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
        body: JSON.stringify({ action: 'report', user_id: user.id }),
      });
      const data = await res.json();
      if (data.error) toast({ title: 'Report error', description: data.error, variant: 'destructive' });
      else setReport(data);
    } catch (err) {
      toast({ title: 'Report failed', description: String(err), variant: 'destructive' });
    } finally { setGenerating(false); }
  }, [user, toast]);

  // Auto-refresh every 5 min
  useEffect(() => {
    runTick();
    loadAgentStats();
    const t1 = setInterval(runTick, 5 * 60 * 1000);
    const t2 = setInterval(loadAgentStats, 5 * 60 * 1000);
    return () => { clearInterval(t1); clearInterval(t2); };
  }, [runTick, loadAgentStats]);

  const loadJobs = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('pawn_jobs').select('id, created_at, job_type, total, clean, duplicates, invalid, status').order('created_at', { ascending: false }).limit(10);
    setJobs(data || []);
  }, [user]);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  // ── Sweep ──────────────────────────────────────────────────
  const runSweep = async () => {
    if (!user) return;
    setSweeping(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/bishop-sweep`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
        body: JSON.stringify({ user_id: user.id }),
      });
      const data = await res.json();
      toast({ title: 'Sweep complete', description: `${data.processed ?? 0} leads processed.` });
      await runTick();
    } catch (err) {
      toast({ title: 'Sweep failed', description: String(err), variant: 'destructive' });
    } finally { setSweeping(false); }
  };

  // ── Manual verify ──────────────────────────────────────────
  const verifyLeads = async () => {
    if (!rawInput.trim() || !user) return;
    setVerifying(true); setVerifyStats(null); setVerifyError(null);
    const leads = rawInput.trim().split('\n').filter(Boolean).map(line => {
      const p = line.split(',').map(s => s.trim());
      if (p.length >= 3) return { name: p[0], email: p[1], company: p[2] };
      const email = p[0];
      return { name: 'Unknown', email, company: email.includes('@') ? email.split('@')[1].split('.')[0] : 'Unknown' };
    });
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/pawn-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
        body: JSON.stringify({ leads, user_id: user.id, auto_insert: true }),
      });
      const data = await res.json();
      if (data.error) setVerifyError(data.error);
      else { setVerifyStats(data.stats); setRawInput(''); await Promise.all([loadJobs(), loadAgentStats(), runTick()]); }
    } catch (err) { setVerifyError(String(err)); }
    finally { setVerifying(false); }
  };

  const statusKeys = ['NEW', 'INTRO_SENT', 'FOLLOW_UP_NEEDED', 'NUDGE_SENT', 'BREAKUP_SENT', 'booked'] as const;

  // ─── Render ────────────────────────────────────────────────
  return (
    <MainLayout>
      <div style={{ background: '#FDFBF7', minHeight: '100vh' }}>
        <Header title="Pawn" subtitle="Gatekeeper · Scheduler · Intelligence" icon={Shield} />

        <div className="p-6 space-y-6 max-w-6xl mx-auto">

          {/* ── Agent Stats ──────────────────────────────────── */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Knight', icon: MessageSquare, iconBg: '#f0fdf4', iconColor: '#16a34a', primary: agentStats.openTickets, primaryLabel: 'open tickets', sub: `${agentStats.totalTickets} total` },
              { label: 'Bishop', icon: Target, iconBg: '#eff6ff', iconColor: '#2563eb', primary: agentStats.totalLeads, primaryLabel: 'in pipeline', sub: `${agentStats.bookedLeads} booked · ${agentStats.sentEmails} sent` },
              { label: 'Rook', icon: Castle, iconBg: '#fdf4ff', iconColor: '#9333ea', primary: agentStats.crmSyncs, primaryLabel: 'CRM syncs', sub: 'HubSpot · Salesforce · Zoho' },
              { label: 'Pawn', icon: Shield, iconBg: '#fff7ed', iconColor: '#CC5500', primary: agentStats.pawnVerified, primaryLabel: 'verified', sub: `${agentStats.pawnBlocked} blocked` },
            ].map(({ label, icon: Icon, iconBg, iconColor, primary, primaryLabel, sub }) => (
              <div key={label} style={{ background: '#fff', border: '1px solid #E7E5E4', borderRadius: 12, padding: 20 }}>
                <div className="flex items-center gap-2 mb-3">
                  <div style={{ background: iconBg, borderRadius: 8, padding: 6 }}>
                    <Icon size={15} style={{ color: iconColor }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#78716c', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</span>
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#1C1917' }}>{primary}</div>
                <div style={{ fontSize: 12, color: '#78716c', marginTop: 1 }}>{primaryLabel}</div>
                <div style={{ fontSize: 11, color: '#a8a29e', marginTop: 1 }}>{sub}</div>
              </div>
            ))}
          </div>

          {/* ── Intelligence Report ───────────────────────────── */}
          <div style={{ background: '#fff', border: '1px solid #E7E5E4', borderRadius: 12, padding: 24 }}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Brain size={16} style={{ color: '#CC5500' }} />
                <span style={{ fontFamily: 'Instrument Serif, serif', fontSize: 18, color: '#1C1917' }}>Intelligence Report</span>
                {report && <span style={{ fontSize: 12, color: '#a8a29e' }}>generated {timeAgo(report.generated_at)}</span>}
              </div>
              <Button
                onClick={generateReport}
                disabled={generating}
                style={{ background: '#1C1917', color: '#fff', border: 'none' }}
                size="sm"
              >
                {generating ? <><Loader2 size={14} className="animate-spin mr-2" />Analysing...</> : <><BarChart3 size={14} className="mr-2" />Generate Report</>}
              </Button>
            </div>

            {!report && !generating && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#a8a29e', fontSize: 14 }}>
                <Brain size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                <div>Click "Generate Report" to analyse all agents and surface business insights.</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Checks lead sources, role performance, funnel leaks, complaint patterns, and more.</div>
              </div>
            )}

            {generating && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#78716c', fontSize: 14 }}>
                <Loader2 size={28} style={{ margin: '0 auto 12px', opacity: 0.5, animation: 'spin 1s linear infinite' }} className="animate-spin" />
                <div>Aggregating data from all agents...</div>
              </div>
            )}

            {report && (
              <div className="space-y-6">

                {/* AI Narrative */}
                {report.narrative && (
                  <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '16px 20px' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <Lightbulb size={14} style={{ color: '#d97706' }} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#92400e' }}>AI Executive Summary</span>
                    </div>
                    <p style={{ fontSize: 14, color: '#1C1917', lineHeight: 1.6, margin: 0 }}>{report.narrative}</p>
                  </div>
                )}

                {/* Loopholes */}
                {report.loopholes.length > 0 && (
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1C1917', marginBottom: 10 }}>
                      Identified Loopholes & Opportunities
                    </div>
                    <div className="space-y-2">
                      {report.loopholes.map((l, i) => (
                        <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 14px', background: '#fafaf9', borderRadius: 8, border: '1px solid #E7E5E4' }}>
                          <AlertTriangle size={14} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 2 }} />
                          <span style={{ fontSize: 13, color: '#1C1917', lineHeight: 1.5 }}>{l}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Three-column breakdown */}
                <div className="grid grid-cols-3 gap-5">

                  {/* Lead Source Performance */}
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#78716c', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                      Lead Source Performance
                    </div>
                    {report.source_breakdown.length === 0 ? (
                      <div style={{ fontSize: 12, color: '#a8a29e' }}>No source data yet — leads need a source_url.</div>
                    ) : (
                      <div className="space-y-2">
                        {report.source_breakdown.map((s) => (
                          <div key={s.source} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #E7E5E4', background: '#fafaf9' }}>
                            <div className="flex justify-between items-center">
                              <span style={{ fontSize: 13, fontWeight: 500, color: '#1C1917' }}>{s.source}</span>
                              <span style={{ fontSize: 13, fontWeight: 700, color: rateColor(s.rate) }}>{s.rate}%</span>
                            </div>
                            <div style={{ fontSize: 11, color: '#a8a29e', marginTop: 2 }}>{s.booked} booked of {s.total} leads</div>
                            <div style={{ marginTop: 5, height: 3, background: '#E7E5E4', borderRadius: 99 }}>
                              <div style={{ height: '100%', borderRadius: 99, background: rateColor(s.rate), width: `${Math.min(s.rate * 4, 100)}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Role / Title Performance */}
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#78716c', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                      Role Performance
                    </div>
                    {report.role_breakdown.length === 0 ? (
                      <div style={{ fontSize: 12, color: '#a8a29e' }}>Not enough data. Need ≥3 leads per title.</div>
                    ) : (
                      <div className="space-y-2">
                        {report.role_breakdown.slice(0, 6).map((r) => (
                          <div key={r.role} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #E7E5E4', background: '#fafaf9' }}>
                            <div className="flex justify-between items-center">
                              <span style={{ fontSize: 12, fontWeight: 500, color: '#1C1917', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110 }}>{r.role}</span>
                              <span style={{ fontSize: 13, fontWeight: 700, color: rateColor(r.rate) }}>{r.rate}%</span>
                            </div>
                            <div style={{ fontSize: 11, color: '#a8a29e', marginTop: 2 }}>{r.booked}/{r.total} booked</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Knight Channel + Complaints */}
                  <div className="space-y-4">
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#78716c', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                        Support Channels (Knight)
                      </div>
                      {report.channel_breakdown.length === 0 ? (
                        <div style={{ fontSize: 12, color: '#a8a29e' }}>No ticket data yet.</div>
                      ) : (
                        <div className="space-y-2">
                          {report.channel_breakdown.map((c) => (
                            <div key={c.channel} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #E7E5E4', background: '#fafaf9' }}>
                              <div className="flex justify-between">
                                <span style={{ fontSize: 12, fontWeight: 500, color: '#1C1917', textTransform: 'capitalize' }}>{c.channel}</span>
                                <span style={{ fontSize: 11, color: c.resolution_rate >= 70 ? '#16a34a' : c.resolution_rate >= 40 ? '#d97706' : '#dc2626' }}>
                                  {c.resolution_rate}% resolved
                                </span>
                              </div>
                              <div style={{ fontSize: 11, color: '#a8a29e', marginTop: 1 }}>
                                {c.tickets} tickets{c.avg_sentiment ? ` · sentiment ${c.avg_sentiment}/10` : ''}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {report.complaint_topics.length > 0 && (
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#78716c', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                          Top Complaint Words
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {report.complaint_topics.slice(0, 8).map((t) => (
                            <span key={t.word} style={{ background: '#fee2e2', color: '#dc2626', fontSize: 11, padding: '2px 8px', borderRadius: 99, fontWeight: 500 }}>
                              {t.word} ×{t.count}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Funnel drop-off */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#78716c', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                    Sequence Funnel
                  </div>
                  <div className="flex items-center gap-1">
                    {statusKeys.map((key, i) => {
                      const cfg = STATUS_CFG[key];
                      const count = report.funnel[key] ?? 0;
                      const prevCount = i > 0 ? (report.funnel[statusKeys[i - 1]] ?? 0) : count;
                      const dropPct = i > 0 && prevCount > 0 ? Math.round((prevCount - count) / prevCount * 100) : null;
                      return (
                        <div key={key} className="flex items-center gap-1 flex-1">
                          {i > 0 && dropPct !== null && (
                            <div style={{ textAlign: 'center', fontSize: 10, color: dropPct > 40 ? '#dc2626' : '#a8a29e', flexShrink: 0 }}>
                              <ArrowDown size={10} style={{ display: 'block', margin: '0 auto' }} />
                              <span style={{ fontWeight: dropPct > 40 ? 700 : 400 }}>-{dropPct}%</span>
                            </div>
                          )}
                          <div style={{ flex: 1, background: cfg.bg, borderRadius: 8, padding: '10px 8px', textAlign: 'center', border: `1px solid ${cfg.color}22` }}>
                            <div style={{ fontSize: 18, fontWeight: 700, color: cfg.color }}>{count}</div>
                            <div style={{ fontSize: 10, color: '#78716c', marginTop: 2, lineHeight: 1.2 }}>{cfg.label}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* ── Pipeline Intelligence ─────────────────────────── */}
          <div style={{ background: '#fff', border: '1px solid #E7E5E4', borderRadius: 12, padding: 24 }}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Activity size={16} style={{ color: '#CC5500' }} />
                <span style={{ fontFamily: 'Instrument Serif, serif', fontSize: 18, color: '#1C1917' }}>Pipeline</span>
                {health && <span style={{ fontSize: 12, color: '#a8a29e' }}>scanned {timeAgo(health.scanned_at)}</span>}
                {health?.auto_verified && health.auto_verified.removed > 0 && (
                  <span style={{ fontSize: 11, background: '#dcfce7', color: '#16a34a', padding: '2px 8px', borderRadius: 99 }}>
                    auto-removed {health.auto_verified.removed} invalid
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={runTick} disabled={ticking} style={{ borderColor: '#E7E5E4' }}>
                  {ticking ? <Loader2 size={14} className="animate-spin mr-1" /> : <RefreshCw size={14} className="mr-1" />}Scan
                </Button>
                <Button size="sm" onClick={runSweep} disabled={sweeping || !health || health.overdue === 0} style={{ background: '#CC5500', color: '#fff', border: 'none' }}>
                  {sweeping ? <Loader2 size={14} className="animate-spin mr-1" /> : <Zap size={14} className="mr-1" />}
                  Sweep {health && health.overdue > 0 ? `(${health.overdue})` : ''}
                </Button>
              </div>
            </div>

            {health ? (
              <>
                <div className="grid grid-cols-6 gap-3 mb-4">
                  {statusKeys.map(key => {
                    const cfg = STATUS_CFG[key];
                    const count = health.pipeline[key as keyof typeof health.pipeline] ?? 0;
                    return (
                      <div key={key} style={{ background: cfg.bg, borderRadius: 10, padding: '12px 8px', textAlign: 'center' }}>
                        <div style={{ fontSize: 22, fontWeight: 700, color: cfg.color }}>{count}</div>
                        <div style={{ fontSize: 11, color: '#78716c', marginTop: 2 }}>{cfg.label}</div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-5 mb-4" style={{ fontSize: 13, color: '#57534e' }}>
                  <span className="flex items-center gap-1"><Users size={13} />{health.total_active} active</span>
                  <span className="flex items-center gap-1" style={{ color: health.overdue > 0 ? '#f59e0b' : '#22c55e' }}><Clock size={13} />{health.overdue} overdue</span>
                  <span className="flex items-center gap-1" style={{ color: '#22c55e' }}><CalendarCheck size={13} />{health.pipeline.booked} booked</span>
                </div>
                {health.overdue_leads.length > 0 && (
                  <div style={{ border: '1px solid #fde68a', borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{ background: '#fffbeb', padding: '8px 14px', fontSize: 12, fontWeight: 600, color: '#92400e', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <AlertTriangle size={13} />{health.overdue_leads.length} leads need action
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow style={{ background: '#fafaf9' }}>
                          <TableHead style={{ fontSize: 12 }}>Name</TableHead>
                          <TableHead style={{ fontSize: 12 }}>Company</TableHead>
                          <TableHead style={{ fontSize: 12 }}>Status</TableHead>
                          <TableHead style={{ fontSize: 12 }}>Overdue</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {health.overdue_leads.map(lead => {
                          const cfg = STATUS_CFG[lead.bishop_status] ?? STATUS_CFG['NEW'];
                          return (
                            <TableRow key={lead.id}>
                              <TableCell style={{ fontSize: 13 }}>{lead.name || '—'}</TableCell>
                              <TableCell style={{ fontSize: 13, color: '#78716c' }}>{lead.company || '—'}</TableCell>
                              <TableCell><Badge style={{ background: cfg.bg, color: cfg.color, border: 'none', fontSize: 11 }}>{cfg.label}</Badge></TableCell>
                              <TableCell style={{ fontSize: 12, color: '#f59e0b', fontWeight: 500 }}>{overdueLabel(lead.next_action_due)}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '30px 0', color: '#a8a29e', fontSize: 14 }}>
                {ticking ? <span className="flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin" />Scanning...</span> : 'Click "Scan" to check pipeline health'}
              </div>
            )}
          </div>

          {/* ── Manual Verify + Job History ───────────────────── */}
          <div className="grid grid-cols-2 gap-6">
            <div style={{ background: '#fff', border: '1px solid #E7E5E4', borderRadius: 12, padding: 24 }}>
              <div className="flex items-center gap-2 mb-1">
                <Shield size={14} style={{ color: '#CC5500' }} />
                <span style={{ fontFamily: 'Instrument Serif, serif', fontSize: 16, color: '#1C1917' }}>Manual Verify</span>
              </div>
              <p style={{ fontSize: 12, color: '#78716c', marginBottom: 10 }}>
                Paste emails or CSV: <code style={{ fontSize: 11 }}>name, email, company</code>
              </p>
              <Textarea value={rawInput} onChange={e => setRawInput(e.target.value)} placeholder={'john@acme.com\nJane Doe, jane@stripe.com, Stripe'} rows={6} style={{ fontFamily: 'monospace', fontSize: 13, borderColor: '#E7E5E4' }} />
              <Button className="w-full mt-3" onClick={verifyLeads} disabled={verifying || !rawInput.trim()} style={{ background: '#1C1917', color: '#fff', border: 'none' }}>
                {verifying ? <><Loader2 size={14} className="animate-spin mr-2" />Verifying...</> : 'Verify & Import'}
              </Button>
              {verifyStats && (
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {[['Clean', verifyStats.clean, '#dcfce7', '#16a34a', '#15803d'], ['Dupes', verifyStats.duplicates, '#fef3c7', '#d97706', '#b45309'], ['Invalid', verifyStats.invalid, '#fee2e2', '#dc2626', '#b91c1c']].map(([label, val, bg, fg, sub]) => (
                    <div key={String(label)} style={{ background: String(bg), borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: String(fg) }}>{val}</div>
                      <div style={{ fontSize: 11, color: String(sub) }}>{label}</div>
                    </div>
                  ))}
                </div>
              )}
              {verifyStats?.inserted > 0 && (
                <div className="flex items-center gap-2 mt-3" style={{ fontSize: 13, color: '#16a34a' }}>
                  <CheckCircle2 size={14} />{verifyStats.inserted} lead{verifyStats.inserted !== 1 ? 's' : ''} added to Bishop's pipeline
                </div>
              )}
              {verifyError && <div className="flex items-center gap-2 mt-3" style={{ fontSize: 13, color: '#dc2626' }}><XCircle size={14} />{verifyError}</div>}
            </div>

            <div style={{ background: '#fff', border: '1px solid #E7E5E4', borderRadius: 12, padding: 24 }}>
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp size={14} style={{ color: '#CC5500' }} />
                <span style={{ fontFamily: 'Instrument Serif, serif', fontSize: 16, color: '#1C1917' }}>Recent Jobs</span>
              </div>
              {jobs.length === 0 ? (
                <div style={{ color: '#a8a29e', fontSize: 13, textAlign: 'center', paddingTop: 40 }}>No jobs yet</div>
              ) : (
                <div className="space-y-2">
                  {jobs.map(job => (
                    <div key={job.id} style={{ borderRadius: 8, border: '1px solid #E7E5E4', padding: '10px 14px' }} className="flex items-center justify-between">
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: '#1C1917', textTransform: 'capitalize' }}>{job.job_type}</div>
                        <div style={{ fontSize: 12, color: '#78716c', marginTop: 2 }}>{job.clean} clean · {job.duplicates} dupes · {job.invalid} invalid</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <Badge style={{ background: job.status === 'done' ? '#dcfce7' : '#fee2e2', color: job.status === 'done' ? '#16a34a' : '#dc2626', border: 'none', fontSize: 11 }}>{job.status}</Badge>
                        <div style={{ fontSize: 11, color: '#a8a29e', marginTop: 4 }}>{timeAgo(job.created_at)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </MainLayout>
  );
}
