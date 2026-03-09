/**
 * REGENT: Bishop Sweep Edge Function
 *
 * Generates AI email drafts for leads due for follow-up.
 * Production-ready: reads bishop_settings for timing, blacklist,
 * golden samples, signature, and strategy toggles.
 *
 * Secrets Required:
 * - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * - OPENAI_API_KEY | DEEPSEEK_API_KEY | OPENROUTER_API_KEY
 * - LLM_PROVIDER: 'openai' | 'deepseek' | 'openrouter' (default: openai)
 *
 * POST /functions/v1/bishop-sweep
 * Body: { "user_id": "uuid" }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

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

type BishopStatus = 'NEW' | 'INTRO_SENT' | 'FOLLOW_UP_NEEDED' | 'NUDGE_SENT' | 'BREAKUP_SENT' | 'ESCALATE_TO_KING';
type Strategy = 'INTRO' | 'INTRO_FOLLOW_UP' | 'NUDGE' | 'BREAKUP' | 'NONE';

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
  context_notes: string | null;
  enrichment_data: Record<string, any> | null;
}

interface BishopSettings {
  days_to_first_followup: number;
  days_to_second_followup: number;
  days_to_breakup: number;
  enable_sniper_intro: boolean;
  enable_value_nudge: boolean;
  enable_breakup: boolean;
  blacklisted_domains: string[];
  golden_samples: string[];
  signature_html: string;
  voice_tone: string;
  persona_prompt: string | null;
}

interface Draft {
  subject: string;
  body: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function appendNote(existing: string | null, note: string): string {
  const entry = `[${new Date().toISOString().split('T')[0]}] ${note}`;
  return existing ? `${existing}\n${entry}` : entry;
}

function emailDomain(email: string): string {
  return email.split('@')[1]?.toLowerCase() ?? '';
}

// ─── Strategy resolver (uses bishop_settings timing) ──────────────────────────

function determineStrategy(lead: Lead, settings: BishopSettings): Strategy {
  const days = daysSince(lead.last_contact_date);

  switch (lead.bishop_status) {
    case 'NEW':
    case null:
    case undefined:
      return 'INTRO';
    case 'INTRO_SENT':
      if (settings.enable_sniper_intro && days >= settings.days_to_first_followup)
        return 'INTRO_FOLLOW_UP';
      break;
    case 'FOLLOW_UP_NEEDED':
      if (settings.enable_value_nudge && days >= settings.days_to_second_followup)
        return 'NUDGE';
      break;
    case 'NUDGE_SENT':
      if (settings.enable_breakup && days >= settings.days_to_breakup)
        return 'BREAKUP';
      break;
    case 'BREAKUP_SENT':
    case 'ESCALATE_TO_KING':
      return 'NONE';
  }
  return 'NONE';
}

function getNextState(strategy: Strategy, settings: BishopSettings): { status: BishopStatus; nextActionDue: string | null } {
  switch (strategy) {
    case 'INTRO':
      return { status: 'INTRO_SENT', nextActionDue: daysFromNow(settings.days_to_first_followup) };
    case 'INTRO_FOLLOW_UP':
      return { status: 'FOLLOW_UP_NEEDED', nextActionDue: daysFromNow(settings.days_to_second_followup) };
    case 'NUDGE':
      return { status: 'NUDGE_SENT', nextActionDue: daysFromNow(settings.days_to_breakup) };
    case 'BREAKUP':
      return { status: 'BREAKUP_SENT', nextActionDue: null };
    default:
      throw new Error(`Unknown strategy: ${strategy}`);
  }
}

// ─── Draft generation ─────────────────────────────────────────────────────────

async function generateDraft(
  lead: Lead,
  strategy: Strategy,
  settings: BishopSettings,
  llm: { baseURL: string; apiKey: string; model: string },
  enrichContext?: string
): Promise<Draft> {

  // Build few-shot examples block from golden samples
  const samplesBlock = settings.golden_samples.length > 0
    ? `\n\nHere are examples of emails this sender has written previously. Match their style:\n---\n${settings.golden_samples.slice(0, 3).join('\n---\n')}\n---`
    : '';

  // Build persona context
  const personaBlock = settings.persona_prompt
    ? `\n\nPersona context: ${settings.persona_prompt}`
    : '';

  // Build company enrichment context for personalization
  const enrichBlock = enrichContext
    ? `\n\nCompany context (use for personalization — do NOT quote verbatim):\n${enrichContext}`
    : '';

  const toneNote = `Write in a ${settings.voice_tone.toLowerCase()} tone.`;

  // Try to extract a first name from email local part if lead has no name
  // e.g. john.doe@company.com → "John", recruiting@company.com → skip (generic role words)
  const GENERIC_EMAIL_PREFIXES = new Set(['recruiting', 'hello', 'hi', 'info', 'contact', 'team', 'support', 'sales', 'admin', 'noreply', 'no-reply', 'founders', 'founder', 'press', 'jobs', 'career', 'careers']);
  function extractNameFromEmail(email: string): string | null {
    const local = email.split('@')[0].toLowerCase().replace(/[^a-z.]/g, '');
    if (GENERIC_EMAIL_PREFIXES.has(local)) return null;
    const parts = local.split('.').filter(p => p.length > 1);
    if (parts.length === 0) return null;
    return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  }

  const rawName = lead.name && lead.name.trim();
  const recipientName = rawName || extractNameFromEmail(lead.email) || 'there';
  const companyName = lead.company && lead.company.trim() ? lead.company.trim() : 'your company';

  const prompts: Record<string, string> = {
    INTRO: `Write a SHORT first-touch cold email (3-5 sentences) to ${recipientName} at ${companyName}.
THIS IS THE VERY FIRST EMAIL — there is NO previous conversation, NO previous email, NO prior contact of any kind.
- Subject: make it specific to their company/role — do NOT use "Quick follow-up", "Following up", or anything implying prior contact
- Open with something relevant to what they are building
- Lead with value, not a pitch
- Ask ONE clear question to open a conversation
- Sound human, warm, concise
- Do NOT say "follow up", "following up", "previous note", "my last email", or imply any prior contact
- Do NOT mention AI
- Do NOT use "I hope this finds you well" or filler openers
- ${toneNote}${enrichBlock}${samplesBlock}${personaBlock}
Return JSON only: {"subject": "...", "body": "..."}`,

    INTRO_FOLLOW_UP: `Write a SHORT follow-up email (2-4 sentences) to ${recipientName} at ${companyName}.
This is a follow-up to an intro email sent a few days ago.
- Be value-anchored, not pushy
- Ask ONE clear question
- Sound human and calm
- Do NOT say "just checking in"
- Do NOT mention AI
- ${toneNote}${enrichBlock}${samplesBlock}${personaBlock}
Return JSON only: {"subject": "...", "body": "..."}`,

    NUDGE: `Write a SHORT gentle nudge email (2-4 sentences) to ${recipientName} at ${companyName}.
They haven't replied to previous emails.
- Offer an easy next step OR an easy exit
- No urgency or pressure
- Be professional and calm
- Sound human
- Do NOT mention AI
- ${toneNote}${enrichBlock}${samplesBlock}${personaBlock}
Return JSON only: {"subject": "...", "body": "..."}`,

    BREAKUP: `Write a SHORT close-the-loop email (2-4 sentences) to ${lead.name} at ${lead.company}.
This is a final message — they haven't replied to multiple emails.
- Thank them for their time
- Leave the door open
- Be gracious and professional
- No guilt-tripping
- Do NOT mention AI
- ${toneNote}${enrichBlock}${samplesBlock}${personaBlock}
Return JSON only: {"subject": "...", "body": "..."}`,
  };

  const prompt = prompts[strategy];
  if (!prompt) throw new Error(`No prompt for strategy: ${strategy}`);

  try {
    const response = await fetch(`${llm.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${llm.apiKey}`,
      },
      body: JSON.stringify({
        model: llm.model,
        messages: [
          { role: 'system', content: 'You write short, professional, human-sounding cold emails. Never mention prior contact unless the prompt says so. Return JSON only: {"subject":"...","body":"..."}' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 400,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`LLM API error ${response.status}: ${errBody}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error('Empty LLM response');

    let jsonStr = content;
    if (content.includes('```json')) jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    else if (content.includes('```')) jsonStr = content.replace(/```\n?/g, '');

    const parsed = JSON.parse(jsonStr.trim());
    return { subject: parsed.subject, body: parsed.body };
  } catch (error) {
    console.error('[BISHOP] Draft generation error for strategy', strategy, ':', error);
    const fallbacks: Record<string, Draft> = {
      INTRO: {
        subject: `Quick question for ${companyName}`,
        body: `Hi ${recipientName},\n\nI came across ${companyName} and wanted to reach out — we help small SaaS teams automate their sales outreach so they can focus on building.\n\nWould it be worth a 15-minute chat to see if there's a fit?\n\nBest`,
      },
      INTRO_FOLLOW_UP: {
        subject: `Re: ${companyName}`,
        body: `Hi ${recipientName},\n\nJust wanted to resurface my last note in case it got buried. Happy to share more if it's relevant to what you're working on at ${companyName}.\n\nBest`,
      },
      NUDGE: {
        subject: `One more thought — ${companyName}`,
        body: `Hi ${recipientName},\n\nI know things get busy. If now isn't the right time, no worries at all. Otherwise, happy to find 15 minutes that works for you.\n\nBest`,
      },
      BREAKUP: {
        subject: `Closing the loop — ${companyName}`,
        body: `Hi ${recipientName},\n\nI'll assume the timing isn't right and won't follow up again. If anything changes down the road, I'm always happy to reconnect.\n\nWishing you and the team all the best.`,
      },
    };
    return fallbacks[strategy] ?? fallbacks['INTRO']!;
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const llmProvider = Deno.env.get('LLM_PROVIDER') || 'openai';

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: 'Supabase credentials not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const llmConfigs: Record<string, { baseURL: string; apiKey: string | undefined; model: string }> = {
      openai:     { baseURL: 'https://api.openai.com/v1',         apiKey: Deno.env.get('OPENAI_API_KEY'),     model: 'gpt-4o-mini' },
      deepseek:   { baseURL: 'https://api.deepseek.com/v1',       apiKey: Deno.env.get('DEEPSEEK_API_KEY'),   model: 'deepseek-chat' },
      openrouter: { baseURL: 'https://openrouter.ai/api/v1',      apiKey: Deno.env.get('OPENROUTER_API_KEY'), model: 'deepseek/deepseek-chat' },
    };

    const llmConfig = llmConfigs[llmProvider];
    if (!llmConfig?.apiKey) {
      return new Response(JSON.stringify({ error: `LLM API key not configured for ${llmProvider}` }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { user_id } = await req.json();
    if (!user_id) {
      return new Response(JSON.stringify({ error: 'user_id is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[BISHOP] Starting sweep for user: ${user_id.substring(0, 8)}...`);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ── Subscription check ───────────────────────────────────────────────────
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_active, subscription_tier, subscription_expires_at')
      .eq('id', user_id)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: 'User profile not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isActive = profile.is_active === true;
    const notExpired = !profile.subscription_expires_at || new Date(profile.subscription_expires_at) > new Date();
    if (!isActive || !notExpired) {
      return new Response(JSON.stringify({ error: 'Subscription required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Fetch workspace_id ───────────────────────────────────────────────────
    const { data: membership } = await supabase
      .from('workspace_memberships')
      .select('workspace_id')
      .eq('user_id', user_id)
      .limit(1)
      .single();

    const workspaceId: string | null = membership?.workspace_id ?? null;

    // ── Fetch bishop_settings ────────────────────────────────────────────────
    const DEFAULT_SETTINGS: BishopSettings = {
      days_to_first_followup: 3,
      days_to_second_followup: 4,
      days_to_breakup: 7,
      enable_sniper_intro: true,
      enable_value_nudge: true,
      enable_breakup: true,
      blacklisted_domains: [],
      golden_samples: [],
      signature_html: '',
      voice_tone: 'Professional',
      persona_prompt: null,
    };

    const { data: settingsRow } = await supabase
      .from('bishop_settings')
      .select('*')
      .eq('user_id', user_id)
      .single();

    const settings: BishopSettings = settingsRow
      ? { ...DEFAULT_SETTINGS, ...settingsRow }
      : DEFAULT_SETTINGS;

    console.log(`[BISHOP] Settings loaded. Blacklist: ${settings.blacklisted_domains.length} domains, Samples: ${settings.golden_samples.length}`);

    // ── Fetch eligible leads ─────────────────────────────────────────────────
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('id, user_id, name, email, company, bishop_status, last_contact_date, next_action_due, notes, context_notes, enrichment_data')
      .eq('user_id', user_id)
      .not('bishop_status', 'eq', 'ESCALATE_TO_KING')
      .not('bishop_status', 'eq', 'BREAKUP_SENT')
      .limit(50);

    if (leadsError) {
      return new Response(JSON.stringify({ error: 'Failed to fetch leads', details: leadsError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!leads || leads.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No leads due for action', leads_processed: 0, drafts_created: 0 }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Apply blacklist filter ───────────────────────────────────────────────
    const blacklistSet = new Set(settings.blacklisted_domains.map(d => d.toLowerCase()));
    const eligibleLeads = (leads as Lead[]).filter(l => {
      if (!l.email) return false;
      const domain = emailDomain(l.email);
      if (blacklistSet.has(domain)) {
        console.log(`[BISHOP] Skipping ${l.name} (${domain} blacklisted)`);
        return false;
      }
      return true;
    });

    console.log(`[BISHOP] ${leads.length} leads found, ${eligibleLeads.length} after blacklist filter`);

    // ── Process leads in parallel (batches of 10) ────────────────────────────
    const results: Array<{ lead: string; strategy: string; success: boolean; skipped?: boolean }> = [];

    const processLead = async (lead: Lead) => {
      const strategy = determineStrategy(lead, settings);
      if (strategy === 'NONE') {
        return { lead: lead.name, strategy: 'NONE', success: true, skipped: true };
      }

      console.log(`[BISHOP] Processing ${lead.name}: ${strategy}`);

      // Enrich lead with company website context for personalization
      let enrichContext = lead.context_notes ?? '';
      try {
        const enrichRes = await supabase.functions.invoke('bishop-enrich', {
          body: { lead_id: lead.id, user_id },
        });
        if (enrichRes.data?.summary) enrichContext = enrichRes.data.summary;
      } catch {
        // Non-fatal — proceed without enrichment
      }

      // Generate draft
      const draft = await generateDraft(lead, strategy, settings, llmConfig as { baseURL: string; apiKey: string; model: string }, enrichContext || undefined);

      // Append email signature if set
      let finalBody = draft.body;
      if (settings.signature_html?.trim()) {
        finalBody = `${draft.body}\n\n${settings.signature_html.replace(/<[^>]+>/g, '')}`;
      }

      // Insert draft
      const { error: draftError } = await supabase.from('ai_drafts').insert({
        user_id,
        lead_id: lead.id,
        subject: draft.subject,
        body: finalBody,
        plain_text: finalBody,
        persona_used: 'BISHOP_SWEEP',
        strategy_used: strategy,
        is_ai_draft: true,
        status: 'PENDING_APPROVAL',
        metadata: {
          strategy,
          lead_name: lead.name,
          company: lead.company,
          generated_by: 'bishop-sweep-edge',
          generated_at: new Date().toISOString(),
          llm_provider: llmProvider,
          golden_samples_used: settings.golden_samples.length,
        },
      });

      if (draftError) {
        console.error(`[BISHOP] Draft insert error for ${lead.name}:`, draftError.message);
        return { lead: lead.name, strategy, success: false };
      }

      // Advance lead state
      const { status: nextStatus, nextActionDue } = getNextState(strategy, settings);
      const noteMsg: Record<string, string> = {
        INTRO_FOLLOW_UP: 'Draft created: intro follow-up',
        NUDGE: 'Draft created: value nudge',
        BREAKUP: 'Draft created: breakup',
      };

      await supabase
        .from('leads')
        .update({
          bishop_status: nextStatus,
          last_contact_date: new Date().toISOString(),
          next_action_due: nextActionDue,
          notes: appendNote(lead.notes, noteMsg[strategy] ?? `Draft created: ${strategy}`),
        })
        .eq('id', lead.id);

      console.log(`[BISHOP] ${lead.name}: ${lead.bishop_status} → ${nextStatus}`);
      return { lead: lead.name, strategy, success: true };
    };

    // Process in batches of 10 to avoid rate limits
    const BATCH_SIZE = 10;
    for (let i = 0; i < eligibleLeads.length; i += BATCH_SIZE) {
      const batch = eligibleLeads.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(batch.map(processLead));
      results.push(...batchResults);
    }

    const draftsCreated = results.filter(r => r.success && !r.skipped).length;

    console.log(`[BISHOP] Sweep complete. Drafts created: ${draftsCreated}`);

    return new Response(JSON.stringify({
      success: true,
      message: 'Bishop sweep completed',
      leads_processed: eligibleLeads.length,
      drafts_created: draftsCreated,
      blacklisted_skipped: leads.length - eligibleLeads.length,
      results,
      timestamp: new Date().toISOString(),
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[BISHOP] Sweep failed:', error);
    return new Response(JSON.stringify({
      error: 'Bishop sweep failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
