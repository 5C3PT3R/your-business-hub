import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Shield,
  Search,
  MessageSquare,
  Phone,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  Users,
  Zap,
  Settings,
  Twitter,
  Linkedin,
  Mail,
  Instagram,
  Facebook,
  ArrowLeft,
  Send,
  Bot,
  RefreshCw,
  Filter,
  MoreVertical,
  ExternalLink,
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useToast } from '@/hooks/use-toast';
import {
  getTickets,
  getTicketDetail,
  updateTicketStatus,
  addMessage,
  getKnightStats,
  getKnightConfig,
  updateKnightConfig,
  subscribeToTickets,
  type Ticket,
  type TicketDetail,
  type KnightStats,
  type KnightConfig,
} from '@/lib/knight-ticket-service';
import { getChannelInfo } from '@/lib/knight-channel-service';

export default function Knight() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { workspace } = useWorkspace();
  const isMobile = useIsMobile();

  const [activeTab, setActiveTab] = useState<string>('tickets');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<TicketDetail | null>(null);
  const [stats, setStats] = useState<KnightStats | null>(null);
  const [config, setConfig] = useState<KnightConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Load data
  useEffect(() => {
    if (workspace?.id) {
      loadData();
      // Subscribe to real-time updates
      const channel = subscribeToTickets(workspace.id, (ticket) => {
        setTickets((prev) => {
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
    } catch (error) {
      console.error('[Knight] Load data error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTicket = async (ticket: Ticket) => {
    const detail = await getTicketDetail(ticket.id);
    setSelectedTicket(detail);
  };

  const handleStatusChange = async (ticketId: string, status: Ticket['status']) => {
    const success = await updateTicketStatus(ticketId, status);
    if (success) {
      toast({ title: 'Ticket updated', description: `Status changed to ${status}` });
      loadData();
      if (selectedTicket?.ticket.id === ticketId) {
        const detail = await getTicketDetail(ticketId);
        setSelectedTicket(detail);
      }
    }
  };

  const handleSendReply = async () => {
    if (!selectedTicket || !replyText.trim()) return;
    setSending(true);
    try {
      await addMessage(selectedTicket.ticket.id, 'human_agent', replyText.trim());
      setReplyText('');
      toast({ title: 'Reply sent' });
      const detail = await getTicketDetail(selectedTicket.ticket.id);
      setSelectedTicket(detail);
    } catch (error) {
      toast({ title: 'Failed to send reply', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const handleConfigUpdate = async (updates: Partial<KnightConfig>) => {
    if (!workspace?.id) return;
    const updated = await updateKnightConfig(workspace.id, updates);
    if (updated) {
      setConfig(updated);
      toast({ title: 'Settings saved' });
    }
  };

  // Filter tickets
  const filteredTickets = React.useMemo(() => {
    let result = tickets;

    if (statusFilter !== 'all') {
      result = result.filter((t) => t.status === statusFilter);
    }
    if (priorityFilter !== 'all') {
      result = result.filter((t) => t.priority === priorityFilter);
    }
    if (channelFilter !== 'all') {
      result = result.filter((t) => t.source_channel === channelFilter);
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.source_handle.toLowerCase().includes(query) ||
          t.summary?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [tickets, statusFilter, priorityFilter, channelFilter, searchQuery]);

  const getChannelIcon = (channel: string) => {
    const icons: Record<string, React.ReactNode> = {
      twitter: <Twitter className="h-4 w-4" />,
      linkedin: <Linkedin className="h-4 w-4" />,
      outlook: <Mail className="h-4 w-4" />,
      whatsapp: <MessageSquare className="h-4 w-4" />,
      instagram: <Instagram className="h-4 w-4" />,
      facebook: <Facebook className="h-4 w-4" />,
      voice: <Phone className="h-4 w-4" />,
    };
    return icons[channel] || <MessageSquare className="h-4 w-4" />;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-500/10 text-red-500 border-red-500/30';
      case 'medium':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30';
      default:
        return 'bg-green-500/10 text-green-500 border-green-500/30';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/30';
      case 'pending_user':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30';
      case 'escalated':
        return 'bg-red-500/10 text-red-500 border-red-500/30';
      case 'resolved':
        return 'bg-green-500/10 text-green-500 border-green-500/30';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <Header title="The Knight" subtitle="Loading..." />
        <div className="flex items-center justify-center min-h-[600px]">
          <div className="flex flex-col items-center gap-4">
            <Shield className="h-12 w-12 text-primary animate-pulse" />
            <p className="text-sm text-muted-foreground">Loading Knight data...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Header
        title="The Knight"
        subtitle="Omni-channel Customer Defense"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        }
      />

      {/* Stats Cards */}
      <div className="p-4 md:p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card variant="glass" className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <MessageSquare className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats?.open_tickets || 0}</p>
              <p className="text-xs text-muted-foreground">Open Tickets</p>
            </div>
          </div>
        </Card>

        <Card variant="glass" className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/10">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats?.critical_tickets || 0}</p>
              <p className="text-xs text-muted-foreground">Critical</p>
            </div>
          </div>
        </Card>

        <Card variant="glass" className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats?.resolved_today || 0}</p>
              <p className="text-xs text-muted-foreground">Resolved Today</p>
            </div>
          </div>
        </Card>

        <Card variant="glass" className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <TrendingUp className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats?.avg_sentiment?.toFixed(1) || '5.0'}</p>
              <p className="text-xs text-muted-foreground">Avg Sentiment</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Main Content */}
      <div className="p-4 md:p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="tickets">
              <MessageSquare className="h-4 w-4 mr-2" />
              Tickets
            </TabsTrigger>
            <TabsTrigger value="activity">
              <Zap className="h-4 w-4 mr-2" />
              Activity
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tickets" className="space-y-4">
            {/* Filters */}
            <Card variant="glass" className="p-4">
              <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search tickets..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="pending_user">Pending</SelectItem>
                    <SelectItem value="escalated">Escalated</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priority</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={channelFilter} onValueChange={setChannelFilter}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue placeholder="Channel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Channels</SelectItem>
                    <SelectItem value="twitter">Twitter</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="outlook">Email</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="facebook">Facebook</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </Card>

            {/* Ticket List & Detail */}
            <div className={cn('flex gap-4', isMobile && 'flex-col')}>
              {/* Ticket List */}
              <Card
                variant="glass"
                className={cn(
                  'overflow-hidden',
                  isMobile ? 'w-full' : 'w-96',
                  selectedTicket && isMobile && 'hidden'
                )}
              >
                <div className="max-h-[600px] overflow-y-auto divide-y divide-border">
                  {filteredTickets.length === 0 ? (
                    <div className="p-8 text-center">
                      <Shield className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                      <p className="text-sm font-medium">No tickets found</p>
                      <p className="text-xs text-muted-foreground">
                        The Knight is watching for incoming messages
                      </p>
                    </div>
                  ) : (
                    filteredTickets.map((ticket) => (
                      <button
                        key={ticket.id}
                        onClick={() => handleSelectTicket(ticket)}
                        className={cn(
                          'w-full p-4 text-left hover:bg-muted/50 transition-colors',
                          selectedTicket?.ticket.id === ticket.id && 'bg-primary/10'
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 mt-1">
                            {getChannelIcon(ticket.source_channel)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm truncate">
                                {ticket.source_handle}
                              </span>
                              <Badge
                                variant="outline"
                                className={cn('text-xs', getPriorityColor(ticket.priority))}
                              >
                                {ticket.priority}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {ticket.summary}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge
                                variant="outline"
                                className={cn('text-xs', getStatusColor(ticket.status))}
                              >
                                {ticket.status.replace('_', ' ')}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {formatTimestamp(new Date(ticket.created_at))}
                              </span>
                            </div>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </Card>

              {/* Ticket Detail */}
              {selectedTicket ? (
                <Card variant="glass" className="flex-1 flex flex-col">
                  {/* Header */}
                  <div className="p-4 border-b">
                    {isMobile && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mb-3"
                        onClick={() => setSelectedTicket(null)}
                      >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to tickets
                      </Button>
                    )}
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          {getChannelIcon(selectedTicket.ticket.source_channel)}
                          <span className="font-semibold">
                            {selectedTicket.ticket.source_handle}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={getPriorityColor(selectedTicket.ticket.priority)}
                          >
                            {selectedTicket.ticket.priority}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={getStatusColor(selectedTicket.ticket.status)}
                          >
                            {selectedTicket.ticket.status.replace('_', ' ')}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            Sentiment: {selectedTicket.ticket.sentiment_score}/10
                          </span>
                        </div>
                      </div>
                      <Select
                        value={selectedTicket.ticket.status}
                        onValueChange={(value) =>
                          handleStatusChange(selectedTicket.ticket.id, value as Ticket['status'])
                        }
                      >
                        <SelectTrigger className="w-[130px]">
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
                  </div>

                  {/* Messages */}
                  <div className="flex-1 p-4 overflow-y-auto space-y-4 max-h-[400px]">
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
                            'max-w-[80%] rounded-lg p-3',
                            msg.sender_type === 'user'
                              ? 'bg-muted'
                              : msg.sender_type === 'knight'
                              ? 'bg-primary/10 border border-primary/20'
                              : 'bg-blue-500/10 border border-blue-500/20'
                          )}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            {msg.sender_type === 'knight' && (
                              <Bot className="h-3 w-3 text-primary" />
                            )}
                            <span className="text-xs font-medium capitalize">
                              {msg.sender_type === 'knight'
                                ? 'The Knight'
                                : msg.sender_type === 'human_agent'
                                ? 'Agent'
                                : 'Customer'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatTimestamp(new Date(msg.created_at))}
                            </span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Reply Input */}
                  <div className="p-4 border-t">
                    <div className="flex gap-2">
                      <Textarea
                        placeholder="Type your reply..."
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        className="min-h-[80px]"
                      />
                    </div>
                    <div className="flex justify-end mt-2">
                      <Button onClick={handleSendReply} disabled={!replyText.trim() || sending}>
                        <Send className="h-4 w-4 mr-2" />
                        {sending ? 'Sending...' : 'Send Reply'}
                      </Button>
                    </div>
                  </div>
                </Card>
              ) : (
                !isMobile && (
                  <Card variant="glass" className="flex-1 flex items-center justify-center p-8">
                    <div className="text-center">
                      <Shield className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                      <p className="text-sm font-medium">Select a ticket</p>
                      <p className="text-xs text-muted-foreground">
                        Choose a ticket from the list to view details
                      </p>
                    </div>
                  </Card>
                )
              )}
            </div>
          </TabsContent>

          <TabsContent value="activity" className="space-y-4">
            <Card variant="glass" className="p-6">
              <h3 className="text-lg font-semibold mb-4">Knight Activity</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-2xl font-bold">{stats?.messages_sent || 0}</p>
                    <p className="text-xs text-muted-foreground">Auto-Replies Sent</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-2xl font-bold">{stats?.escalations || 0}</p>
                    <p className="text-xs text-muted-foreground">Escalations</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-2xl font-bold">{stats?.total_tickets || 0}</p>
                    <p className="text-xs text-muted-foreground">Total Tickets</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-2xl font-bold">
                      {stats?.resolved_today || 0}/{stats?.open_tickets || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Resolved/Open</p>
                  </div>
                </div>

                {/* Channel Breakdown */}
                <div className="mt-6">
                  <h4 className="text-sm font-medium mb-3">By Channel</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {Object.entries(stats?.by_channel || {}).map(([channel, count]) => (
                      <div key={channel} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                        {getChannelIcon(channel)}
                        <div>
                          <p className="text-sm font-medium capitalize">{channel}</p>
                          <p className="text-xs text-muted-foreground">{count} tickets</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card variant="glass" className="p-6">
              <h3 className="text-lg font-semibold mb-4">Knight Configuration</h3>

              <div className="space-y-6">
                {/* Master Toggle */}
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
                  <div>
                    <Label className="text-base font-medium">Knight Active</Label>
                    <p className="text-xs text-muted-foreground">
                      Enable The Knight to handle incoming messages
                    </p>
                  </div>
                  <Switch
                    checked={config?.is_active ?? true}
                    onCheckedChange={(checked) => handleConfigUpdate({ is_active: checked })}
                  />
                </div>

                {/* Auto-Reply */}
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
                  <div>
                    <Label className="text-base font-medium">Auto-Reply</Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically respond to incoming messages
                    </p>
                  </div>
                  <Switch
                    checked={config?.auto_reply_enabled ?? true}
                    onCheckedChange={(checked) =>
                      handleConfigUpdate({ auto_reply_enabled: checked })
                    }
                  />
                </div>

                {/* Voice Escalation */}
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
                  <div>
                    <Label className="text-base font-medium">Voice Escalation</Label>
                    <p className="text-xs text-muted-foreground">
                      Enable outbound voice calls for critical issues via Vapi
                    </p>
                  </div>
                  <Switch
                    checked={config?.voice_escalation_enabled ?? false}
                    onCheckedChange={(checked) =>
                      handleConfigUpdate({ voice_escalation_enabled: checked })
                    }
                  />
                </div>

                {/* Sentiment Threshold */}
                <div className="p-4 rounded-lg bg-muted/30">
                  <Label className="text-base font-medium">Sentiment Threshold</Label>
                  <p className="text-xs text-muted-foreground mb-3">
                    Mark tickets as critical below this score (1-10)
                  </p>
                  <Select
                    value={String(config?.sentiment_threshold ?? 3)}
                    onValueChange={(value) =>
                      handleConfigUpdate({ sentiment_threshold: parseInt(value) })
                    }
                  >
                    <SelectTrigger className="w-[100px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Channels */}
                <div className="p-4 rounded-lg bg-muted/30">
                  <Label className="text-base font-medium">Enabled Channels</Label>
                  <p className="text-xs text-muted-foreground mb-3">
                    Select which channels The Knight should monitor
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {['twitter', 'linkedin', 'outlook', 'whatsapp', 'instagram', 'facebook'].map(
                      (channel) => (
                        <div key={channel} className="flex items-center gap-2">
                          <Switch
                            checked={config?.channels_enabled?.[channel] ?? true}
                            onCheckedChange={(checked) =>
                              handleConfigUpdate({
                                channels_enabled: {
                                  ...config?.channels_enabled,
                                  [channel]: checked,
                                },
                              })
                            }
                          />
                          <div className="flex items-center gap-2">
                            {getChannelIcon(channel)}
                            <span className="text-sm capitalize">{channel}</span>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>

                {/* Custom Persona */}
                <div className="p-4 rounded-lg bg-muted/30">
                  <Label className="text-base font-medium">Custom Persona Prompt</Label>
                  <p className="text-xs text-muted-foreground mb-3">
                    Customize how The Knight responds (optional)
                  </p>
                  <Textarea
                    placeholder="Enter custom persona instructions..."
                    value={config?.persona_prompt || ''}
                    onChange={(e) => handleConfigUpdate({ persona_prompt: e.target.value })}
                    className="min-h-[120px]"
                  />
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}

function formatTimestamp(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
