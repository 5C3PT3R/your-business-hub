/**
 * Knight Channel Service
 * Handles multi-channel message routing for The Knight
 * Supports: Twitter, LinkedIn, Outlook, WhatsApp, Instagram, Facebook
 */

import { supabase } from '@/integrations/supabase/client';
import {
  createTicket,
  addMessage,
  findOpenTicket,
  getTicketDetail,
  updateTicketStatus,
  getKnightConfig,
  type Ticket,
} from './knight-ticket-service';
import { processMessage, formatConversationHistory } from './knight-ai-service';
import { initiateVoiceCall, shouldEscalateToVoice, extractPhoneNumber } from './knight-vapi-service';

// Types
export interface IncomingMessage {
  channel: Ticket['source_channel'];
  sourceHandle: string;
  content: string;
  metadata?: Record<string, any>;
  phoneNumber?: string;
  customerName?: string;
}

export interface ChannelResponse {
  success: boolean;
  ticketId?: string;
  response?: string;
  action?: 'replied' | 'escalated' | 'voice_call' | 'created';
  error?: string;
}

// Channel-specific payload parsers
export interface SocialWebhookPayload {
  platform: 'twitter' | 'linkedin' | 'instagram' | 'facebook';
  user_handle: string;
  content: string;
  post_url?: string;
  is_dm?: boolean;
  metadata?: Record<string, any>;
}

export interface OutlookWebhookPayload {
  from: string;
  subject: string;
  body: string;
  thread_id?: string;
  metadata?: Record<string, any>;
}

export interface WhatsAppWebhookPayload {
  from: string;
  body: string;
  phone_number: string;
  name?: string;
  metadata?: Record<string, any>;
}

/**
 * Process an incoming message from any channel
 */
export async function handleIncomingMessage(
  workspaceId: string,
  message: IncomingMessage
): Promise<ChannelResponse> {
  try {
    // Get Knight config
    const config = await getKnightConfig(workspaceId);

    if (!config?.is_active) {
      return { success: false, error: 'Knight is not active for this workspace' };
    }

    // Check if channel is enabled
    if (!config.channels_enabled[message.channel]) {
      return { success: false, error: `Channel ${message.channel} is not enabled` };
    }

    // Find or create ticket
    let ticket = await findOpenTicket(workspaceId, message.sourceHandle, message.channel);
    let isNewTicket = false;

    if (!ticket) {
      // Create new ticket
      ticket = await createTicket({
        workspaceId,
        sourceChannel: message.channel,
        sourceHandle: message.sourceHandle,
        content: message.content,
        metadata: message.metadata,
      });
      isNewTicket = true;
    } else {
      // Add message to existing ticket
      await addMessage(ticket.id, 'user', message.content, message.metadata);
    }

    if (!ticket) {
      return { success: false, error: 'Failed to create or find ticket' };
    }

    // If auto-reply is disabled, just create/update the ticket
    if (!config.auto_reply_enabled) {
      return {
        success: true,
        ticketId: ticket.id,
        action: isNewTicket ? 'created' : 'replied',
      };
    }

    // Get conversation history
    const ticketDetail = await getTicketDetail(ticket.id);
    const history = ticketDetail?.messages
      ? formatConversationHistory(ticketDetail.messages)
      : [];

    // Process message with AI
    const { response, sentiment, shouldEscalate } = await processMessage(
      workspaceId,
      ticket.id,
      message.content,
      message.channel,
      history
    );

    // Update ticket sentiment
    await (supabase as any)
      .from('tickets')
      .update({
        sentiment_score: sentiment.score,
        priority: sentiment.priority,
        updated_at: new Date().toISOString(),
      })
      .eq('id', ticket.id);

    // Check for voice escalation
    const messageCount = ticketDetail?.messages?.length || 0;
    const hasPhone = !!message.phoneNumber || !!extractPhoneNumber(message.sourceHandle);

    if (
      shouldEscalate &&
      config.voice_escalation_enabled &&
      hasPhone &&
      shouldEscalateToVoice(
        sentiment.score,
        messageCount,
        true,
        true,
        config.sentiment_threshold
      )
    ) {
      // Escalate to voice call
      const phoneNumber = message.phoneNumber || extractPhoneNumber(message.sourceHandle);

      if (phoneNumber) {
        const callResult = await initiateVoiceCall({
          phoneNumber,
          ticketId: ticket.id,
          customerName: message.customerName,
          issueSummary: ticket.summary || message.content.substring(0, 200),
          assistantId: config.vapi_assistant_id,
        });

        if (callResult.success) {
          await updateTicketStatus(ticket.id, 'escalated', 'Voice call initiated');
          return {
            success: true,
            ticketId: ticket.id,
            action: 'voice_call',
            response: response.message,
          };
        }
      }
    }

    // Handle regular escalation (no voice)
    if (shouldEscalate && response.suggestedAction === 'escalate') {
      await updateTicketStatus(ticket.id, 'escalated', 'AI suggested escalation');
      return {
        success: true,
        ticketId: ticket.id,
        action: 'escalated',
        response: response.message,
      };
    }

    // Send auto-reply
    await addMessage(ticket.id, 'knight', response.message);

    // Send response via channel
    const sendResult = await sendChannelResponse(
      message.channel,
      message.sourceHandle,
      response.message,
      message.metadata
    );

    if (!sendResult.success) {
      console.error('[Knight] Failed to send channel response:', sendResult.error);
    }

    return {
      success: true,
      ticketId: ticket.id,
      action: 'replied',
      response: response.message,
    };
  } catch (err) {
    console.error('[Knight] Handle message error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Parse social webhook payload
 */
export function parseSocialWebhook(payload: SocialWebhookPayload): IncomingMessage {
  return {
    channel: payload.platform as Ticket['source_channel'],
    sourceHandle: payload.user_handle,
    content: payload.content,
    metadata: {
      post_url: payload.post_url,
      is_dm: payload.is_dm,
      ...payload.metadata,
    },
  };
}

/**
 * Parse Outlook webhook payload
 */
export function parseOutlookWebhook(payload: OutlookWebhookPayload): IncomingMessage {
  return {
    channel: 'outlook',
    sourceHandle: payload.from,
    content: `Subject: ${payload.subject}\n\n${payload.body}`,
    metadata: {
      subject: payload.subject,
      thread_id: payload.thread_id,
      ...payload.metadata,
    },
  };
}

/**
 * Parse WhatsApp webhook payload (Twilio format)
 */
export function parseWhatsAppWebhook(payload: WhatsAppWebhookPayload): IncomingMessage {
  return {
    channel: 'whatsapp',
    sourceHandle: payload.from,
    content: payload.body,
    phoneNumber: payload.phone_number,
    customerName: payload.name,
    metadata: payload.metadata,
  };
}

/**
 * Send response via channel
 */
async function sendChannelResponse(
  channel: Ticket['source_channel'],
  recipient: string,
  message: string,
  metadata?: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('knight-send-message', {
      body: {
        channel,
        recipient,
        message,
        metadata,
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Handle social mention/complaint (The Watchtower)
 */
export async function handleSocialMention(
  workspaceId: string,
  payload: SocialWebhookPayload
): Promise<ChannelResponse> {
  const message = parseSocialWebhook(payload);
  return handleIncomingMessage(workspaceId, message);
}

/**
 * Handle email message (The Diplomat - Outlook)
 */
export async function handleEmailMessage(
  workspaceId: string,
  payload: OutlookWebhookPayload
): Promise<ChannelResponse> {
  const message = parseOutlookWebhook(payload);
  return handleIncomingMessage(workspaceId, message);
}

/**
 * Handle WhatsApp message (The Diplomat - WhatsApp)
 */
export async function handleWhatsAppMessage(
  workspaceId: string,
  payload: WhatsAppWebhookPayload
): Promise<ChannelResponse> {
  const message = parseWhatsAppWebhook(payload);
  return handleIncomingMessage(workspaceId, message);
}

/**
 * Get channel display info
 */
export function getChannelInfo(channel: Ticket['source_channel']): {
  name: string;
  icon: string;
  color: string;
} {
  const channels: Record<string, { name: string; icon: string; color: string }> = {
    twitter: { name: 'Twitter/X', icon: 'twitter', color: '#1DA1F2' },
    linkedin: { name: 'LinkedIn', icon: 'linkedin', color: '#0A66C2' },
    outlook: { name: 'Email', icon: 'mail', color: '#0078D4' },
    whatsapp: { name: 'WhatsApp', icon: 'message-circle', color: '#25D366' },
    instagram: { name: 'Instagram', icon: 'instagram', color: '#E4405F' },
    facebook: { name: 'Facebook', icon: 'facebook', color: '#1877F2' },
    voice: { name: 'Voice', icon: 'phone', color: '#6366F1' },
  };

  return channels[channel] || { name: channel, icon: 'message-square', color: '#6B7280' };
}
