import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Integration } from '@/types/inbox';
import { getPlatformConfig } from '@/config/platforms';

interface ChannelNavigationProps {
  integrations: Integration[];
  activeChannel: string;
  onChannelChange: (channel: string) => void;
}

export function ChannelNavigation({
  integrations,
  activeChannel,
  onChannelChange,
}: ChannelNavigationProps) {
  // Filter to only show connected and active integrations
  const connectedIntegrations = integrations.filter(
    (integration) => integration.isConnected && integration.isActive
  );

  // Calculate total unread count
  const totalUnread = connectedIntegrations.reduce(
    (sum, integration) => sum + integration.unreadCount,
    0
  );

  // Group integrations by category if more than 5 platforms
  const shouldGroupByCategory = connectedIntegrations.length > 5;

  // Hide individual channel buttons if only one integration connected
  const showIndividualChannels = connectedIntegrations.length > 1;

  const categories = shouldGroupByCategory
    ? Array.from(new Set(connectedIntegrations.map((i) => i.category)))
    : [];

  return (
    <div className="border-b border-gray-200 bg-white">
      <ScrollArea className="w-full">
        <div className="flex items-center gap-2 px-6 py-3">
          {/* All Messages Tab */}
          <Button
            variant={activeChannel === 'all' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onChannelChange('all')}
            className="flex-shrink-0"
          >
            <span>All Messages</span>
            {totalUnread > 0 && (
              <Badge
                variant={activeChannel === 'all' ? 'secondary' : 'default'}
                className="ml-2 rounded-full px-2 py-0.5 text-xs"
              >
                {totalUnread > 99 ? '99+' : totalUnread}
              </Badge>
            )}
          </Button>

          {/* Category Grouping or Individual Channels */}
          {showIndividualChannels && shouldGroupByCategory ? (
            // Show category tabs when many platforms connected
            categories.map((category) => {
              const categoryIntegrations = connectedIntegrations.filter(
                (i) => i.category === category
              );
              const categoryUnread = categoryIntegrations.reduce(
                (sum, i) => sum + i.unreadCount,
                0
              );

              return (
                <Button
                  key={category}
                  variant={activeChannel === category ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => onChannelChange(category)}
                  className="flex-shrink-0 capitalize"
                >
                  <span>{category}</span>
                  {categoryUnread > 0 && (
                    <Badge
                      variant={
                        activeChannel === category ? 'secondary' : 'default'
                      }
                      className="ml-2 rounded-full px-2 py-0.5 text-xs"
                    >
                      {categoryUnread > 99 ? '99+' : categoryUnread}
                    </Badge>
                  )}
                </Button>
              );
            })
          ) : showIndividualChannels ? (
            // Show individual platform tabs when few platforms
            connectedIntegrations.map((integration) => {
              const config = getPlatformConfig(integration.platform);

              return (
                <Button
                  key={integration.id}
                  variant={
                    activeChannel === integration.platform ? 'default' : 'ghost'
                  }
                  size="sm"
                  onClick={() => onChannelChange(integration.platform)}
                  className="flex-shrink-0"
                >
                  <span className="mr-1.5">{config?.icon}</span>
                  <span>{integration.name}</span>
                  {integration.unreadCount > 0 && (
                    <Badge
                      variant={
                        activeChannel === integration.platform
                          ? 'secondary'
                          : 'default'
                      }
                      className="ml-2 rounded-full px-2 py-0.5 text-xs"
                    >
                      {integration.unreadCount > 99
                        ? '99+'
                        : integration.unreadCount}
                    </Badge>
                  )}
                </Button>
              );
            })
          ) : null}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
