import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AgentRequest {
  instruction: string;
  workspaceId: string;
  industryType: string;
  context: {
    leads?: any[];
    contacts?: any[];
    deals?: any[];
    tasks?: any[];
    tickets?: any[];
    properties?: any[];
    clients?: any[];
  };
  allowedActions: string[];
}

const industryPrompts: Record<string, string> = {
  sales: `You are an AI CRM Operations Agent for a Sales CRM. 
You help users manage leads, contacts, deals, and tasks.
Available actions: create_lead, update_lead, create_contact, update_contact, create_deal, update_deal_stage, create_task, complete_task, send_followup, qualify_lead`,

  real_estate: `You are an AI CRM Operations Agent for a Real Estate CRM.
You help users manage clients, properties, site visits, and bookings.
Available actions: create_client, update_client, add_property, update_property_status, schedule_site_visit, create_booking, send_property_match, update_intent_level`,

  ecommerce: `You are an AI CRM Operations Agent for an E-commerce CRM.
You help users manage customers, orders, tickets, and returns.
Available actions: create_ticket, escalate_ticket, resolve_ticket, update_order_status, process_refund, create_customer, send_update, flag_priority`,

  insurance: `You are an AI CRM Operations Agent for an Insurance CRM.
You help users manage policies, claims, renewals, and policyholders.
Available actions: create_claim, update_claim_status, schedule_renewal, create_policy, update_policyholder, flag_fraud, send_reminder, escalate_case`
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { instruction, workspaceId, industryType, context, allowedActions } = await req.json() as AgentRequest;
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const industryPrompt = industryPrompts[industryType] || industryPrompts.sales;
    
    const systemPrompt = `${industryPrompt}

CRITICAL RULES:
1. You are an operations agent, NOT a chatbot. Suggest specific actions, don't just talk.
2. Always respond with valid JSON matching the required format.
3. Assign confidence scores (0-1) based on how certain you are the action is correct.
4. Actions with confidence < 0.7 should require approval.
5. Never suggest actions outside the allowed list.
6. Be concise and action-oriented.

CURRENT CONTEXT:
- Workspace ID: ${workspaceId}
- Industry: ${industryType}
- Allowed Actions: ${allowedActions.join(', ')}
- Available Records: ${JSON.stringify(context, null, 2)}

RESPONSE FORMAT (JSON ONLY):
{
  "agent_message": "Brief explanation of what you found and will do",
  "planned_actions": [
    {
      "action": "action_name",
      "record_id": "optional_record_id",
      "record_type": "lead|contact|deal|task|ticket|property|client|claim|policy",
      "params": {},
      "confidence": 0.85,
      "requires_approval": true,
      "reason": "Why this action is suggested"
    }
  ],
  "summary": "One-line summary of the plan"
}`;

    console.log("Sending request to OpenAI API...");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: instruction }
        ],
        temperature: 0.3,
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 401) {
        return new Response(JSON.stringify({ error: "Invalid OpenAI API key." }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    console.log("OpenAI response received:", JSON.stringify(data).slice(0, 200));
    
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No response from AI");
    }

    // Parse the JSON response from the AI
    let agentResponse;
    try {
      // Extract JSON from potential markdown code blocks
      const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/```\n?([\s\S]*?)\n?```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : content;
      agentResponse = JSON.parse(jsonStr.trim());
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      agentResponse = {
        agent_message: content,
        planned_actions: [],
        summary: "Could not parse structured response"
      };
    }

    return new Response(JSON.stringify(agentResponse), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("CRM Agent error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
