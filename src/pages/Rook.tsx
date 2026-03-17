/**
 * Rook — Revenue Ops Dashboard
 *
 * CRM sync control center: monitor sync health, view logs,
 * retry failed syncs, and trigger manual syncs per client.
 */

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  Castle,
  RefreshCw,
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Building2,
  ArrowRight,
  RotateCcw,
  Loader2,
  Activity,
  Database,
  Mail,
  TrendingUp,
  MinusCircle,
  HelpCircle,
  Ban,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────

interface ReplyLog {
  id: string;
  lead_id: string;
  intent_classification: string;
  classification_confidence: number;
  extracted_phone: string | null;
  extracted_title: string | null;
  suggested_next_state: string;
  bishop_status_before: string | null;
  bishop_status_after: string | null;
  created_at: string;
  lead?: { name: string | null; email: string } | null;
}

interface RookSync {
  id: string;
  client_id: string;
  entity_type: 'lead' | 'ticket' | 'deal';
  entity_id: string;
  crm_type: string;
  crm_record_id: string | null;
  sync_status: 'pending' | 'synced' | 'failed' | 'skipped';
  error_msg: string | null;
  synced_at: string | null;
  created_at: string;
  client?: { name: string; rook_crm_type: string } | null;
}

interface RookClient {
  id: string;
  name: string;
  rook_enabled: boolean;
  rook_crm_type: string | null;
  status: string;
}

// ─── Helpers ───────────────────────────────────────────────

const CRM_LABELS: Record<string, string> = {
  hubspot:    'HubSpot',
  salesforce: 'Salesforce',
  zoho:       'Zoho CRM',
  pipedrive:  'Pipedrive',
};

const INTENT_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  positive_meeting:    { label: 'Meeting',     color: 'bg-emerald-100 text-emerald-800', icon: TrendingUp },
  objection_pricing:   { label: 'Pricing',     color: 'bg-amber-100 text-amber-800',     icon: HelpCircle },
  objection_timing:    { label: 'Timing',      color: 'bg-amber-100 text-amber-800',     icon: Clock },
  information_request: { label: 'Info Req.',   color: 'bg-blue-100 text-blue-800',       icon: HelpCircle },
  not_interested:      { label: 'Not Inter.',  color: 'bg-stone-100 text-stone-600',     icon: MinusCircle },
  unsubscribe:         { label: 'Unsub',       color: 'bg-red-100 text-red-800',         icon: Ban },
};

const STATUS_CONFIG = {
  synced:  { label: 'Synced',  color: 'bg-emerald-100 text-emerald-800', icon: CheckCircle2 },
  failed:  { label: 'Failed',  color: 'bg-red-100 text-red-800',         icon: XCircle },
  pending: { label: 'Pending', color: 'bg-amber-100 text-amber-800',     icon: Clock },
  skipped: { label: 'Skipped', color: 'bg-stone-100 text-stone-600',     icon: ArrowRight },
};

function formatTime(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function timeAgo(iso: string) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60)  return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// ─── Component ─────────────────────────────────────────────

export default function Rook() {
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const [syncs, setSyncs]         = useState<RookSync[]>([]);
  const [clients, setClients]     = useState<RookClient[]>([]);
  const [replyLogs, setReplyLogs] = useState<ReplyLog[]>([]);
  const [loading, setLoading]     = useState(true);
  const [retrying, setRetrying]   = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'log');

  // Manual sync form
  const [manualClientId,   setManualClientId]   = useState('');
  const [manualEntityType, setManualEntityType] = useState<'lead' | 'ticket'>('lead');
  const [manualEntityId,   setManualEntityId]   = useState('');
  const [manualForce,      setManualForce]      = useState(false);
  const [manualLoading,    setManualLoading]    = useState(false);

  // Bulk sync state
  const [bulkClientId,  setBulkClientId]  = useState('');
  const [bulkLoading,   setBulkLoading]   = useState(false);
  const [bulkProgress,  setBulkProgress]  = useState<{ done: number; total: number; failed: number } | null>(null);

  // ── Load data ─────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    const [syncsRes, clientsRes, repliesRes] = await Promise.all([
      supabase
        .from('rook_crm_syncs')
        .select('*, client:clients(name, rook_crm_type)')
        .order('created_at', { ascending: false })
        .limit(200),
      supabase
        .from('clients')
        .select('id, name, rook_enabled, rook_crm_type, status')
        .eq('rook_enabled', true),
      supabase
        .from('rook_reply_logs')
        .select('*, lead:leads(name, email)')
        .order('created_at', { ascending: false })
        .limit(100),
    ]);

    if (syncsRes.data)   setSyncs(syncsRes.data as RookSync[]);
    if (clientsRes.data) setClients(clientsRes.data as RookClient[]);
    if (repliesRes.data) setReplyLogs(repliesRes.data as ReplyLog[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Stats ─────────────────────────────────────────────────

  const today      = new Date().toDateString();
  const todaySyncs = syncs.filter(s => new Date(s.created_at).toDateString() === today);
  const totalToday = todaySyncs.length;
  const syncedToday = todaySyncs.filter(s => s.sync_status === 'synced').length;
  const failedTotal = syncs.filter(s => s.sync_status === 'failed').length;
  const successRate = syncs.length > 0
    ? Math.round((syncs.filter(s => s.sync_status === 'synced').length / syncs.filter(s => s.sync_status !== 'skipped').length) * 100) || 0
    : 0;

  // ── Filter syncs ──────────────────────────────────────────

  const filteredSyncs = statusFilter === 'all'
    ? syncs
    : syncs.filter(s => s.sync_status === statusFilter);

  // ── Per-client stats ──────────────────────────────────────

  const clientStats = clients.map(c => {
    const clientSyncs = syncs.filter(s => s.client_id === c.id);
    const synced = clientSyncs.filter(s => s.sync_status === 'synced').length;
    const failed = clientSyncs.filter(s => s.sync_status === 'failed').length;
    const lastSync = clientSyncs[0]?.synced_at ?? clientSyncs[0]?.created_at ?? null;
    const rate = clientSyncs.length > 0
      ? Math.round((synced / clientSyncs.filter(s => s.sync_status !== 'skipped').length) * 100) || 0
      : null;
    return { ...c, synced, failed, total: clientSyncs.length, lastSync, rate };
  });

  // ── Trigger sync ──────────────────────────────────────────

  async function triggerSync(
    clientId: string,
    entityType: string,
    entityId: string,
    force = false,
  ) {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/rook-sync`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ client_id: clientId, entity_type: entityType, entity_id: entityId, force }),
    });
    return res.json();
  }

  // ── Retry a failed sync ───────────────────────────────────

  async function handleRetry(sync: RookSync) {
    setRetrying(sync.id);
    try {
      const result = await triggerSync(sync.client_id, sync.entity_type, sync.entity_id, true);
      if (result.success) {
        toast({ title: 'Sync successful', description: `${sync.entity_type} pushed to ${CRM_LABELS[sync.crm_type] || sync.crm_type}` });
      } else {
        toast({ title: 'Sync failed', description: result.error || 'Unknown error', variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Request failed', description: String(err), variant: 'destructive' });
    } finally {
      setRetrying(null);
      loadData();
    }
  }

  // ── Manual sync ───────────────────────────────────────────

  async function handleManualSync() {
    if (!manualClientId || !manualEntityId) {
      toast({ title: 'Missing fields', description: 'Select a client and enter an entity ID', variant: 'destructive' });
      return;
    }
    setManualLoading(true);
    try {
      const result = await triggerSync(manualClientId, manualEntityType, manualEntityId, manualForce);
      if (result.success) {
        toast({
          title: result.action === 'skipped' ? 'Skipped' : 'Sync complete',
          description: result.action === 'skipped'
            ? result.reason === 'already_synced' ? 'Already synced — use Force to re-push' : 'Rook disabled for this client'
            : `${result.action} in ${CRM_LABELS[result.crm_type] || result.crm_type} (#${result.crm_record_id})`,
        });
      } else {
        toast({ title: 'Sync failed', description: result.error || 'Unknown error', variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Request failed', description: String(err), variant: 'destructive' });
    } finally {
      setManualLoading(false);
      loadData();
    }
  }

  // ── Bulk sync: push all unsynced leads for a client ───────

  async function handleBulkSync() {
    if (!bulkClientId) {
      toast({ title: 'Select a client first', variant: 'destructive' });
      return;
    }
    setBulkLoading(true);
    setBulkProgress(null);

    // Fetch all leads for this client that haven't been synced yet
    const client = clients.find(c => c.id === bulkClientId);
    const { data: leads, error } = await supabase
      .from('leads')
      .select('id')
      .eq('client_id', bulkClientId);

    if (error || !leads) {
      toast({ title: 'Failed to load leads', description: error?.message, variant: 'destructive' });
      setBulkLoading(false);
      return;
    }

    // Filter out leads already synced
    const syncedIds = new Set(
      syncs
        .filter(s => s.client_id === bulkClientId && s.sync_status === 'synced' && s.entity_type === 'lead')
        .map(s => s.entity_id),
    );
    const unsynced = leads.filter(l => !syncedIds.has(l.id));

    if (unsynced.length === 0) {
      toast({ title: 'All leads already synced', description: `${leads.length} leads up to date in ${CRM_LABELS[client?.rook_crm_type || ''] || 'CRM'}` });
      setBulkLoading(false);
      return;
    }

    let done = 0;
    let failed = 0;
    setBulkProgress({ done: 0, total: unsynced.length, failed: 0 });

    for (const lead of unsynced) {
      try {
        await triggerSync(bulkClientId, 'lead', lead.id);
        done++;
      } catch {
        failed++;
      }
      setBulkProgress({ done: done + failed, total: unsynced.length, failed });
    }

    toast({
      title: `Bulk sync complete`,
      description: `${done} synced, ${failed} failed out of ${unsynced.length} leads`,
      variant: failed > 0 ? 'destructive' : 'default',
    });
    setBulkLoading(false);
    setBulkProgress(null);
    loadData();
  }

  // ── Render ────────────────────────────────────────────────

  return (
    <MainLayout>
      <Header
        title="Rook"
        subtitle="Revenue Ops — CRM sync bridge"
        icon={<Castle className="w-5 h-5" />}
        actions={
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-xs text-stone-500 font-space-grotesk uppercase tracking-wide mb-1">Synced Today</div>
            <div className="text-2xl font-instrument-serif">{syncedToday}<span className="text-sm text-stone-400 ml-1">/ {totalToday}</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-xs text-stone-500 font-space-grotesk uppercase tracking-wide mb-1">Success Rate</div>
            <div className={`text-2xl font-instrument-serif ${successRate < 80 ? 'text-red-600' : successRate < 95 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {successRate}%
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-xs text-stone-500 font-space-grotesk uppercase tracking-wide mb-1">Failed</div>
            <div className={`text-2xl font-instrument-serif ${failedTotal > 0 ? 'text-red-600' : ''}`}>{failedTotal}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-xs text-stone-500 font-space-grotesk uppercase tracking-wide mb-1">Active Clients</div>
            <div className="text-2xl font-instrument-serif">{clients.length}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="log">
            <Activity className="w-3.5 h-3.5 mr-1.5" />
            Sync Log
            {failedTotal > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">
                {failedTotal}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="clients">
            <Building2 className="w-3.5 h-3.5 mr-1.5" />
            Clients
          </TabsTrigger>
          <TabsTrigger value="manual">
            <Play className="w-3.5 h-3.5 mr-1.5" />
            Manual Sync
          </TabsTrigger>
          <TabsTrigger value="bulk">
            <Database className="w-3.5 h-3.5 mr-1.5" />
            Bulk Sync
          </TabsTrigger>
          <TabsTrigger value="replies">
            <Mail className="w-3.5 h-3.5 mr-1.5" />
            Replies
            {replyLogs.filter(r => r.intent_classification === 'positive_meeting').length > 0 && (
              <span className="ml-1.5 bg-emerald-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">
                {replyLogs.filter(r => r.intent_classification === 'positive_meeting').length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Sync Log ─────────────────────────────────────── */}
        <TabsContent value="log">
          <div className="flex items-center gap-3 mb-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="synced">Synced</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="skipped">Skipped</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-stone-400">{filteredSyncs.length} records</span>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-stone-400 py-12 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading sync log…
            </div>
          ) : filteredSyncs.length === 0 ? (
            <div className="text-center py-12 text-stone-400">
              <Database className="w-8 h-8 mx-auto mb-3 opacity-40" />
              <p>No syncs yet.</p>
              <p className="text-sm mt-1">Syncs appear here as leads are sourced and emails are sent.</p>
            </div>
          ) : (
            <div className="rounded-lg border border-[#E7E5E4] overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-stone-50 border-b border-[#E7E5E4]">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-space-grotesk text-xs text-stone-500 uppercase tracking-wide">Entity</th>
                    <th className="text-left px-4 py-2.5 font-space-grotesk text-xs text-stone-500 uppercase tracking-wide">Client</th>
                    <th className="text-left px-4 py-2.5 font-space-grotesk text-xs text-stone-500 uppercase tracking-wide">CRM</th>
                    <th className="text-left px-4 py-2.5 font-space-grotesk text-xs text-stone-500 uppercase tracking-wide">Status</th>
                    <th className="text-left px-4 py-2.5 font-space-grotesk text-xs text-stone-500 uppercase tracking-wide">Time</th>
                    <th className="text-left px-4 py-2.5 font-space-grotesk text-xs text-stone-500 uppercase tracking-wide">CRM ID</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7E5E4]">
                  {filteredSyncs.map(sync => {
                    const cfg = STATUS_CONFIG[sync.sync_status] || STATUS_CONFIG.pending;
                    const Icon = cfg.icon;
                    return (
                      <tr key={sync.id} className="hover:bg-stone-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium capitalize">{sync.entity_type}</div>
                          <div className="text-xs text-stone-400 font-mono">{sync.entity_id.slice(0, 8)}…</div>
                        </td>
                        <td className="px-4 py-3 text-stone-600">
                          {sync.client?.name ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-stone-600">
                          {CRM_LABELS[sync.crm_type] || sync.crm_type}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.color}`}>
                            <Icon className="w-3 h-3" />
                            {cfg.label}
                          </span>
                          {sync.sync_status === 'failed' && sync.error_msg && (
                            <div className="text-xs text-red-500 mt-1 max-w-[200px] truncate" title={sync.error_msg}>
                              {sync.error_msg}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-stone-400 text-xs whitespace-nowrap">
                          {formatTime(sync.synced_at || sync.created_at)}
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-stone-400">
                          {sync.crm_record_id ? sync.crm_record_id.slice(0, 12) + '…' : '—'}
                        </td>
                        <td className="px-4 py-3">
                          {sync.sync_status === 'failed' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-[#CC5500] hover:text-[#CC5500] hover:bg-orange-50 h-7 px-2"
                              disabled={retrying === sync.id}
                              onClick={() => handleRetry(sync)}
                            >
                              {retrying === sync.id
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <RotateCcw className="w-3.5 h-3.5" />
                              }
                              <span className="ml-1">Retry</span>
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* ── Clients ──────────────────────────────────────── */}
        <TabsContent value="clients">
          {loading ? (
            <div className="flex items-center gap-2 text-stone-400 py-12 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading clients…
            </div>
          ) : clients.length === 0 ? (
            <div className="text-center py-12 text-stone-400">
              <Building2 className="w-8 h-8 mx-auto mb-3 opacity-40" />
              <p>No clients have Rook enabled yet.</p>
              <p className="text-sm mt-1">Enable Rook in the Clients page to start syncing.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {clientStats.map(c => (
                <Card key={c.id}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#CC5500]/10 flex items-center justify-center">
                          <Castle className="w-4 h-4 text-[#CC5500]" />
                        </div>
                        <div>
                          <div className="font-medium">{c.name}</div>
                          <div className="text-sm text-stone-400">
                            {CRM_LABELS[c.rook_crm_type || ''] || c.rook_crm_type || 'No CRM set'}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-6 text-sm">
                        <div className="text-center">
                          <div className="font-medium text-emerald-600">{c.synced}</div>
                          <div className="text-xs text-stone-400">Synced</div>
                        </div>
                        <div className="text-center">
                          <div className={`font-medium ${c.failed > 0 ? 'text-red-600' : 'text-stone-400'}`}>{c.failed}</div>
                          <div className="text-xs text-stone-400">Failed</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium">{c.rate !== null ? `${c.rate}%` : '—'}</div>
                          <div className="text-xs text-stone-400">Rate</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-stone-400">Last sync</div>
                          <div className="text-xs font-medium">{c.lastSync ? timeAgo(c.lastSync) : 'Never'}</div>
                        </div>
                        <Badge variant="outline" className={c.status === 'active' ? 'border-emerald-300 text-emerald-700' : ''}>
                          {c.status}
                        </Badge>
                      </div>
                    </div>
                    {c.failed > 0 && (
                      <div className="mt-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                        {c.failed} failed sync{c.failed > 1 ? 's' : ''} — retry from the Sync Log tab.
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Manual Sync ───────────────────────────────────── */}
        <TabsContent value="manual">
          <Card className="max-w-lg">
            <CardHeader>
              <CardTitle className="text-base font-instrument-serif">Trigger a manual sync</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs font-space-grotesk uppercase tracking-wide text-stone-500 mb-1.5 block">Client</Label>
                <Select value={manualClientId} onValueChange={setManualClientId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a client…" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} — {CRM_LABELS[c.rook_crm_type || ''] || c.rook_crm_type || 'No CRM'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-space-grotesk uppercase tracking-wide text-stone-500 mb-1.5 block">Entity type</Label>
                <Select value={manualEntityType} onValueChange={v => setManualEntityType(v as 'lead' | 'ticket')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lead">Lead</SelectItem>
                    <SelectItem value="ticket">Ticket</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-space-grotesk uppercase tracking-wide text-stone-500 mb-1.5 block">Entity ID (UUID)</Label>
                <Input
                  placeholder="e.g. 3f4a1b2c-…"
                  value={manualEntityId}
                  onChange={e => setManualEntityId(e.target.value.trim())}
                  className="font-mono text-sm"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="force-toggle"
                  type="checkbox"
                  checked={manualForce}
                  onChange={e => setManualForce(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="force-toggle" className="text-sm text-stone-600 cursor-pointer">
                  Force re-sync (overwrite already-synced records)
                </Label>
              </div>

              <Button
                className="w-full bg-[#CC5500] hover:bg-[#b34a00] text-white"
                disabled={manualLoading || !manualClientId || !manualEntityId}
                onClick={handleManualSync}
              >
                {manualLoading
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Syncing…</>
                  : <><Play className="w-4 h-4 mr-2" />Sync now</>
                }
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Bulk Sync ─────────────────────────────────────── */}
        <TabsContent value="bulk">
          <Card className="max-w-lg">
            <CardHeader>
              <CardTitle className="text-base font-instrument-serif">Bulk sync all leads</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs font-space-grotesk uppercase tracking-wide text-stone-500 mb-1.5 block">Client</Label>
                <Select value={bulkClientId} onValueChange={setBulkClientId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a client…" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} — {CRM_LABELS[c.rook_crm_type || ''] || c.rook_crm_type || 'No CRM'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="text-sm text-stone-500 bg-stone-50 rounded-md px-3 py-2">
                Pushes all leads assigned to this client that haven't been synced yet. Already-synced leads are skipped. Use Manual Sync with Force enabled to re-push specific records.
              </div>

              {bulkProgress && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-stone-600">{bulkProgress.done} / {bulkProgress.total} processed</span>
                    {bulkProgress.failed > 0 && (
                      <span className="text-red-500">{bulkProgress.failed} failed</span>
                    )}
                  </div>
                  <div className="w-full bg-stone-100 rounded-full h-1.5">
                    <div
                      className="bg-[#CC5500] h-1.5 rounded-full transition-all"
                      style={{ width: `${(bulkProgress.done / bulkProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              <Button
                className="w-full bg-[#CC5500] hover:bg-[#b34a00] text-white"
                disabled={bulkLoading || !bulkClientId}
                onClick={handleBulkSync}
              >
                {bulkLoading
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Syncing…</>
                  : <><Database className="w-4 h-4 mr-2" />Bulk sync leads</>
                }
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Replies ───────────────────────────────────────── */}
        <TabsContent value="replies">
          {replyLogs.length === 0 ? (
            <div className="text-center py-12 text-stone-400">
              <Mail className="w-8 h-8 mx-auto mb-3 opacity-40" />
              <p>No classified replies yet.</p>
              <p className="text-sm mt-1">When prospects reply to Bishop emails, Rook classifies them here.</p>
            </div>
          ) : (
            <>
              {/* Intent summary */}
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-5">
                {Object.entries(INTENT_CONFIG).map(([key, cfg]) => {
                  const count = replyLogs.filter(r => r.intent_classification === key).length;
                  const Icon = cfg.icon;
                  return (
                    <div key={key} className="rounded-lg border border-[#E7E5E4] p-3 text-center">
                      <Icon className="w-4 h-4 mx-auto mb-1 text-stone-400" />
                      <div className="text-lg font-instrument-serif">{count}</div>
                      <div className="text-xs text-stone-500">{cfg.label}</div>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-lg border border-[#E7E5E4] overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-stone-50 border-b border-[#E7E5E4]">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-space-grotesk text-xs text-stone-500 uppercase tracking-wide">Lead</th>
                      <th className="text-left px-4 py-2.5 font-space-grotesk text-xs text-stone-500 uppercase tracking-wide">Intent</th>
                      <th className="text-left px-4 py-2.5 font-space-grotesk text-xs text-stone-500 uppercase tracking-wide">Confidence</th>
                      <th className="text-left px-4 py-2.5 font-space-grotesk text-xs text-stone-500 uppercase tracking-wide">Extracted</th>
                      <th className="text-left px-4 py-2.5 font-space-grotesk text-xs text-stone-500 uppercase tracking-wide">State Change</th>
                      <th className="text-left px-4 py-2.5 font-space-grotesk text-xs text-stone-500 uppercase tracking-wide">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E7E5E4]">
                    {replyLogs.map(log => {
                      const intentCfg = INTENT_CONFIG[log.intent_classification] || { label: log.intent_classification, color: 'bg-stone-100 text-stone-600', icon: HelpCircle };
                      const Icon = intentCfg.icon;
                      return (
                        <tr key={log.id} className="hover:bg-stone-50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-medium">{log.lead?.name || '—'}</div>
                            <div className="text-xs text-stone-400">{log.lead?.email || log.lead_id.slice(0, 8) + '…'}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${intentCfg.color}`}>
                              <Icon className="w-3 h-3" />
                              {intentCfg.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-16 bg-stone-100 rounded-full h-1.5">
                                <div
                                  className="bg-[#CC5500] h-1.5 rounded-full"
                                  style={{ width: `${log.classification_confidence * 100}%` }}
                                />
                              </div>
                              <span className="text-xs text-stone-500">{Math.round(log.classification_confidence * 100)}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-stone-500">
                            {log.extracted_phone && <div>📞 {log.extracted_phone}</div>}
                            {log.extracted_title && <div>💼 {log.extracted_title}</div>}
                            {!log.extracted_phone && !log.extracted_title && <span className="text-stone-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-xs">
                            {log.bishop_status_before && log.bishop_status_after ? (
                              <span className="text-stone-500">
                                {log.bishop_status_before} <ArrowRight className="w-3 h-3 inline" /> <span className="font-medium text-[#CC5500]">{log.bishop_status_after}</span>
                              </span>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-3 text-xs text-stone-400 whitespace-nowrap">
                            {formatTime(log.created_at)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}
