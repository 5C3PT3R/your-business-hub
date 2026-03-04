import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Header } from '@/components/layout/Header';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import {
  Shield, Search, MessageSquare, Phone, AlertTriangle, CheckCircle2,
  TrendingUp, Zap, Settings, Twitter, Linkedin, Mail, Instagram, Facebook,
  ArrowLeft, Send, Bot, RefreshCw, Sparkles, User, BookOpen, Plus, Edit2,
  Trash2, ExternalLink, ChevronRight,
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useToast } from '@/hooks/use-toast';
import {
  getTickets, getTicketDetail, updateTicketStatus, addMessage,
  getKnightStats, getKnightConfig, updateKnightConfig,
  subscribeToTickets, subscribeToMessages, BUSINESS_TYPES,
  type Ticket, type TicketDetail, type TicketMessage,
  type KnightStats, type KnightConfig,
} from '@/lib/knight-ticket-service';
import {
  getKnowledgeEntries, addKnowledgeEntry, updateKnowledgeEntry, deleteKnowledgeEntry,
  type KnowledgeEntry,
} from '@/lib/knight-knowledge-service';
import { getMetaIntegration, getMetaWhatsAppAccounts, sendWhatsAppText } from '@/lib/meta-service';
import { supabase } from '@/integrations/supabase/client';

// ─── Helpers ──────────────────────────────────────────────

function fmtTs(date: Date): string {
  const now  = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60)    return 'Just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function sentimentDisplay(score: number | null | undefined) {
  if (!score) return null;
  if (score >= 7) return { emoji: '😊', cls: 'text-emerald-600' };
  if (score >= 4) return { emoji: '😐', cls: 'text-amber-500' };
  return            { emoji: '😠', cls: 'text-red-500' };
}

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  twitter:   <Twitter className="w-4 h-4" />,
  linkedin:  <Linkedin className="w-4 h-4" />,
  outlook:   <Mail className="w-4 h-4" />,
  whatsapp:  <MessageSquare className="w-4 h-4" />,
  instagram: <Instagram className="w-4 h-4" />,
  facebook:  <Facebook className="w-4 h-4" />,
  voice:     <Phone className="w-4 h-4" />,
};

const KB_CATEGORIES = ['faq', 'product', 'pricing', 'policy', 'technical', 'troubleshooting'] as const;
type KbCategory = typeof KB_CATEGORIES[number];

const CATEGORY_STYLE: Record<string, string> = {
  faq:            'bg-blue-50 text-blue-700 border-blue-200',
  product:        'bg-teal-50 text-teal-700 border-teal-200',
  pricing:        'bg-emerald-50 text-emerald-700 border-emerald-200',
  policy:         'bg-amber-50 text-amber-700 border-amber-200',
  technical:      'bg-purple-50 text-purple-700 border-purple-200',
  troubleshooting:'bg-red-50 text-red-700 border-red-200',
};

// ─── Sub-components ───────────────────────────────────────

function MetricTile({ label, value, Icon, highlight }: {
  label: string; value: string | number; Icon: React.ElementType; highlight?: boolean;
}) {
  return (
    <div className={cn(
      'flex flex-col gap-2 p-4 rounded-lg border',
      highlight ? 'bg-[#FFF8F5] border-[#CC5500]/20' : 'bg-stone-50 border-[#E7E5E4]',
    )}>
      <div className="flex items-center gap-2">
        <div className={cn('w-7 h-7 rounded-md flex items-center justify-center',
          highlight ? 'bg-[#CC5500]/10' : 'bg-white border border-[#E7E5E4]',
        )}>
          <Icon className={cn('w-3.5 h-3.5', highlight ? 'text-[#CC5500]' : 'text-stone-500')} />
        </div>
        <span className="text-[10px] uppercase tracking-wider text-stone-500"
          style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
          {label}
        </span>
      </div>
      <span className={cn('text-2xl font-bold', highlight ? 'text-[#CC5500]' : 'text-stone-900')}
        style={{ fontFamily: 'Instrument Serif, serif' }}>
        {value}
      </span>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────

export default function Knight() {
  const navigate        = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast }       = useToast();
  const { workspace }   = useWorkspace();
  const isMobile        = useIsMobile();

  const tabParam  = searchParams.get('tab') || 'tickets';
  const [activeTab, setActiveTab] = useState(tabParam);

  useEffect(() => {
    setActiveTab(searchParams.get('tab') || 'tickets');
  }, [searchParams]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    tab === 'tickets' ? setSearchParams({}) : setSearchParams({ tab });
  };

  // ── Core state ────────────────────────────────────────
  const [tickets, setTickets]           = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<TicketDetail | null>(null);
  const [stats, setStats]               = useState<KnightStats | null>(null);
  const [config, setConfig]             = useState<KnightConfig | null>(null);
  const [draftText, setDraftText]       = useState({ agent_name: '', business_description: '', persona_prompt: '' });
  const [contactMap, setContactMap]     = useState<Map<string, { name: string; type: 'contact' | 'lead'; id: string }>>(new Map());
  const [loading, setLoading]           = useState(true);
  const [replyText, setReplyText]       = useState('');
  const [sending, setSending]           = useState(false);
  const [guideMode, setGuideMode]       = useState(false);
  const [guiding, setGuiding]           = useState(false);

  // ── Filters ───────────────────────────────────────────
  const [statusFilter, setStatusFilter]   = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [channelFilter, setChannelFilter] = useState('all');
  const [searchQuery, setSearchQuery]     = useState('');

  // ── Knowledge Base state ──────────────────────────────
  const [kbEntries, setKbEntries]         = useState<KnowledgeEntry[]>([]);
  const [kbCategory, setKbCategory]       = useState<string>('all');
  const [kbLoading, setKbLoading]         = useState(false);
  const [kbSheetOpen, setKbSheetOpen]     = useState(false);
  const [editingEntry, setEditingEntry]   = useState<KnowledgeEntry | null>(null);
  const [kbSaving, setKbSaving]           = useState(false);
  const [kbForm, setKbForm]               = useState({ title: '', category: 'faq' as KbCategory, content: '', source_url: '' });

  // ── Data loading ──────────────────────────────────────
  useEffect(() => {
    if (workspace?.id) {
      loadData();
      const ch = subscribeToTickets(workspace.id, (ticket) => {
        setTickets((prev) => {
          const i = prev.findIndex((t) => t.id === ticket.id);
          if (i >= 0) { const u = [...prev]; u[i] = ticket; return u; }
          return [ticket, ...prev];
        });
      });

      // Rebuild contactMap whenever a contact name changes
      const contactSub = supabase
        .channel('knight_contact_changes')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'contacts' }, () => {
          rebuildContactMap();
        })
        .subscribe();

      return () => {
        ch.unsubscribe();
        supabase.removeChannel(contactSub);
      };
    }
  }, [workspace?.id]);

  useEffect(() => {
    if (!selectedTicket?.ticket.id) return;
    const ch = subscribeToMessages(selectedTicket.ticket.id, (msg: TicketMessage) => {
      setSelectedTicket((prev) => {
        if (!prev || prev.ticket.id !== msg.ticket_id) return prev;
        if (prev.messages.some((m) => m.id === msg.id)) return prev;
        return { ...prev, messages: [...prev.messages, msg] };
      });
    });
    return () => { ch.unsubscribe(); };
  }, [selectedTicket?.ticket.id]);

  // Load KB when tab changes to 'kb'
  useEffect(() => {
    if (activeTab === 'kb' && workspace?.id) loadKb();
  }, [activeTab, workspace?.id, kbCategory]);

  const rebuildContactMap = async () => {
    if (!workspace?.id) return;
    const [contactsRes, leadsRes] = await Promise.all([
      supabase.from('contacts').select('id, name, phone').eq('workspace_id', workspace.id),
      supabase.from('leads').select('id, name, phone'),
    ]);
    const normalize = (p: string) => p.replace(/\D/g, '').slice(-10);
    const map = new Map<string, { name: string; type: 'contact' | 'lead'; id: string }>();
    (contactsRes.data || []).forEach((c: any) => {
      if (c.phone && c.name) map.set(normalize(c.phone), { name: c.name, type: 'contact', id: c.id });
    });
    (leadsRes.data || []).forEach((l: any) => {
      if (l.phone && l.name) map.set(normalize(l.phone), { name: l.name, type: 'lead', id: l.id });
    });
    setContactMap(map);
  };

  const loadData = async () => {
    if (!workspace?.id) return;
    setLoading(true);
    try {
      const [ticketsData, statsData, configData] = await Promise.all([
        getTickets(workspace.id),
        getKnightStats(workspace.id),
        getKnightConfig(workspace.id),
      ]);
      setTickets(ticketsData);
      setStats(statsData);
      setConfig(configData);
      if (configData) {
        setDraftText({
          agent_name:           configData.agent_name || '',
          business_description: configData.business_description || '',
          persona_prompt:       configData.persona_prompt || '',
        });
      }
      await rebuildContactMap();
    } finally {
      setLoading(false);
    }
  };

  const loadKb = async () => {
    if (!workspace?.id) return;
    setKbLoading(true);
    const entries = await getKnowledgeEntries(workspace.id, {
      category: kbCategory !== 'all' ? (kbCategory as KbCategory) : undefined,
    });
    setKbEntries(entries);
    setKbLoading(false);
  };

  // ── Ticket actions ────────────────────────────────────
  const handleSelectTicket = async (ticket: Ticket) => {
    const detail = await getTicketDetail(ticket.id);
    setSelectedTicket(detail);
  };

  const handleStatusChange = async (ticketId: string, status: Ticket['status']) => {
    const ok = await updateTicketStatus(ticketId, status);
    if (ok) {
      toast({ title: 'Ticket updated' });
      loadData();
      if (selectedTicket?.ticket.id === ticketId) {
        setSelectedTicket(await getTicketDetail(ticketId));
      }
    }
  };

  const handleSendReply = async () => {
    if (!selectedTicket || !replyText.trim() || !workspace?.id) return;
    setSending(true);
    try {
      const msg = replyText.trim();
      await addMessage(selectedTicket.ticket.id, 'human_agent', msg);
      setReplyText('');
      if (selectedTicket.ticket.source_channel === 'whatsapp') {
        try {
          const integration = await getMetaIntegration(workspace.id);
          if (integration?.id && integration?.access_token) {
            const accounts = await getMetaWhatsAppAccounts(integration.id);
            const active   = accounts.find((a) => a.is_active && a.phone_number_id);
            if (active?.phone_number_id) {
              await sendWhatsAppText(active.phone_number_id, integration.access_token, selectedTicket.ticket.source_handle, msg);
            }
          }
        } catch {
          toast({ title: 'Saved but WhatsApp delivery failed', variant: 'destructive' });
        }
      }
      toast({ title: 'Reply sent' });
      setSelectedTicket(await getTicketDetail(selectedTicket.ticket.id));
    } catch {
      toast({ title: 'Failed to send reply', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const handleGuideKnight = async () => {
    if (!selectedTicket || !replyText.trim() || !workspace?.id) return;
    setGuiding(true);
    try {
      const instruction = replyText.trim();
      const { data, error } = await supabase.functions.invoke('knight-webhook', {
        body: { action: 'guide', ticket_id: selectedTicket.ticket.id, instruction, workspace_id: workspace.id },
      });
      if (error) { toast({ title: 'Failed to guide Knight', variant: 'destructive' }); return; }
      setReplyText('');
      toast({ title: data?.whatsapp_sent ? 'Knight sent guided response via WhatsApp' : 'Knight sent guided response' });
      setSelectedTicket(await getTicketDetail(selectedTicket.ticket.id));
    } catch {
      toast({ title: 'Failed to guide Knight', variant: 'destructive' });
    } finally {
      setGuiding(false);
    }
  };

  const handleConfigUpdate = async (updates: Partial<KnightConfig>, showToast = false) => {
    if (!workspace?.id) return;
    const updated = await updateKnightConfig(workspace.id, updates);
    if (updated) { setConfig(updated); if (showToast) toast({ title: 'Settings saved' }); }
  };

  // ── KB actions ────────────────────────────────────────
  const openKbSheet = (entry: KnowledgeEntry | null) => {
    setEditingEntry(entry);
    setKbForm(entry
      ? { title: entry.title || '', category: entry.category, content: entry.content, source_url: entry.source_url || '' }
      : { title: '', category: 'faq', content: '', source_url: '' }
    );
    setKbSheetOpen(true);
  };

  const handleKbSave = async () => {
    if (!workspace?.id || !kbForm.title.trim() || !kbForm.content.trim()) return;
    setKbSaving(true);
    try {
      if (editingEntry) {
        const ok = await updateKnowledgeEntry(editingEntry.id, {
          title: kbForm.title, category: kbForm.category,
          content: kbForm.content, sourceUrl: kbForm.source_url || undefined,
        });
        if (ok) toast({ title: 'Entry updated' });
        else    toast({ title: 'Failed to update', variant: 'destructive' });
      } else {
        const created = await addKnowledgeEntry({
          workspaceId: workspace.id, title: kbForm.title, category: kbForm.category,
          content: kbForm.content, sourceUrl: kbForm.source_url || undefined,
        });
        if (created) toast({ title: 'Entry added' });
        else         toast({ title: 'Failed to add entry', variant: 'destructive' });
      }
      setKbSheetOpen(false);
      loadKb();
    } finally {
      setKbSaving(false);
    }
  };

  const handleKbDelete = async (id: string) => {
    if (!confirm('Delete this knowledge entry?')) return;
    const ok = await deleteKnowledgeEntry(id);
    if (ok) { toast({ title: 'Entry deleted' }); loadKb(); }
    else     toast({ title: 'Failed to delete', variant: 'destructive' });
  };

  // ── Derived ────────────────────────────────────────────
  const resolveContact = (handle: string) => {
    const n = handle.replace(/\D/g, '').slice(-10);
    return n.length >= 7 ? (contactMap.get(n) ?? null) : null;
  };

  const filteredTickets = useMemo(() => {
    let result = tickets;
    if (statusFilter   !== 'all') result = result.filter((t) => t.status         === statusFilter);
    if (priorityFilter !== 'all') result = result.filter((t) => t.priority        === priorityFilter);
    if (channelFilter  !== 'all') result = result.filter((t) => t.source_channel  === channelFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((t) =>
        t.source_handle.toLowerCase().includes(q) || t.summary?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [tickets, statusFilter, priorityFilter, channelFilter, searchQuery]);

  const agentName = config?.agent_name || 'Knight';

  // ─── Tab bar ──────────────────────────────────────────
  const TABS = [
    { id: 'tickets',  label: 'Tickets',        Icon: MessageSquare },
    { id: 'activity', label: 'Activity',        Icon: Zap           },
    { id: 'kb',       label: 'Knowledge Base',  Icon: BookOpen      },
    { id: 'settings', label: 'Settings',        Icon: Settings      },
  ];

  return (
    <MainLayout>
      <Header
        title="Knight"
        subtitle="Omni-channel customer support agent"
        actions={
          <button onClick={loadData} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#E7E5E4] bg-white text-xs text-stone-600 hover:bg-stone-50 transition-colors disabled:opacity-50">
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            Refresh
          </button>
        }
      />

      <div className="min-h-screen" style={{ background: '#FDFBF7' }}>

        {/* Grain */}
        <div className="fixed inset-0 pointer-events-none opacity-[0.015]"
          style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 512 512\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'g\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.75\' numOctaves=\'4\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23g)\'/%3E%3C/svg%3E")' }}
        />

        <div className="p-6">
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <MetricTile label="Open Tickets"   value={stats?.open_tickets    || 0}    Icon={MessageSquare} />
            <MetricTile label="Critical"       value={stats?.critical_tickets || 0}   Icon={AlertTriangle} highlight={(stats?.critical_tickets ?? 0) > 0} />
            <MetricTile label="Resolved Today" value={stats?.resolved_today   || 0}   Icon={CheckCircle2} />
            <MetricTile label="Avg Sentiment"  value={stats?.avg_sentiment != null ? `${stats.avg_sentiment.toFixed(1)}/10` : '—'} Icon={TrendingUp} />
          </div>

          {/* Custom tab bar */}
          <div className="flex gap-1 mb-6 bg-stone-100 rounded-lg p-1 w-fit">
            {TABS.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => handleTabChange(id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-md text-sm transition-all',
                  activeTab === id
                    ? 'bg-white border border-[#E7E5E4] text-stone-900 font-medium shadow-sm'
                    : 'text-stone-500 hover:text-stone-700',
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>

          {/* ── TICKETS TAB ─────────────────────────────── */}
          {activeTab === 'tickets' && (
            <div className="space-y-4">
              {/* Filter bar */}
              <div className="flex flex-wrap gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
                  <input
                    type="text"
                    placeholder="Search tickets…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 pr-3 py-2 text-sm border border-[#E7E5E4] rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-[#CC5500] w-52"
                  />
                </div>
                {['all','open','pending_user','escalated','resolved'].map((s) => (
                  <button key={s} onClick={() => setStatusFilter(s)}
                    className={cn('px-3 py-1.5 text-xs rounded-md border transition-colors capitalize',
                      statusFilter === s
                        ? 'bg-[#1C1917] text-white border-[#1C1917]'
                        : 'bg-white text-stone-600 border-[#E7E5E4] hover:bg-stone-50',
                    )}>
                    {s === 'all' ? 'All' : s === 'pending_user' ? 'Pending' : s}
                  </button>
                ))}
              </div>

              {/* Split view */}
              <div className={cn('flex gap-4', isMobile && 'flex-col')}
                style={{ height: isMobile ? 'auto' : 'calc(100vh - 320px)', minHeight: 400 }}>

                {/* List */}
                <div className={cn(
                  'bg-white border border-[#E7E5E4] rounded-lg flex flex-col overflow-hidden',
                  isMobile ? 'w-full' : 'w-80 flex-shrink-0',
                  selectedTicket && isMobile && 'hidden',
                )}>
                  <div className="p-4 border-b border-[#E7E5E4]">
                    <p className="text-sm font-semibold text-stone-900"
                      style={{ fontFamily: 'Instrument Serif, serif' }}>
                      All Conversations
                    </p>
                    <p className="text-xs text-stone-400">{filteredTickets.length} ticket{filteredTickets.length !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="flex-1 overflow-y-auto divide-y divide-[#E7E5E4]">
                    {filteredTickets.length === 0 ? (
                      <div className="p-8 text-center">
                        <Shield className="w-10 h-10 mx-auto mb-3 text-stone-200" />
                        <p className="text-sm text-stone-500">No tickets found</p>
                      </div>
                    ) : filteredTickets.map((ticket) => {
                      const contact   = resolveContact(ticket.source_handle);
                      const sent      = sentimentDisplay(ticket.sentiment_score);
                      const isSelected = selectedTicket?.ticket.id === ticket.id;
                      return (
                        <button key={ticket.id} onClick={() => handleSelectTicket(ticket)}
                          className={cn(
                            'w-full p-3 text-left hover:bg-stone-50 transition-colors border-l-4',
                            isSelected              ? 'bg-stone-50 border-l-[#CC5500]'
                            : ticket.status === 'escalated'  ? 'border-l-red-400'
                            : ticket.priority === 'critical' ? 'border-l-amber-400'
                            : 'border-l-transparent',
                          )}
                        >
                          <div className="flex items-start gap-2">
                            <span className="text-stone-400 mt-0.5 shrink-0">
                              {CHANNEL_ICONS[ticket.source_channel] || <MessageSquare className="w-4 h-4" />}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-1 mb-0.5">
                                <span className="text-sm font-semibold text-stone-900 truncate">
                                  {contact ? contact.name : ticket.source_handle}
                                </span>
                                <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border uppercase tracking-wider shrink-0',
                                  ticket.status === 'escalated' ? 'bg-red-50 text-red-600 border-red-200'
                                  : ticket.status === 'open'    ? 'bg-blue-50 text-blue-600 border-blue-200'
                                  : ticket.status === 'resolved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-stone-100 text-stone-600 border-stone-200'
                                )} style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                                  {ticket.status.replace('_', ' ')}
                                </span>
                              </div>
                              <p className="text-xs text-stone-400 truncate mb-1">
                                {contact ? ticket.source_handle : (ticket.summary || '—')}
                              </p>
                              <div className="flex items-center gap-2">
                                {sent && <span className={cn('text-[11px]', sent.cls)}>{sent.emoji} {ticket.sentiment_score}/10</span>}
                                <span className="text-[10px] text-stone-400 ml-auto">{fmtTs(new Date(ticket.updated_at))}</span>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-stone-300 shrink-0 mt-1" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Detail */}
                {selectedTicket ? (
                  <div className="flex-1 flex flex-col gap-3 min-w-0 min-h-0">
                    {isMobile && (
                      <button onClick={() => setSelectedTicket(null)}
                        className="flex items-center gap-1.5 text-sm text-stone-600 hover:text-stone-900 w-fit">
                        <ArrowLeft className="w-4 h-4" /> Back
                      </button>
                    )}

                    {/* Header */}
                    {(() => {
                      const contact = resolveContact(selectedTicket.ticket.source_handle);
                      const sent    = sentimentDisplay(selectedTicket.ticket.sentiment_score);
                      return (
                        <div className="bg-white border border-[#E7E5E4] rounded-lg p-4 flex items-start justify-between gap-3 shrink-0">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="text-lg font-bold text-stone-900"
                                style={{ fontFamily: 'Instrument Serif, serif' }}>
                                {contact ? contact.name : selectedTicket.ticket.source_handle}
                              </span>
                              {contact && (
                                <>
                                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border uppercase tracking-wider',
                                    contact.type === 'lead'
                                      ? 'bg-blue-50 text-blue-600 border-blue-200'
                                      : 'bg-purple-50 text-purple-600 border-purple-200',
                                  )} style={{ fontFamily: 'Space Grotesk, sans-serif' }}>{contact.type}</span>
                                  <button onClick={() => navigate(`/${contact.type === 'lead' ? 'leads' : 'contacts'}?highlight=${contact.id}`)}
                                    className="text-xs text-[#CC5500] hover:underline">
                                    View {contact.type} ↗
                                  </button>
                                </>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap text-xs text-stone-500">
                              {contact && <span>{selectedTicket.ticket.source_handle}</span>}
                              <span className="capitalize px-1.5 py-0.5 rounded border border-[#E7E5E4] bg-stone-50">
                                {selectedTicket.ticket.source_channel}
                              </span>
                              {sent && (
                                <span className={cn('font-medium', sent.cls)}>
                                  {sent.emoji} {selectedTicket.ticket.sentiment_score}/10
                                </span>
                              )}
                            </div>
                          </div>
                          <Select value={selectedTicket.ticket.status}
                            onValueChange={(v) => handleStatusChange(selectedTicket.ticket.id, v as Ticket['status'])}>
                            <SelectTrigger className="w-32 shrink-0 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="open">Open</SelectItem>
                              <SelectItem value="pending_user">Pending User</SelectItem>
                              <SelectItem value="escalated">Escalate</SelectItem>
                              <SelectItem value="resolved">Resolve</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      );
                    })()}

                    {/* Messages */}
                    <div className="flex-1 bg-white border border-[#E7E5E4] rounded-lg overflow-y-auto p-4 space-y-3">
                      {selectedTicket.messages.map((msg) => (
                        <div key={msg.id} className={cn('flex', msg.sender_type === 'user' ? 'justify-start' : 'justify-end')}>
                          <div className={cn('max-w-[78%] rounded-xl p-3',
                            msg.sender_type === 'user'
                              ? 'bg-stone-100 text-stone-800'
                              : msg.sender_type === 'knight'
                              ? msg.metadata?.guided
                                ? 'bg-purple-50 border border-purple-100'
                                : 'bg-[#FFF8F5] border border-[#CC5500]/10'
                              : 'bg-blue-50 border border-blue-100',
                          )}>
                            <div className="flex items-center gap-1.5 mb-1">
                              {msg.sender_type === 'knight' && (
                                msg.metadata?.guided
                                  ? <Sparkles className="w-3 h-3 text-purple-500" />
                                  : <Bot className="w-3 h-3 text-[#CC5500]" />
                              )}
                              <span className="text-[11px] font-medium text-stone-500">
                                {msg.sender_type === 'knight'
                                  ? (msg.metadata?.guided ? `${agentName} (guided)` : agentName)
                                  : msg.sender_type === 'human_agent' ? 'You' : 'Customer'}
                              </span>
                              <span className="text-[10px] text-stone-400">{fmtTs(new Date(msg.created_at))}</span>
                            </div>
                            <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                            {msg.metadata?.guided && msg.metadata?.instruction && (
                              <p className="text-[10px] text-purple-400 mt-1 italic">
                                Instruction: "{msg.metadata.instruction}"
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Reply area */}
                    <div className="bg-white border border-[#E7E5E4] rounded-lg p-4 shrink-0 space-y-3">
                      {/* Mode toggle */}
                      <div className="flex gap-1 bg-stone-100 rounded-md p-1 w-fit">
                        <button onClick={() => setGuideMode(false)}
                          className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all',
                            !guideMode ? 'bg-white border border-[#E7E5E4] text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700',
                          )}>
                          <User className="w-3 h-3" /> Reply Directly
                        </button>
                        <button onClick={() => setGuideMode(true)}
                          className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all',
                            guideMode ? 'bg-[#FFF8F5] border border-[#CC5500]/20 text-[#CC5500] shadow-sm' : 'text-stone-500 hover:text-stone-700',
                          )}>
                          <Sparkles className="w-3 h-3" /> Guide Knight
                        </button>
                      </div>

                      {guideMode && (
                        <div className="flex items-start gap-2 p-3 rounded-lg bg-[#FFF8F5] border border-[#CC5500]/10">
                          <Sparkles className="w-3.5 h-3.5 text-[#CC5500] mt-0.5 shrink-0" />
                          <p className="text-xs text-stone-600">
                            Tell Knight what to do — it will craft a natural response and send it.
                            <span className="block text-stone-400 mt-0.5">e.g. "Offer a full refund and apologise for the delay"</span>
                          </p>
                        </div>
                      )}

                      <Textarea
                        placeholder={guideMode ? 'Tell Knight what to say…' : 'Type your reply…'}
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        className="min-h-[72px] border-[#E7E5E4] focus-visible:ring-[#CC5500]/30"
                      />
                      <div className="flex justify-end">
                        {guideMode ? (
                          <button onClick={handleGuideKnight} disabled={!replyText.trim() || guiding}
                            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-[#CC5500] text-white rounded-md hover:bg-[#b34a00] transition-colors disabled:opacity-50">
                            <Sparkles className="w-3.5 h-3.5" />
                            {guiding ? 'Knight is typing…' : 'Send via Knight'}
                          </button>
                        ) : (
                          <button onClick={handleSendReply} disabled={!replyText.trim() || sending}
                            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-[#1C1917] text-white rounded-md hover:bg-stone-800 transition-colors disabled:opacity-50">
                            <Send className="w-3.5 h-3.5" />
                            {sending ? 'Sending…' : 'Send Reply'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  !isMobile && (
                    <div className="flex-1 bg-white border border-[#E7E5E4] rounded-lg flex items-center justify-center">
                      <div className="text-center">
                        <div className="w-14 h-14 rounded-2xl bg-stone-100 flex items-center justify-center mx-auto mb-3">
                          <Shield className="w-7 h-7 text-stone-300" />
                        </div>
                        <p className="text-sm font-semibold text-stone-700"
                          style={{ fontFamily: 'Instrument Serif, serif' }}>
                          Select a ticket
                        </p>
                        <p className="text-xs text-stone-400 mt-1">
                          Choose a conversation to view details and reply
                        </p>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          {/* ── ACTIVITY TAB ─────────────────────────────── */}
          {activeTab === 'activity' && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Auto-Replies Sent', value: stats?.messages_sent || 0 },
                { label: 'Escalations',       value: stats?.escalations   || 0 },
                { label: 'Total Tickets',     value: stats?.total_tickets  || 0 },
                { label: 'Resolved Today',    value: stats?.resolved_today || 0 },
              ].map(({ label, value }) => (
                <div key={label} className="bg-white border border-[#E7E5E4] rounded-lg p-4">
                  <p className="text-2xl font-bold text-stone-900 mb-1"
                    style={{ fontFamily: 'Instrument Serif, serif' }}>{value}</p>
                  <p className="text-xs text-stone-500 uppercase tracking-wider"
                    style={{ fontFamily: 'Space Grotesk, sans-serif' }}>{label}</p>
                </div>
              ))}
              {Object.entries(stats?.by_channel || {}).length > 0 && (
                <div className="col-span-full bg-white border border-[#E7E5E4] rounded-lg p-5">
                  <h3 className="text-sm font-semibold text-stone-900 mb-4"
                    style={{ fontFamily: 'Instrument Serif, serif' }}>By Channel</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {Object.entries(stats?.by_channel || {}).map(([channel, count]) => (
                      <div key={channel} className="flex items-center gap-3 p-3 rounded-lg bg-stone-50 border border-[#E7E5E4]">
                        <span className="text-stone-500">{CHANNEL_ICONS[channel] || <MessageSquare className="w-4 h-4" />}</span>
                        <div>
                          <p className="text-sm font-medium text-stone-800 capitalize">{channel}</p>
                          <p className="text-xs text-stone-400">{String(count)} tickets</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── KNOWLEDGE BASE TAB ───────────────────────── */}
          {activeTab === 'kb' && (
            <div className="space-y-4">
              {/* KB header bar */}
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex gap-1 flex-wrap">
                  {['all', ...KB_CATEGORIES].map((cat) => (
                    <button key={cat} onClick={() => setKbCategory(cat)}
                      className={cn('px-3 py-1.5 text-xs rounded-md border transition-colors capitalize',
                        kbCategory === cat
                          ? 'bg-[#1C1917] text-white border-[#1C1917]'
                          : 'bg-white text-stone-600 border-[#E7E5E4] hover:bg-stone-50',
                      )}>
                      {cat === 'all' ? 'All' : cat}
                    </button>
                  ))}
                </div>
                <button onClick={() => openKbSheet(null)}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-[#CC5500] text-white rounded-md hover:bg-[#b34a00] transition-colors shrink-0">
                  <Plus className="w-4 h-4" /> Add Entry
                </button>
              </div>

              {/* Entry list */}
              {kbLoading ? (
                <p className="text-sm text-stone-400 py-8 text-center">Loading knowledge base…</p>
              ) : kbEntries.length === 0 ? (
                <div className="bg-white border border-[#E7E5E4] rounded-lg p-12 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-stone-100 flex items-center justify-center mx-auto mb-4">
                    <BookOpen className="w-7 h-7 text-stone-300" />
                  </div>
                  <p className="text-base font-semibold text-stone-700 mb-1"
                    style={{ fontFamily: 'Instrument Serif, serif' }}>
                    No knowledge entries yet
                  </p>
                  <p className="text-xs text-stone-400 max-w-xs mx-auto mb-4">
                    Add FAQs, product details, pricing, and policies so Knight can give accurate, product-specific answers.
                  </p>
                  <button onClick={() => openKbSheet(null)}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-[#CC5500] text-white rounded-md hover:bg-[#b34a00] transition-colors mx-auto">
                    <Plus className="w-4 h-4" /> Add First Entry
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {kbEntries.map((entry) => (
                    <div key={entry.id} className="bg-white border border-[#E7E5E4] rounded-lg p-4 flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-stone-900 leading-snug">{entry.title || 'Untitled'}</p>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => openKbSheet(entry)}
                            className="p-1.5 rounded hover:bg-stone-100 text-stone-400 hover:text-stone-700 transition-colors">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleKbDelete(entry.id)}
                            className="p-1.5 rounded hover:bg-red-50 text-stone-400 hover:text-red-500 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <span className={cn('text-[10px] px-2 py-0.5 rounded-full border uppercase tracking-wider w-fit', CATEGORY_STYLE[entry.category] || '')}
                        style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                        {entry.category}
                      </span>
                      <p className="text-xs text-stone-500 leading-relaxed line-clamp-2">{entry.content}</p>
                      {entry.source_url && (
                        <a href={entry.source_url} target="_blank" rel="noreferrer"
                          className="flex items-center gap-1 text-xs text-[#CC5500] hover:underline mt-auto">
                          <ExternalLink className="w-3 h-3" /> Source
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── SETTINGS TAB ─────────────────────────────── */}
          {activeTab === 'settings' && (
            <div className="max-w-2xl space-y-5">

              {/* Business Identity */}
              <div className="bg-white border border-[#E7E5E4] rounded-lg p-6">
                <h3 className="text-base font-semibold text-stone-900 mb-1"
                  style={{ fontFamily: 'Instrument Serif, serif' }}>Business Identity</h3>
                <p className="text-xs text-stone-400 mb-5">
                  Tell Knight what your business does so it can have real, relevant conversations.
                </p>
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-stone-700">Agent Name</Label>
                    <p className="text-xs text-stone-400 mb-1.5">The name customers see. E.g. "Alex" or "Support".</p>
                    <Input placeholder="e.g. Sarah, Alex, Support"
                      value={draftText.agent_name}
                      onChange={(e) => setDraftText(p => ({ ...p, agent_name: e.target.value }))}
                      onBlur={() => handleConfigUpdate({ agent_name: draftText.agent_name }, true)}
                      className="max-w-xs border-[#E7E5E4] focus-visible:ring-[#CC5500]/30" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-stone-700">Business Type</Label>
                    <p className="text-xs text-stone-400 mb-1.5">Shapes how Knight talks.</p>
                    <Select value={config?.business_type || 'general'}
                      onValueChange={(v) => handleConfigUpdate({ business_type: v })}>
                      <SelectTrigger className="max-w-xs border-[#E7E5E4]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BUSINESS_TYPES.map((bt) => (
                          <SelectItem key={bt.value} value={bt.value}>
                            <div className="flex flex-col">
                              <span>{bt.label}</span>
                              <span className="text-xs text-stone-400">{bt.example}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-stone-700">Business Description</Label>
                    <p className="text-xs text-stone-400 mb-1.5">
                      Describe your products, services, and anything Knight should know.
                    </p>
                    <Textarea placeholder="e.g. We're a SaaS CRM for small teams. We offer a free 14-day trial. Our pricing is $49/mo. Support hours are 9-5 EST."
                      value={draftText.business_description}
                      onChange={(e) => setDraftText(p => ({ ...p, business_description: e.target.value }))}
                      onBlur={() => handleConfigUpdate({ business_description: draftText.business_description }, true)}
                      className="min-h-[100px] border-[#E7E5E4] focus-visible:ring-[#CC5500]/30" />
                  </div>
                </div>
              </div>

              {/* General Settings */}
              <div className="bg-white border border-[#E7E5E4] rounded-lg p-6">
                <h3 className="text-base font-semibold text-stone-900 mb-5"
                  style={{ fontFamily: 'Instrument Serif, serif' }}>General Settings</h3>
                <div className="space-y-3">
                  {[
                    { label: 'Knight Active', desc: 'Enable Knight to handle incoming messages', key: 'is_active', val: config?.is_active ?? true },
                    { label: 'Auto-Reply',    desc: 'Automatically respond to new messages',     key: 'auto_reply_enabled', val: config?.auto_reply_enabled ?? true },
                    { label: 'Voice Escalation', desc: 'Outbound voice calls for critical issues via Vapi', key: 'voice_escalation_enabled', val: config?.voice_escalation_enabled ?? false },
                  ].map(({ label, desc, key, val }) => (
                    <div key={key} className="flex items-center justify-between p-4 rounded-lg bg-stone-50 border border-[#E7E5E4]">
                      <div>
                        <p className="text-sm font-medium text-stone-800">{label}</p>
                        <p className="text-xs text-stone-400">{desc}</p>
                      </div>
                      <Switch checked={val} onCheckedChange={(v) => handleConfigUpdate({ [key]: v })} />
                    </div>
                  ))}

                  {/* Sentiment threshold */}
                  <div className="p-4 rounded-lg bg-stone-50 border border-[#E7E5E4]">
                    <p className="text-sm font-medium text-stone-800 mb-0.5">Sentiment Threshold</p>
                    <p className="text-xs text-stone-400 mb-3">Mark tickets as critical below this score (1–10).</p>
                    <Select value={String(config?.sentiment_threshold ?? 3)}
                      onValueChange={(v) => handleConfigUpdate({ sentiment_threshold: parseInt(v) })}>
                      <SelectTrigger className="w-24 border-[#E7E5E4]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[1,2,3,4,5].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Channels */}
                  <div className="p-4 rounded-lg bg-stone-50 border border-[#E7E5E4]">
                    <p className="text-sm font-medium text-stone-800 mb-0.5">Enabled Channels</p>
                    <p className="text-xs text-stone-400 mb-3">Channels Knight should monitor.</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {['twitter','linkedin','outlook','whatsapp','instagram','facebook'].map((ch) => (
                        <div key={ch} className="flex items-center gap-2">
                          <Switch
                            checked={config?.channels_enabled?.[ch] ?? true}
                            onCheckedChange={(v) => handleConfigUpdate({ channels_enabled: { ...config?.channels_enabled, [ch]: v } })}
                          />
                          <span className="text-stone-500">{CHANNEL_ICONS[ch]}</span>
                          <span className="text-sm text-stone-700 capitalize">{ch}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Persona */}
                  <div className="p-4 rounded-lg bg-stone-50 border border-[#E7E5E4]">
                    <p className="text-sm font-medium text-stone-800 mb-0.5">Custom Persona Prompt</p>
                    <p className="text-xs text-stone-400 mb-3">Advanced: override the default system prompt (optional).</p>
                    <Textarea placeholder="Enter custom persona instructions…"
                      value={draftText.persona_prompt}
                      onChange={(e) => setDraftText(p => ({ ...p, persona_prompt: e.target.value }))}
                      onBlur={() => handleConfigUpdate({ persona_prompt: draftText.persona_prompt }, true)}
                      className="min-h-[100px] border-[#E7E5E4] focus-visible:ring-[#CC5500]/30" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── KB Sheet ─────────────────────────────────────── */}
      <Sheet open={kbSheetOpen} onOpenChange={setKbSheetOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto" style={{ background: '#FDFBF7' }}>
          <SheetHeader className="mb-6">
            <SheetTitle style={{ fontFamily: 'Instrument Serif, serif' }}>
              {editingEntry ? 'Edit Knowledge Entry' : 'Add Knowledge Entry'}
            </SheetTitle>
          </SheetHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-stone-700 mb-1.5 block">Title</Label>
              <Input placeholder="e.g. Refund Policy"
                value={kbForm.title}
                onChange={(e) => setKbForm(p => ({ ...p, title: e.target.value }))}
                className="border-[#E7E5E4] focus-visible:ring-[#CC5500]/30" />
            </div>
            <div>
              <Label className="text-sm font-medium text-stone-700 mb-1.5 block">Category</Label>
              <Select value={kbForm.category} onValueChange={(v) => setKbForm(p => ({ ...p, category: v as KbCategory }))}>
                <SelectTrigger className="border-[#E7E5E4]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {KB_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-medium text-stone-700 mb-1.5 block">Content</Label>
              <Textarea placeholder="Paste the knowledge content here — FAQs, policy text, product details, etc."
                value={kbForm.content}
                onChange={(e) => setKbForm(p => ({ ...p, content: e.target.value }))}
                className="min-h-[160px] border-[#E7E5E4] focus-visible:ring-[#CC5500]/30" />
            </div>
            <div>
              <Label className="text-sm font-medium text-stone-700 mb-1.5 block">Source URL <span className="text-stone-400 font-normal">(optional)</span></Label>
              <Input placeholder="https://docs.yoursite.com/refund-policy"
                value={kbForm.source_url}
                onChange={(e) => setKbForm(p => ({ ...p, source_url: e.target.value }))}
                className="border-[#E7E5E4] focus-visible:ring-[#CC5500]/30" />
            </div>
            <button
              onClick={handleKbSave}
              disabled={kbSaving || !kbForm.title.trim() || !kbForm.content.trim()}
              className="w-full py-2.5 text-sm font-medium bg-[#CC5500] text-white rounded-md hover:bg-[#b34a00] transition-colors disabled:opacity-50"
            >
              {kbSaving ? 'Saving…' : editingEntry ? 'Save Changes' : 'Add Entry'}
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </MainLayout>
  );
}
