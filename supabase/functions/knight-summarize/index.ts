import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const ALLOWED_ORIGINS = ['https://hireregent.com', 'https://www.hireregent.com'];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const { content } = await req.json();
    if (!content) {
      return new Response(JSON.stringify({ error: 'content is required' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const prompt = `Summarize this customer support conversation in 2-3 sentences. Focus on: what the customer needed, how it was resolved, and any follow-up required.\n\n${content}`;

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    const deepseekKey = Deno.env.get('DEEPSEEK_API_KEY');

    let summary = '';

    if (openaiKey) {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
        body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], max_tokens: 200 }),
      });
      const data = await res.json();
      summary = data.choices?.[0]?.message?.content?.trim() ?? '';
    } else if (deepseekKey) {
      const res = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${deepseekKey}` },
        body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: prompt }], max_tokens: 200 }),
      });
      const data = await res.json();
      summary = data.choices?.[0]?.message?.content?.trim() ?? '';
    } else {
      return new Response(JSON.stringify({ error: 'No LLM API key configured (OPENAI_API_KEY or DEEPSEEK_API_KEY)' }), {
        status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ summary }), {
      status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (err) {
    console.error('[knight-summarize] Error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});
