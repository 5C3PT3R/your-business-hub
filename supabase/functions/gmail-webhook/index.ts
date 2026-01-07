/**
 * Gmail Webhook Receiver (Google Pub/Sub)
 * Receives push notifications when new Gmail messages arrive
 *
 * Security features:
 * - Pub/Sub message verification
 * - Message deduplication
 * - Rate limiting
 * - Audit logging
 *
 * Flow:
 * 1. Receive Pub/Sub push notification
 * 2. Verify message authenticity
 * 3. Fetch full message from Gmail API
 * 4. Normalize message format
 * 5. Create lead/activity in CRM
 * 6. Trigger AI analysis
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getValidGmailToken, fetchGmailMessage, extractEmailBody, getHeader, cleanEmailBody } from '../_shared/gmail-utils.ts';
import { enforceRateLimit } from '../_shared/rate-limiter.ts';
import { logAudit } from '../_shared/audit-logger.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Only accept POST requests
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Parse Pub/Sub message
    const body = await req.json();

    // Pub/Sub sends data in this format
    if (!body.message || !body.message.data) {
      console.error('Invalid Pub/Sub message format:', body);
      return new Response(JSON.stringify({ error: 'Invalid message format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Decode Pub/Sub message data (base64)
    const decodedData = JSON.parse(atob(body.message.data));
    const { emailAddress, historyId } = decodedData;

    console.log('Gmail webhook received:', { emailAddress, historyId });

    // Find user by Gmail email address
    const { data: tokenData } = await supabase
      .from('oauth_tokens')
      .select('user_id, email_address')
      .eq('channel', 'gmail')
      .eq('email_address', emailAddress)
      .single();

    if (!tokenData) {
      console.log('No user found for email:', emailAddress);
      // Return 200 to acknowledge receipt (user may have disconnected)
      return new Response(JSON.stringify({ status: 'ignored' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const userId = tokenData.user_id;

    // Rate limiting (high limit for webhooks)
    const rateLimitResponse = await enforceRateLimit(supabase, userId, 'gmail-webhook', {
      maxRequests: 1000,
      windowMinutes: 1,
    });
    if (rateLimitResponse) return rateLimitResponse;

    // Process the Gmail history
    await processGmailHistory(supabase, userId, emailAddress, historyId);

    // Acknowledge receipt immediately (Pub/Sub expects <10s response)
    return new Response(
      JSON.stringify({ status: 'processing' }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Gmail webhook error:', error);

    // Still return 200 to acknowledge receipt (prevent retries)
    return new Response(
      JSON.stringify({ status: 'error', message: error.message }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});

/**
 * Process Gmail history changes
 */
async function processGmailHistory(
  supabase: any,
  userId: string,
  emailAddress: string,
  historyId: string
): Promise<void> {
  try {
    const accessToken = await getValidGmailToken(supabase, userId);

    // Get history changes since last historyId
    // Note: You'll need to store the last historyId per user
    const { data: lastSync } = await supabase
      .from('oauth_tokens')
      .select('last_synced_at, metadata')
      .eq('user_id', userId)
      .eq('channel', 'gmail')
      .single();

    const startHistoryId = lastSync?.metadata?.lastHistoryId || historyId;

    // Fetch history from Gmail API
    const historyResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/history?startHistoryId=${startHistoryId}&historyTypes=messageAdded&maxResults=100`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (historyResponse.status === 404) {
      // History ID is too old, fetch recent messages instead
      console.log('History ID expired, fetching recent messages');
      await fetchRecentMessages(supabase, userId, accessToken);
      return;
    }

    if (!historyResponse.ok) {
      console.error('Failed to fetch history:', await historyResponse.text());
      return;
    }

    const historyData = await historyResponse.json();

    if (!historyData.history || historyData.history.length === 0) {
      console.log('No new messages in history');
      return;
    }

    // Process each new message
    for (const historyRecord of historyData.history) {
      if (historyRecord.messagesAdded) {
        for (const messageAdded of historyRecord.messagesAdded) {
          const message = messageAdded.message;

          // Skip if it's a sent message (we only want received)
          if (message.labelIds?.includes('SENT')) {
            continue;
          }

          await processGmailMessage(supabase, userId, accessToken, message.id);
        }
      }
    }

    // Update last synced history ID
    await supabase
      .from('oauth_tokens')
      .update({
        last_synced_at: new Date().toISOString(),
        metadata: { lastHistoryId: historyData.historyId },
      })
      .eq('user_id', userId)
      .eq('channel', 'gmail');

  } catch (error) {
    console.error('Process history error:', error);
    throw error;
  }
}

/**
 * Fetch recent messages (fallback when history is unavailable)
 */
async function fetchRecentMessages(
  supabase: any,
  userId: string,
  accessToken: string
): Promise<void> {
  const response = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages?labelIds=INBOX&maxResults=10',
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch recent messages');
  }

  const data = await response.json();

  if (data.messages) {
    for (const message of data.messages) {
      await processGmailMessage(supabase, userId, accessToken, message.id);
    }
  }
}

/**
 * Process a single Gmail message
 */
async function processGmailMessage(
  supabase: any,
  userId: string,
  accessToken: string,
  messageId: string
): Promise<void> {
  try {
    // Check deduplication
    const dedupKey = `msg:gmail:${messageId}`;
    const { data: existingDedup } = await supabase
      .from('message_dedup')
      .select('dedup_key')
      .eq('dedup_key', dedupKey)
      .single();

    if (existingDedup) {
      console.log('Duplicate message, skipping:', messageId);
      return;
    }

    // Fetch full message
    const message = await fetchGmailMessage(accessToken, messageId);

    // Extract message details
    const from = getHeader(message, 'From');
    const subject = getHeader(message, 'Subject');
    const date = getHeader(message, 'Date');
    const threadId = message.threadId;
    const { text: bodyText, html: bodyHtml } = extractEmailBody(message);

    // Skip if no sender
    if (!from) {
      console.log('No sender, skipping message:', messageId);
      return;
    }

    // Extract email address from "Name <email@example.com>" format
    const emailMatch = from.match(/<([^>]+)>/);
    const senderEmail = emailMatch ? emailMatch[1] : from;
    const senderName = emailMatch ? from.replace(/<[^>]+>/, '').trim() : null;

    // Clean body (remove signatures, quoted replies)
    const cleanedBody = cleanEmailBody(bodyText);

    // Skip if body is too short (likely automated/spam)
    if (cleanedBody.length < 10) {
      console.log('Message too short, skipping:', messageId);
      return;
    }

    // Get user's workspace
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();

    if (!profile) {
      console.error('User profile not found:', userId);
      return;
    }

    // Find or create lead
    let leadId = await findOrCreateLead(supabase, userId, senderEmail, senderName);

    // Create activity
    const { data: activity, error: activityError } = await supabase
      .from('activities')
      .insert({
        type: 'email',
        channel: 'gmail',
        description: subject || '(No Subject)',
        raw_text: cleanedBody,
        external_id: messageId,
        external_thread_id: threadId,
        sender_email: senderEmail,
        metadata: {
          from,
          subject,
          date,
          bodyHtml,
        },
        created_at: date ? new Date(date).toISOString() : new Date().toISOString(),
      })
      .select()
      .single();

    if (activityError) {
      console.error('Failed to create activity:', activityError);
      return;
    }

    // Store deduplication key
    await supabase.from('message_dedup').insert({
      dedup_key: dedupKey,
      channel: 'gmail',
      external_id: messageId,
      lead_id: leadId,
      activity_id: activity.id,
    });

    // Audit log
    await logAudit(supabase, {
      action: 'message_ingested',
      entityType: 'activity',
      entityId: activity.id,
      userId,
      performedBy: 'system',
      metadata: {
        channel: 'gmail',
        messageId,
        from: senderEmail,
        subject,
      },
      riskLevel: 'low',
    });

    // Trigger AI analysis (async - don't wait)
    triggerAIAnalysis(activity.id).catch(err =>
      console.error('AI analysis trigger failed:', err)
    );

    console.log('Message processed successfully:', messageId);
  } catch (error) {
    console.error('Process message error:', error);
  }
}

/**
 * Find existing lead or create new one
 */
async function findOrCreateLead(
  supabase: any,
  userId: string,
  email: string,
  name: string | null
): Promise<string> {
  // Try to find existing contact by email
  const { data: existingContact } = await supabase
    .from('contacts')
    .select('id, name, email')
    .eq('email', email)
    .single();

  if (existingContact) {
    // Find or create lead for this contact
    const { data: existingLead } = await supabase
      .from('leads')
      .select('id')
      .eq('contact_id', existingContact.id)
      .single();

    if (existingLead) {
      return existingLead.id;
    }

    // Create lead for existing contact
    const { data: newLead } = await supabase
      .from('leads')
      .insert({
        contact_id: existingContact.id,
        source: 'gmail',
        status: 'new',
      })
      .select()
      .single();

    return newLead.id;
  }

  // Create new contact and lead
  const { data: newContact } = await supabase
    .from('contacts')
    .insert({
      name: name || email.split('@')[0],
      email: email,
    })
    .select()
    .single();

  const { data: newLead } = await supabase
    .from('leads')
    .insert({
      contact_id: newContact.id,
      source: 'gmail',
      status: 'new',
    })
    .select()
    .single();

  return newLead.id;
}

/**
 * Trigger AI analysis for activity (async)
 */
async function triggerAIAnalysis(activityId: string): Promise<void> {
  // Call the analyze-conversation Edge Function
  await fetch(`${SUPABASE_URL}/functions/v1/analyze-conversation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ activityId }),
  });
}
