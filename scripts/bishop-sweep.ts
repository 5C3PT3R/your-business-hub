/**
 * BISHOP SWEEP SCRIPT (MASTER PRD VERSION)
 *
 * Daily sweep over leads table with full persona support.
 * State Machine: NEW → CONTACTED → INTERESTED/STALLED/CLOSED
 *
 * STRATEGIES:
 * - 🟢 SNIPER_INTRO: First contact (NEW leads)
 * - 🟡 VALUE_NUDGE: Bump after 3+ days (CONTACTED)
 * - 🔴 BREAKUP: Final message after 7+ days (CONTACTED)
 *
 * FEATURES:
 * - Multi-tenant (user_id scoping)
 * - Subscription gating
 * - Persona from bishop_settings (voice_tone, golden_samples)
 * - Blacklist filtering
 * - Strategy toggles
 * - Configurable timing
 *
 * Run: USER_ID=<uuid> npx tsx scripts/bishop-sweep.ts
 * Or:  npx tsx scripts/bishop-sweep.ts (uses BISHOP_USER_ID from .env)
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// ============================================
// CONFIGURATION
// ============================================

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('[BISHOP] Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// LLM Configuration
const LLM_PROVIDER = process.env.LLM_PROVIDER || 'openai';

const LLM_CONFIG: Record<string, { baseURL: string; apiKey: string | undefined; model: string }> = {
  openai: {
    baseURL: 'https://api.openai.com/v1',
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4o-mini',
  },
  deepseek: {
    baseURL: 'https://api.deepseek.com/v1',
    apiKey: process.env.DEEPSEEK_API_KEY,
    model: 'deepseek-chat',
  },
  openrouter: {
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
    model: 'deepseek/deepseek-chat',
  },
};

const currentConfig = LLM_CONFIG[LLM_PROVIDER];

if (!currentConfig?.apiKey) {
  console.error(`[BISHOP] Missing API key for ${LLM_PROVIDER}`);
  process.exit(1);
}

const openai = new OpenAI({
  baseURL: currentConfig.baseURL,
  apiKey: currentConfig.apiKey,
});

// ============================================
// USER SCOPING
// ============================================

const USER_ID = process.env.USER_ID || process.env.BISHOP_USER_ID;

if (!USER_ID) {
  console.error('[BISHOP] ERROR: No user_id provided');
  console.error('[BISHOP] Set USER_ID environment variable or BISHOP_USER_ID in .env');
  process.exit(1);
}

console.log(`[BISHOP] User scope: ${USER_ID.substring(0, 8)}...`);

// ============================================
// TYPES
// ============================================

type BishopStatus =
  | 'NEW'
  | 'CONTACTED'
  | 'INTERESTED'
  | 'STALLED'
  | 'CLOSED'
  | 'BLACKLISTED'
  // Legacy statuses (backwards compatible)
  | 'INTRO_SENT'
  | 'FOLLOW_UP_NEEDED'
  | 'NUDGE_SENT'
  | 'BREAKUP_SENT'
  | 'ESCALATE_TO_KING';

type Strategy = 'SNIPER_INTRO' | 'VALUE_NUDGE' | 'BREAKUP' | 'NONE';

interface Lead {
  id: string;
  user_id: string;
  name: string;
  email: string;
  company: string;
  linkedin_url?: string;
  bishop_status: BishopStatus;
  last_contact_date: string;
  next_action_due: string;
  notes: string | null;
  context_log?: any[];
}

interface BishopSettings {
  user_id: string;
  linkedin_profile_url: string | null;
  voice_tone: string;
  signature_html: string | null;
  golden_samples: string[];
  blacklisted_domains: string[];
  enable_sniper_intro: boolean;
  enable_value_nudge: boolean;
  enable_breakup: boolean;
  days_to_first_followup: number;
  days_to_second_followup: number;
  days_to_breakup: number;
  persona_prompt: string | null;
}

interface Draft {
  subject: string;
  body: string;
}

// Default settings if none exist
const DEFAULT_SETTINGS: BishopSettings = {
  user_id: USER_ID,
  linkedin_profile_url: null,
  voice_tone: 'Professional',
  signature_html: null,
  golden_samples: [],
  blacklisted_domains: [],
  enable_sniper_intro: true,
  enable_value_nudge: true,
  enable_breakup: true,
  days_to_first_followup: 3,
  days_to_second_followup: 4,
  days_to_breakup: 7,
  persona_prompt: null,
};

// ============================================
// HELPERS
// ============================================

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

function getDomain(email: string): string {
  return email.split('@')[1]?.toLowerCase() || '';
}

function isBlacklisted(email: string, blacklist: string[]): boolean {
  const domain = getDomain(email);
  return blacklist.some((b) => domain.includes(b.toLowerCase()));
}

// ============================================
// FETCH SETTINGS
// ============================================

async function fetchBishopSettings(): Promise<BishopSettings> {
  const { data, error } = await supabase
    .from('bishop_settings')
    .select('*')
    .eq('user_id', USER_ID)
    .single();

  if (error || !data) {
    console.log('[BISHOP] No custom settings found, using defaults');
    return DEFAULT_SETTINGS;
  }

  console.log(`[BISHOP] Loaded settings: voice_tone=${data.voice_tone}, samples=${data.golden_samples?.length || 0}`);
  return data as BishopSettings;
}

// ============================================
// SUBSCRIPTION CHECK
// ============================================

async function checkUserSubscription(): Promise<boolean> {
  console.log('[BISHOP] Checking subscription status...');

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('is_active, subscription_tier, subscription_expires_at')
    .eq('id', USER_ID)
    .single();

  if (error) {
    console.error('[BISHOP] Error fetching profile:', error.message);
    return false;
  }

  if (!profile) {
    console.error('[BISHOP] No profile found for user');
    return false;
  }

  const isActive = profile.is_active === true;
  const notExpired =
    !profile.subscription_expires_at || new Date(profile.subscription_expires_at) > new Date();

  if (!isActive || !notExpired) {
    console.error('[BISHOP] User subscription is not active');
    return false;
  }

  console.log(`[BISHOP] Subscription OK: ${profile.subscription_tier} tier`);
  return true;
}

// ============================================
// STRATEGY RESOLVER
// ============================================

function determineStrategy(lead: Lead, settings: BishopSettings): Strategy {
  const daysSinceContact = daysSince(lead.last_contact_date);
  const status = lead.bishop_status;

  console.log(`  Status: ${status}, Days since contact: ${daysSinceContact}`);

  // Map legacy statuses to new ones
  const isNew = status === 'NEW' || status === 'INTRO_SENT';
  const isContacted =
    status === 'CONTACTED' ||
    status === 'FOLLOW_UP_NEEDED' ||
    status === 'NUDGE_SENT';

  // Terminal states
  if (
    status === 'INTERESTED' ||
    status === 'CLOSED' ||
    status === 'BLACKLISTED' ||
    status === 'BREAKUP_SENT' ||
    status === 'STALLED' ||
    status === 'ESCALATE_TO_KING'
  ) {
    return 'NONE';
  }

  // Strategy 1: Sniper Intro (NEW leads, ≥0 days)
  if (isNew && settings.enable_sniper_intro) {
    if (daysSinceContact >= 0) {
      return 'SNIPER_INTRO';
    }
  }

  // Strategy 2: Value Nudge (CONTACTED, 3-6 days)
  if (isContacted && settings.enable_value_nudge) {
    if (
      daysSinceContact >= settings.days_to_first_followup &&
      daysSinceContact < settings.days_to_breakup
    ) {
      return 'VALUE_NUDGE';
    }
  }

  // Strategy 3: Breakup (CONTACTED, ≥7 days)
  if (isContacted && settings.enable_breakup) {
    if (daysSinceContact >= settings.days_to_breakup) {
      return 'BREAKUP';
    }
  }

  return 'NONE';
}

// ============================================
// PROMPT BUILDING (The Identity Engine)
// ============================================

function buildSystemPrompt(settings: BishopSettings): string {
  let prompt = 'You write short, professional, human-sounding sales emails. Return JSON only.\n\n';

  // Add persona
  if (settings.persona_prompt) {
    prompt += `PERSONA: ${settings.persona_prompt}\n\n`;
  }

  // Add voice tone
  prompt += `VOICE TONE: ${settings.voice_tone}\n`;
  prompt += `- Write in a ${settings.voice_tone.toLowerCase()} style\n`;

  // Add golden samples for few-shot learning
  if (settings.golden_samples && settings.golden_samples.length > 0) {
    prompt += '\nSTYLE EXAMPLES (mimic this style):\n';
    settings.golden_samples.slice(0, 3).forEach((sample, i) => {
      prompt += `Example ${i + 1}:\n${sample}\n\n`;
    });
  }

  prompt += '\nRULES:\n';
  prompt += '- Keep emails SHORT (2-4 sentences)\n';
  prompt += '- Sound human, not robotic\n';
  prompt += '- Do NOT mention AI or automation\n';
  prompt += '- Do NOT say "just checking in" or "following up"\n';
  prompt += '- End with ONE clear call-to-action\n';

  return prompt;
}

function buildUserPrompt(lead: Lead, strategy: Strategy, settings: BishopSettings): string {
  const prompts: Record<string, string> = {
    SNIPER_INTRO: `Write a SHORT intro email (2-4 sentences) to ${lead.name} at ${lead.company}.
This is FIRST CONTACT - they don't know you yet.
- Reference their company if relevant
- Be curious about their challenges
- Ask ONE thoughtful question
- Be value-anchored, not salesy

Return JSON only: {"subject": "...", "body": "..."}`,

    VALUE_NUDGE: `Write a SHORT follow-up email (2-4 sentences) to ${lead.name} at ${lead.company}.
They received an intro email ${daysSince(lead.last_contact_date)} days ago but haven't replied.
- Offer value (insight, case study, or resource)
- OR offer an easy next step
- No pressure or urgency
- Be helpful, not pushy

Return JSON only: {"subject": "...", "body": "..."}`,

    BREAKUP: `Write a SHORT breakup email (2-4 sentences) to ${lead.name} at ${lead.company}.
They haven't replied to multiple emails over ${daysSince(lead.last_contact_date)} days.
- Use negative reverse psychology: "I'll assume this isn't a priority"
- Leave the door open gracefully
- Be professional, not passive-aggressive
- Thank them for their time

Return JSON only: {"subject": "...", "body": "..."}`,
  };

  let prompt = prompts[strategy] || prompts.SNIPER_INTRO;

  // Add signature instruction if available
  if (settings.signature_html) {
    prompt += `\n\nNOTE: Do NOT include a signature - it will be added automatically.`;
  }

  return prompt;
}

// ============================================
// DRAFT GENERATION
// ============================================

async function generateDraft(
  lead: Lead,
  strategy: Strategy,
  settings: BishopSettings
): Promise<Draft> {
  const systemPrompt = buildSystemPrompt(settings);
  const userPrompt = buildUserPrompt(lead, strategy, settings);

  try {
    const response = await openai.chat.completions.create({
      model: currentConfig.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 400,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) throw new Error('Empty LLM response');

    // Parse JSON (handle markdown code blocks)
    let jsonStr = content;
    if (content.includes('```json')) {
      jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (content.includes('```')) {
      jsonStr = content.replace(/```\n?/g, '');
    }

    const parsed = JSON.parse(jsonStr.trim());
    let body = parsed.body;

    // Append signature if configured
    if (settings.signature_html) {
      body += `\n\n${settings.signature_html}`;
    }

    return { subject: parsed.subject, body };
  } catch (error) {
    console.error('[BISHOP] Draft generation error:', error);

    // Fallback drafts
    const fallbacks: Record<string, Draft> = {
      SNIPER_INTRO: {
        subject: `Quick question for ${lead.company}`,
        body: `Hi ${lead.name},\n\nI came across ${lead.company} and was curious about how you're currently handling [relevant challenge].\n\nWould love to hear your thoughts if you have a moment.\n\nBest`,
      },
      VALUE_NUDGE: {
        subject: `Thought you might find this useful - ${lead.company}`,
        body: `Hi ${lead.name},\n\nI know things get busy. Wanted to share a quick insight that might be relevant to what ${lead.company} is working on.\n\nHappy to find 15 minutes if this resonates.\n\nBest`,
      },
      BREAKUP: {
        subject: `Closing the loop - ${lead.company}`,
        body: `Hi ${lead.name},\n\nI'll assume the timing isn't right and close the loop on my end. If anything changes down the road, always happy to reconnect.\n\nWishing you and the team all the best.`,
      },
    };

    return fallbacks[strategy] || fallbacks.SNIPER_INTRO;
  }
}

// ============================================
// STATE TRANSITIONS
// ============================================

function getNextState(
  strategy: Strategy,
  settings: BishopSettings
): { status: BishopStatus; nextActionDue: string | null } {
  switch (strategy) {
    case 'SNIPER_INTRO':
      return {
        status: 'CONTACTED',
        nextActionDue: daysFromNow(settings.days_to_first_followup),
      };

    case 'VALUE_NUDGE':
      return {
        status: 'CONTACTED',
        nextActionDue: daysFromNow(settings.days_to_second_followup),
      };

    case 'BREAKUP':
      return {
        status: 'STALLED',
        nextActionDue: null, // Terminal state
      };

    default:
      throw new Error(`Unknown strategy: ${strategy}`);
  }
}

// ============================================
// PROCESS LEAD
// ============================================

async function processLead(lead: Lead, settings: BishopSettings): Promise<boolean> {
  console.log(`\n[BISHOP] Processing: ${lead.name} @ ${lead.company}`);

  // Check blacklist
  if (isBlacklisted(lead.email, settings.blacklisted_domains)) {
    console.log('  → SKIPPED: Domain is blacklisted');
    await supabase
      .from('leads')
      .update({ bishop_status: 'BLACKLISTED' })
      .eq('id', lead.id);
    return false;
  }

  // Determine strategy
  const strategy = determineStrategy(lead, settings);

  if (strategy === 'NONE') {
    console.log('  → No action needed');
    return false;
  }

  console.log(`  → Strategy: ${strategy}`);

  // Generate draft with persona
  console.log('  → Generating draft...');
  const draft = await generateDraft(lead, strategy, settings);
  console.log(`  → Subject: "${draft.subject}"`);

  // Insert draft into ai_drafts
  const { error: draftError } = await supabase.from('ai_drafts').insert({
    user_id: USER_ID,
    lead_id: lead.id,
    subject: draft.subject,
    body: draft.body,
    plain_text: draft.body.replace(/<[^>]*>/g, ''), // Strip HTML
    persona_used: settings.voice_tone,
    is_ai_draft: true,
    status: 'PENDING_APPROVAL',
    strategy_used: strategy,
    metadata: {
      strategy,
      lead_name: lead.name,
      company: lead.company,
      voice_tone: settings.voice_tone,
      generated_by: 'bishop-sweep-v2',
      generated_at: new Date().toISOString(),
    },
  });

  if (draftError) {
    console.error('  → Draft insert error:', draftError.message);
    return false;
  }

  console.log('  → Draft saved to ai_drafts');

  // Update lead state
  const { status: nextStatus, nextActionDue } = getNextState(strategy, settings);
  const noteMessage = {
    SNIPER_INTRO: 'Sent sniper intro',
    VALUE_NUDGE: 'Sent value nudge',
    BREAKUP: 'Sent breakup email',
  }[strategy];

  // Update context_log
  const newContextEntry = {
    date: new Date().toISOString(),
    strategy,
    subject: draft.subject,
  };

  const contextLog = lead.context_log || [];
  contextLog.push(newContextEntry);

  const { error: updateError } = await supabase
    .from('leads')
    .update({
      bishop_status: nextStatus,
      last_contact_date: new Date().toISOString(),
      next_action_due: nextActionDue,
      notes: appendNote(lead.notes, noteMessage || `Processed with ${strategy}`),
      context_log: contextLog,
    })
    .eq('id', lead.id);

  if (updateError) {
    console.error('  → Lead update error:', updateError.message);
    return false;
  }

  console.log(`  → State: ${lead.bishop_status} → ${nextStatus}`);
  return true;
}

// ============================================
// MAIN SWEEP
// ============================================

async function runSweep() {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║            BISHOP SWEEP (MASTER PRD VERSION)               ║');
  console.log('║                                                             ║');
  console.log('║   NEW → CONTACTED → INTERESTED/STALLED/CLOSED              ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`[BISHOP] Provider: ${LLM_PROVIDER.toUpperCase()}`);
  console.log(`[BISHOP] User: ${USER_ID}`);
  console.log(`[BISHOP] Time: ${new Date().toISOString()}`);
  console.log('');

  // Subscription gate
  const hasSubscription = await checkUserSubscription();
  if (!hasSubscription) {
    console.error('[BISHOP] BLOCKED: User does not have an active subscription');
    console.error('[BISHOP] Subscribe at /subscribe to enable Bishop');
    process.exit(1);
  }

  // Load persona settings
  const settings = await fetchBishopSettings();
  console.log(`[BISHOP] Voice: ${settings.voice_tone}`);
  console.log(`[BISHOP] Strategies: intro=${settings.enable_sniper_intro}, nudge=${settings.enable_value_nudge}, breakup=${settings.enable_breakup}`);
  console.log(`[BISHOP] Timing: ${settings.days_to_first_followup}d → ${settings.days_to_second_followup}d → ${settings.days_to_breakup}d`);
  console.log(`[BISHOP] Blacklist: ${settings.blacklisted_domains.length} domains`);
  console.log('');

  // Fetch eligible leads
  console.log('[BISHOP] Fetching eligible leads...');

  const { data: leads, error } = await supabase
    .from('leads')
    .select('id, user_id, name, email, company, linkedin_url, bishop_status, last_contact_date, next_action_due, notes, context_log')
    .eq('user_id', USER_ID)
    .or('next_action_due.lte.now(),next_action_due.is.null')
    .not('bishop_status', 'in', '(INTERESTED,CLOSED,BLACKLISTED,STALLED,BREAKUP_SENT,ESCALATE_TO_KING)');

  if (error) {
    console.error('[BISHOP] Sweep query failed:', error.message);
    process.exit(1);
  }

  if (!leads || leads.length === 0) {
    console.log('[BISHOP] No leads due for action.');
    console.log('[BISHOP] Run seed-leads.ts first: npx tsx scripts/seed-leads.ts');
    return;
  }

  console.log(`[BISHOP] Found ${leads.length} leads to process`);
  console.log('═'.repeat(60));

  // Process each lead
  let draftsCreated = 0;

  for (const lead of leads as Lead[]) {
    const created = await processLead(lead, settings);
    if (created) draftsCreated++;
  }

  // Summary
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                    SWEEP COMPLETE                          ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`  Leads processed: ${leads.length}`);
  console.log(`  Drafts created:  ${draftsCreated}`);
  console.log('');
  console.log('[BISHOP] Drafts are in ai_drafts table with status PENDING_APPROVAL');
  console.log('[BISHOP] Review in Command Center: /command-center');
  console.log('');
}

// Run
runSweep().catch(console.error);
