import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SDRAgentRequest {
  leadIds: string[];
  personaKey: string;
  userContext?: string;
  workspaceId: string;
  userId: string;
}

interface LeadData {
  id: string;
  name: string;
  email: string;
  company: string;
  title: string;
  industry: string;
  pain_points?: string[];
  notes?: string;
  last_contacted?: string;
  lead_score?: number;
}

interface AIDraftResponse {
  success: boolean;
  drafts: Array<{
    leadId: string;
    leadName: string;
    subject: string;
    body: string;
    personaUsed: string;
    status: string;
    draftId?: string;
    error?: string;
  }>;
  totalCreditsUsed: number;
  summary: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { leadIds, personaKey, userContext, workspaceId, userId }: SDRAgentRequest = await req.json();

    // Validate required fields
    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "leadIds must be a non-empty array" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!personaKey) {
      return new Response(
        JSON.stringify({ error: "personaKey is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!workspaceId) {
      return new Response(
        JSON.stringify({ error: "workspaceId is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "userId is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({
          error: "AI agent not configured",
          message: "OPENAI_API_KEY environment variable must be set in Supabase Edge Functions settings"
        }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({
          error: "Database connection not configured",
          message: "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set"
        }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Initialize Supabase client with service role key
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log(`SDR Agent Brain: Processing ${leadIds.length} leads for workspace ${workspaceId} with persona ${personaKey}`);

    // Step 1: Fetch lead data from database
    const { data: leads, error: leadsError } = await supabase
      .from("leads")
      .select("id, name, email, company, title, industry, pain_points, notes, last_contacted, lead_score")
      .in("id", leadIds)
      .eq("workspace_id", workspaceId);

    if (leadsError) {
      console.error("Error fetching leads:", leadsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch lead data", details: leadsError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!leads || leads.length === 0) {
      return new Response(
        JSON.stringify({ error: "No leads found for the provided IDs" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Found ${leads.length} leads to process`);

    // Step 2: Check if workspace has sufficient AI usage credits (optional check)
    // Note: The actual credit deduction happens via trigger when drafts are created
    // We could add a pre-check here if needed

    // Step 3: Generate AI drafts for each lead
    const drafts = [];
    let totalTokensUsed = 0;

    for (const lead of leads) {
      try {
        console.log(`Generating draft for lead: ${lead.name} (${lead.email})`);

        // Construct the prompt based on persona and lead data
        const prompt = constructPrompt(lead, personaKey, userContext);

        // Call OpenAI API
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: `You are an expert SDR (Sales Development Representative) writing personalized outreach emails.
                Your goal is to generate compelling, personalized email drafts that will get responses.
                Follow these guidelines:
                1. Keep it concise (150-250 words max)
                2. Personalize based on the lead's information
                3. Focus on value, not just features
                4. Include a clear call to action
                5. Use a professional but approachable tone
                6. Format as a proper email with subject line and body`
              },
              {
                role: "user",
                content: prompt
              }
            ],
            temperature: 0.7,
            max_tokens: 800,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`OpenAI API error for lead ${lead.id}:`, response.status, errorText);
          
          drafts.push({
            leadId: lead.id,
            leadName: lead.name,
            subject: "",
            body: "",
            personaUsed: personaKey,
            status: "FAILED",
            error: `OpenAI API error: ${response.status}`
          });
          continue;
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        const usage = data.usage;

        if (usage) {
          totalTokensUsed += usage.total_tokens || 0;
        }

        if (!content) {
          throw new Error("No response from AI");
        }

        // Parse the AI response to extract subject and body
        const { subject, body } = parseAIResponse(content);

        // Step 4: Save the draft to database
        const { data: draft, error: insertError } = await supabase
          .from("ai_drafts")
          .insert({
            workspace_id: workspaceId,
            user_id: userId,
            lead_id: lead.id,
            subject: subject,
            body: body,
            plain_text: body.replace(/<[^>]*>/g, ''), // Strip HTML tags for plain text
            persona_used: personaKey,
            is_ai_draft: true,
            ai_model_used: "gpt-4o-mini",
            prompt_tokens: usage?.prompt_tokens,
            completion_tokens: usage?.completion_tokens,
            total_tokens: usage?.total_tokens,
            status: "PENDING_APPROVAL",
            version: 1,
            metadata: {
              lead_data: {
                name: lead.name,
                email: lead.email,
                company: lead.company,
                title: lead.title,
                industry: lead.industry
              },
              generation_timestamp: new Date().toISOString(),
              user_context: userContext
            }
          })
          .select("id")
          .single();

        if (insertError) {
          console.error(`Error saving draft for lead ${lead.id}:`, insertError);
          drafts.push({
            leadId: lead.id,
            leadName: lead.name,
            subject: subject,
            body: body,
            personaUsed: personaKey,
            status: "FAILED",
            error: `Database error: ${insertError.message}`
          });
        } else {
          drafts.push({
            leadId: lead.id,
            leadName: lead.name,
            subject: subject,
            body: body,
            personaUsed: personaKey,
            status: "PENDING_APPROVAL",
            draftId: draft.id
          });
          console.log(`Draft created successfully for lead ${lead.name}, draft ID: ${draft.id}`);
        }

      } catch (error) {
        console.error(`Error processing lead ${lead.id}:`, error);
        drafts.push({
          leadId: lead.id,
          leadName: lead.name,
          subject: "",
          body: "",
          personaUsed: personaKey,
          status: "FAILED",
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }

    // Step 5: Prepare response
    const successfulDrafts = drafts.filter(d => d.status === "PENDING_APPROVAL");
    const failedDrafts = drafts.filter(d => d.status === "FAILED");

    const response: AIDraftResponse = {
      success: successfulDrafts.length > 0,
      drafts: drafts,
      totalCreditsUsed: successfulDrafts.length, // Each successful draft uses 1 AI credit
      summary: `Generated ${successfulDrafts.length} drafts successfully, ${failedDrafts.length} failed.`
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("SDR Agent Brain error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

/**
 * Construct a prompt for the AI based on lead data and persona
 */
function constructPrompt(lead: LeadData, personaKey: string, userContext?: string): string {
  const personaInstructions = getPersonaInstructions(personaKey);
  
  let prompt = `Generate a personalized outreach email for a lead with the following details:\n\n`;
  
  prompt += `LEAD INFORMATION:\n`;
  prompt += `- Name: ${lead.name}\n`;
  if (lead.email) prompt += `- Email: ${lead.email}\n`;
  if (lead.company) prompt += `- Company: ${lead.company}\n`;
  if (lead.title) prompt += `- Title: ${lead.title}\n`;
  if (lead.industry) prompt += `- Industry: ${lead.industry}\n`;
  if (lead.pain_points && lead.pain_points.length > 0) {
    prompt += `- Pain Points: ${lead.pain_points.join(', ')}\n`;
  }
  if (lead.notes) prompt += `- Notes: ${lead.notes}\n`;
  if (lead.lead_score) prompt += `- Lead Score: ${lead.lead_score}/100\n`;
  
  prompt += `\nPERSONA INSTRUCTIONS:\n`;
  prompt += `${personaInstructions}\n`;
  
  if (userContext) {
    prompt += `\nADDITIONAL CONTEXT FROM USER:\n`;
    prompt += `${userContext}\n`;
  }
  
  prompt += `\nFORMAT REQUIREMENTS:\n`;
  prompt += `Please provide your response in the following format:\n`;
  prompt += `SUBJECT: [Your email subject line here]\n`;
  prompt += `BODY: [Your email body here]\n`;
  prompt += `\nThe email body should be properly formatted with paragraphs and appropriate spacing.`;
  
  return prompt;
}

/**
 * Get persona-specific instructions
 */
function getPersonaInstructions(personaKey: string): string {
  const personas: Record<string, string> = {
    FRIENDLY_FOUNDER: `You are a friendly founder who genuinely wants to help other businesses succeed.
    Your tone should be warm, approachable, and collaborative.
    Focus on understanding their needs and offering value, not just selling.
    Start with a personalized compliment or observation about their company/work.
    Mention a specific pain point you can help solve.
    Offer concrete value (insight, resource, introduction).
    Suggest a low-pressure next step (15-min call, resource sharing).
    End with a warm, open invitation to connect.`,
    
    DIRECT_SALES: `You are a direct sales professional with a focus on delivering clear ROI.
    Your emails should be concise, value-driven, and get straight to the point.
    Focus on specific metrics, results, and clear next steps.
    Start with a clear value proposition.
    State the specific problem you solve.
    Include relevant metrics or case studies.
    Propose a specific next step with clear timeline.
    Include a clear call to action.`,
    
    HELPFUL_TEACHER: `You are a helpful teacher who educates rather than sells.
    Your goal is to provide genuine value through insights, tips, or resources.
    Position yourself as an expert who wants to help others learn.
    Start with an educational insight or observation.
    Share a specific tip, framework, or resource.
    Explain the "why" behind your approach.
    Offer additional resources or follow-up.
    Invite them to learn more if interested.`,
    
    EXPERT_ADVISOR: `You are an expert advisor providing strategic insights to business leaders.
    Your emails should demonstrate deep understanding of their industry and challenges.
    Focus on strategic impact rather than tactical features.
    Start with a strategic observation about their industry.
    Identify a key challenge or opportunity.
    Provide a high-level framework or approach.
    Offer to discuss strategic implications.
    Position as a thought partner, not just a vendor.`,
    
    COLD_OUTREACH: `You are writing a cold outreach email designed to get a response.
    Keep it extremely brief (under 150 words), curiosity-driven, and low-commitment.
    Focus on sparking interest, not explaining everything.
    Start with a curiosity-driven subject line.
    Make it personal and relevant.
    Ask an intriguing question.
    Keep the ask minimal (reply, quick call).
    Make it easy to respond.`
  };
  
  return personas[personaKey] || personas.FRIENDLY_FOUNDER;
}

/**
 * Parse AI response to extract subject and body
 */
function parseAIResponse(content: string): { subject: string; body: string } {
  // Default values
  let subject = "Follow-up regarding your business";
  let body = content;
  
  // Try to extract subject line if formatted as "SUBJECT: ..."
  const subjectMatch = content.match(/SUBJECT:\s*(.+?)(?:\n|$)/i);
  if (subjectMatch) {
    subject = subjectMatch[1].trim();
    // Remove the subject line from body
    body = content.replace(/SUBJECT:\s*.+?\n/i, '');
  }
  
  // Try to extract body if formatted as "BODY: ..."
  const bodyMatch = content.match(/BODY:\s*(.+)/is);
  if (bodyMatch) {
    body = bodyMatch[1].trim();
  }
  
  // Clean up the body
  body = body.replace(/^(?:\n|\s)+/, ''); // Remove leading whitespace
  
  return { subject, body };
}