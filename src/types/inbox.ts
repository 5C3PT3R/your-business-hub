// Unified Message Types for Inbox

export type Platform =
  | 'gmail'
  | 'outlook'
  | 'linkedin'
  | 'whatsapp'
  | 'slack'
  | 'teams'
  | 'facebook'
  | 'instagram'
  | 'twitter'
  | 'reddit'
  | 'discord'
  | 'telegram'
  | 'stackoverflow'
  | 'hackernews'
  | 'quora'
  | 'facebook_lead_ads'
  | 'linkedin_lead_gen'
  | 'intercom'
  | 'zendesk'
  | 'twilio_sms';

export type PlatformCategory = 'email' | 'social' | 'messaging' | 'ads' | 'support' | 'sms';

export type MessageDirection = 'inbound' | 'outbound';
export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
export type Sentiment = 'positive' | 'neutral' | 'negative';

export interface Integration {
  id: string;
  userId: string;
  platform: Platform;
  name: string;
  icon: string;
  color: string;
  category: PlatformCategory;
  isConnected: boolean;
  isActive: boolean;
  unreadCount: number;
  lastSyncAt?: Date;
  credentials?: Record<string, any>;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Participant {
  id?: string;              // Contact ID if matched
  name?: string;
  email?: string;
  avatar?: string;
  platformHandle?: string;  // @username, phone, etc.
  company?: string;
}

export interface Attachment {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  url: string;
  thumbnailUrl?: string;
}

export interface UnifiedMessage {
  // Core Identity
  id: string;
  externalId: string;
  platform: Platform;

  // Thread & Conversation
  conversationId: string;
  threadId?: string;

  // Participants
  from: Participant;
  to: Participant[];
  cc?: Participant[];
  bcc?: Participant[];

  // Content
  subject?: string;
  body: string;
  bodyHtml?: string;
  preview: string;

  // Metadata
  direction: MessageDirection;
  status: MessageStatus;

  // Attachments
  attachments: Attachment[];

  // Platform-Specific
  platformMetadata: Record<string, any>;

  // Social Platform Specifics
  messageType?: 'text' | 'image' | 'video' | 'audio' | 'document' | 'sticker' | 'location' | 'contact' | 'template' | 'interactive' | 'reaction' | 'story_reply';
  templateId?: string; // WhatsApp HSM template ID if sent via template
  sourcePageName?: string; // "Via Acme Corp FB Page" for Meta messages
  replyToId?: string; // For threaded replies
  reactionEmoji?: string; // For reactions

  // WhatsApp Session Status
  sessionExpired?: boolean; // True if 24h window has closed
  requiresTemplate?: boolean; // True if must use template to message

  // Timestamps
  sentAt: Date;
  receivedAt: Date;
  readAt?: Date;
  deliveredAt?: Date;

  // AI Analysis
  sentiment?: Sentiment;
  intent?: string;
  topics?: string[];
  aiExtracted?: {
    budget?: number;
    timeline?: string;
    competitors?: string[];
    nextSteps?: string[];
  };

  // User Actions
  isRead: boolean;
  isStarred: boolean;
  isUrgent: boolean;
  labels?: string[];

  // Sync
  syncedAt: Date;
  lastUpdatedAt: Date;
}

export interface Conversation {
  id: string;
  userId: string;

  // Participants
  contact: Participant;
  participants: Participant[];

  // Channels
  channels: Platform[];

  // Latest Message
  latestMessage: UnifiedMessage;
  latestMessageAt: Date;

  // Counts
  messageCount: number;
  unreadCount: number;

  // Deal Association
  dealId?: string;
  dealName?: string;
  dealValue?: number;
  dealHealthScore?: number;

  // AI Insights
  overallSentiment?: Sentiment;
  topics?: string[];

  // User Actions
  isArchived: boolean;
  isStarred: boolean;
  assignedTo?: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface IntegrationAdapter {
  // Metadata
  platform: Platform;
  name: string;
  icon: string;
  color: string;
  category: PlatformCategory;

  // Authentication
  authType: 'oauth2' | 'api_key' | 'webhook';
  authenticate(): Promise<AuthResult>;

  // Core Functions
  fetchMessages(params: FetchParams): Promise<UnifiedMessage[]>;
  sendMessage(message: OutgoingMessage): Promise<SendResult>;
  markAsRead(messageId: string): Promise<void>;
  deleteMessage?(messageId: string): Promise<void>;

  // Sync
  getLastSyncTimestamp(): Promise<Date | null>;
  syncNewMessages(): Promise<SyncResult>;

  // Webhooks (if supported)
  setupWebhook?(): Promise<WebhookConfig>;
  handleWebhook?(payload: any): Promise<void>;
}

export interface AuthResult {
  success: boolean;
  authUrl?: string;
  requiresRedirect?: boolean;
  error?: string;
}

export interface FetchParams {
  limit?: number;
  offset?: number;
  pageToken?: string;
  before?: string;
  after?: string;
  query?: string;
}

export interface OutgoingMessage {
  to: Participant[];
  subject?: string;
  body: string;
  threadId?: string;
  attachments?: Attachment[];
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  threadId?: string;
  error?: string;
}

export interface SyncResult {
  newMessages: number;
  updatedMessages: number;
  syncedAt: Date;
  error?: string;
}

export interface WebhookConfig {
  type: 'webhook' | 'pubsub';
  endpoint: string;
  events?: string[];
}

export interface PlatformConfig {
  platform: Platform;
  name: string;
  icon: string;
  color: string;
  category: PlatformCategory;
  description: string;
  features: {
    canSend: boolean;
    canReceive: boolean;
    canMarkRead: boolean;
    canDelete: boolean;
    supportsAttachments: boolean;
    supportsThreads: boolean;
    supportsWebhooks: boolean;
  };
  authType: 'oauth2' | 'api_key' | 'webhook';
  docs: string;
}

// Social Integration Types
export type SocialPlatform = 'whatsapp' | 'messenger' | 'instagram' | 'linkedin';

export interface SocialConnection {
  id: string;
  userId: string;
  workspaceId: string;
  platform: SocialPlatform;
  platformAccountId: string;
  platformAccountName?: string;
  status: 'active' | 'disconnected' | 'expired' | 'error';
  lastError?: string;
  lastSyncAt?: Date;
  // WhatsApp specific
  phoneNumberId?: string;
  whatsappBusinessId?: string;
  // Meta specific
  pageId?: string;
  pageName?: string;
  instagramAccountId?: string;
  // LinkedIn specific
  linkedinUrn?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WhatsAppTemplate {
  id: string;
  workspaceId: string;
  connectionId: string;
  templateId: string;
  name: string;
  language: string;
  category: 'authentication' | 'marketing' | 'utility';
  headerType?: 'text' | 'image' | 'video' | 'document';
  headerText?: string;
  bodyText: string;
  footerText?: string;
  variables: Array<{ name: string; example: string }>;
  buttons: Array<{ type: string; text: string; url?: string; phoneNumber?: string }>;
  status: 'pending' | 'approved' | 'rejected' | 'paused' | 'disabled';
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SocialConversation {
  id: string;
  workspaceId: string;
  connectionId: string;
  contactId?: string;
  platform: SocialPlatform;
  platformConversationId: string;
  platformUserId?: string;
  platformUserName?: string;
  platformUserAvatar?: string;
  sessionExpiresAt?: Date;
  requiresTemplate: boolean;
  status: 'active' | 'archived' | 'blocked';
  messageCount: number;
  unreadCount: number;
  lastMessageAt?: Date;
  lastInboundAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SocialMessage {
  id: string;
  workspaceId: string;
  conversationId: string;
  platform: SocialPlatform;
  externalId: string;
  direction: 'inbound' | 'outbound';
  messageType: 'text' | 'image' | 'video' | 'audio' | 'document' | 'sticker' | 'location' | 'contact' | 'template' | 'interactive' | 'reaction' | 'story_reply';
  body?: string;
  caption?: string;
  mediaUrl?: string;
  mediaMimeType?: string;
  mediaFilename?: string;
  mediaSize?: number;
  templateId?: string;
  templateVariables?: Record<string, string>;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  statusUpdatedAt?: Date;
  errorCode?: string;
  errorMessage?: string;
  replyToId?: string;
  reactionEmoji?: string;
  sourcePageName?: string;
  sentAt: Date;
  deliveredAt?: Date;
  readAt?: Date;
  createdAt: Date;
}
