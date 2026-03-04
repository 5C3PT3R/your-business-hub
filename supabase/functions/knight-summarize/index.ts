import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const DEEPSEEK_API_KEY = Deno.env.get('DEEPSEEK_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://hireregent.com',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { content } = await req.json();

    if (!content || typeof content !== 'string') {
      return new Response(JSON.stringify({ error: 'content is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!DEEPSEEK_API_KEY) {
      return new Response(JSON.stringify({ error: 'DEEPSEEK_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content:
              'You are a support conversation analyst. Read the following customer support conversation and provide a concise summary. Include: 1) What the customer wanted, 2) How it was handled, 3) Current status/outcome. Keep it brief and clear — 3-5 sentences max.',
          },
          {
            role: 'user',
            content,
          },
        ],
        max_tokens: 300,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[knight-summarize] DeepSeek API error:', errText);
      return new Response(JSON.stringify({ error: 'DeepSeek API error', detail: errText }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await res.json();
    const summary = data.choices?.[0]?.message?.content ?? '';

    return new Response(JSON.stringify({ summary }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[knight-summarize] Unexpected error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
