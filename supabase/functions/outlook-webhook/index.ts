/**
 * Outlook Webhook Handler
 * Receives Microsoft Graph Change Notifications for real-time email updates
 *
 * Webhook URL: POST /api/webhooks/outlook/notification
 * Validation URL: POST /api/webhooks/outlook/notification?validationToken=xxx
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { decryptToken } from '../_shared/encryption.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const OUTLOOK_WEBHOOK_SECRET = Deno.env.get('OUTLOOK_WEBHOOK_SECRET'); // Client state for validation

const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0';

interface ChangeNotification {
  changeType: 'created' | 'updated' | 'deleted';
  clientState: string;
  resource: string;
  resourceData: {
    '@odata.type': string;
    '@odata.id': string;
    '@odata.etag': string;
    id: string;
  };
  subscriptionId: string;
  subscriptionExpirationDateTime: string;
  tenantId: string;
}

interface WebhookPayload {
  value: ChangeNotification[];
}

serve(async (req) => {
  const url = new URL(req.url);

  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': 'https://hireregent.com',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'content-type',
      },
    });
  }

  // Handle validation request from Microsoft
  // When creating a subscription, Microsoft sends a validation request
  const validationToken = url.searchParams.get('validationToken');
  if (validationToken) {
    console.log('Validation request received');
    return new Response(validationToken, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: 'Configuration error' }), { status: 503 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const payload: WebhookPayload = await req.json();
    console.log('Webhook received:', JSON.stringify(payload, null, 2));

    // Process each notification
    for (const notification of payload.value) {
      // Validate client state (security check)
      if (OUTLOOK_WEBHOOK_SECRET && notification.clientState !== OUTLOOK_WEBHOOK_SECRET) {
        console.warn('Invalid client state, skipping notification');
        continue;
      }

      // Find user by subscription ID
      const { data: subscription } = await supabase
        .from('outlook_subscriptions')
        .select('user_id')
        .eq('subscription_id', notification.subscriptionId)
        .single();

      if (!subscription) {
        console.warn('Unknown subscription:', notification.subscriptionId);
        continue;
      }

      const userId = subscription.user_id;

      // Process based on change type
      switch (notification.changeType) {
        case 'created':
          await handleNewMessage(notification, userId, supabase);
          break;
        case 'updated':
          await handleUpdatedMessage(notification, userId, supabase);
          break;
        case 'deleted':
          await handleDeletedMessage(notification, userId, supabase);
          break;
      }
    }

    // Microsoft expects 202 Accepted for successful processing
    return new Response(null, { status: 202 });
  } catch (error) {
    console.error('Webhook processing error:', error);
    // Return 202 anyway to prevent Microsoft from retrying
    return new Response(null, { status: 202 });
  }
});

/**
 * Handle new message notification
 */
async function handleNewMessage(
  notification: ChangeNotification,
  userId: string,
  supabase: any
): Promise<void> {
  console.log('New message:', notification.resourceData.id);

  // Get user's access token
  const { data: tokenData } = await supabase
    .from('oauth_tokens')
    .select('encrypted_access_token, token_iv')
    .eq('user_id', userId)
    .eq('channel', 'outlook')
    .single();

  if (!tokenData) {
    console.error('No Outlook token for user:', userId);
    return;
  }

  const accessToken = await decryptToken(tokenData.encrypted_access_token, tokenData.token_iv);

  // Fetch full message details
  const messageId = notification.resourceData.id;
  const response = await fetch(
    `${GRAPH_API_BASE}/me/messages/${messageId}?$select=id,conversationId,subject,bodyPreview,from,receivedDateTime,isRead`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    console.error('Failed to fetch message:', await response.text());
    return;
  }

  const message = await response.json();

  // Create notification for user
  await supabase.from('notifications').insert({
    user_id: userId,
    type: 'email_received',
    source: 'integration',
    title: `New email from ${message.from.emailAddress.name || message.from.emailAddress.address}`,
    message: message.subject,
    ai_priority: 'medium',
    related_entity_type: 'email',
    related_entity_id: messageId,
    metadata: {
      provider: 'outlook',
      from: message.from.emailAddress.address,
      received_at: message.receivedDateTime,
    },
  });

  // Queue for full sync to properly store the message
  await supabase.from('sync_queue').insert({
    user_id: userId,
    provider: 'outlook',
    action: 'sync_message',
    resource_id: messageId,
    status: 'pending',
  });
}

/**
 * Handle updated message notification (e.g., read status change)
 */
async function handleUpdatedMessage(
  notification: ChangeNotification,
  userId: string,
  supabase: any
): Promise<void> {
  console.log('Updated message:', notification.resourceData.id);

  // Queue for sync to update local copy
  await supabase.from('sync_queue').insert({
    user_id: userId,
    provider: 'outlook',
    action: 'update_message',
    resource_id: notification.resourceData.id,
    status: 'pending',
  });
}

/**
 * Handle deleted message notification
 */
async function handleDeletedMessage(
  notification: ChangeNotification,
  userId: string,
  supabase: any
): Promise<void> {
  console.log('Deleted message:', notification.resourceData.id);

  // Mark as deleted in our database
  await supabase
    .from('email_messages')
    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
    .eq('provider_message_id', notification.resourceData.id)
    .eq('user_id', userId);
}

/**
 * Create webhook subscription for a user
 * Call this after OAuth connection
 */
export async function createSubscription(
  userId: string,
  accessToken: string,
  supabase: any
): Promise<string | null> {
  const webhookUrl = `${SUPABASE_URL}/functions/v1/outlook-webhook`;

  const subscriptionPayload = {
    changeType: 'created,updated,deleted',
    notificationUrl: webhookUrl,
    resource: '/me/mailFolders/Inbox/messages',
    expirationDateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days
    clientState: OUTLOOK_WEBHOOK_SECRET || crypto.randomUUID(),
  };

  const response = await fetch(`${GRAPH_API_BASE}/subscriptions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(subscriptionPayload),
  });

  if (!response.ok) {
    console.error('Failed to create subscription:', await response.text());
    return null;
  }

  const subscription = await response.json();

  // Store subscription for lookup
  await supabase.from('outlook_subscriptions').upsert({
    user_id: userId,
    subscription_id: subscription.id,
    expiration: subscription.expirationDateTime,
    resource: subscription.resource,
    created_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });

  return subscription.id;
}

/**
 * Renew subscription before expiration
 */
export async function renewSubscription(
  subscriptionId: string,
  accessToken: string
): Promise<boolean> {
  const newExpiration = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

  const response = await fetch(`${GRAPH_API_BASE}/subscriptions/${subscriptionId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ expirationDateTime: newExpiration }),
  });

  return response.ok;
}
