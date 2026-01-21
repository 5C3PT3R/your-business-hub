import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Mail,
  Search,
  Star,
  Circle,
  Archive,
  Trash2,
  Reply,
  Forward,
  MoreVertical,
  Filter,
  RefreshCw,
  Bot,
  Clock,
  User,
  Building2,
  Sparkles,
  ArrowLeft,
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useIntegrations } from '@/hooks/useIntegrations';
import { useMessages } from '@/hooks/useMessages';
import { useGmailSync } from '@/hooks/useGmailSync';
import { useToast } from '@/hooks/use-toast';
import { UnifiedMessage } from '@/types/inbox';
import { ChannelNavigation } from '@/components/inbox/ChannelNavigation';
import { EmptyInboxState } from '@/components/inbox/EmptyInboxState';
import { EmptyMessagesState } from '@/components/inbox/EmptyMessagesState';
import { ComposeModal } from '@/components/inbox/ComposeModal';
import { getPlatformConfig } from '@/config/platforms';
import { supabase } from '@/integrations/supabase/client';

export default function Inbox() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { integrations, loading: integrationsLoading, refreshIntegrations } = useIntegrations();
  const { syncGmail, isSyncing: isGmailSyncing } = useGmailSync();
  const isMobile = useIsMobile();

  // Read initial values from URL query parameters
  const filterParam = searchParams.get('filter') || 'all';
  const channelParam = searchParams.get('channel') || 'all';

  const [activeTab, setActiveTab] = useState<string>(filterParam);
  const [activeChannel, setActiveChannel] = useState<string>(channelParam);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMessage, setSelectedMessage] = useState<UnifiedMessage | null>(null);
  const [sortBy, setSortBy] = useState<string>('date');
  const [composeOpen, setComposeOpen] = useState(false);

  // Sync state with URL params when they change
  useEffect(() => {
    const filter = searchParams.get('filter') || 'all';
    const channel = searchParams.get('channel') || 'all';

    setActiveTab(filter);
    setActiveChannel(channel);
  }, [searchParams]);

  // Fetch real messages from conversations table
  const {
    messages,
    loading: messagesLoading,
    refreshMessages,
    markAsRead: markMessageAsRead,
    toggleStar: toggleMessageStar,
  } = useMessages({
    channel: activeChannel as any,
    unreadOnly: false, // Don't filter at DB level, filter in UI for flexibility
  });

  // Set page title
  useEffect(() => {
    document.title = 'Inbox | Breeze CRM';
  }, []);

  // Handle sync
  const handleSync = async () => {
    try {
      // First sync Gmail messages
      await syncGmail();
      // Then refresh integrations and messages
      await Promise.all([refreshIntegrations(), refreshMessages()]);
    } catch (error) {
      // Error already handled by useGmailSync
      console.error('Sync error:', error);
    }
  };

  // Handlers to update both state and URL
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    const newParams = new URLSearchParams(searchParams);
    if (tab === 'all') {
      newParams.delete('filter');
    } else {
      newParams.set('filter', tab);
    }
    setSearchParams(newParams);
  };

  const handleChannelChange = (channel: string) => {
    setActiveChannel(channel);
    const newParams = new URLSearchParams(searchParams);
    if (channel === 'all') {
      newParams.delete('channel');
    } else {
      newParams.set('channel', channel);
    }
    setSearchParams(newParams);
  };

  // Filter messages based on active filters
  const filteredMessages = React.useMemo(() => {
    let result = messages;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (msg) =>
          msg.from.name.toLowerCase().includes(query) ||
          msg.subject?.toLowerCase().includes(query) ||
          msg.preview.toLowerCase().includes(query) ||
          msg.from.company?.toLowerCase().includes(query)
      );
    }

    // Tab filter
    if (activeTab !== 'all') {
      if (activeTab === 'unread') {
        result = result.filter((msg) => !msg.isRead);
      } else if (activeTab === 'starred') {
        result = result.filter((msg) => msg.isStarred);
      } else if (activeTab === 'urgent') {
        result = result.filter((msg) => msg.isUrgent);
      } else if (activeTab === 'sent') {
        result = result.filter((msg) => msg.direction === 'outgoing');
      } else if (activeTab === 'ai') {
        // AI Assigned filter - could filter by AI-suggested actions or tags
        result = result.filter((msg) => msg.intent !== undefined || msg.sentiment !== undefined);
      }
    }

    // Channel filter
    if (activeChannel !== 'all') {
      // Check if it's a category or specific platform
      const categoryIntegrations = integrations.filter(
        (i) => i.category === activeChannel
      );
      if (categoryIntegrations.length > 0) {
        // Filter by category
        result = result.filter((msg) =>
          categoryIntegrations.some((i) => i.platform === msg.platform)
        );
      } else {
        // Filter by specific platform or channel type
        // Handle special cases: map UI channels to actual platform values
        if (activeChannel === 'calls') {
          // Calls can be from twilio_sms or other phone platforms
          result = result.filter((msg) =>
            msg.platform === 'twilio_sms' ||
            (msg as any).channel === 'call' ||
            (msg as any).channel === 'phone'
          );
        } else if (activeChannel === 'email') {
          // Email includes gmail and outlook
          result = result.filter((msg) =>
            msg.platform === 'gmail' ||
            msg.platform === 'outlook'
          );
        } else if (activeChannel === 'whatsapp') {
          // WhatsApp messages
          result = result.filter((msg) => msg.platform === 'whatsapp');
        } else if (activeChannel === 'social') {
          // Social includes messenger, instagram, linkedin
          result = result.filter((msg) =>
            msg.platform === 'messenger' ||
            msg.platform === 'instagram' ||
            msg.platform === 'linkedin' ||
            msg.platform === 'facebook'
          );
        } else {
          // Direct platform match
          result = result.filter((msg) => msg.platform === activeChannel);
        }
      }
    }

    // Sort
    switch (sortBy) {
      case 'date':
        result.sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        break;
      case 'sender':
        result.sort((a, b) => a.from.name.localeCompare(b.from.name));
        break;
    }

    return result;
  }, [messages, searchQuery, activeTab, activeChannel, sortBy, integrations]);

  // Handle message actions
  const handleMarkAsRead = (messageId: string) => {
    markMessageAsRead(messageId);
  };

  const handleToggleStar = (messageId: string) => {
    toggleMessageStar(messageId);
  };

  const handleSelectMessage = (message: UnifiedMessage) => {
    setSelectedMessage(message);
    if (!message.isRead) {
      handleMarkAsRead(message.id);
    }
  };

  // Mobile: Go back to message list
  const handleBackToList = () => {
    setSelectedMessage(null);
  };

  // Calculate counts
  const unreadCount = messages.filter((msg) => !msg.isRead).length;
  const urgentCount = messages.filter((msg) => msg.isUrgent).length;
  const starredCount = messages.filter((msg) => msg.isStarred).length;
  const sentCount = messages.filter((msg) => msg.direction === 'outgoing').length;

  // Show loading state
  if (integrationsLoading || messagesLoading) {
    return (
      <MainLayout>
        <Header title="Inbox" subtitle="Loading..." />
        <div className="flex items-center justify-center min-h-[600px]">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="h-12 w-12 rounded-xl gradient-brand animate-pulse" />
              <div className="absolute inset-0 h-12 w-12 rounded-xl gradient-brand blur-xl opacity-50 animate-pulse" />
            </div>
            <div className="space-y-2 text-center">
              <p className="text-sm font-medium text-foreground">Loading inbox...</p>
              <p className="text-xs text-muted-foreground">Fetching your messages</p>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  // Show empty state if no integrations
  if (integrations.length === 0) {
    return (
      <MainLayout>
        <Header title="Inbox" subtitle="Connect your communication channels" />
        <EmptyInboxState />
      </MainLayout>
    );
  }

  // Main inbox view
  return (
    <MainLayout>
      <Header
        title="Inbox"
        subtitle={`${unreadCount} unread · ${urgentCount} urgent`}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={isGmailSyncing}
            >
              <RefreshCw
                className={cn('h-4 w-4 mr-2', isGmailSyncing && 'animate-spin')}
              />
              Sync Gmail
            </Button>
            <Button variant="default" size="sm" onClick={() => setComposeOpen(true)}>
              <Mail className="h-4 w-4 mr-2" />
              Compose
            </Button>
          </div>
        }
      />

      {/* Dynamic Channel Navigation */}
      <ChannelNavigation
        integrations={integrations}
        activeChannel={activeChannel}
        onChannelChange={handleChannelChange}
      />

      <div className="p-4 md:p-6 relative overflow-hidden min-h-[calc(100vh-10rem)]">
        {/* Animated background gradients */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-gradient-to-br from-blue-500/20 via-purple-500/15 to-pink-500/10 dark:from-blue-500/30 dark:via-purple-500/20 dark:to-pink-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-[-30%] left-[-15%] w-[500px] h-[500px] bg-gradient-to-tr from-cyan-500/15 via-blue-500/10 to-transparent dark:from-cyan-500/20 dark:via-blue-500/15 rounded-full blur-3xl" />
          <div className="absolute top-[40%] left-[30%] w-[300px] h-[300px] bg-gradient-to-r from-violet-500/10 to-fuchsia-500/5 dark:from-violet-500/15 dark:to-fuchsia-500/10 rounded-full blur-2xl" />
        </div>

        {/* Mobile: Show either list or detail, not both */}
        {isMobile ? (
          selectedMessage ? (
            // Mobile Message Detail View
            <div className="h-[calc(100vh-12rem)]">
              <Card variant="glass" className="h-full flex flex-col animate-fade-in">
                {/* Back Button + Header */}
                <div className="p-4 border-b flex items-center gap-3">
                  <Button variant="ghost" size="sm" onClick={handleBackToList}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div className="flex-1 min-w-0">
                    <h2 className="font-semibold text-foreground truncate">
                      {selectedMessage.subject || 'Message'}
                    </h2>
                    <p className="text-xs text-muted-foreground truncate">
                      {selectedMessage.from.name}
                    </p>
                  </div>
                  <button
                    onClick={() => handleToggleStar(selectedMessage.id)}
                    className="hover:scale-110 transition-transform"
                  >
                    <Star
                      className={cn(
                        'h-5 w-5',
                        selectedMessage.isStarred
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-muted-foreground'
                      )}
                    />
                  </button>
                </div>

                {/* Message Actions */}
                <div className="p-3 border-b flex items-center gap-2 overflow-x-auto">
                  <Button size="sm">
                    <Reply className="h-4 w-4 mr-1" />
                    Reply
                  </Button>
                  <Button size="sm" variant="outline">
                    <Forward className="h-4 w-4 mr-1" />
                    Forward
                  </Button>
                  <Button size="sm" variant="outline">
                    <Archive className="h-4 w-4" />
                  </Button>
                </div>

                {/* AI Insights */}
                {(selectedMessage.sentiment || selectedMessage.intent) && (
                  <div className="p-3 bg-accent/10 border-b border-accent/20">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-accent-foreground" />
                      {selectedMessage.sentiment && (
                        <Badge
                          variant="outline"
                          className={cn(
                            'capitalize text-xs',
                            selectedMessage.sentiment === 'positive' && 'bg-success/10 text-success',
                            selectedMessage.sentiment === 'neutral' && 'bg-muted text-muted-foreground',
                            selectedMessage.sentiment === 'negative' && 'bg-destructive/10 text-destructive'
                          )}
                        >
                          {selectedMessage.sentiment}
                        </Badge>
                      )}
                      {selectedMessage.intent && (
                        <Badge variant="outline" className="capitalize text-xs">
                          {selectedMessage.intent}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                {/* Message Body */}
                <div className="flex-1 p-4 overflow-y-auto">
                  {selectedMessage.bodyHtml ? (
                    <div
                      className="prose prose-sm max-w-none dark:prose-invert"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(selectedMessage.bodyHtml) }}
                    />
                  ) : (
                    <p className="whitespace-pre-wrap text-sm text-foreground/80">
                      {selectedMessage.body}
                    </p>
                  )}
                </div>
              </Card>
            </div>
          ) : (
            // Mobile Message List View
            <div className="space-y-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search messages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Quick Filter Tabs */}
              <div className="flex gap-2 overflow-x-auto pb-2">
                {['all', 'unread', 'starred'].map((tab) => (
                  <Button
                    key={tab}
                    variant={activeTab === tab ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => handleTabChange(tab)}
                    className="capitalize flex-shrink-0"
                  >
                    {tab}
                    {tab === 'unread' && unreadCount > 0 && (
                      <Badge variant="default" className="ml-1 text-xs">{unreadCount}</Badge>
                    )}
                  </Button>
                ))}
              </div>

              {/* Message List */}
              <div className="space-y-2">
                {filteredMessages.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <Mail className="h-12 w-12 mx-auto mb-3 text-muted-foreground/60" />
                    <p className="text-sm font-medium">No messages found</p>
                  </div>
                ) : (
                  filteredMessages.map((message) => {
                    const platformConfig = getPlatformConfig(message.platform);
                    return (
                      <Card
                        key={message.id}
                        variant="glass"
                        onClick={() => handleSelectMessage(message)}
                        className={cn(
                          'p-3 cursor-pointer active:scale-[0.98] transition-transform',
                          !message.isRead && 'border-primary/30 bg-primary/5'
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-lg flex-shrink-0">{platformConfig?.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                'font-medium text-sm truncate',
                                !message.isRead && 'font-semibold'
                              )}>
                                {message.from.name}
                              </span>
                              {!message.isRead && (
                                <Circle className="h-2 w-2 fill-primary text-primary flex-shrink-0" />
                              )}
                            </div>
                            {message.subject && (
                              <p className="text-sm text-foreground/80 truncate">{message.subject}</p>
                            )}
                            <p className="text-xs text-muted-foreground line-clamp-1">{message.preview}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatTimestamp(new Date(message.timestamp))}
                            </p>
                          </div>
                        </div>
                      </Card>
                    );
                  })
                )}
              </div>
            </div>
          )
        ) : (
          // Desktop: Two-column layout
          <div className="flex gap-6 h-[calc(100vh-16rem)]">
            {/* Left Sidebar - Message List */}
            <div className="w-96 flex flex-col gap-4">
            {/* Filters and Search */}
            <Card variant="glass" className="p-4">
              <div className="space-y-3">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search messages..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {/* Tabs */}
                <Tabs value={activeTab} onValueChange={handleTabChange}>
                  <TabsList className="w-full grid grid-cols-5 gap-1">
                    <TabsTrigger value="all" className="text-xs">
                      All
                      <Badge variant="secondary" className="ml-1 text-xs">
                        {messages.length}
                      </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="unread" className="text-xs">
                      Unread
                      {unreadCount > 0 && (
                        <Badge variant="default" className="ml-1 text-xs">
                          {unreadCount}
                        </Badge>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="sent" className="text-xs">
                      Sent
                      {sentCount > 0 && (
                        <Badge variant="secondary" className="ml-1 text-xs">
                          {sentCount}
                        </Badge>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="urgent" className="text-xs">
                      Urgent
                      {urgentCount > 0 && (
                        <Badge variant="destructive" className="ml-1 text-xs">
                          {urgentCount}
                        </Badge>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="starred" className="text-xs">
                      Starred
                      {starredCount > 0 && (
                        <Badge variant="secondary" className="ml-1 text-xs">
                          {starredCount}
                        </Badge>
                      )}
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                {/* Sort */}
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date">Sort by Date</SelectItem>
                    <SelectItem value="sender">Sort by Sender</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </Card>

            {/* Message List */}
            <Card variant="glass" className="flex-1 overflow-hidden">
              <div className="h-full overflow-y-auto">
                {filteredMessages.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <Mail className="h-12 w-12 mx-auto mb-3 text-muted-foreground/60" />
                    <p className="text-sm font-medium">No messages found</p>
                    <p className="text-xs text-muted-foreground/80 mt-1">
                      {searchQuery
                        ? 'Try adjusting your search'
                        : 'Your messages will appear here'}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {filteredMessages.map((message) => {
                      const platformConfig = getPlatformConfig(message.platform);
                      return (
                        <button
                          key={message.id}
                          onClick={() => handleSelectMessage(message)}
                          className={cn(
                            'w-full p-4 text-left hover:bg-muted/50 transition-colors',
                            selectedMessage?.id === message.id && 'bg-primary/10',
                            !message.isRead && 'bg-primary/5'
                          )}
                        >
                          <div className="flex items-start gap-3">
                            {/* Platform Icon */}
                            <div className="flex-shrink-0 mt-1">
                              <span className="text-lg">{platformConfig?.icon}</span>
                            </div>

                            <div className="flex-1 min-w-0">
                              {/* Header */}
                              <div className="flex items-center gap-2 mb-1">
                                <span
                                  className={cn(
                                    'font-semibold text-sm truncate',
                                    !message.isRead && 'text-foreground',
                                    message.isRead && 'text-foreground/80'
                                  )}
                                >
                                  {message.from.name}
                                </span>
                                {message.isUrgent && (
                                  <Badge variant="destructive" className="text-xs px-1.5 py-0">
                                    Urgent
                                  </Badge>
                                )}
                                {!message.isRead && (
                                  <Circle className="h-2 w-2 fill-primary text-primary" />
                                )}
                              </div>

                              {/* Company */}
                              {message.from.company && (
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                                  <Building2 className="h-3 w-3" />
                                  <span>{message.from.company}</span>
                                </div>
                              )}

                              {/* Subject */}
                              {message.subject && (
                                <p
                                  className={cn(
                                    'text-sm mb-1 truncate',
                                    !message.isRead && 'font-semibold text-foreground',
                                    message.isRead && 'text-foreground/80'
                                  )}
                                >
                                  {message.subject}
                                </p>
                              )}

                              {/* Preview */}
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {message.preview}
                              </p>

                              {/* Footer */}
                              <div className="flex items-center justify-between mt-2">
                                <span className="text-xs text-muted-foreground">
                                  {formatTimestamp(new Date(message.timestamp))}
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleStar(message.id);
                                  }}
                                  className="hover:scale-110 transition-transform"
                                >
                                  <Star
                                    className={cn(
                                      'h-4 w-4',
                                      message.isStarred
                                        ? 'fill-yellow-400 text-yellow-400'
                                        : 'text-muted-foreground'
                                    )}
                                  />
                                </button>
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Right Panel - Message Detail */}
          {selectedMessage ? (
            <Card variant="glass" className="flex-1 flex flex-col animate-fade-in">
              {/* Message Header */}
              <div className="p-6 border-b">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">
                        {getPlatformConfig(selectedMessage.platform)?.icon}
                      </span>
                      <h2 className="text-xl font-bold text-foreground">
                        {selectedMessage.subject || 'Message'}
                      </h2>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <span className="font-medium text-foreground">{selectedMessage.from.name}</span>
                        <span className="text-muted-foreground/70">
                          &lt;{selectedMessage.from.email}&gt;
                        </span>
                      </div>
                      <span>·</span>
                      <Clock className="h-4 w-4" />
                      <span>
                        {formatTimestamp(new Date(selectedMessage.timestamp), true)}
                      </span>
                    </div>
                    {selectedMessage.from.company && (
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline">
                          <Building2 className="h-3 w-3 mr-1" />
                          {selectedMessage.from.company}
                        </Badge>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleToggleStar(selectedMessage.id)}
                    className="hover:scale-110 transition-transform"
                  >
                    <Star
                      className={cn(
                        'h-5 w-5',
                        selectedMessage.isStarred
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-muted-foreground'
                      )}
                    />
                  </button>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  <Button size="sm">
                    <Reply className="h-4 w-4 mr-2" />
                    Reply
                  </Button>
                  <Button size="sm" variant="outline">
                    <Forward className="h-4 w-4 mr-2" />
                    Forward
                  </Button>
                  <Button size="sm" variant="outline">
                    <Archive className="h-4 w-4 mr-2" />
                    Archive
                  </Button>
                  <Button size="sm" variant="ghost">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* AI Insights */}
              {(selectedMessage.sentiment || selectedMessage.intent) && (
                <div className="p-4 bg-accent/10 border-b border-accent/20 dark:bg-accent/5 dark:border-accent/10">
                  <div className="flex items-start gap-3">
                    <Sparkles className="h-5 w-5 text-accent-foreground flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground text-sm mb-2">
                        AI Insights
                      </h3>
                      <div className="flex items-center gap-2">
                        {selectedMessage.sentiment && (
                          <Badge
                            variant="outline"
                            className={cn(
                              'capitalize',
                              selectedMessage.sentiment === 'positive' &&
                                'bg-success/10 text-success border-success/30 dark:bg-success/20',
                              selectedMessage.sentiment === 'neutral' &&
                                'bg-muted text-muted-foreground border-border',
                              selectedMessage.sentiment === 'negative' &&
                                'bg-destructive/10 text-destructive border-destructive/30 dark:bg-destructive/20'
                            )}
                          >
                            {selectedMessage.sentiment}
                          </Badge>
                        )}
                        {selectedMessage.intent && (
                          <Badge variant="outline" className="capitalize">
                            {selectedMessage.intent}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Message Body */}
              <div className="flex-1 p-6 overflow-y-auto">
                {selectedMessage.bodyHtml ? (
                  <div
                    className="prose prose-sm max-w-none dark:prose-invert"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(selectedMessage.bodyHtml) }}
                  />
                ) : (
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <p className="whitespace-pre-wrap text-foreground/80">
                      {selectedMessage.body}
                    </p>
                  </div>
                )}
              </div>
            </Card>
          ) : (
            <EmptyMessagesState
              platform={activeChannel !== 'all' ? activeChannel : undefined}
              onRefresh={handleSync}
            />
          )}
        </div>
        )}
      </div>

      {/* Compose Modal */}
      <ComposeModal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        onSend={async (data) => {
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
              throw new Error('Not authenticated');
            }

            // Send email via Edge Function
            const response = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gmail-send`,
              {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${session.access_token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
              }
            );

            if (!response.ok) {
              const error = await response.json();
              throw new Error(error.error || 'Failed to send email');
            }

            toast({
              title: 'Email sent successfully',
              description: `Message sent to ${data.to}`,
            });

            // Refresh messages to show the sent email
            await refreshMessages();
          } catch (error) {
            toast({
              title: 'Failed to send email',
              description: error instanceof Error ? error.message : 'Unknown error',
              variant: 'destructive',
            });
            throw error;
          }
        }}
      />
    </MainLayout>
  );
}

function sanitizeHtml(html: string): string {
  // Remove <style> tags and their contents
  let cleaned = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // Remove inline style attributes
  cleaned = cleaned.replace(/\sstyle="[^"]*"/gi, '');

  // Remove script tags
  cleaned = cleaned.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

  // Remove dangerous attributes
  cleaned = cleaned.replace(/\son\w+="[^"]*"/gi, '');

  return cleaned;
}

function formatTimestamp(date: Date, detailed: boolean = false): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (detailed) {
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  if (diffHours < 1) {
    const diffMins = Math.floor(diffMs / (1000 * 60));
    return `${diffMins}m ago`;
  }
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  if (diffDays === 1) {
    return 'Yesterday';
  }
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
