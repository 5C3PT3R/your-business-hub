import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, leadName, leadId } = await req.json();

    if (!to) {
      throw new Error('Destination phone number is required');
    }

    const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
    const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
    const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER');

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      throw new Error('Twilio credentials not configured');
    }

    console.log('Initiating Twilio call from', TWILIO_PHONE_NUMBER, 'to', to);

    // Format phone number (remove non-digits, ensure + prefix for international)
    let formattedTo = to.replace(/\D/g, '');
    if (!formattedTo.startsWith('+')) {
      formattedTo = '+' + formattedTo;
    }

    // Create TwiML URL that connects both parties
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    
    // Use Twilio's built-in Dial verb via a TwiML Bin or generate inline
    // For now, use a TwiML response that dials the number
    const twimlContent = encodeURIComponent(`<?xml version="1.0" encoding="UTF-8"?><Response><Dial record="record-from-ringing-dual" recordingStatusCallback="${supabaseUrl}/functions/v1/twilio-webhook">${formattedTo}</Dial></Response>`);
    const twimlUrl = `http://twimlets.com/echo?Twiml=${twimlContent}`;

    // Create the call using Twilio REST API
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
        },
        body: new URLSearchParams({
          To: TWILIO_PHONE_NUMBER, // Call your own Twilio number first
          From: TWILIO_PHONE_NUMBER,
          Url: twimlUrl, // This will then dial the lead
          StatusCallback: `${supabaseUrl}/functions/v1/twilio-webhook`,
          StatusCallbackEvent: 'initiated ringing answered completed',
        }).toString(),
      }
    );

    const responseText = await response.text();
    console.log('Twilio API response:', response.status, responseText);

    if (!response.ok) {
      throw new Error(`Twilio API error: ${responseText}`);
    }

    const callData = JSON.parse(responseText);

    return new Response(
      JSON.stringify({ 
        success: true,
        callId: callData.sid,
        status: callData.status,
        message: `Calling ${leadName || to}...`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Call error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
