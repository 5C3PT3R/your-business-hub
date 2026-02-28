// Knight Voice Call Edge Function
// Handles Vapi.ai voice call initiation and management

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const VAPI_API_KEY = Deno.env.get('VAPI_PRIVATE_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://hireregent.com',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action } = body;

    if (!VAPI_API_KEY) {
      throw new Error('VAPI_PRIVATE_KEY not configured');
    }

    switch (action) {
      case 'get_status':
        return await getCallStatus(body.call_id);

      case 'configure_assistant':
        return await configureAssistant(body.workspace_id, body.config);

      default:
        // Default action is to initiate a call
        return await initiateCall(body);
    }
  } catch (error) {
    console.error('Knight voice call error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function initiateCall(params: {
  phone_number: string;
  ticket_id: string;
  customer_name: string;
  issue_summary: string;
  assistant_id?: string;
}): Promise<Response> {
  const systemPrompt = `Role: You are a senior support rep for Regent. You are calling a customer who just left a complaint or is having issues.

Tone: Calm, apologetic, highly competent.

Instructions:
- Introduce yourself: "Hi, this is the Support Team at Regent. I saw your message and wanted to reach out personally."
- Listen to their complaint fully before responding
- Acknowledge their frustration: "I completely understand why that would be frustrating."
- Offer concrete solutions: a refund, immediate fix, or escalation to engineering
- Do not interrupt them while they are venting
- Stay calm even if they are angry
- End with a clear next step and timeline

Customer Name: ${params.customer_name}
Issue Summary: ${params.issue_summary}`;

  const response = await fetch('https://api.vapi.ai/call/phone', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${VAPI_API_KEY}`,
    },
    body: JSON.stringify({
      phoneNumberId: Deno.env.get('VAPI_PHONE_NUMBER_ID'),
      customer: {
        number: params.phone_number,
        name: params.customer_name,
      },
      assistant: params.assistant_id
        ? { id: params.assistant_id }
        : {
            model: {
              provider: 'anthropic',
              model: 'claude-3-5-sonnet-20241022',
              systemPrompt,
            },
            voice: {
              provider: 'openai',
              voiceId: 'nova',
            },
            firstMessage: `Hi ${params.customer_name}, this is the support team from Regent. I noticed you reached out about an issue, and I wanted to personally follow up. How can I help you today?`,
            endCallPhrases: ['goodbye', 'have a good day', 'thank you for calling'],
          },
      metadata: {
        ticket_id: params.ticket_id,
      },
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    return new Response(
      JSON.stringify({ error: data.message || 'Failed to initiate call' }),
      {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  return new Response(
    JSON.stringify({ call_id: data.id, status: data.status }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function getCallStatus(callId: string): Promise<Response> {
  const response = await fetch(`https://api.vapi.ai/call/${callId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${VAPI_API_KEY}`,
    },
  });

  const data = await response.json();

  return new Response(
    JSON.stringify({
      status: data.status,
      duration: data.duration,
      transcript: data.transcript,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function configureAssistant(
  workspaceId: string,
  config: {
    name: string;
    model: string;
    voice: string;
    system_prompt: string;
    first_message: string;
    end_call_phrases: string[];
  }
): Promise<Response> {
  const response = await fetch('https://api.vapi.ai/assistant', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${VAPI_API_KEY}`,
    },
    body: JSON.stringify({
      name: `${config.name} - ${workspaceId}`,
      model: {
        provider: 'anthropic',
        model: config.model,
        systemPrompt: config.system_prompt,
      },
      voice: {
        provider: 'openai',
        voiceId: config.voice,
      },
      firstMessage: config.first_message,
      endCallPhrases: config.end_call_phrases,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    return new Response(
      JSON.stringify({ error: data.message || 'Failed to create assistant' }),
      {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  return new Response(
    JSON.stringify({ assistant_id: data.id }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
