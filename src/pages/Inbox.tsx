import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
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

export default function Inbox() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { integrations, loading: integrationsLoading, refreshIntegrations } = useIntegrations();
  const { syncGmail, isSyncing: isGmailSyncing } = useGmailSync();
  const [activeTab, setActiveTab] = useState<string>('all');
  const [activeChannel, setActiveChannel] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMessage, setSelectedMessage] = useState<UnifiedMessage | null>(null);
  const [sortBy, setSortBy] = useState<string>('date');
  const [composeOpen, setComposeOpen] = useState(false);

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
        // Filter by specific platform
        result = result.filter((msg) => msg.platform === activeChannel);
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

  // Calculate counts
  const unreadCount = messages.filter((msg) => !msg.isRead).length;
  const urgentCount = messages.filter((msg) => msg.isUrgent).length;
  const starredCount = messages.filter((msg) => msg.isStarred).length;

  // Show loading state
  if (integrationsLoading || messagesLoading) {
    return (
      <MainLayout>
        <Header title="Inbox" subtitle="Loading..." />
        <div className="flex items-center justify-center min-h-[600px]">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-foreground animate-pulse" />
            <p className="text-sm text-muted-foreground">Loading inbox...</p>
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
        onChannelChange={setActiveChannel}
      />

      <div className="p-4 md:p-6">
        <div className="flex gap-6 h-[calc(100vh-16rem)]">
          {/* Left Sidebar - Message List */}
          <div className="w-96 flex flex-col gap-4">
            {/* Filters and Search */}
            <Card className="p-4">
              <div className="space-y-3">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search messages..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {/* Tabs */}
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="w-full grid grid-cols-4">
                    <TabsTrigger value="all" className="text-xs">
                      All
                      <Badge variant="secondary" className="ml-1 text-xs">
                        {messages.length}
                      </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="unread" className="text-xs">
                      Unread
                      {unreadCount > 0 && (
                        <Badge variant="default" className="ml-1 text-xs bg-blue-600">
                          {unreadCount}
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
            <Card className="flex-1 overflow-hidden">
              <div className="h-full overflow-y-auto">
                {filteredMessages.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <Mail className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                    <p className="text-sm font-medium">No messages found</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {searchQuery
                        ? 'Try adjusting your search'
                        : 'Your messages will appear here'}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {filteredMessages.map((message) => {
                      const platformConfig = getPlatformConfig(message.platform);
                      return (
                        <button
                          key={message.id}
                          onClick={() => handleSelectMessage(message)}
                          className={cn(
                            'w-full p-4 text-left hover:bg-gray-50 transition-colors',
                            selectedMessage?.id === message.id && 'bg-blue-50',
                            !message.isRead && 'bg-blue-50/30'
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
                                    !message.isRead && 'text-gray-900',
                                    message.isRead && 'text-gray-700'
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
                                  <Circle className="h-2 w-2 fill-blue-600 text-blue-600" />
                                )}
                              </div>

                              {/* Company */}
                              {message.from.company && (
                                <div className="flex items-center gap-1.5 text-xs text-gray-600 mb-1">
                                  <Building2 className="h-3 w-3" />
                                  <span>{message.from.company}</span>
                                </div>
                              )}

                              {/* Subject */}
                              {message.subject && (
                                <p
                                  className={cn(
                                    'text-sm mb-1 truncate',
                                    !message.isRead && 'font-semibold text-gray-900',
                                    message.isRead && 'text-gray-700'
                                  )}
                                >
                                  {message.subject}
                                </p>
                              )}

                              {/* Preview */}
                              <p className="text-xs text-gray-600 line-clamp-2">
                                {message.preview}
                              </p>

                              {/* Footer */}
                              <div className="flex items-center justify-between mt-2">
                                <span className="text-xs text-gray-500">
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
                                        : 'text-gray-400'
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
            <Card className="flex-1 flex flex-col">
              {/* Message Header */}
              <div className="p-6 border-b">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">
                        {getPlatformConfig(selectedMessage.platform)?.icon}
                      </span>
                      <h2 className="text-xl font-bold text-gray-900">
                        {selectedMessage.subject || 'Message'}
                      </h2>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <span className="font-medium">{selectedMessage.from.name}</span>
                        <span className="text-gray-400">
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
                          : 'text-gray-400'
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
                <div className="p-4 bg-purple-50 border-b border-purple-100">
                  <div className="flex items-start gap-3">
                    <Sparkles className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h3 className="font-semibold text-purple-900 text-sm mb-2">
                        AI Insights
                      </h3>
                      <div className="flex items-center gap-2">
                        {selectedMessage.sentiment && (
                          <Badge
                            variant="outline"
                            className={cn(
                              'capitalize',
                              selectedMessage.sentiment === 'positive' &&
                                'bg-green-50 text-green-700 border-green-200',
                              selectedMessage.sentiment === 'neutral' &&
                                'bg-gray-50 text-gray-700 border-gray-200',
                              selectedMessage.sentiment === 'negative' &&
                                'bg-red-50 text-red-700 border-red-200'
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
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(selectedMessage.bodyHtml) }}
                  />
                ) : (
                  <div className="prose prose-sm max-w-none">
                    <p className="whitespace-pre-wrap text-gray-700">
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
      </div>

      {/* Compose Modal */}
      <ComposeModal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        onSend={async (data) => {
          toast({
            title: 'Email sent',
            description: `Message sent to ${data.to}`,
          });
          // TODO: Implement actual email sending via API
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
