/**
 * Gmail Send Function
 * Sends emails via Gmail API and stores them in conversations table
 *
 * Security: Input validation with Zod, rate limiting, proper error handling
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { getValidGmailToken } from '../_shared/gmail-utils.ts';
import { enforceRateLimit } from '../_shared/rate-limiter.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Input validation schema
const SendEmailSchema = z.object({
  to: z.string().email('Invalid recipient email address'),
  subject: z.string()
    .min(1, 'Subject is required')
    .max(200, 'Subject must be less than 200 characters'),
  body: z.string()
    .min(1, 'Email body is required')
    .max(50000, 'Email body must be less than 50,000 characters'),
  cc: z.array(z.string().email()).optional(),
  bcc: z.array(z.string().email()).optional(),
  replyTo: z.string().email().optional(),
});

// CORS headers constant
const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // SECURITY: Enforce rate limiting - do NOT skip on errors
    const rateLimitResponse = await enforceRateLimit(supabase, user.id, 'gmail-send');
    if (rateLimitResponse) return rateLimitResponse;

    // Parse and validate request body with Zod
    let requestBody;
    try {
      requestBody = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const validationResult = SendEmailSchema.safeParse(requestBody);
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({
          error: 'Validation failed',
          details: validationResult.error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const { to, subject, body, cc, bcc, replyTo } = validationResult.data;

    // Get Gmail access token
    let accessToken;
    try {
      accessToken = await getValidGmailToken(supabase, user.id);
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: 'Gmail not connected',
          message: 'Please connect your Gmail account in Settings.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
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

    // Create email in RFC 2822 format with proper encoding
    const emailHeaders = [
      `To: ${to}`,
      `From: ${fromEmail}`,
      `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
      'Content-Transfer-Encoding: base64',
    ];

    if (cc && cc.length > 0) {
      emailHeaders.push(`Cc: ${cc.join(', ')}`);
    }
    if (bcc && bcc.length > 0) {
      emailHeaders.push(`Bcc: ${bcc.join(', ')}`);
    }
    if (replyTo) {
      emailHeaders.push(`Reply-To: ${replyTo}`);
    }

    // Encode body as base64 for proper UTF-8 handling
    const encodedBody = btoa(unescape(encodeURIComponent(body)));
    const email = emailHeaders.join('\r\n') + '\r\n\r\n' + encodedBody;

    // Encode entire email in base64url format for Gmail API
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
        body: JSON.stringify({ raw: encodedEmail }),
      }
    );

    if (!sendResponse.ok) {
      const errorText = await sendResponse.text();
      console.error('Gmail API error:', sendResponse.status, errorText);

      // Handle specific Gmail API errors
      if (sendResponse.status === 401) {
        return new Response(
          JSON.stringify({ error: 'Gmail token expired. Please reconnect Gmail.' }),
          { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      throw new Error(`Gmail API error: ${sendResponse.status}`);
    }

    const sentMessage = await sendResponse.json();

    // Store sent message in conversations table (don't fail if this errors)
    try {
      await supabase
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
          to_emails: [to, ...(cc || [])],
          external_id: sentMessage.id,
          external_thread_id: sentMessage.threadId,
          is_read: true,
          is_starred: false,
          is_urgent: false,
          sent_at: new Date().toISOString(),
          metadata: {
            labelIds: sentMessage.labelIds || ['SENT'],
            cc: cc || [],
            bcc: bcc || [],
          },
          raw_data: sentMessage,
        });
    } catch (insertError) {
      // Log but don't fail - email was sent successfully
      console.error('Failed to save sent message:', insertError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        messageId: sentMessage.id,
        threadId: sentMessage.threadId,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error) {
    console.error('Gmail send error:', error);

    return new Response(
      JSON.stringify({ error: 'Failed to send email. Please try again.' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});
