// Knight AI Analysis Edge Function
// Handles sentiment analysis, response generation, and embeddings

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SentimentAnalysis {
  score: number;
  priority: 'low' | 'medium' | 'critical';
  intent: 'complaint' | 'question' | 'urgent' | 'feedback' | 'general';
  keywords: string[];
  requiresEscalation: boolean;
}

interface KnightResponse {
  message: string;
  tone: 'empathetic' | 'professional' | 'apologetic' | 'helpful';
  suggestedAction?: 'reply' | 'escalate' | 'voice_call' | 'wait';
  confidence: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, message, history, knowledge, channel, sentiment, persona, text } = await req.json();

    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    switch (action) {
      case 'analyze_sentiment':
        return await analyzeSentiment(message);

      case 'generate_response':
        return await generateResponse(message, history, knowledge, channel, sentiment, persona);

      case 'get_embedding':
        return await getEmbedding(text);

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error('Knight analyze error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function analyzeSentiment(message: string): Promise<Response> {
  const prompt = `Analyze the sentiment and intent of this customer message. Return ONLY valid JSON.

Message: "${message}"

Return this exact JSON structure:
{
  "score": <number 1-10, where 1=very angry, 5=neutral, 10=very happy>,
  "priority": "<'low' | 'medium' | 'critical'>",
  "intent": "<'complaint' | 'question' | 'urgent' | 'feedback' | 'general'>",
  "keywords": [<array of key issue words>],
  "requiresEscalation": <true if needs human intervention>
}

Priority rules:
- critical: score <= 3 OR urgent intent OR legal/safety mentions
- medium: score 4-6 OR complaint intent
- low: score >= 7 AND positive/neutral intent`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const data = await response.json();
  const content = data.content?.[0]?.text || '{}';

  // Parse the JSON response
  try {
    const analysis = JSON.parse(content) as SentimentAnalysis;
    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch {
    // Return default on parse error
    return new Response(
      JSON.stringify({
        score: 5,
        priority: 'medium',
        intent: 'general',
        keywords: [],
        requiresEscalation: false,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

async function generateResponse(
  message: string,
  history: Array<{ role: string; content: string }>,
  knowledge: Array<{ content: string; category: string; title?: string }>,
  channel: string,
  sentiment: SentimentAnalysis | undefined,
  persona: string
): Promise<Response> {
  // Build knowledge context
  const knowledgeContext = knowledge?.length
    ? knowledge.map((k) => `[${k.category}${k.title ? `: ${k.title}` : ''}]\n${k.content}`).join('\n\n')
    : 'No specific knowledge base entries found.';

  // Build conversation history
  const historyText = history?.length
    ? history.map((h) => `${h.role === 'user' ? 'Customer' : 'Knight'}: ${h.content}`).join('\n')
    : '';

  // Adjust tone based on sentiment
  let toneGuidance = '';
  if (sentiment) {
    if (sentiment.score <= 3) {
      toneGuidance = 'The customer is upset. Lead with empathy and acknowledgment. Apologize sincerely.';
    } else if (sentiment.score <= 5) {
      toneGuidance = 'The customer has concerns. Be professional and solution-focused.';
    } else {
      toneGuidance = 'The customer seems positive. Be helpful and maintain the good relationship.';
    }
  }

  const systemPrompt = `${persona}

${toneGuidance}

Context from Knowledge Base:
${knowledgeContext}

${historyText ? `Previous conversation:\n${historyText}\n` : ''}

Channel: ${channel} (keep response appropriate for this medium)

Respond as The Knight. Return ONLY valid JSON:
{
  "message": "<your response to the customer>",
  "tone": "<'empathetic' | 'professional' | 'apologetic' | 'helpful'>",
  "suggestedAction": "<'reply' | 'escalate' | 'voice_call' | 'wait'>",
  "confidence": <0-1 confidence in your response>
}`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: 'user', content: `Customer message: "${message}"` }],
    }),
  });

  const data = await response.json();
  const content = data.content?.[0]?.text || '{}';

  try {
    const knightResponse = JSON.parse(content) as KnightResponse;
    return new Response(JSON.stringify(knightResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(
      JSON.stringify({
        message: "I understand your concern and I'm here to help. Let me look into this for you right away.",
        tone: 'empathetic',
        suggestedAction: 'reply',
        confidence: 0.5,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

async function getEmbedding(text: string): Promise<Response> {
  // Use OpenAI for embeddings (Anthropic doesn't have an embedding model)
  // You'll need to add OPENAI_API_KEY to your Supabase secrets
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

  if (!OPENAI_API_KEY) {
    // Return a placeholder embedding if OpenAI not configured
    console.warn('OPENAI_API_KEY not configured, returning zero embedding');
    return new Response(
      JSON.stringify({ embedding: new Array(1536).fill(0) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'text-embedding-ada-002',
      input: text,
    }),
  });

  const data = await response.json();
  const embedding = data.data?.[0]?.embedding;

  return new Response(
    JSON.stringify({ embedding }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
