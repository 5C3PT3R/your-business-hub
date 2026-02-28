import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://hireregent.com',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { transcription, leadName, leadCompany, leadId, userId, workspaceId, autoCreateTasks } = await req.json();

    if (!transcription) {
      throw new Error('No transcription provided');
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    console.log('Analyzing call transcription for:', leadName);

    const systemPrompt = `You are an AI assistant that analyzes sales call transcriptions in Hindi, English, or Hinglish (mixed). Your job is to:
1. Create a concise summary of the call (2-3 sentences)
2. Determine the sentiment (positive, neutral, or negative) based on the conversation tone
3. Identify any follow-up commitments or scheduled meetings mentioned in the call
4. Extract action items that should be created as tasks

Look for phrases like:
- "let's meet tomorrow at 5" / "kal 5 baje milte hain"
- "I'll call you back on Monday" / "Monday ko call karta hoon"
- "book a meeting" / "meeting book kar do"
- "schedule a follow-up" / "follow-up schedule karo"
- "send me the proposal" / "proposal bhej do"
- "ek meeting fix karo" / "kal subah 6 baje"

For each task/follow-up identified, determine:
- A clear task title
- Priority (high if time-sensitive, medium otherwise)
- Due date if mentioned (convert relative dates like "kal" (tomorrow), "parso" (day after) to actual dates)

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
  "actionItems": ["List of action items as strings"],
  "tasksToCreate": [
    {
      "title": "Clear task title",
      "description": "Task description",
      "priority": "high" | "medium" | "low",
      "dueDate": "YYYY-MM-DD format if date mentioned, null otherwise"
    }
  ],
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
          { role: 'user', content: `Today's date is ${new Date().toISOString().split('T')[0]}. Analyze this call transcription with ${leadName || 'a lead'}${leadCompany ? ` from ${leadCompany}` : ''}:\n\n"${transcription}"` }
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

    // Automatically create tasks if requested and we have the required info
    let createdTasks: any[] = [];
    if (autoCreateTasks && userId && workspaceId && analysis.tasksToCreate?.length > 0) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      for (const task of analysis.tasksToCreate) {
        const { data, error } = await supabase
          .from('tasks')
          .insert({
            title: task.title,
            description: task.description || `Created from call with ${leadName || 'lead'}`,
            priority: task.priority || 'medium',
            due_date: task.dueDate || null,
            status: 'pending',
            user_id: userId,
            workspace_id: workspaceId,
            related_lead_id: leadId || null,
          })
          .select()
          .single();

        if (error) {
          console.error('Error creating task:', error);
        } else {
          console.log('Created task:', data);
          createdTasks.push(data);
        }
      }
    }

    return new Response(
      JSON.stringify({ ...analysis, createdTasks }),
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
