// Knight Send Message Edge Function
// Handles sending messages via various channels (Outlook, Twilio/WhatsApp, etc.)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://hireregent.com',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Environment variables
const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
const TWILIO_WHATSAPP_NUMBER = Deno.env.get('TWILIO_WHATSAPP_NUMBER');
const MICROSOFT_TENANT_ID = Deno.env.get('MICROSOFT_TENANT_ID');
const MICROSOFT_CLIENT_ID = Deno.env.get('MICROSOFT_CLIENT_ID');
const MICROSOFT_CLIENT_SECRET = Deno.env.get('MICROSOFT_CLIENT_SECRET');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { channel, recipient, message, metadata } = await req.json();

    switch (channel) {
      case 'whatsapp':
        return await sendWhatsApp(recipient, message);

      case 'outlook':
        return await sendOutlook(recipient, message, metadata?.subject);

      case 'twitter':
      case 'linkedin':
      case 'instagram':
      case 'facebook':
        // Social channels typically require webhooks or specific APIs
        // For now, log and return success (actual integration would go here)
        console.log(`[Knight] Would send ${channel} message to ${recipient}: ${message}`);
        return new Response(
          JSON.stringify({ success: true, note: 'Social channel - logged only' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      default:
        throw new Error(`Unsupported channel: ${channel}`);
    }
  } catch (error) {
    console.error('Knight send message error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function sendWhatsApp(to: string, message: string): Promise<Response> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    throw new Error('Twilio credentials not configured');
  }

  // Format phone number for WhatsApp
  const formattedTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
  const formattedFrom = `whatsapp:${TWILIO_WHATSAPP_NUMBER}`;

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
      },
      body: new URLSearchParams({
        To: formattedTo,
        From: formattedFrom,
        Body: message,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    return new Response(
      JSON.stringify({ error: data.message || 'Failed to send WhatsApp message' }),
      {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  return new Response(
    JSON.stringify({ success: true, message_sid: data.sid }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function sendOutlook(to: string, message: string, subject?: string): Promise<Response> {
  if (!MICROSOFT_TENANT_ID || !MICROSOFT_CLIENT_ID || !MICROSOFT_CLIENT_SECRET) {
    throw new Error('Microsoft Graph credentials not configured');
  }

  // Get access token
  const tokenResponse = await fetch(
    `https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: MICROSOFT_CLIENT_ID,
        client_secret: MICROSOFT_CLIENT_SECRET,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials',
      }),
    }
  );

  const tokenData = await tokenResponse.json();

  if (!tokenResponse.ok) {
    throw new Error('Failed to get Microsoft Graph access token');
  }

  // Send email via Graph API
  const emailResponse = await fetch('https://graph.microsoft.com/v1.0/users/me/sendMail', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenData.access_token}`,
    },
    body: JSON.stringify({
      message: {
        subject: subject || 'Re: Your Support Request',
        body: {
          contentType: 'Text',
          content: message,
        },
        toRecipients: [
          {
            emailAddress: {
              address: to,
            },
          },
        ],
      },
    }),
  });

  if (!emailResponse.ok) {
    const errorData = await emailResponse.json();
    return new Response(
      JSON.stringify({ error: errorData.error?.message || 'Failed to send email' }),
      {
        status: emailResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  return new Response(
    JSON.stringify({ success: true }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
