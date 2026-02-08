import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Shield,
  MessageSquare,
  AlertTriangle,
  ArrowLeft,
  Bot,
  RefreshCw,
  Sparkles,
  Phone,
  CheckCircle2,
  Clock,
  ChevronRight,
  Send,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useToast } from '@/hooks/use-toast';
import {
  getTickets,
  getTicketDetail,
  updateTicketStatus,
  getKnightConfig,
  subscribeToTickets,
  subscribeToMessages,
  type Ticket,
  type TicketDetail,
  type TicketMessage,
  type KnightConfig,
} from '@/lib/knight-ticket-service';
import { supabase } from '@/integrations/supabase/client';

export default function KnightDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { workspace } = useWorkspace();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<TicketDetail | null>(null);
  const [config, setConfig] = useState<KnightConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [instruction, setInstruction] = useState('');
  const [guiding, setGuiding] = useState(false);

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
      const [allTickets, configData] = await Promise.all([
        getTickets(workspace.id),
        getKnightConfig(workspace.id),
      ]);
      // Show escalated first, then open tickets sorted by updated_at
      const relevant = allTickets
        .filter((t) => t.status === 'escalated' || t.status === 'open' || t.status === 'pending_user')
        .sort((a, b) => {
          // Escalated first
          if (a.status === 'escalated' && b.status !== 'escalated') return -1;
          if (b.status === 'escalated' && a.status !== 'escalated') return 1;
          // Then by updated_at desc
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        });
      setTickets(relevant);
      setConfig(configData);
    } catch (error) {
      console.error('[KnightDashboard] Load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTicket = async (ticket: Ticket) => {
    const detail = await getTicketDetail(ticket.id);
    setSelectedTicket(detail);
    setInstruction('');
  };

  const handleGuideKnight = async () => {
    if (!selectedTicket || !instruction.trim() || !workspace?.id) return;
    setGuiding(true);
    try {
      const { data, error } = await supabase.functions.invoke('knight-webhook', {
        body: {
          action: 'guide',
          ticket_id: selectedTicket.ticket.id,
          instruction: instruction.trim(),
          workspace_id: workspace.id,
        },
      });

      // Debug: log full response
      console.log('[KnightDashboard] Guide response:', { data, error });

      if (error) {
        console.error('[KnightDashboard] Guide error details:', error);
        toast({ title: 'Failed to guide Knight', description: String(error.message || error), variant: 'destructive' });
        return;
      }

      setInstruction('');

      if (data?.whatsapp_sent) {
        toast({ title: 'Knight sent guided response', description: 'Delivered via WhatsApp' });
      } else if (data?.whatsapp_error) {
        toast({ title: 'Response saved but WhatsApp failed', description: data.whatsapp_error, variant: 'destructive' });
      } else {
        toast({ title: 'Knight sent guided response', description: `Response: "${data?.response?.substring(0, 60)}..." | WA sent: ${data?.whatsapp_sent}` });
      }

      // Refresh
      const detail = await getTicketDetail(selectedTicket.ticket.id);
      setSelectedTicket(detail);
    } catch (error: any) {
      toast({ title: 'Failed to guide Knight', variant: 'destructive' });
    } finally {
      setGuiding(false);
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleGuideKnight();
    }
  };

  const agentName = config?.agent_name || 'Knight';

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
        subtitle="Guide Knight through conversations that need your help"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/knight')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              All Tickets
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
              tickets.map((ticket) => (
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
                      <div className="flex items-center gap-2 mb-1">
                        {ticket.status === 'escalated' ? (
                          <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                        ) : ticket.priority === 'critical' ? (
                          <AlertTriangle className="h-3.5 w-3.5 text-orange-500 flex-shrink-0" />
                        ) : (
                          <MessageSquare className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        )}
                        <span className="text-sm font-medium truncate">
                          {ticket.source_handle}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 ml-5">
                        {ticket.summary}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5 ml-5">
                        {ticket.status === 'escalated' && (
                          <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-500 border-red-500/30">
                            Escalated
                          </Badge>
                        )}
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px]',
                            ticket.priority === 'critical'
                              ? 'bg-red-500/10 text-red-500 border-red-500/30'
                              : ticket.priority === 'medium'
                              ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30'
                              : 'bg-green-500/10 text-green-500 border-green-500/30'
                          )}
                        >
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
              ))
            )}
          </div>
        </Card>

        {/* Conversation + Guide Panel */}
        {selectedTicket ? (
          <div className="flex-1 flex flex-col gap-4 min-w-0">
            {/* Ticket Header */}
            <Card variant="glass" className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{selectedTicket.ticket.source_handle}</span>
                    <Badge variant="outline" className="text-xs capitalize">
                      {selectedTicket.ticket.source_channel}
                    </Badge>
                    {selectedTicket.ticket.status === 'escalated' && (
                      <Badge variant="outline" className="text-xs bg-red-500/10 text-red-500 border-red-500/30">
                        Escalated
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Sentiment: {selectedTicket.ticket.sentiment_score}/10 · {selectedTicket.messages.length} messages
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleResolve(selectedTicket.ticket.id)}
                  className="text-green-600 border-green-500/30 hover:bg-green-500/10"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Mark Resolved
                </Button>
              </div>
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

            {/* Guide Input */}
            <Card variant="glass" className="p-4">
              <div className="flex items-start gap-2 mb-3">
                <Sparkles className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Guide {agentName}</p>
                  <p className="text-xs text-muted-foreground">
                    Tell {agentName} what to say. It will craft a natural message and send it to the customer.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Textarea
                  placeholder={`e.g. "Give them a full refund and apologize" or "Offer 10% off next order"`}
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="min-h-[60px] flex-1"
                />
                <Button
                  onClick={handleGuideKnight}
                  disabled={!instruction.trim() || guiding}
                  className="self-end"
                  size="lg"
                >
                  {guiding ? (
                    <>
                      <Bot className="h-4 w-4 mr-2 animate-pulse" />
                      Typing...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send via {agentName}
                    </>
                  )}
                </Button>
              </div>
              {/* Quick Actions */}
              <div className="flex flex-wrap gap-2 mt-3">
                {[
                  'Apologize and offer a refund',
                  'Escalate to manager',
                  'Offer 10% discount',
                  'Ask for order ID',
                  'Confirm issue is resolved',
                ].map((quick) => (
                  <button
                    key={quick}
                    onClick={() => setInstruction(quick)}
                    className="px-2.5 py-1 rounded-full text-xs bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {quick}
                  </button>
                ))}
              </div>
            </Card>
          </div>
        ) : (
          <Card variant="glass" className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-sm">
              <Shield className="h-14 w-14 mx-auto mb-4 text-muted-foreground/30" />
              <p className="text-lg font-medium mb-2">Knight Dashboard</p>
              <p className="text-sm text-muted-foreground">
                Select a conversation from the left to guide {agentName}. When a customer asks for something {agentName} can't handle, give it instructions and it'll respond naturally.
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
