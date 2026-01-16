import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Integration } from '@/types/inbox';
import { getPlatformConfig } from '@/config/platforms';
import {
  Mail,
  MessageCircle,
  MessageSquare,
  Instagram,
  Linkedin,
  Facebook,
  Phone,
} from 'lucide-react';

// Platform icon mapping
const platformIcons: Record<string, any> = {
  gmail: Mail,
  outlook: Mail,
  whatsapp: MessageCircle,
  messenger: Facebook,
  instagram: Instagram,
  linkedin: Linkedin,
  twilio_sms: Phone,
  email: Mail,
  social: MessageSquare,
};

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
    <div className="border-b border-white/5 bg-card/50 backdrop-blur-lg">
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

          {/* Quick Channel Filters */}
          <Button
            variant={activeChannel === 'email' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onChannelChange('email')}
            className="flex-shrink-0"
          >
            <Mail className="h-4 w-4 mr-1.5 text-red-500" />
            <span>Email</span>
          </Button>

          <Button
            variant={activeChannel === 'whatsapp' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onChannelChange('whatsapp')}
            className="flex-shrink-0"
          >
            <MessageCircle className="h-4 w-4 mr-1.5 text-green-500" />
            <span>WhatsApp</span>
          </Button>

          <Button
            variant={activeChannel === 'social' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onChannelChange('social')}
            className="flex-shrink-0"
          >
            <MessageSquare className="h-4 w-4 mr-1.5 text-blue-500" />
            <span>Social</span>
          </Button>

          {/* Divider */}
          <div className="h-6 w-px bg-border mx-2" />

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
              const CategoryIcon = platformIcons[category] || MessageSquare;

              return (
                <Button
                  key={category}
                  variant={activeChannel === category ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => onChannelChange(category)}
                  className="flex-shrink-0 capitalize"
                >
                  <CategoryIcon className="h-4 w-4 mr-1.5" />
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
              const PlatformIcon = platformIcons[integration.platform] || MessageSquare;

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
                  <PlatformIcon className="h-4 w-4 mr-1.5" />
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
