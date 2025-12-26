/**
 * V1 MODE: AI Conversation Analysis Edge Function
 * Analyzes sales conversations and extracts structured CRM insights.
 * Uses OpenAI API to generate summaries and stage recommendations.
 */

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are an AI CRM assistant.

Your job:
Analyze a sales conversation and extract structured CRM insights.

Rules:
- Be conservative. If unsure, say "unknown".
- Only use evidence from the conversation.
- Do NOT hallucinate facts.
- Never recommend "Closed" stage unless the conversation explicitly states a deal has been won or closed.

Return STRICT JSON in this exact format (no markdown, no code blocks, just JSON):
{
  "summary": "Brief 2–3 sentence summary",
  "intent_level": "low" | "medium" | "high",
  "recommended_stage": "lead" | "qualified" | "proposal" | "closed",
  "confidence": 0.0 - 1.0,
  "key_points": [
    "Important point 1",
    "Important point 2"
  ],
  "evidence_quote": "Exact sentence from the conversation that justifies the stage recommendation",
  "next_actions": [
    {
      "action": "What should happen next",
      "due_in_days": number
    }
  ]
}`;

interface AnalysisResult {
  summary: string;
  intent_level: 'low' | 'medium' | 'high';
  recommended_stage: 'lead' | 'qualified' | 'proposal' | 'closed';
  confidence: number;
  key_points: string[];
  evidence_quote: string;
  next_actions: Array<{ action: string; due_in_days: number }>;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { activity_id } = await req.json();

    if (!activity_id) {
      console.error("Missing activity_id in request");
      return new Response(
        JSON.stringify({ error: "activity_id is required" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Analyzing conversation for activity: ${activity_id}`);

    // Initialize Supabase client with service role for database access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Step 1: Fetch activity by id
    const { data: activity, error: fetchError } = await supabase
      .from('activities')
      .select('*')
      .eq('id', activity_id)
      .single();

    if (fetchError || !activity) {
      console.error("Error fetching activity:", fetchError);
      return new Response(
        JSON.stringify({ error: "Activity not found" }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: If ai_processed = true → exit
    if (activity.ai_processed === true) {
      console.log("Activity already processed, skipping");
      return new Response(
        JSON.stringify({ message: "Activity already processed", skipped: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if there's text to analyze
    if (!activity.raw_text || activity.raw_text.trim() === '') {
      console.log("No raw_text to analyze");
      return new Response(
        JSON.stringify({ error: "No conversation text to analyze" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 3: Send activity.raw_text to OpenAI with system prompt
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      console.error("OPENAI_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "OpenAI API key not configured" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Calling OpenAI API...");
    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Analyze this sales conversation:\n\n${activity.raw_text}` }
        ],
        max_tokens: 1000,
        temperature: 0.3,
      }),
    });

    if (!openAIResponse.ok) {
      const errorText = await openAIResponse.text();
      console.error("OpenAI API error:", openAIResponse.status, errorText);
      
      // Mark as not processed so it can be retried
      await supabase
        .from('activities')
        .update({ ai_processed: false })
        .eq('id', activity_id);

      return new Response(
        JSON.stringify({ error: "Failed to analyze conversation", details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const openAIData = await openAIResponse.json();
    const aiContent = openAIData.choices?.[0]?.message?.content;

    if (!aiContent) {
      console.error("No content in OpenAI response");
      return new Response(
        JSON.stringify({ error: "No analysis generated" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("OpenAI response received, parsing JSON...");

    // Step 4: Parse JSON safely
    let analysis: AnalysisResult;
    try {
      // Clean the response - remove markdown code blocks if present
      let cleanedContent = aiContent.trim();
      if (cleanedContent.startsWith('```json')) {
        cleanedContent = cleanedContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedContent.startsWith('```')) {
        cleanedContent = cleanedContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      analysis = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error("Failed to parse OpenAI response as JSON:", parseError, aiContent);
      
      // Still save what we can
      await supabase
        .from('activities')
        .update({ 
          ai_summary: aiContent.substring(0, 500),
          ai_processed: true 
        })
        .eq('id', activity_id);

      return new Response(
        JSON.stringify({ 
          error: "Failed to parse AI response", 
          partial_summary: aiContent.substring(0, 500) 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Analysis parsed:", JSON.stringify(analysis, null, 2));

    // Build the summary with all the details for UI display
    const fullSummary = JSON.stringify({
      summary: analysis.summary,
      intent_level: analysis.intent_level,
      key_points: analysis.key_points,
      evidence_quote: analysis.evidence_quote,
      next_actions: analysis.next_actions,
      recommended_stage: analysis.recommended_stage,
      confidence: analysis.confidence,
    });

    // Step 5: Update activity
    const { error: updateActivityError } = await supabase
      .from('activities')
      .update({
        ai_summary: fullSummary,
        ai_processed: true,
      })
      .eq('id', activity_id);

    if (updateActivityError) {
      console.error("Error updating activity:", updateActivityError);
      return new Response(
        JSON.stringify({ error: "Failed to save analysis" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Activity updated with AI summary");

    // Step 6: If confidence >= 0.7, update linked deal.stage
    let stageUpdated = false;
    if (analysis.confidence >= 0.7 && activity.related_deal_id) {
      // GUARDRAIL: Never auto-close a deal
      if (analysis.recommended_stage !== 'closed') {
        console.log(`Updating deal ${activity.related_deal_id} to stage: ${analysis.recommended_stage}`);
        
        const { error: updateDealError } = await supabase
          .from('deals')
          .update({ stage: analysis.recommended_stage })
          .eq('id', activity.related_deal_id);

        if (updateDealError) {
          console.error("Error updating deal stage:", updateDealError);
        } else {
          stageUpdated = true;
          console.log("Deal stage updated successfully");
        }
      } else {
        console.log("Skipping stage update: AI recommended 'closed' but auto-close is disabled");
      }
    } else if (analysis.confidence < 0.7) {
      console.log(`Confidence ${analysis.confidence} < 0.7, skipping stage update`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        analysis: {
          summary: analysis.summary,
          intent_level: analysis.intent_level,
          recommended_stage: analysis.recommended_stage,
          confidence: analysis.confidence,
          key_points: analysis.key_points,
        },
        stage_updated: stageUpdated,
        activity_id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Error in analyze-conversation:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
