/**
 * Outlook Sync Service
 * Uses Delta Queries for efficient email synchronization
 *
 * Features:
 * - Delta sync (only new/changed emails)
 * - Thread mapping via internetMessageHeaders
 * - Maps to unified Message/Thread schema
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { decryptToken, encryptToken } from '../_shared/encryption.ts';

const OUTLOOK_CLIENT_ID = Deno.env.get('OUTLOOK_CLIENT_ID');
const OUTLOOK_CLIENT_SECRET = Deno.env.get('OUTLOOK_CLIENT_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0';

interface OutlookMessage {
  id: string;
  conversationId: string;
  subject: string;
  bodyPreview: string;
  body: { contentType: string; content: string };
  from: { emailAddress: { name: string; address: string } };
  toRecipients: Array<{ emailAddress: { name: string; address: string } }>;
  ccRecipients?: Array<{ emailAddress: { name: string; address: string } }>;
  receivedDateTime: string;
  sentDateTime: string;
  isRead: boolean;
  isDraft: boolean;
  hasAttachments: boolean;
  importance: string;
  internetMessageHeaders?: Array<{ name: string; value: string }>;
  internetMessageId?: string;
  parentFolderId: string;
}

serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': 'https://hireregent.com',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(
      JSON.stringify({ error: 'Configuration error' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Route: Sync emails
    if (url.pathname.includes('/sync') || url.pathname === '/') {
      return await handleSync(req, supabase);
    }

    // Route: Full sync (initial)
    if (url.pathname.includes('/full-sync')) {
      return await handleFullSync(req, supabase);
    }

    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
  } catch (error) {
    console.error('Outlook sync error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Delta sync - fetch only new/changed emails
 */
async function handleSync(req: Request, supabase: any): Promise<Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401 });
  }

  // Get Outlook tokens
  const { data: tokenData } = await supabase
    .from('oauth_tokens')
    .select('encrypted_access_token, token_iv, encrypted_refresh_token, refresh_token_iv, expires_at, delta_link')
    .eq('user_id', user.id)
    .eq('channel', 'outlook')
    .single();

  if (!tokenData) {
    return new Response(JSON.stringify({ error: 'Outlook not connected' }), { status: 400 });
  }

  // Decrypt access token
  let accessToken: string;
  try {
    accessToken = await decryptToken(tokenData.encrypted_access_token, tokenData.token_iv);
  } catch (e) {
    console.error('Failed to decrypt token:', e);
    return new Response(JSON.stringify({ error: 'Token decryption failed' }), { status: 500 });
  }

  // Check if token expired, refresh if needed
  if (new Date(tokenData.expires_at) < new Date()) {
    const refreshedToken = await refreshAccessToken(
      tokenData.encrypted_refresh_token,
      tokenData.refresh_token_iv,
      supabase,
      user.id
    );
    if (!refreshedToken) {
      return new Response(JSON.stringify({ error: 'Token refresh failed' }), { status: 401 });
    }
    accessToken = refreshedToken;
  }

  // Use delta link if available, otherwise start fresh
  let deltaUrl = tokenData.delta_link ||
    `${GRAPH_API_BASE}/me/mailFolders/Inbox/messages/delta?$select=id,conversationId,subject,bodyPreview,body,from,toRecipients,ccRecipients,receivedDateTime,sentDateTime,isRead,isDraft,hasAttachments,importance,internetMessageHeaders,internetMessageId,parentFolderId`;

  const syncedMessages: any[] = [];
  let nextDeltaLink: string | null = null;

  // Fetch all pages
  while (deltaUrl) {
    const response = await fetch(deltaUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Graph API error:', error);

      // If delta link is invalid, reset and do full sync
      if (error.error?.code === 'resyncRequired' || error.error?.code === 'syncStateNotFound') {
        await supabase
          .from('oauth_tokens')
          .update({ delta_link: null })
          .eq('user_id', user.id)
          .eq('channel', 'outlook');

        return new Response(
          JSON.stringify({ error: 'Resync required', needsFullSync: true }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      throw new Error(`Graph API error: ${error.error?.message}`);
    }

    const data = await response.json();

    // Process messages
    for (const message of data.value || []) {
      const mappedMessage = await mapOutlookMessage(message, user.id, supabase);
      if (mappedMessage) {
        syncedMessages.push(mappedMessage);
      }
    }

    // Get next page or delta link
    deltaUrl = data['@odata.nextLink'] || null;
    nextDeltaLink = data['@odata.deltaLink'] || nextDeltaLink;
  }

  // Store new delta link
  if (nextDeltaLink) {
    await supabase
      .from('oauth_tokens')
      .update({
        delta_link: nextDeltaLink,
        last_synced_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .eq('channel', 'outlook');
  }

  return new Response(
    JSON.stringify({
      success: true,
      syncedCount: syncedMessages.length,
      messages: syncedMessages,
    }),
    { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://hireregent.com' } }
  );
}

/**
 * Full sync - initial sync of all emails
 */
async function handleFullSync(req: Request, supabase: any): Promise<Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user } } = await supabase.auth.getUser(token);

  if (!user) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401 });
  }

  // Clear delta link to force fresh sync
  await supabase
    .from('oauth_tokens')
    .update({ delta_link: null })
    .eq('user_id', user.id)
    .eq('channel', 'outlook');

  // Delegate to regular sync
  return handleSync(req, supabase);
}

/**
 * Map Outlook message to unified schema
 */
async function mapOutlookMessage(
  outlookMsg: OutlookMessage,
  userId: string,
  supabase: any
): Promise<any> {
  // Extract Message-ID from headers for thread mapping
  const messageIdHeader = outlookMsg.internetMessageHeaders?.find(
    h => h.name.toLowerCase() === 'message-id'
  );
  const inReplyToHeader = outlookMsg.internetMessageHeaders?.find(
    h => h.name.toLowerCase() === 'in-reply-to'
  );
  const referencesHeader = outlookMsg.internetMessageHeaders?.find(
    h => h.name.toLowerCase() === 'references'
  );

  // Find or create thread
  let threadId: string | null = null;

  // First, check if we have a thread for this conversation
  const { data: existingThread } = await supabase
    .from('email_threads')
    .select('id')
    .eq('provider_thread_id', outlookMsg.conversationId)
    .eq('user_id', userId)
    .single();

  if (existingThread) {
    threadId = existingThread.id;
  } else {
    // Try to find parent message via In-Reply-To header
    if (inReplyToHeader?.value) {
      const { data: parentMessage } = await supabase
        .from('email_messages')
        .select('thread_id')
        .eq('internet_message_id', inReplyToHeader.value)
        .eq('user_id', userId)
        .single();

      if (parentMessage?.thread_id) {
        threadId = parentMessage.thread_id;
      }
    }

    // Create new thread if not found
    if (!threadId) {
      const { data: newThread, error } = await supabase
        .from('email_threads')
        .insert({
          user_id: userId,
          provider: 'outlook',
          provider_thread_id: outlookMsg.conversationId,
          subject: outlookMsg.subject,
          last_message_at: outlookMsg.receivedDateTime,
          message_count: 1,
          is_read: outlookMsg.isRead,
        })
        .select('id')
        .single();

      if (error) {
        console.error('Failed to create thread:', error);
        return null;
      }
      threadId = newThread.id;
    }
  }

  // Check if message already exists
  const { data: existingMessage } = await supabase
    .from('email_messages')
    .select('id')
    .eq('provider_message_id', outlookMsg.id)
    .eq('user_id', userId)
    .single();

  if (existingMessage) {
    // Update existing message
    await supabase
      .from('email_messages')
      .update({
        is_read: outlookMsg.isRead,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingMessage.id);

    return { id: existingMessage.id, action: 'updated' };
  }

  // Insert new message
  const { data: newMessage, error: msgError } = await supabase
    .from('email_messages')
    .insert({
      user_id: userId,
      thread_id: threadId,
      provider: 'outlook',
      provider_message_id: outlookMsg.id,
      internet_message_id: messageIdHeader?.value || outlookMsg.internetMessageId,
      subject: outlookMsg.subject,
      snippet: outlookMsg.bodyPreview,
      body_html: outlookMsg.body.contentType === 'html' ? outlookMsg.body.content : null,
      body_text: outlookMsg.body.contentType === 'text' ? outlookMsg.body.content : null,
      from_email: outlookMsg.from.emailAddress.address,
      from_name: outlookMsg.from.emailAddress.name,
      to_emails: outlookMsg.toRecipients.map(r => r.emailAddress.address),
      cc_emails: outlookMsg.ccRecipients?.map(r => r.emailAddress.address) || [],
      received_at: outlookMsg.receivedDateTime,
      sent_at: outlookMsg.sentDateTime,
      is_read: outlookMsg.isRead,
      is_draft: outlookMsg.isDraft,
      has_attachments: outlookMsg.hasAttachments,
      importance: outlookMsg.importance,
      folder_id: outlookMsg.parentFolderId,
    })
    .select('id')
    .single();

  if (msgError) {
    console.error('Failed to insert message:', msgError);
    return null;
  }

  // Update thread
  await supabase
    .from('email_threads')
    .update({
      last_message_at: outlookMsg.receivedDateTime,
      message_count: supabase.sql`message_count + 1`,
      is_read: outlookMsg.isRead,
    })
    .eq('id', threadId);

  // Auto-link to contact if email matches
  await linkMessageToContact(newMessage.id, outlookMsg.from.emailAddress.address, userId, supabase);

  return { id: newMessage.id, threadId, action: 'created' };
}

/**
 * Refresh access token using refresh token
 */
async function refreshAccessToken(
  encryptedRefresh: string,
  refreshIv: string,
  supabase: any,
  userId: string
): Promise<string | null> {
  try {
    const refreshToken = await decryptToken(encryptedRefresh, refreshIv);

    const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: OUTLOOK_CLIENT_ID!,
        client_secret: OUTLOOK_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      console.error('Token refresh failed:', await response.text());
      return null;
    }

    const tokens = await response.json();

    // Encrypt and store new tokens
    const { encryptedToken: encryptedAccess, iv: accessIv } = await encryptToken(tokens.access_token);
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + tokens.expires_in);

    await supabase
      .from('oauth_tokens')
      .update({
        encrypted_access_token: encryptedAccess,
        token_iv: accessIv,
        expires_at: expiresAt.toISOString(),
      })
      .eq('user_id', userId)
      .eq('channel', 'outlook');

    return tokens.access_token;
  } catch (e) {
    console.error('Refresh token error:', e);
    return null;
  }
}

/**
 * Link email message to existing contact
 */
async function linkMessageToContact(
  messageId: string,
  fromEmail: string,
  userId: string,
  supabase: any
): Promise<void> {
  const { data: contact } = await supabase
    .from('contacts')
    .select('id')
    .eq('email', fromEmail)
    .eq('user_id', userId)
    .single();

  if (contact) {
    await supabase
      .from('email_messages')
      .update({ contact_id: contact.id })
      .eq('id', messageId);
  }
}
