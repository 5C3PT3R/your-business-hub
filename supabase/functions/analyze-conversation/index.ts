/**
 * V1 MODE: AI Conversation Analysis Edge Function
 * Analyzes sales conversations and extracts structured CRM insights.
 * Uses Lovable AI Gateway (Gemini 2.5 Flash) for analysis.
 * 
 * AGENTS IMPLEMENTED:
 * - Agent 2: AI Analysis & Structuring
 * - Agent 3: Stage Movement
 * - Agent 5: Risk Detection
 * - Agent 9: Failure Safety
 * - Agent 12: Memory/Context (passes prior conversations)
 */

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are an AI CRM assistant for Upflo, a conversation-first sales CRM.

Your job:
Analyze a sales conversation and extract structured CRM insights.

PHILOSOPHY:
- AI suggests, humans approve
- Conservative > aggressive
- Explain everything
- No hallucination

Rules:
- Be conservative. If unsure, lower the confidence score.
- Only use evidence from the conversation.
- Do NOT hallucinate facts, pricing, budgets, or timelines.
- Never recommend "closed" stage unless the conversation explicitly states a deal has been won/lost.
- If information is insufficient, set confidence < 0.4 and provide a safe summary.

PRIOR CONTEXT:
{prior_context}

Return STRICT JSON in this exact format (no markdown, no code blocks, just JSON):
{
  "summary": "Brief 2–3 sentence factual summary",
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
  ],
  "follow_up_message": "A polite, professional follow-up message the sales rep could send (1-3 sentences)"
}`;

interface AnalysisResult {
  summary: string;
  intent_level: 'low' | 'medium' | 'high';
  recommended_stage: 'lead' | 'qualified' | 'proposal' | 'closed';
  confidence: number;
  key_points: string[];
  evidence_quote: string;
  next_actions: Array<{ action: string; due_in_days: number }>;
  follow_up_message?: string;
}

// Agent 9: Failure Safety - Default safe response
const SAFE_ANALYSIS: AnalysisResult = {
  summary: "Insufficient information to make a recommendation. Please add more conversation context.",
  intent_level: "low",
  recommended_stage: "lead",
  confidence: 0.3,
  key_points: ["Unable to extract clear insights from the provided text"],
  evidence_quote: "",
  next_actions: [],
  follow_up_message: ""
};

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
      // Agent 9: Save safe analysis instead of erroring
      await supabase
        .from('activities')
        .update({ 
          ai_summary: JSON.stringify(SAFE_ANALYSIS),
          ai_processed: true 
        })
        .eq('id', activity_id);
      
      return new Response(
        JSON.stringify({ success: true, analysis: SAFE_ANALYSIS, activity_id }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Agent 12: Memory/Context - Fetch prior conversations for this deal
    let priorContext = "No prior conversations available.";
    if (activity.related_deal_id) {
      const { data: priorActivities } = await supabase
        .from('activities')
        .select('raw_text, ai_summary, created_at')
        .eq('related_deal_id', activity.related_deal_id)
        .eq('ai_processed', true)
        .neq('id', activity_id)
        .order('created_at', { ascending: false })
        .limit(3);

      if (priorActivities && priorActivities.length > 0) {
        const summaries = priorActivities.map((a, idx) => {
          try {
            const parsed = JSON.parse(a.ai_summary || '{}');
            return `Conversation ${idx + 1}: ${parsed.summary || 'No summary'}`;
          } catch {
            return `Conversation ${idx + 1}: ${a.ai_summary?.substring(0, 200) || 'No summary'}`;
          }
        });
        priorContext = `Previous conversations (most recent first):\n${summaries.join('\n')}`;
      }
    }

    // Prepare system prompt with context
    const systemPromptWithContext = SYSTEM_PROMPT.replace('{prior_context}', priorContext);

    // Step 3: Call Lovable AI Gateway
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      console.error("LOVABLE_API_KEY not configured");
      // Agent 9: Fallback to safe analysis
      await supabase
        .from('activities')
        .update({ 
          ai_summary: JSON.stringify(SAFE_ANALYSIS),
          ai_processed: true 
        })
        .eq('id', activity_id);
      
      return new Response(
        JSON.stringify({ success: true, analysis: SAFE_ANALYSIS, activity_id, error: "API key not configured" }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Calling Lovable AI Gateway...");
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPromptWithContext },
          { role: 'user', content: `Analyze this sales conversation:\n\n${activity.raw_text}` }
        ],
      }),
    });

    // Handle rate limits and payment errors
    if (aiResponse.status === 429) {
      console.error("Rate limit exceeded");
      return new Response(
        JSON.stringify({ error: "Rate limits exceeded, please try again later." }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (aiResponse.status === 402) {
      console.error("Payment required");
      return new Response(
        JSON.stringify({ error: "AI credits depleted. Please add credits in workspace settings." }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errorText);
      
      // Agent 9: Save safe analysis on API failure
      await supabase
        .from('activities')
        .update({ 
          ai_summary: JSON.stringify(SAFE_ANALYSIS),
          ai_processed: true 
        })
        .eq('id', activity_id);

      return new Response(
        JSON.stringify({ success: true, analysis: SAFE_ANALYSIS, activity_id, error: "AI analysis failed" }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content;

    if (!aiContent) {
      console.error("No content in AI response");
      // Agent 9: Save safe analysis
      await supabase
        .from('activities')
        .update({ 
          ai_summary: JSON.stringify(SAFE_ANALYSIS),
          ai_processed: true 
        })
        .eq('id', activity_id);
      
      return new Response(
        JSON.stringify({ success: true, analysis: SAFE_ANALYSIS, activity_id }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("AI response received, parsing JSON...");

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
      
      // Validate required fields exist
      if (!analysis.summary || !analysis.intent_level || !analysis.recommended_stage) {
        throw new Error("Missing required fields in analysis");
      }
      
      // Ensure confidence is within bounds
      analysis.confidence = Math.max(0, Math.min(1, analysis.confidence || 0.5));
      
    } catch (parseError) {
      console.error("Failed to parse AI response as JSON:", parseError, aiContent);
      
      // Agent 9: Save safe analysis on parse failure
      await supabase
        .from('activities')
        .update({ 
          ai_summary: JSON.stringify({
            ...SAFE_ANALYSIS,
            summary: aiContent.substring(0, 500)
          }),
          ai_processed: true 
        })
        .eq('id', activity_id);

      return new Response(
        JSON.stringify({ 
          success: true,
          analysis: SAFE_ANALYSIS,
          activity_id,
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
      key_points: analysis.key_points || [],
      evidence_quote: analysis.evidence_quote || '',
      next_actions: analysis.next_actions || [],
      recommended_stage: analysis.recommended_stage,
      confidence: analysis.confidence,
      follow_up_message: analysis.follow_up_message || '',
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

    // Agent 3: Stage Movement - Only if confidence >= 0.7
    let stageUpdated = false;
    
    // Agent 5: Risk Detection - Check for at-risk deals
    let riskUpdated = false;
    
    if (activity.related_deal_id) {
      // Fetch current deal state
      const { data: deal } = await supabase
        .from('deals')
        .select('stage')
        .eq('id', activity.related_deal_id)
        .single();

      const currentStage = deal?.stage;

      // Agent 3: Stage Movement
      if (analysis.confidence >= 0.7 && analysis.recommended_stage !== 'closed') {
        if (currentStage !== analysis.recommended_stage) {
          console.log(`Updating deal ${activity.related_deal_id} to stage: ${analysis.recommended_stage}`);
          
          const { error: updateDealError } = await supabase
            .from('deals')
            .update({ 
              stage: analysis.recommended_stage,
              ai_stage_suggestion: analysis.recommended_stage,
            })
            .eq('id', activity.related_deal_id);

          if (updateDealError) {
            console.error("Error updating deal stage:", updateDealError);
          } else {
            stageUpdated = true;
            console.log("Deal stage updated successfully");
          }
        }
      } else if (analysis.confidence < 0.7) {
        console.log(`Confidence ${analysis.confidence} < 0.7, skipping stage update`);
      }

      // Agent 5: Risk Detection
      // Mark as at_risk if intent is low AND deal is in Qualified or Proposal stage
      const isAtRisk = analysis.intent_level === 'low' && 
        (currentStage === 'qualified' || currentStage === 'proposal');
      
      const { error: riskError } = await supabase
        .from('deals')
        .update({ 
          at_risk: isAtRisk,
          follow_up_completed: false, // Reset follow-up status on new conversation
        })
        .eq('id', activity.related_deal_id);

      if (!riskError && isAtRisk) {
        riskUpdated = true;
        console.log("Deal marked as at-risk");
      }
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
          follow_up_message: analysis.follow_up_message,
        },
        stage_updated: stageUpdated,
        risk_updated: riskUpdated,
        activity_id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Error in analyze-conversation:", error);
    
    // Agent 9: Never crash - return safe response
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        analysis: SAFE_ANALYSIS
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
