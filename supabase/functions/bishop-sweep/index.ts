/**
 * REGENT: Bishop Sweep Edge Function
 * Production cloud version of the Bishop agent sweep logic.
 *
 * DAY 7: This function runs Bishop in the cloud without localhost dependency.
 *
 * Secrets Required (set via Supabase CLI or Dashboard):
 * - SUPABASE_URL: Your Supabase project URL
 * - SUPABASE_SERVICE_ROLE_KEY: Service role key for admin access
 * - OPENAI_API_KEY: OpenAI API key for draft generation
 * - LLM_PROVIDER: 'openai' | 'deepseek' | 'openrouter' (default: openai)
 * - DEEPSEEK_API_KEY: DeepSeek API key (if using deepseek)
 * - OPENROUTER_API_KEY: OpenRouter API key (if using openrouter)
 *
 * To set secrets:
 * npx supabase secrets set OPENAI_API_KEY=sk-xxx
 *
 * Trigger:
 * POST /functions/v1/bishop-sweep
 * Body: { "user_id": "uuid" }
 * Headers: Authorization: Bearer <service_role_key>
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Types
type BishopStatus = 'INTRO_SENT' | 'FOLLOW_UP_NEEDED' | 'NUDGE_SENT' | 'BREAKUP_SENT' | 'ESCALATE_TO_KING';
type Strategy = 'INTRO_FOLLOW_UP' | 'NUDGE' | 'BREAKUP' | 'NONE';

interface Lead {
  id: string;
  user_id: string;
  name: string;
  email: string;
  company: string;
  bishop_status: BishopStatus;
  last_contact_date: string;
  next_action_due: string;
  notes: string | null;
}

interface Draft {
  subject: string;
  body: string;
}

// Timing constants (hardcoded per PRD)
const TIMING = {
  INTRO_FOLLOW_UP_DAYS: 2,
  NUDGE_DAYS: 3,
  BREAKUP_DAYS: 4,
  NEXT_ACTION_INTRO: 3,
  NEXT_ACTION_NUDGE: 4,
};

// Helpers
function daysSince(dateStr: string): number {
  const date = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
}

function daysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function appendNote(existingNotes: string | null, newNote: string): string {
  const timestamp = new Date().toISOString().split('T')[0];
  const entry = `[${timestamp}] ${newNote}`;
  return existingNotes ? `${existingNotes}\n${entry}` : entry;
}

// Strategy resolver
function determineStrategy(lead: Lead): Strategy {
  const daysSinceContact = daysSince(lead.last_contact_date);

  switch (lead.bishop_status) {
    case 'INTRO_SENT':
      if (daysSinceContact >= TIMING.INTRO_FOLLOW_UP_DAYS) return 'INTRO_FOLLOW_UP';
      break;
    case 'FOLLOW_UP_NEEDED':
      if (daysSinceContact >= TIMING.NUDGE_DAYS) return 'NUDGE';
      break;
    case 'NUDGE_SENT':
      if (daysSinceContact >= TIMING.BREAKUP_DAYS) return 'BREAKUP';
      break;
    case 'BREAKUP_SENT':
    case 'ESCALATE_TO_KING':
      return 'NONE';
  }
  return 'NONE';
}

// Get next state
function getNextState(strategy: Strategy): { status: BishopStatus; nextActionDue: string | null } {
  switch (strategy) {
    case 'INTRO_FOLLOW_UP':
      return { status: 'FOLLOW_UP_NEEDED', nextActionDue: daysFromNow(TIMING.NEXT_ACTION_INTRO) };
    case 'NUDGE':
      return { status: 'NUDGE_SENT', nextActionDue: daysFromNow(TIMING.NEXT_ACTION_NUDGE) };
    case 'BREAKUP':
      return { status: 'BREAKUP_SENT', nextActionDue: null };
    default:
      throw new Error(`Unknown strategy: ${strategy}`);
  }
}

// LLM draft generation
async function generateDraft(lead: Lead, strategy: Strategy, config: { baseURL: string; apiKey: string; model: string }): Promise<Draft> {
  const prompts: Record<string, string> = {
    INTRO_FOLLOW_UP: `Write a SHORT follow-up email (2-4 sentences) to ${lead.name} at ${lead.company}.
This is a follow-up to an intro email sent a few days ago.
- Be value-anchored, not pushy
- Ask ONE clear question
- Sound human and calm
- Do NOT say "just checking in"
- Do NOT mention AI
Return JSON only: {"subject": "...", "body": "..."}`,
    NUDGE: `Write a SHORT gentle nudge email (2-4 sentences) to ${lead.name} at ${lead.company}.
They haven't replied to previous emails.
- Offer an easy next step OR an easy exit
- No urgency or pressure
- Be professional and calm
- Sound human
- Do NOT mention AI
Return JSON only: {"subject": "...", "body": "..."}`,
    BREAKUP: `Write a SHORT close-the-loop email (2-4 sentences) to ${lead.name} at ${lead.company}.
This is a final message - they haven't replied to multiple emails.
- Thank them for their time
- Leave the door open
- Be gracious and professional
- No guilt-tripping
- Do NOT mention AI
Return JSON only: {"subject": "...", "body": "..."}`,
  };

  const prompt = prompts[strategy];
  if (!prompt) throw new Error(`No prompt for strategy: ${strategy}`);

  try {
    const response = await fetch(`${config.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: 'You write short, professional, human-sounding emails. Return JSON only.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error('Empty LLM response');

    // Parse JSON (handle markdown code blocks)
    let jsonStr = content;
    if (content.includes('```json')) {
      jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (content.includes('```')) {
      jsonStr = content.replace(/```\n?/g, '');
    }

    const parsed = JSON.parse(jsonStr.trim());
    return { subject: parsed.subject, body: parsed.body };
  } catch (error) {
    console.error('[BISHOP] Draft generation error:', error);
    // Fallback drafts
    const fallbacks: Record<string, Draft> = {
      INTRO_FOLLOW_UP: {
        subject: `Quick follow-up - ${lead.company}`,
        body: `Hi ${lead.name},\n\nWanted to follow up on my previous note. Would love to hear if this resonates with what ${lead.company} is working on.\n\nWould a brief call next week work?\n\nBest`,
      },
      NUDGE: {
        subject: `One more thought - ${lead.company}`,
        body: `Hi ${lead.name},\n\nI know things get busy. If now isn't the right time, no worries at all. Otherwise, happy to find 15 minutes that works for you.\n\nBest`,
      },
      BREAKUP: {
        subject: `Closing the loop - ${lead.company}`,
        body: `Hi ${lead.name},\n\nI'll assume the timing isn't right and won't follow up again. If anything changes down the road, I'm always happy to reconnect.\n\nWishing you and the team all the best.`,
      },
    };
    return fallbacks[strategy] || fallbacks.INTRO_FOLLOW_UP;
  }
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const llmProvider = Deno.env.get('LLM_PROVIDER') || 'openai';

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: 'Supabase credentials not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // LLM config
    const llmConfigs: Record<string, { baseURL: string; apiKey: string | undefined; model: string }> = {
      openai: {
        baseURL: 'https://api.openai.com/v1',
        apiKey: Deno.env.get('OPENAI_API_KEY'),
        model: 'gpt-4o-mini',
      },
      deepseek: {
        baseURL: 'https://api.deepseek.com/v1',
        apiKey: Deno.env.get('DEEPSEEK_API_KEY'),
        model: 'deepseek-chat',
      },
      openrouter: {
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: Deno.env.get('OPENROUTER_API_KEY'),
        model: 'deepseek/deepseek-chat',
      },
    };

    const llmConfig = llmConfigs[llmProvider];
    if (!llmConfig?.apiKey) {
      return new Response(JSON.stringify({ error: `LLM API key not configured for ${llmProvider}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request
    const { user_id } = await req.json();
    if (!user_id) {
      return new Response(JSON.stringify({ error: 'user_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[BISHOP] Starting sweep for user: ${user_id.substring(0, 8)}...`);

    // Initialize Supabase client with service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // DAY 6: Check subscription status
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_active, subscription_tier, subscription_expires_at')
      .eq('id', user_id)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: 'User profile not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isActive = profile.is_active === true;
    const notExpired = !profile.subscription_expires_at || new Date(profile.subscription_expires_at) > new Date();

    if (!isActive || !notExpired) {
      return new Response(JSON.stringify({
        error: 'Subscription required',
        message: 'User does not have an active subscription',
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[BISHOP] Subscription OK: ${profile.subscription_tier}`);

    // Fetch eligible leads
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('id, user_id, name, email, company, bishop_status, last_contact_date, next_action_due, notes')
      .eq('user_id', user_id)
      .lte('next_action_due', new Date().toISOString())
      .not('bishop_status', 'eq', 'ESCALATE_TO_KING')
      .not('bishop_status', 'eq', 'BREAKUP_SENT');

    if (leadsError) {
      return new Response(JSON.stringify({ error: 'Failed to fetch leads', details: leadsError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!leads || leads.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No leads due for action',
        leads_processed: 0,
        drafts_created: 0,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[BISHOP] Found ${leads.length} leads to process`);

    // Process leads
    let draftsCreated = 0;
    const results: Array<{ lead: string; strategy: string; success: boolean }> = [];

    for (const lead of leads as Lead[]) {
      const strategy = determineStrategy(lead);

      if (strategy === 'NONE') {
        results.push({ lead: lead.name, strategy: 'NONE', success: true });
        continue;
      }

      console.log(`[BISHOP] Processing ${lead.name}: ${strategy}`);

      // Generate draft
      const draft = await generateDraft(lead, strategy, llmConfig as { baseURL: string; apiKey: string; model: string });

      // Insert draft
      const { error: draftError } = await supabase.from('ai_drafts').insert({
        user_id: user_id,
        lead_id: lead.id,
        subject: draft.subject,
        body: draft.body,
        plain_text: draft.body,
        persona_used: 'BISHOP_SWEEP',
        is_ai_draft: true,
        status: 'PENDING_APPROVAL',
        metadata: {
          strategy,
          lead_name: lead.name,
          company: lead.company,
          generated_by: 'bishop-sweep-edge',
          generated_at: new Date().toISOString(),
        },
      });

      if (draftError) {
        console.error(`[BISHOP] Draft insert error for ${lead.name}:`, draftError.message);
        results.push({ lead: lead.name, strategy, success: false });
        continue;
      }

      // Update lead state
      const { status: nextStatus, nextActionDue } = getNextState(strategy);
      const noteMessage = {
        INTRO_FOLLOW_UP: 'Sent intro follow-up (cloud)',
        NUDGE: 'Sent nudge (cloud)',
        BREAKUP: 'Sent breakup (cloud)',
      }[strategy];

      await supabase
        .from('leads')
        .update({
          bishop_status: nextStatus,
          last_contact_date: new Date().toISOString(),
          next_action_due: nextActionDue,
          notes: appendNote(lead.notes, noteMessage || `Processed with ${strategy}`),
        })
        .eq('id', lead.id);

      draftsCreated++;
      results.push({ lead: lead.name, strategy, success: true });
      console.log(`[BISHOP] ${lead.name}: ${lead.bishop_status} → ${nextStatus}`);
    }

    console.log(`[BISHOP] Sweep complete. Drafts created: ${draftsCreated}`);

    return new Response(JSON.stringify({
      success: true,
      message: 'Bishop sweep completed',
      leads_processed: leads.length,
      drafts_created: draftsCreated,
      results,
      timestamp: new Date().toISOString(),
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[BISHOP] Sweep failed:', error);
    return new Response(JSON.stringify({
      error: 'Bishop sweep failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
