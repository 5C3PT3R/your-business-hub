import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Header } from '@/components/layout/Header';
import { KnightSetupChecklist } from '@/components/knight/KnightSetupChecklist';
import {
  Shield, MessageSquare, AlertTriangle, Bot, RefreshCw, Sparkles,
  CheckCircle2, ChevronRight, Trash2, FileText, Copy, Loader2,
  TrendingUp, Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useToast } from '@/hooks/use-toast';
import {
  getTickets, getTicketDetail, updateTicketStatus, deleteTicket,
  getKnightConfig, subscribeToTickets, subscribeToMessages,
  type Ticket, type TicketDetail, type TicketMessage, type KnightConfig,
} from '@/lib/knight-ticket-service';

// ─── Helpers ──────────────────────────────────────────────

function formatTime(date: Date): string {
  const now  = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60)       return 'Just now';
  if (diff < 3600)     return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)    return `${Math.floor(diff / 3600)}h ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function sentimentEmoji(score: number | null | undefined) {
  if (!score) return null;
  if (score >= 7) return { emoji: '😊', color: 'text-emerald-600' };
  if (score >= 4) return { emoji: '😐', color: 'text-amber-600'   };
  return            { emoji: '😠', color: 'text-red-600'          };
}

// ─── Metric tile ──────────────────────────────────────────

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

export default function KnightDashboard() {
  const navigate         = useNavigate();
  const { toast }        = useToast();
  const { workspace }    = useWorkspace();
  const messagesEndRef   = useRef<HTMLDivElement>(null);

  const [tickets, setTickets]                       = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket]         = useState<TicketDetail | null>(null);
  const [config, setConfig]                         = useState<KnightConfig | null>(null);
  const [loading, setLoading]                       = useState(true);
  const [contactMap, setContactMap]                 = useState<Map<string, { name: string; type: 'contact' | 'lead'; id: string }>>(new Map());
  const [transcript, setTranscript]                 = useState('');
  const [generatingTranscript, setGeneratingTranscript] = useState(false);

  useEffect(() => {
    if (workspace?.id) {
      loadData();
      const channel = subscribeToTickets(workspace.id, (ticket) => {
        setTickets((prev) => {
          if (ticket.status !== 'escalated' && ticket.status !== 'open') {
            return prev.filter((t) => t.id !== ticket.id);
          }
          const i = prev.findIndex((t) => t.id === ticket.id);
          if (i >= 0) { const u = [...prev]; u[i] = ticket; return u; }
          return [ticket, ...prev];
        });
      });
      return () => { channel.unsubscribe(); };
    }
  }, [workspace?.id]);

  useEffect(() => {
    if (!selectedTicket?.ticket.id) return;
    const channel = subscribeToMessages(selectedTicket.ticket.id, (msg: TicketMessage) => {
      setSelectedTicket((prev) => {
        if (!prev || prev.ticket.id !== msg.ticket_id) return prev;
        if (prev.messages.some((m) => m.id === msg.id)) return prev;
        return { ...prev, messages: [...prev.messages, msg] };
      });
    });
    return () => { channel.unsubscribe(); };
  }, [selectedTicket?.ticket.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedTicket?.messages]);

  const loadData = async () => {
    if (!workspace?.id) return;
    setLoading(true);
    try {
      const [allTickets, configData, contactsRes, leadsRes] = await Promise.all([
        getTickets(workspace.id),
        getKnightConfig(workspace.id),
        supabase.from('contacts').select('id, name, phone').eq('workspace_id', workspace.id),
        supabase.from('leads').select('id, name, phone'),
      ]);
      const relevant = allTickets
        .filter((t) => t.status === 'escalated' || t.status === 'open' || t.status === 'pending_user')
        .sort((a, b) => {
          if (a.status === 'escalated' && b.status !== 'escalated') return -1;
          if (b.status === 'escalated' && a.status !== 'escalated') return 1;
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        });
      setTickets(relevant);
      setConfig(configData);

      const normalize = (p: string) => p.replace(/\D/g, '').slice(-10);
      const map = new Map<string, { name: string; type: 'contact' | 'lead'; id: string }>();
      (contactsRes.data || []).forEach((c: any) => {
        if (c.phone && c.name) map.set(normalize(c.phone), { name: c.name, type: 'contact', id: c.id });
      });
      (leadsRes.data || []).forEach((l: any) => {
        if (l.phone && l.name) map.set(normalize(l.phone), { name: l.name, type: 'lead', id: l.id });
      });
      setContactMap(map);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTicket = async (ticket: Ticket) => {
    const detail = await getTicketDetail(ticket.id);
    setSelectedTicket(detail);
    setTranscript('');
  };

  const generateTranscript = async () => {
    if (!selectedTicket || selectedTicket.messages.length === 0) return;
    setGeneratingTranscript(true);
    try {
      const agentName = config?.agent_name || 'Knight';
      const content = selectedTicket.messages.map((msg) => {
        const sender = msg.sender_type === 'knight' ? agentName
          : msg.sender_type === 'human_agent' ? 'Agent' : 'Customer';
        return `${sender}: ${msg.content}`;
      }).join('\n');

      const { data, error } = await supabase.functions.invoke('knight-summarize', {
        body: { content },
      });

      if (error || !data?.summary) {
        toast({ title: 'Failed to generate summary', variant: 'destructive' });
        return;
      }
      setTranscript(data.summary);
    } catch {
      toast({ title: 'Failed to generate summary', variant: 'destructive' });
    } finally {
      setGeneratingTranscript(false);
    }
  };

  const handleResolve = async (ticketId: string) => {
    const ok = await updateTicketStatus(ticketId, 'resolved');
    if (ok) { toast({ title: 'Ticket resolved' }); setSelectedTicket(null); loadData(); }
  };

  const handleDelete = async (ticketId: string) => {
    const ok = await deleteTicket(ticketId);
    if (ok) { toast({ title: 'Conversation deleted' }); setSelectedTicket(null); loadData(); }
    else    { toast({ title: 'Failed to delete', variant: 'destructive' }); }
  };

  const resolveContact = (handle: string) => {
    const n = handle.replace(/\D/g, '').slice(-10);
    return n.length >= 7 ? (contactMap.get(n) ?? null) : null;
  };

  const agentName      = config?.agent_name || 'Knight';
  const escalatedCount = tickets.filter((t) => t.status === 'escalated').length;
  const openCount      = tickets.filter((t) => t.status === 'open').length;
  const avgSentiment   = tickets.length
    ? Math.round(tickets.reduce((s, t) => s + (t.sentiment_score || 5), 0) / tickets.length * 10) / 10
    : null;

  return (
    <MainLayout>
      <Header
        title="Knight"
        subtitle="Escalated conversations & human oversight"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/knight?tab=settings')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#E7E5E4] bg-white text-xs text-stone-600 hover:bg-stone-50 transition-colors"
            >
              Settings
            </button>
            <button
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#E7E5E4] bg-white text-xs text-stone-600 hover:bg-stone-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
              Refresh
            </button>
          </div>
        }
      />

      <div className="min-h-screen p-6" style={{ background: '#FDFBF7' }}>

        {/* Grain overlay */}
        <div className="fixed inset-0 pointer-events-none opacity-[0.015]"
          style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 512 512\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'g\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.75\' numOctaves=\'4\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23g)\'/%3E%3C/svg%3E")' }}
        />

        {/* Setup Checklist */}
        <KnightSetupChecklist />

        {/* Metric tiles */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <MetricTile label="Escalated" value={escalatedCount} Icon={AlertTriangle} highlight={escalatedCount > 0} />
          <MetricTile label="Open Tickets" value={openCount}   Icon={MessageSquare} />
          <MetricTile label="Avg Sentiment" value={avgSentiment != null ? `${avgSentiment}/10` : '—'} Icon={TrendingUp} />
        </div>

        {/* Split view */}
        <div className="flex gap-4" style={{ height: 'calc(100vh - 340px)', minHeight: 420 }}>

          {/* Ticket list */}
          <div className="w-72 flex-shrink-0 bg-white border border-[#E7E5E4] rounded-lg flex flex-col overflow-hidden">
            <div className="p-4 border-b border-[#E7E5E4]">
              <h3 className="text-sm font-semibold text-stone-900"
                style={{ fontFamily: 'Instrument Serif, serif' }}>
                Active Conversations
              </h3>
              <p className="text-xs text-stone-400 mt-0.5">
                {tickets.length} ticket{tickets.length !== 1 ? 's' : ''}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-[#E7E5E4]">
              {tickets.length === 0 ? (
                <div className="p-8 text-center">
                  <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-emerald-400/50" />
                  <p className="text-sm font-medium text-stone-700">No escalations</p>
                  <p className="text-xs text-stone-400 mt-1">{agentName} is handling everything</p>
                </div>
              ) : (
                tickets.map((ticket) => {
                  const contact  = resolveContact(ticket.source_handle);
                  const sent     = sentimentEmoji(ticket.sentiment_score);
                  const isSelected = selectedTicket?.ticket.id === ticket.id;
                  return (
                    <button
                      key={ticket.id}
                      onClick={() => handleSelectTicket(ticket)}
                      className={cn(
                        'w-full p-3 text-left hover:bg-stone-50 transition-colors border-l-4',
                        isSelected         ? 'bg-stone-50 border-l-[#CC5500]'
                        : ticket.status === 'escalated' ? 'border-l-red-400'
                        : ticket.priority === 'critical'  ? 'border-l-amber-400'
                        : 'border-l-transparent',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            {ticket.status === 'escalated' ? (
                              <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                            ) : (
                              <MessageSquare className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                            )}
                            <span className="text-sm font-semibold text-stone-900 truncate">
                              {contact ? contact.name : ticket.source_handle}
                            </span>
                          </div>
                          <div className="text-xs text-stone-400 truncate ml-5 mb-1.5">
                            {contact ? ticket.source_handle : (ticket.summary || ticket.source_channel)}
                          </div>
                          <div className="flex items-center gap-1.5 ml-5 flex-wrap">
                            {contact && (
                              <span className={cn(
                                'text-[10px] px-1.5 py-0.5 rounded-full border uppercase tracking-wider',
                                contact.type === 'lead'
                                  ? 'bg-blue-50 text-blue-600 border-blue-200'
                                  : 'bg-purple-50 text-purple-600 border-purple-200',
                              )} style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                                {contact.type}
                              </span>
                            )}
                            {sent && (
                              <span className={cn('text-[11px]', sent.color)}>{sent.emoji} {ticket.sentiment_score}/10</span>
                            )}
                            <span className="text-[10px] text-stone-400 ml-auto">
                              {formatTime(new Date(ticket.updated_at))}
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-stone-300 shrink-0 mt-1" />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Conversation pane */}
          {selectedTicket ? (
            <div className="flex-1 flex flex-col gap-3 min-w-0">

              {/* Ticket header */}
              {(() => {
                const contact = resolveContact(selectedTicket.ticket.source_handle);
                const sent    = sentimentEmoji(selectedTicket.ticket.sentiment_score);
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
                            <span className={cn(
                              'text-[10px] px-1.5 py-0.5 rounded-full border uppercase tracking-wider',
                              contact.type === 'lead'
                                ? 'bg-blue-50 text-blue-600 border-blue-200'
                                : 'bg-purple-50 text-purple-600 border-purple-200',
                            )} style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                              {contact.type}
                            </span>
                            <button
                              onClick={() => navigate(`/${contact.type === 'lead' ? 'leads' : 'contacts'}?highlight=${contact.id}`)}
                              className="text-xs text-[#CC5500] hover:underline"
                            >
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
                        {selectedTicket.ticket.status === 'escalated' && (
                          <span className="px-1.5 py-0.5 rounded border bg-red-50 text-red-600 border-red-200 text-[10px] uppercase tracking-wider"
                            style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                            Escalated
                          </span>
                        )}
                        {sent && (
                          <span className={cn('font-medium', sent.color)}>
                            {sent.emoji} {selectedTicket.ticket.sentiment_score}/10
                          </span>
                        )}
                        <span>{selectedTicket.messages.length} messages</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleResolve(selectedTicket.ticket.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-emerald-700 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Resolve
                      </button>
                      <button
                        onClick={() => handleDelete(selectedTicket.ticket.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Messages */}
              <div className="flex-1 bg-white border border-[#E7E5E4] rounded-lg flex flex-col overflow-hidden min-h-0">
                <div className="flex-1 p-4 overflow-y-auto space-y-3">
                  {selectedTicket.messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn('flex', msg.sender_type === 'user' ? 'justify-start' : 'justify-end')}
                    >
                      <div className={cn(
                        'max-w-[75%] rounded-xl p-3',
                        msg.sender_type === 'user'
                          ? 'bg-stone-100 text-stone-800'
                          : msg.sender_type === 'knight'
                          ? msg.metadata?.guided
                            ? 'bg-purple-50 border border-purple-100 text-purple-900'
                            : 'bg-[#FFF8F5] border border-[#CC5500]/10 text-stone-800'
                          : 'bg-blue-50 border border-blue-100 text-blue-900',
                      )}>
                        <div className="flex items-center gap-1.5 mb-1.5">
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
                          <span className="text-[10px] text-stone-400">
                            {formatTime(new Date(msg.created_at))}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                        {msg.metadata?.guided && msg.metadata?.instruction && (
                          <p className="text-[10px] text-purple-400 mt-1.5 italic">
                            Instruction: "{msg.metadata.instruction}"
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* AI Summary */}
              <div className="bg-white border border-[#E7E5E4] rounded-lg p-4 shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-md bg-[#CC5500]/10 flex items-center justify-center">
                      <FileText className="w-3.5 h-3.5 text-[#CC5500]" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-stone-900">AI Summary</p>
                      <p className="text-xs text-stone-400">Generated by Queen via DeepSeek</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {transcript && (
                      <button
                        onClick={() => { navigator.clipboard.writeText(transcript); toast({ title: 'Copied' }); }}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-stone-600 border border-[#E7E5E4] rounded-md hover:bg-stone-50 transition-colors"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        Copy
                      </button>
                    )}
                    <button
                      onClick={generateTranscript}
                      disabled={generatingTranscript}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#1C1917] text-white rounded-md hover:bg-stone-800 transition-colors disabled:opacity-50"
                    >
                      {generatingTranscript ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin" />Generating…</>
                      ) : (
                        <><Sparkles className="w-3.5 h-3.5" />{transcript ? 'Regenerate' : 'Generate Summary'}</>
                      )}
                    </button>
                  </div>
                </div>
                {transcript ? (
                  <p className="text-sm text-stone-600 leading-relaxed bg-stone-50 rounded-lg p-3">
                    {transcript}
                  </p>
                ) : (
                  <p className="text-xs text-stone-400 text-center py-3">
                    Click "Generate Summary" for an AI-powered gist of this conversation
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 bg-white border border-[#E7E5E4] rounded-lg flex items-center justify-center">
              <div className="text-center max-w-xs">
                <div className="w-16 h-16 rounded-2xl bg-stone-100 flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-8 h-8 text-stone-300" />
                </div>
                <p className="text-base font-semibold text-stone-700"
                  style={{ fontFamily: 'Instrument Serif, serif' }}>
                  Select a conversation
                </p>
                <p className="text-xs text-stone-400 mt-1">
                  Choose a ticket on the left to view messages and generate summaries.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
