import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { to, leadName, leadId } = await req.json();

    if (!to) {
      throw new Error('Destination phone number is required');
    }

    const VONAGE_API_KEY = Deno.env.get('VONAGE_API_KEY');
    const VONAGE_API_SECRET = Deno.env.get('VONAGE_API_SECRET');
    const VONAGE_PHONE_NUMBER = Deno.env.get('VONAGE_PHONE_NUMBER');

    if (!VONAGE_API_KEY || !VONAGE_API_SECRET || !VONAGE_PHONE_NUMBER) {
      throw new Error('Vonage credentials not configured');
    }

    console.log('Initiating call from', VONAGE_PHONE_NUMBER, 'to', to);

    // Create the call using Vonage Voice API
    const response = await fetch('https://api.nexmo.com/v1/calls', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + btoa(`${VONAGE_API_KEY}:${VONAGE_API_SECRET}`),
      },
      body: JSON.stringify({
        to: [{
          type: 'phone',
          number: to.replace(/\D/g, '') // Remove non-digits
        }],
        from: {
          type: 'phone',
          number: VONAGE_PHONE_NUMBER
        },
        answer_url: ['https://raw.githubusercontent.com/nexmo-community/ncco-examples/main/first_call_talk.json'],
        event_url: [`${Deno.env.get('SUPABASE_URL')}/functions/v1/vonage-webhook`],
        record: true,
        recording_format: 'mp3'
      }),
    });

    const responseText = await response.text();
    console.log('Vonage API response:', response.status, responseText);

    if (!response.ok) {
      throw new Error(`Vonage API error: ${responseText}`);
    }

    const callData = JSON.parse(responseText);

    return new Response(
      JSON.stringify({ 
        success: true,
        callId: callData.uuid,
        conversationId: callData.conversation_uuid,
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
