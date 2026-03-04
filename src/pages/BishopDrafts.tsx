import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Mail, Send, X, Edit2, RefreshCw, Loader2, Inbox, Swords,
  CheckCircle, Clock, ChevronDown, ChevronUp,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Draft {
  id: string;
  lead_id: string | null;
  subject: string;
  body: string;
  strategy_used: string | null;
  created_at: string;
  lead?: {
    name: string | null;
    company: string | null;
    email: string | null;
  } | null;
}

const STRATEGY_META: Record<string, { label: string; color: string; bg: string }> = {
  SNIPER_INTRO:      { label: 'Intro',     color: '#0ea5e9', bg: '#e0f2fe' },
  INTRO_FOLLOW_UP:   { label: 'Follow-Up', color: '#d97706', bg: '#fef3c7' },
  VALUE_NUDGE:       { label: 'Nudge',     color: '#CC5500', bg: '#fff0e6' },
  BREAKUP:           { label: 'Breakup',   color: '#dc2626', bg: '#fee2e2' },
};

function strategyMeta(s: string | null) {
  return STRATEGY_META[s ?? ''] ?? { label: s ?? 'Unknown', color: '#78716c', bg: '#f5f5f4' };
}

const FILTER_TABS = [
  { id: 'all',     label: 'All' },
  { id: 'SNIPER_INTRO',    label: 'Intro' },
  { id: 'INTRO_FOLLOW_UP', label: 'Follow-Up' },
  { id: 'VALUE_NUDGE',     label: 'Nudge' },
  { id: 'BREAKUP',         label: 'Breakup' },
];

export default function BishopDrafts() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const leadIdFilter = searchParams.get('lead_id');

  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  const [sweeping, setSweeping] = useState(false);

  // Per-card state
  const [sending, setSending] = useState<Record<string, boolean>>({});
  const [rejecting, setRejecting] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<Record<string, boolean>>({});
  const [editSubject, setEditSubject] = useState<Record<string, string>>({});
  const [editBody, setEditBody] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const loadDrafts = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    let query = supabase
      .from('ai_drafts')
      .select('id, lead_id, subject, body, strategy_used, created_at')
      .eq('user_id', user.id)
      .eq('status', 'PENDING_APPROVAL')
      .order('created_at', { ascending: false });

    if (leadIdFilter) query = query.eq('lead_id', leadIdFilter);

    const { data: draftRows, error } = await query;
    if (error) { console.error(error); setLoading(false); return; }

    // Fetch lead context for each draft that has a lead_id
    const leadIds = [...new Set((draftRows ?? []).map(d => d.lead_id).filter(Boolean))];
    let leadsMap: Record<string, { name: string | null; company: string | null; email: string | null }> = {};
    if (leadIds.length > 0) {
      const { data: leadRows } = await supabase
        .from('leads')
        .select('id, name, company, email')
        .in('id', leadIds as string[]);
      for (const l of leadRows ?? []) leadsMap[l.id] = l;
    }

    setDrafts((draftRows ?? []).map(d => ({
      ...d,
      lead: d.lead_id ? leadsMap[d.lead_id] ?? null : null,
    })));
    setLoading(false);
  }, [user, leadIdFilter]);

  useEffect(() => { loadDrafts(); }, [loadDrafts]);

  const filtered = activeFilter === 'all'
    ? drafts
    : drafts.filter(d => d.strategy_used === activeFilter);

  const handleApprove = async (draft: Draft) => {
    if (!user) return;
    setSending(p => ({ ...p, [draft.id]: true }));
    try {
      const body = editing[draft.id]
        ? { draft_id: draft.id, user_id: user.id }
        : { draft_id: draft.id, user_id: user.id };

      // If editing, patch the draft first
      if (editing[draft.id]) {
        await supabase.from('ai_drafts').update({
          subject: editSubject[draft.id] ?? draft.subject,
          body: editBody[draft.id] ?? draft.body,
        }).eq('id', draft.id);
      }

      const { error } = await supabase.functions.invoke('bishop-send', { body });
      if (error) throw new Error(error.message);

      toast({ title: 'Email sent', description: `Sent to ${draft.lead?.email ?? 'lead'}` });
      setDrafts(p => p.filter(d => d.id !== draft.id));
    } catch (e: any) {
      toast({ title: 'Send failed', description: e.message, variant: 'destructive' });
    } finally {
      setSending(p => ({ ...p, [draft.id]: false }));
    }
  };

  const handleReject = async (draftId: string) => {
    setRejecting(p => ({ ...p, [draftId]: true }));
    const { error } = await supabase.from('ai_drafts').update({ status: 'REJECTED' }).eq('id', draftId);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setDrafts(p => p.filter(d => d.id !== draftId));
    }
    setRejecting(p => ({ ...p, [draftId]: false }));
  };

  const handleEditToggle = (draft: Draft) => {
    const on = !editing[draft.id];
    setEditing(p => ({ ...p, [draft.id]: on }));
    if (on) {
      setEditSubject(p => ({ ...p, [draft.id]: draft.subject }));
      setEditBody(p => ({ ...p, [draft.id]: draft.body }));
    }
  };

  const handleSweep = async () => {
    if (!user) return;
    setSweeping(true);
    try {
      const { error } = await supabase.functions.invoke('bishop-sweep', { body: { user_id: user.id } });
      if (error) throw new Error(error.message);
      toast({ title: 'Sweep complete', description: 'New drafts generated' });
      await loadDrafts();
    } catch (e: any) {
      toast({ title: 'Sweep failed', description: e.message, variant: 'destructive' });
    } finally {
      setSweeping(false);
    }
  };

  return (
    <MainLayout>
      <Header
        title="Drafts Queue"
        subtitle="Review and approve Bishop's outreach emails before sending"
        icon={<Swords className="h-6 w-6" style={{ color: '#CC5500' }} />}
      />

      <div className="p-4 md:p-6 max-w-4xl" style={{ fontFamily: "'Inter', sans-serif" }}>

        {/* Filter tabs + actions */}
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <div className="flex items-center gap-1 flex-wrap">
            {FILTER_TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id)}
                className="px-3 py-1.5 rounded-full text-sm font-medium transition-all"
                style={{
                  background: activeFilter === tab.id ? '#CC5500' : '#F5F4F0',
                  color: activeFilter === tab.id ? '#fff' : '#78716c',
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                {tab.label}
                {tab.id !== 'all' && (
                  <span className="ml-1.5 text-xs opacity-70">
                    {drafts.filter(d => d.strategy_used === tab.id).length}
                  </span>
                )}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSweep}
            disabled={sweeping}
            style={{ borderColor: '#E7E5E4' }}
          >
            {sweeping ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Run Sweep
          </Button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#CC5500' }} />
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: '#F5F4F0' }}>
              <Inbox className="h-8 w-8" style={{ color: '#a8a29e' }} />
            </div>
            <h3 className="text-lg font-semibold mb-1" style={{ fontFamily: "'Instrument Serif', serif", color: '#1C1917' }}>
              No pending drafts
            </h3>
            <p className="text-sm mb-6" style={{ color: '#78716c' }}>
              Run Bishop sweep to generate outreach emails for your leads.
            </p>
            <Button onClick={handleSweep} disabled={sweeping} style={{ background: '#CC5500', color: '#fff', border: 'none' }}>
              {sweeping ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Run Bishop Sweep
            </Button>
          </div>
        )}

        {/* Draft cards */}
        {!loading && filtered.length > 0 && (
          <div className="space-y-4">
            {filtered.map(draft => {
              const meta = strategyMeta(draft.strategy_used);
              const isEditing = editing[draft.id] ?? false;
              const isSending = sending[draft.id] ?? false;
              const isRejecting = rejecting[draft.id] ?? false;
              const isExpanded = expanded[draft.id] ?? false;

              return (
                <div
                  key={draft.id}
                  className="rounded-xl border"
                  style={{ background: '#fff', borderColor: '#E7E5E4' }}
                >
                  {/* Card header */}
                  <div className="p-5 pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {/* Strategy badge + timestamp */}
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span
                            className="px-2 py-0.5 rounded-full text-xs font-semibold"
                            style={{ background: meta.bg, color: meta.color, fontFamily: "'Space Grotesk', sans-serif" }}
                          >
                            {meta.label}
                          </span>
                          <span className="text-xs flex items-center gap-1" style={{ color: '#a8a29e' }}>
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(draft.created_at), { addSuffix: true })}
                          </span>
                        </div>

                        {/* Lead info */}
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                            style={{ background: '#F5F4F0', color: '#1C1917' }}>
                            {(draft.lead?.name ?? '?')[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-sm" style={{ color: '#1C1917' }}>
                              {draft.lead?.name ?? 'Unknown Lead'}
                              {draft.lead?.company && (
                                <span className="font-normal ml-1" style={{ color: '#78716c' }}>
                                  · {draft.lead.company}
                                </span>
                              )}
                            </p>
                            {draft.lead?.email && (
                              <p className="text-xs" style={{ color: '#a8a29e' }}>{draft.lead.email}</p>
                            )}
                          </div>
                        </div>

                        {/* Subject + body */}
                        {isEditing ? (
                          <div className="space-y-2">
                            <Input
                              value={editSubject[draft.id] ?? draft.subject}
                              onChange={e => setEditSubject(p => ({ ...p, [draft.id]: e.target.value }))}
                              placeholder="Subject"
                              className="text-sm"
                              style={{ borderColor: '#E7E5E4' }}
                            />
                            <Textarea
                              value={editBody[draft.id] ?? draft.body}
                              onChange={e => setEditBody(p => ({ ...p, [draft.id]: e.target.value }))}
                              rows={8}
                              className="text-sm resize-none"
                              style={{ borderColor: '#E7E5E4' }}
                            />
                          </div>
                        ) : (
                          <>
                            <p className="text-sm font-medium mb-1" style={{ color: '#1C1917' }}>
                              {draft.subject}
                            </p>
                            <p className="text-sm whitespace-pre-wrap" style={{ color: '#57534e' }}>
                              {isExpanded ? draft.body : draft.body.slice(0, 200) + (draft.body.length > 200 ? '…' : '')}
                            </p>
                            {draft.body.length > 200 && (
                              <button
                                onClick={() => setExpanded(p => ({ ...p, [draft.id]: !isExpanded }))}
                                className="mt-1 text-xs flex items-center gap-0.5"
                                style={{ color: '#CC5500' }}
                              >
                                {isExpanded ? <><ChevronUp className="h-3 w-3" /> Show less</> : <><ChevronDown className="h-3 w-3" /> Show more</>}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card actions */}
                  <div className="px-5 pb-5 flex items-center gap-2 flex-wrap">
                    <Button
                      size="sm"
                      onClick={() => handleApprove(draft)}
                      disabled={isSending || isRejecting}
                      style={{ background: '#CC5500', color: '#fff', border: 'none' }}
                    >
                      {isSending
                        ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" /> Sending…</>
                        : <><Send className="h-4 w-4 mr-1.5" />{isEditing ? 'Save & Send' : 'Approve & Send'}</>
                      }
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEditToggle(draft)}
                      disabled={isSending || isRejecting}
                      style={{ borderColor: '#E7E5E4', color: isEditing ? '#CC5500' : '#78716c' }}
                    >
                      <Edit2 className="h-4 w-4 mr-1.5" />
                      {isEditing ? 'Cancel Edit' : 'Edit'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleReject(draft.id)}
                      disabled={isSending || isRejecting}
                      style={{ color: '#dc2626' }}
                    >
                      {isRejecting
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <X className="h-4 w-4 mr-1.5" />
                      }
                      Reject
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
