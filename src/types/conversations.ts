export type ConversationType = 'email' | 'call' | 'meeting' | 'message' | 'note';
export type ConversationSentiment = 'positive' | 'neutral' | 'negative';

export interface Conversation {
  id: string;
  userId: string;
  contactId?: string;
  dealId?: string;
  leadId?: string;
  type: ConversationType;
  subject?: string;
  content: string;
  sentiment?: ConversationSentiment;
  sentimentScore?: number;
  keyPoints?: string[];
  actionItems?: string[];
  mentions?: string[];
  metadata?: Record<string, any>;
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationCreateInput {
  contactId?: string;
  dealId?: string;
  leadId?: string;
  type: ConversationType;
  subject?: string;
  content: string;
  occurredAt?: string;
}
