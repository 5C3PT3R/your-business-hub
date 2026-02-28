import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Shield,
  MessageSquare,
  AlertTriangle,
  Bot,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  ChevronRight,
  Trash2,
  FileText,
  Copy,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useToast } from '@/hooks/use-toast';
import {
  getTickets,
  getTicketDetail,
  updateTicketStatus,
  deleteTicket,
  getKnightConfig,
  subscribeToTickets,
  subscribeToMessages,
  type Ticket,
  type TicketDetail,
  type TicketMessage,
  type KnightConfig,
} from '@/lib/knight-ticket-service';

export default function KnightDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { workspace } = useWorkspace();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<TicketDetail | null>(null);
  const [config, setConfig] = useState<KnightConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [contactMap, setContactMap] = useState<Map<string, { name: string; type: 'contact' | 'lead'; id: string }>>(new Map());
  const [transcript, setTranscript] = useState('');
  const [generatingTranscript, setGeneratingTranscript] = useState(false);

  // Load escalated/halted tickets
  useEffect(() => {
    if (workspace?.id) {
      loadData();

      const channel = subscribeToTickets(workspace.id, (ticket) => {
        setTickets((prev) => {
          // Only keep escalated/open tickets
          if (ticket.status !== 'escalated' && ticket.status !== 'open') {
            return prev.filter((t) => t.id !== ticket.id);
          }
          const index = prev.findIndex((t) => t.id === ticket.id);
          if (index >= 0) {
            const updated = [...prev];
            updated[index] = ticket;
            return updated;
          }
          return [ticket, ...prev];
        });
      });

      return () => {
        channel.unsubscribe();
      };
    }
  }, [workspace?.id]);

  // Subscribe to messages for selected ticket
  useEffect(() => {
    if (!selectedTicket?.ticket.id) return;

    const channel = subscribeToMessages(selectedTicket.ticket.id, (newMessage: TicketMessage) => {
      setSelectedTicket((prev) => {
        if (!prev || prev.ticket.id !== newMessage.ticket_id) return prev;
        if (prev.messages.some((m) => m.id === newMessage.id)) return prev;
        return { ...prev, messages: [...prev.messages, newMessage] };
      });
    });

    return () => {
      channel.unsubscribe();
    };
  }, [selectedTicket?.ticket.id]);

  // Auto-scroll to bottom when messages update
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
        supabase.from('leads').select('id, name, phone').eq('user_id', workspace.id),
      ]);
      // Show escalated first, then open tickets sorted by updated_at
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
    } catch (error) {
      console.error('[KnightDashboard] Load error:', error);
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
      // Build conversation text for AI
      const convoLines = selectedTicket.messages.map((msg) => {
        const sender =
          msg.sender_type === 'knight' ? agentName
          : msg.sender_type === 'human_agent' ? 'Agent'
          : 'Customer';
        return `${sender}: ${msg.content}`;
      });

      const res = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer sk-6b26c326653f4a5c877f2db1d3d03aa4',
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: 'You are a support conversation analyst. Read the following customer support conversation and provide a concise summary. Include: 1) What the customer wanted, 2) How it was handled, 3) Current status/outcome. Keep it brief and clear — 3-5 sentences max.',
            },
            {
              role: 'user',
              content: `Channel: ${selectedTicket.ticket.source_channel}\nCustomer: ${selectedTicket.ticket.source_handle}\n\nConversation:\n${convoLines.join('\n')}`,
            },
          ],
          max_tokens: 300,
        }),
      });

      const data = await res.json();
      const summary = data.choices?.[0]?.message?.content;

      if (summary) {
        setTranscript(summary);
      } else {
        toast({ title: 'AI returned empty response', variant: 'destructive' });
      }
    } catch (err) {
      console.error('[KnightDashboard] Transcript error:', err);
      toast({ title: 'Failed to generate summary', variant: 'destructive' });
    } finally {
      setGeneratingTranscript(false);
    }
  };

  const handleResolve = async (ticketId: string) => {
    const success = await updateTicketStatus(ticketId, 'resolved');
    if (success) {
      toast({ title: 'Ticket resolved' });
      setSelectedTicket(null);
      loadData();
    }
  };

  const handleDelete = async (ticketId: string) => {
    const success = await deleteTicket(ticketId);
    if (success) {
      toast({ title: 'Conversation deleted' });
      setSelectedTicket(null);
      loadData();
    } else {
      toast({ title: 'Failed to delete', variant: 'destructive' });
    }
  };

  const agentName = config?.agent_name || 'Knight';

  const resolveContact = (handle: string) => {
    const normalized = handle.replace(/\D/g, '').slice(-10);
    return normalized.length >= 7 ? (contactMap.get(normalized) ?? null) : null;
  };

  const escalatedCount = tickets.filter((t) => t.status === 'escalated').length;
  const needsAttentionCount = tickets.filter(
    (t) => t.status === 'escalated' || t.priority === 'critical'
  ).length;

  if (loading) {
    return (
      <MainLayout>
        <Header title="Knight Dashboard" subtitle="Loading..." />
        <div className="flex items-center justify-center min-h-[600px]">
          <div className="flex flex-col items-center gap-4">
            <Shield className="h-12 w-12 text-primary animate-pulse" />
            <p className="text-sm text-muted-foreground">Loading dashboard...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Header
        title="Knight Dashboard"
        subtitle="Monitor and manage customer conversations"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/knight/settings')}>
              Settings
            </Button>
            <Button variant="outline" size="sm" onClick={loadData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        }
      />

      {/* Status Bar */}
      <div className="px-4 md:px-6 pt-4 flex gap-3">
        {needsAttentionCount > 0 ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <span className="text-sm font-medium text-red-500">
              {needsAttentionCount} ticket{needsAttentionCount > 1 ? 's' : ''} need{needsAttentionCount === 1 ? 's' : ''} attention
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span className="text-sm font-medium text-green-500">All clear — no escalations</span>
          </div>
        )}
        {escalatedCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20">
            <Shield className="h-4 w-4 text-orange-500" />
            <span className="text-sm font-medium text-orange-500">
              {escalatedCount} escalated
            </span>
          </div>
        )}
      </div>

      {/* Main Layout */}
      <div className="p-4 md:p-6 flex gap-4 h-[calc(100vh-220px)]">
        {/* Ticket List */}
        <Card variant="glass" className="w-80 flex-shrink-0 flex flex-col overflow-hidden">
          <div className="p-3 border-b">
            <h3 className="text-sm font-semibold">Active Conversations</h3>
            <p className="text-xs text-muted-foreground">{tickets.length} ticket{tickets.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {tickets.length === 0 ? (
              <div className="p-8 text-center">
                <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-green-500/50" />
                <p className="text-sm font-medium">No tickets need attention</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {agentName} is handling everything
                </p>
              </div>
            ) : (
              tickets.map((ticket) => {
                const contact = resolveContact(ticket.source_handle);
                return (
                  <button
                    key={ticket.id}
                    onClick={() => handleSelectTicket(ticket)}
                    className={cn(
                      'w-full p-3 text-left hover:bg-muted/50 transition-colors',
                      selectedTicket?.ticket.id === ticket.id && 'bg-primary/5 border-l-2 border-l-primary'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          {ticket.status === 'escalated' ? (
                            <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                          ) : ticket.priority === 'critical' ? (
                            <AlertTriangle className="h-3.5 w-3.5 text-orange-500 flex-shrink-0" />
                          ) : (
                            <MessageSquare className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          )}
                          <span className="text-sm font-semibold truncate">
                            {contact ? contact.name : ticket.source_handle}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 ml-5 mb-1">
                          {contact && (
                            <Badge variant="outline" className={cn('text-[10px] py-0', contact.type === 'lead' ? 'text-blue-500 border-blue-500/30' : 'text-purple-500 border-purple-500/30')}>
                              {contact.type}
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground truncate">
                            {contact ? ticket.source_handle : ticket.summary}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 ml-5">
                          {ticket.status === 'escalated' && (
                            <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-500 border-red-500/30">
                              Escalated
                            </Badge>
                          )}
                          <Badge variant="outline" className={cn('text-[10px]', ticket.priority === 'critical' ? 'bg-red-500/10 text-red-500 border-red-500/30' : ticket.priority === 'medium' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30' : 'bg-green-500/10 text-green-500 border-green-500/30')}>
                            {ticket.priority}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {formatTime(new Date(ticket.updated_at))}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </Card>

        {/* Conversation + Guide Panel */}
        {selectedTicket ? (
          <div className="flex-1 flex flex-col gap-4 min-w-0">
            {/* Ticket Header */}
            <Card variant="glass" className="p-4">
              {(() => {
                const contact = resolveContact(selectedTicket.ticket.source_handle);
                const score = selectedTicket.ticket.sentiment_score;
                const sentimentEmoji = score ? (score >= 7 ? '😊' : score >= 4 ? '😐' : '😠') : null;
                const sentimentColor = score ? (score >= 7 ? 'text-green-500' : score >= 4 ? 'text-yellow-500' : 'text-red-500') : '';
                return (
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-bold text-base">
                          {contact ? contact.name : selectedTicket.ticket.source_handle}
                        </span>
                        {contact && (
                          <Badge variant="outline" className={cn('text-xs', contact.type === 'lead' ? 'text-blue-500 border-blue-500/30' : 'text-purple-500 border-purple-500/30')}>
                            {contact.type}
                          </Badge>
                        )}
                        {contact && (
                          <button
                            onClick={() => navigate(`/${contact.type === 'lead' ? 'leads' : 'contacts'}?highlight=${contact.id}`)}
                            className="text-xs text-primary hover:underline"
                          >
                            View {contact.type} ↗
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {contact && <span className="text-xs text-muted-foreground">{selectedTicket.ticket.source_handle}</span>}
                        <Badge variant="outline" className="text-xs capitalize">{selectedTicket.ticket.source_channel}</Badge>
                        {selectedTicket.ticket.status === 'escalated' && (
                          <Badge variant="outline" className="text-xs bg-red-500/10 text-red-500 border-red-500/30">Escalated</Badge>
                        )}
                        {sentimentEmoji && score && (
                          <span className={cn('text-xs font-medium', sentimentColor)}>{sentimentEmoji} {score}/10</span>
                        )}
                        <span className="text-xs text-muted-foreground">{selectedTicket.messages.length} messages</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button variant="outline" size="sm" onClick={() => handleResolve(selectedTicket.ticket.id)} className="text-green-600 border-green-500/30 hover:bg-green-500/10">
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Resolve
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDelete(selectedTicket.ticket.id)} className="text-red-500 border-red-500/30 hover:bg-red-500/10">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    </div>
                  </div>
                );
              })()}
            </Card>

            {/* Messages */}
            <Card variant="glass" className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 p-4 overflow-y-auto space-y-3">
                {selectedTicket.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      'flex',
                      msg.sender_type === 'user' ? 'justify-start' : 'justify-end'
                    )}
                  >
                    <div
                      className={cn(
                        'max-w-[75%] rounded-lg p-3',
                        msg.sender_type === 'user'
                          ? 'bg-muted'
                          : msg.sender_type === 'knight'
                          ? msg.metadata?.guided
                            ? 'bg-purple-500/10 border border-purple-500/20'
                            : 'bg-primary/10 border border-primary/20'
                          : 'bg-blue-500/10 border border-blue-500/20'
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {msg.sender_type === 'knight' && (
                          msg.metadata?.guided
                            ? <Sparkles className="h-3 w-3 text-purple-500" />
                            : <Bot className="h-3 w-3 text-primary" />
                        )}
                        <span className="text-xs font-medium">
                          {msg.sender_type === 'knight'
                            ? (msg.metadata?.guided ? `${agentName} (guided by you)` : agentName)
                            : msg.sender_type === 'human_agent'
                            ? 'You'
                            : 'Customer'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatTime(new Date(msg.created_at))}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      {msg.metadata?.guided && msg.metadata?.instruction && (
                        <p className="text-[10px] text-purple-500/60 mt-1.5 italic">
                          Your instruction: "{msg.metadata.instruction}"
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </Card>

            {/* AI Transcript */}
            <Card variant="glass" className="p-4 max-h-[240px] flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium">AI Summary</p>
                    <p className="text-xs text-muted-foreground">
                      AI-generated gist of this conversation
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {transcript && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(transcript);
                        toast({ title: 'Transcript copied to clipboard' });
                      }}
                    >
                      <Copy className="h-3.5 w-3.5 mr-1.5" />
                      Copy
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={generateTranscript}
                    disabled={generatingTranscript}
                  >
                    {generatingTranscript ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                        {transcript ? 'Regenerate' : 'Generate Summary'}
                      </>
                    )}
                  </Button>
                </div>
              </div>
              {transcript ? (
                <div className="flex-1 overflow-y-auto text-sm text-foreground/80 bg-muted/30 rounded-md p-3 leading-relaxed">
                  {transcript}
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-center py-4">
                  <p className="text-xs text-muted-foreground">
                    Click "Generate Summary" to get an AI-powered gist of this conversation
                  </p>
                </div>
              )}
            </Card>
          </div>
        ) : (
          <Card variant="glass" className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-sm">
              <Shield className="h-14 w-14 mx-auto mb-4 text-muted-foreground/30" />
              <p className="text-lg font-medium mb-2">Knight Dashboard</p>
              <p className="text-sm text-muted-foreground">
                Select a conversation from the left to view messages and generate transcripts.
              </p>
            </div>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}

function formatTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
