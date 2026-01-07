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
    uploadedFile?: {
      fileName: string;
      headers: string[];
      sampleRows: Record<string, string>[];
      totalRows: number;
    };
  };
  allowedActions: string[];
  fileData?: {
    headers: string[];
    rows: Record<string, string>[];
  };
}

const industryPrompts: Record<string, string> = {
  sales: `You are an AI CRM Operations Agent for a Sales CRM. 
You help users manage leads, contacts, deals, and tasks.
Available actions: create_lead, update_lead, create_contact, update_contact, create_deal, update_deal_stage, create_task, complete_task, send_followup, qualify_lead, bulk_create_leads, bulk_create_contacts`,

  real_estate: `You are an AI CRM Operations Agent for a Real Estate CRM.
You help users manage clients, properties, site visits, and bookings.
Available actions: create_client, update_client, add_property, update_property_status, schedule_site_visit, create_booking, send_property_match, update_intent_level, bulk_create_clients`,

  ecommerce: `You are an AI CRM Operations Agent for an E-commerce CRM.
You help users manage customers, orders, tickets, and returns.
Available actions: create_ticket, escalate_ticket, resolve_ticket, update_order_status, process_refund, create_customer, send_update, flag_priority, bulk_create_customers`,

  insurance: `You are an AI CRM Operations Agent for an Insurance CRM.
You help users manage policies, claims, renewals, and policyholders.
Available actions: create_claim, update_claim_status, schedule_renewal, create_policy, update_policyholder, flag_fraud, send_reminder, escalate_case, bulk_create_policyholders`
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { instruction, workspaceId, industryType, context, allowedActions, fileData } = await req.json() as AgentRequest;
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

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

    const industryPrompt = industryPrompts[industryType] || industryPrompts.sales;
    
    let fileContext = "";
    if (context.uploadedFile) {
      fileContext = `

UPLOADED FILE DATA:
- File Name: ${context.uploadedFile.fileName}
- Total Rows: ${context.uploadedFile.totalRows}
- Columns: ${context.uploadedFile.headers.join(', ')}
- Sample Data (first ${context.uploadedFile.sampleRows.length} rows):
${JSON.stringify(context.uploadedFile.sampleRows, null, 2)}

When importing data from files, use bulk_create_leads or bulk_create_contacts with an "items" array in params.
Each item should map the file columns to the appropriate fields (name, email, phone, company, etc.).`;
    }

    const systemPrompt = `${industryPrompt}

CRITICAL RULES:
1. You are an operations agent, NOT a chatbot. Suggest specific actions, don't just talk.
2. Always respond with valid JSON matching the required format.
3. Assign confidence scores (0-1) based on how certain you are the action is correct.
4. Actions with confidence < 0.7 should require approval.
5. Never suggest actions outside the allowed list.
6. Be concise and action-oriented.
7. For file imports, analyze the columns and map them to appropriate CRM fields.

CURRENT CONTEXT:
- Workspace ID: ${workspaceId}
- Industry: ${industryType}
- Allowed Actions: ${allowedActions.join(', ')}
- Available Records: ${JSON.stringify({
  leads: context.leads?.length || 0,
  contacts: context.contacts?.length || 0,
  deals: context.deals?.length || 0,
  tasks: context.tasks?.length || 0,
}, null, 2)}${fileContext}

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
}

For bulk imports, use this format:
{
  "action": "bulk_create_contacts",
  "params": {
    "items": [
      {"name": "John Doe", "email": "john@example.com", "phone": "123-456-7890", "company": "Acme Inc"},
      ...
    ]
  },
  "confidence": 0.9,
  "requires_approval": true,
  "reason": "Import X contacts from uploaded file"
}`;

    console.log("Sending request to OpenAI API...");

    // Build the user message with file data if available
    let userMessage = instruction;
    if (fileData && fileData.rows.length > 0) {
      userMessage += `\n\nFile data to process (${fileData.rows.length} rows):\n${JSON.stringify(fileData.rows.slice(0, 20), null, 2)}`;
      if (fileData.rows.length > 20) {
        userMessage += `\n... and ${fileData.rows.length - 20} more rows`;
      }
    }

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
          { role: "user", content: userMessage }
        ],
        temperature: 0.3,
        max_tokens: 4096,
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
