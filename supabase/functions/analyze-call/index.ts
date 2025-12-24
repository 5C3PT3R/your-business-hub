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
    const { transcription, leadName, leadCompany } = await req.json();

    if (!transcription) {
      throw new Error('No transcription provided');
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    console.log('Analyzing call transcription for:', leadName);

    const systemPrompt = `You are an AI assistant that analyzes sales call transcriptions. Your job is to:
1. Create a concise summary of the call (2-3 sentences)
2. Determine the sentiment (positive, neutral, or negative) based on the conversation tone
3. Identify any follow-up commitments or scheduled meetings mentioned in the call
4. Extract action items

Look for phrases like:
- "let's meet tomorrow at 5"
- "I'll call you back on Monday"
- "we can discuss this next week"
- "schedule a follow-up"
- "kal 5 baje milte hain" (Hindi for "let's meet tomorrow at 5")
- "kal baat karte hain" (Hindi for "let's talk tomorrow")

Return your analysis in this exact JSON format:
{
  "summary": "Brief summary of the call",
  "sentiment": "positive" | "neutral" | "negative",
  "sentimentScore": 0.0-1.0,
  "followUps": [
    {
      "description": "What was discussed/committed",
      "suggestedDate": "ISO date string if mentioned, null otherwise",
      "suggestedTime": "Time if mentioned, null otherwise",
      "rawText": "The exact phrase from transcription"
    }
  ],
  "actionItems": ["List of action items"],
  "keyTopics": ["Main topics discussed"],
  "nextSteps": "Recommended next steps based on the call"
}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Analyze this call transcription with ${leadName || 'a lead'}${leadCompany ? ` from ${leadCompany}` : ''}:\n\n"${transcription}"` }
        ],
        response_format: { type: 'json_object' }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${errorText}`);
    }

    const result = await response.json();
    const analysis = JSON.parse(result.choices[0].message.content);

    console.log('Call analysis complete:', analysis);

    return new Response(
      JSON.stringify(analysis),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Analysis error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
