import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Mail,
  Phone,
  Calendar,
  MessageSquare,
  FileText,
  TrendingUp,
  TrendingDown,
  Minus,
  Plus,
} from 'lucide-react';
import { useConversations } from '@/hooks/useConversations';
import { cn } from '@/lib/utils';
import type { Conversation } from '@/types/conversations';

interface ConversationTimelineProps {
  contactId?: string;
  dealId?: string;
  leadId?: string;
  limit?: number;
  onAddConversation?: () => void;
}

const typeIcons = {
  email: Mail,
  call: Phone,
  meeting: Calendar,
  message: MessageSquare,
  note: FileText,
};

const typeColors = {
  email: 'bg-blue-100 text-blue-700',
  call: 'bg-green-100 text-green-700',
  meeting: 'bg-purple-100 text-purple-700',
  message: 'bg-yellow-100 text-yellow-700',
  note: 'bg-gray-100 text-gray-700',
};

const sentimentIcons = {
  positive: TrendingUp,
  neutral: Minus,
  negative: TrendingDown,
};

const sentimentColors = {
  positive: 'text-green-600',
  neutral: 'text-gray-600',
  negative: 'text-red-600',
};

export function ConversationTimeline({
  contactId,
  dealId,
  leadId,
  limit = 10,
  onAddConversation,
}: ConversationTimelineProps) {
  const { conversations, isLoading } = useConversations({
    contactId,
    dealId,
    leadId,
    limit,
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } else if (diffInHours < 7 * 24) {
      return date.toLocaleDateString('en-US', { weekday: 'short', hour: 'numeric' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Conversation History</h3>
        {onAddConversation && (
          <Button variant="outline" size="sm" onClick={onAddConversation}>
            <Plus className="h-3 w-3 mr-1" />
            Add
          </Button>
        )}
      </div>

      {conversations.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">
          No conversations yet
        </div>
      ) : (
        <div className="space-y-3">
          {conversations.map((conversation) => {
            const TypeIcon = typeIcons[conversation.type];
            const SentimentIcon = conversation.sentiment
              ? sentimentIcons[conversation.sentiment]
              : null;

            return (
              <div
                key={conversation.id}
                className="flex gap-3 pb-3 border-b border-gray-100 last:border-0 last:pb-0"
              >
                <div
                  className={cn(
                    'p-2 rounded-lg shrink-0 h-fit',
                    typeColors[conversation.type]
                  )}
                >
                  <TypeIcon className="h-4 w-4" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs capitalize">
                        {conversation.type}
                      </Badge>
                      {conversation.sentiment && SentimentIcon && (
                        <div
                          className={cn(
                            'flex items-center gap-1',
                            sentimentColors[conversation.sentiment]
                          )}
                        >
                          <SentimentIcon className="h-3 w-3" />
                          <span className="text-xs capitalize">
                            {conversation.sentiment}
                          </span>
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-gray-500 shrink-0">
                      {formatDate(conversation.occurredAt)}
                    </span>
                  </div>

                  {conversation.subject && (
                    <div className="text-sm font-medium text-gray-900 mb-1">
                      {conversation.subject}
                    </div>
                  )}

                  <p className="text-sm text-gray-600 line-clamp-2">
                    {conversation.content}
                  </p>

                  {conversation.keyPoints && conversation.keyPoints.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {conversation.keyPoints.map((point, idx) => (
                        <Badge
                          key={idx}
                          variant="secondary"
                          className="text-xs py-0 h-5"
                        >
                          {point}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {conversation.actionItems && conversation.actionItems.length > 0 && (
                    <div className="mt-2">
                      <div className="text-xs font-medium text-gray-700 mb-1">
                        Action Items:
                      </div>
                      <ul className="text-xs text-gray-600 space-y-0.5 list-disc list-inside">
                        {conversation.actionItems.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
