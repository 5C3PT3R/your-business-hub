/**
 * REGENT: Send Email Edge Function
 * Secure server-side email delivery via Gmail SMTP
 *
 * MVP Implementation: Uses global SMTP credentials for testing the
 * "Database -> Button -> Email" loop. For multi-tenant production,
 * migrate to OAuth-based gmail-send function in V2.
 *
 * Secrets Required (set via Supabase CLI or Dashboard):
 * - SMTP_USER: Your Gmail address
 * - SMTP_PASS: Your Gmail App Password (NOT your regular password)
 *
 * To set secrets:
 * npx supabase secrets set SMTP_USER=your-email@gmail.com
 * npx supabase secrets set SMTP_PASS=your-app-password
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

// CORS headers for frontend access
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://hireregent.com',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface EmailRequest {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Get SMTP credentials from Supabase secrets
    const SMTP_USER = Deno.env.get('SMTP_USER');
    const SMTP_PASS = Deno.env.get('SMTP_PASS');

    if (!SMTP_USER || !SMTP_PASS) {
      console.error('SMTP credentials not configured');
      return new Response(
        JSON.stringify({
          error: 'Email service not configured',
          details: 'SMTP credentials missing. Contact administrator.'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: EmailRequest = await req.json();
    const { to, subject, html, replyTo } = body;

    // Validate required fields
    if (!to || !subject || !html) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields',
          details: 'Required: to, subject, html'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return new Response(
        JSON.stringify({
          error: 'Invalid email address',
          details: `"${to}" is not a valid email address`
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[REGENT] Deploying email to: ${to}`);
    console.log(`[REGENT] Subject: ${subject}`);

    // Initialize SMTP client for Gmail
    const client = new SMTPClient({
      connection: {
        hostname: 'smtp.gmail.com',
        port: 465,
        tls: true,
        auth: {
          username: SMTP_USER,
          password: SMTP_PASS,
        },
      },
    });

    // Send the email
    await client.send({
      from: SMTP_USER,
      to: to,
      subject: subject,
      content: html,
      html: html,
      replyTo: replyTo || SMTP_USER,
    });

    // Close the connection
    await client.close();

    console.log(`[REGENT] Email deployed successfully to: ${to}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email deployed successfully',
        recipient: to,
        timestamp: new Date().toISOString()
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[REGENT] Email deployment failed:', error);

    // Determine error type for better messaging
    let errorMessage = 'Failed to send email';
    let errorDetails = error instanceof Error ? error.message : 'Unknown error';

    if (errorDetails.includes('authentication')) {
      errorMessage = 'SMTP authentication failed';
      errorDetails = 'Check SMTP_USER and SMTP_PASS credentials';
    } else if (errorDetails.includes('connection')) {
      errorMessage = 'SMTP connection failed';
      errorDetails = 'Unable to connect to Gmail SMTP server';
    }

    return new Response(
      JSON.stringify({
        error: errorMessage,
        details: errorDetails
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
