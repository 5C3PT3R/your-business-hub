import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { InboxIcon, RefreshCw } from 'lucide-react';
import { getPlatformConfig } from '@/config/platforms';

interface EmptyMessagesStateProps {
  platform?: string;
  isLoading?: boolean;
  onRefresh?: () => void;
}

export function EmptyMessagesState({
  platform,
  isLoading,
  onRefresh,
}: EmptyMessagesStateProps) {
  const platformConfig = platform ? getPlatformConfig(platform) : null;

  return (
    <Card className="flex-1 flex items-center justify-center p-12">
      <div className="text-center space-y-4 max-w-md">
        <div className="flex items-center justify-center">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
            {platformConfig ? (
              <span className="text-3xl">{platformConfig.icon}</span>
            ) : (
              <InboxIcon className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-foreground">
            {isLoading
              ? 'Loading messages...'
              : platform
              ? `No ${platformConfig?.name || platform} messages`
              : 'No messages'}
          </h3>
          <p className="text-sm text-muted-foreground">
            {isLoading
              ? 'Fetching your latest messages from connected platforms.'
              : platform
              ? `You're all caught up on ${
                  platformConfig?.name || platform
                }! New messages will appear here.`
              : "You're all caught up! New messages will appear here."}
          </p>
        </div>

        {!isLoading && onRefresh && (
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        )}
      </div>
    </Card>
  );
}
