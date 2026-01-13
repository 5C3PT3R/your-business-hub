/**
 * Gmail Send Function
 * Sends emails via Gmail API and stores them in conversations table
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getValidGmailToken } from '../_shared/gmail-utils.ts';

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

    // Parse request body
    const { to, subject, body } = await req.json();

    if (!to || !subject || !body) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to, subject, body' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        }
      );
    }

    console.log('Sending email for user:', user.id);

    // Get Gmail access token
    let accessToken;
    try {
      accessToken = await getValidGmailToken(supabase, user.id);
    } catch (error) {
      console.error('Failed to get Gmail token:', error);
      return new Response(
        JSON.stringify({
          error: 'Gmail not connected. Please connect Gmail in Settings.',
          details: error.message
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        }
      );
    }

    // Get user's Gmail email address
    const { data: userToken } = await supabase
      .from('oauth_tokens')
      .select('email_address')
      .eq('user_id', user.id)
      .eq('channel', 'gmail')
      .single();

    const fromEmail = userToken?.email_address || 'me';

    // Create email in RFC 2822 format
    const emailLines = [
      `To: ${to}`,
      `From: ${fromEmail}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
      '',
      body
    ];
    const email = emailLines.join('\r\n');

    // Encode email in base64url format
    const encodedEmail = btoa(email)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Send via Gmail API
    const sendResponse = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          raw: encodedEmail,
        }),
      }
    );

    if (!sendResponse.ok) {
      const error = await sendResponse.text();
      console.error('Gmail API error:', error);
      throw new Error(`Failed to send email: ${error}`);
    }

    const sentMessage = await sendResponse.json();
    console.log('Email sent successfully:', sentMessage.id);

    // Store sent message in conversations table
    const { error: insertError } = await supabase
      .from('conversations')
      .insert({
        user_id: user.id,
        channel: 'email',
        direction: 'outbound',
        subject,
        body,
        plain_text: body,
        from_email: fromEmail,
        from_name: fromEmail,
        to_emails: [to],
        external_id: sentMessage.id,
        external_thread_id: sentMessage.threadId,
        is_read: true,
        is_starred: false,
        is_urgent: false,
        sent_at: new Date().toISOString(),
        metadata: {
          labelIds: sentMessage.labelIds || ['SENT'],
        },
        raw_data: sentMessage,
      });

    if (insertError) {
      console.error('Failed to save sent message to database:', insertError);
      // Don't fail the request - email was sent successfully
    }

    return new Response(
      JSON.stringify({
        success: true,
        messageId: sentMessage.id,
        threadId: sentMessage.threadId,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      }
    );
  } catch (error) {
    console.error('Gmail send error:', error);

    return new Response(
      JSON.stringify({ error: error.message || 'Failed to send email' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      }
    );
  }
});
