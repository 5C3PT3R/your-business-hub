/**
 * Outlook Send Email Service
 * Uses Microsoft Graph API /me/sendMail endpoint
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { decryptToken, encryptToken } from '../_shared/encryption.ts';

const OUTLOOK_CLIENT_ID = Deno.env.get('OUTLOOK_CLIENT_ID');
const OUTLOOK_CLIENT_SECRET = Deno.env.get('OUTLOOK_CLIENT_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0';

interface SendEmailRequest {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  isHtml?: boolean;
  replyToMessageId?: string;
  importance?: 'low' | 'normal' | 'high';
  requestReadReceipt?: boolean;
  attachments?: Array<{
    name: string;
    contentType: string;
    contentBytes: string; // Base64 encoded
  }>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': 'https://hireregent.com',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(
      JSON.stringify({ error: 'Configuration error' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
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
      .select('encrypted_access_token, token_iv, encrypted_refresh_token, refresh_token_iv, expires_at')
      .eq('user_id', user.id)
      .eq('channel', 'outlook')
      .single();

    if (!tokenData) {
      return new Response(JSON.stringify({ error: 'Outlook not connected' }), { status: 400 });
    }

    // Decrypt access token
    let accessToken = await decryptToken(tokenData.encrypted_access_token, tokenData.token_iv);

    // Refresh if expired
    if (new Date(tokenData.expires_at) < new Date()) {
      const refreshToken = await decryptToken(tokenData.encrypted_refresh_token, tokenData.refresh_token_iv);
      const refreshed = await refreshAccessToken(refreshToken, supabase, user.id);
      if (!refreshed) {
        return new Response(JSON.stringify({ error: 'Token refresh failed' }), { status: 401 });
      }
      accessToken = refreshed;
    }

    // Parse request body
    const emailRequest: SendEmailRequest = await req.json();

    // Validate required fields
    if (!emailRequest.to?.length || !emailRequest.subject || !emailRequest.body) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to, subject, body' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Build Graph API message payload
    const messagePayload: any = {
      message: {
        subject: emailRequest.subject,
        body: {
          contentType: emailRequest.isHtml ? 'HTML' : 'Text',
          content: emailRequest.body,
        },
        toRecipients: emailRequest.to.map(email => ({
          emailAddress: { address: email },
        })),
        importance: emailRequest.importance || 'normal',
      },
      saveToSentItems: true,
    };

    // Add CC recipients
    if (emailRequest.cc?.length) {
      messagePayload.message.ccRecipients = emailRequest.cc.map(email => ({
        emailAddress: { address: email },
      }));
    }

    // Add BCC recipients
    if (emailRequest.bcc?.length) {
      messagePayload.message.bccRecipients = emailRequest.bcc.map(email => ({
        emailAddress: { address: email },
      }));
    }

    // Add attachments
    if (emailRequest.attachments?.length) {
      messagePayload.message.attachments = emailRequest.attachments.map(att => ({
        '@odata.type': '#microsoft.graph.fileAttachment',
        name: att.name,
        contentType: att.contentType,
        contentBytes: att.contentBytes,
      }));
    }

    // Add read receipt request
    if (emailRequest.requestReadReceipt) {
      messagePayload.message.isReadReceiptRequested = true;
    }

    // Send email via Graph API
    let endpoint = `${GRAPH_API_BASE}/me/sendMail`;

    // If replying, use reply endpoint
    if (emailRequest.replyToMessageId) {
      endpoint = `${GRAPH_API_BASE}/me/messages/${emailRequest.replyToMessageId}/reply`;
      // For replies, only include comment (body)
      const replyPayload = {
        comment: emailRequest.body,
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(replyPayload),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Graph API reply error:', error);
        throw new Error(error.error?.message || 'Failed to send reply');
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Reply sent successfully' }),
        { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://hireregent.com' } }
      );
    }

    // Send new email
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messagePayload),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Graph API send error:', error);
      throw new Error(error.error?.message || 'Failed to send email');
    }

    // Log sent email
    await supabase.from('email_messages').insert({
      user_id: user.id,
      provider: 'outlook',
      subject: emailRequest.subject,
      body_html: emailRequest.isHtml ? emailRequest.body : null,
      body_text: emailRequest.isHtml ? null : emailRequest.body,
      to_emails: emailRequest.to,
      cc_emails: emailRequest.cc || [],
      sent_at: new Date().toISOString(),
      is_sent: true,
      is_read: true,
    });

    return new Response(
      JSON.stringify({ success: true, message: 'Email sent successfully' }),
      { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://hireregent.com' } }
    );
  } catch (error) {
    console.error('Outlook send error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://hireregent.com' } }
    );
  }
});

/**
 * Refresh access token
 */
async function refreshAccessToken(
  refreshToken: string,
  supabase: any,
  userId: string
): Promise<string | null> {
  try {
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
      return null;
    }

    const tokens = await response.json();
    const { encryptedToken, iv } = await encryptToken(tokens.access_token);
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + tokens.expires_in);

    await supabase
      .from('oauth_tokens')
      .update({
        encrypted_access_token: encryptedToken,
        token_iv: iv,
        expires_at: expiresAt.toISOString(),
      })
      .eq('user_id', userId)
      .eq('channel', 'outlook');

    return tokens.access_token;
  } catch (e) {
    console.error('Token refresh error:', e);
    return null;
  }
}
