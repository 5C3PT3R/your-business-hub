/**
 * Gmail Sync Function
 * Fetches recent Gmail messages and stores them in the conversations table
 * Can be called manually or on a schedule
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getValidGmailToken, fetchGmailMessage, extractEmailBody, getHeader } from '../_shared/gmail-utils.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    console.log('Syncing Gmail for user:', user.id);

    // Get Gmail access token
    let accessToken;
    try {
      accessToken = await getValidGmailToken(supabase, user.id);
    } catch (error) {
      console.error('Failed to get Gmail token:', error);

      // Check if it's a decryption error
      if (error.message?.includes('decrypt')) {
        return new Response(
          JSON.stringify({
            error: 'Gmail token encryption error. Please disconnect and reconnect Gmail in Settings to fix this.',
            details: error.message
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          }
        );
      }

      throw error;
    }

    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: 'Gmail not connected' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        }
      );
    }

    // Fetch recent messages from Gmail
    const response = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?labelIds=INBOX&maxResults=50',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch Gmail messages');
    }

    const data = await response.json();
    const messageIds = data.messages || [];

    console.log(`Found ${messageIds.length} messages to sync`);

    let syncedCount = 0;
    let skippedCount = 0;

    // Process each message
    for (const { id: messageId } of messageIds) {
      try {
        // Check if already synced
        const { data: existing } = await supabase
          .from('conversations')
          .select('id')
          .eq('external_id', messageId)
          .eq('channel', 'email')
          .single();

        if (existing) {
          skippedCount++;
          continue;
        }

        // Fetch full message details
        const message = await fetchGmailMessage(accessToken, messageId);

        // Extract message details
        const from = getHeader(message, 'From');
        const to = getHeader(message, 'To');
        const subject = getHeader(message, 'Subject');
        const date = getHeader(message, 'Date');
        const threadId = message.threadId;
        const { text: bodyText, html: bodyHtml } = extractEmailBody(message);

        if (!from) {
          console.log('Skipping message without sender:', messageId);
          skippedCount++;
          continue;
        }

        // Extract email and name from "Name <email@example.com>" format
        const emailMatch = from.match(/<([^>]+)>/);
        const senderEmail = emailMatch ? emailMatch[1] : from;
        const senderName = emailMatch ? from.replace(/<[^>]+>/, '').trim() : from;

        // Parse recipients
        const toEmails = to ? to.split(',').map((e: string) => {
          const match = e.match(/<([^>]+)>/);
          return match ? match[1] : e.trim();
        }) : [];

        // Determine direction (inbound if sender is not the user)
        const { data: userToken } = await supabase
          .from('oauth_tokens')
          .select('email_address')
          .eq('user_id', user.id)
          .eq('channel', 'gmail')
          .single();

        const userEmail = userToken?.email_address;
        const isInbound = userEmail ? senderEmail.toLowerCase() !== userEmail.toLowerCase() : true;

        // Insert into conversations table
        const { error: insertError } = await supabase
          .from('conversations')
          .insert({
            user_id: user.id,
            channel: 'email',
            direction: isInbound ? 'inbound' : 'outbound',
            subject,
            body: bodyText || '',
            plain_text: bodyText || '',
            html_body: bodyHtml,
            from_email: senderEmail,
            from_name: senderName,
            to_emails: toEmails,
            external_id: messageId,
            external_thread_id: threadId,
            is_read: message.labelIds?.includes('UNREAD') ? false : true,
            is_starred: message.labelIds?.includes('STARRED') ? true : false,
            is_urgent: false,
            sent_at: date ? new Date(date).toISOString() : new Date().toISOString(),
            metadata: {
              labels: message.labelIds || [],
              snippet: message.snippet,
            },
            raw_data: message,
          });

        if (insertError) {
          console.error('Failed to insert message:', messageId, insertError);
          skippedCount++;
        } else {
          syncedCount++;
        }
      } catch (error) {
        console.error('Error processing message:', messageId, error);
        skippedCount++;
      }
    }

    // Update last synced timestamp
    await supabase
      .from('oauth_tokens')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('channel', 'gmail');

    return new Response(
      JSON.stringify({
        success: true,
        synced: syncedCount,
        skipped: skippedCount,
        total: messageIds.length,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      }
    );
  } catch (error) {
    console.error('Gmail sync error:', error);

    return new Response(
      JSON.stringify({ error: error.message || 'Failed to sync Gmail' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      }
    );
  }
});
