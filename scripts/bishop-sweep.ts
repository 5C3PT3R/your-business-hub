/**
 * DAY 4 + DAY 5 + DAY 6: BISHOP SWEEP SCRIPT (MULTI-TENANT + GATED)
 *
 * Daily sweep over leads table.
 * Applies: INTRO_SENT → FOLLOW_UP_NEEDED → NUDGE_SENT → BREAKUP_SENT
 *
 * Rules (non-negotiable):
 * - Strategy 1 (Intro Follow-up): INTRO_SENT + ≥2 days → FOLLOW_UP_NEEDED
 * - Strategy 2 (Nudge): FOLLOW_UP_NEEDED + ≥3 days → NUDGE_SENT
 * - Strategy 3 (Breakup): NUDGE_SENT + ≥4 days → BREAKUP_SENT
 *
 * DAY 5 ADDITIONS:
 * - USER_ID environment variable required for multi-tenancy
 * - Bishop only processes leads belonging to the specified user
 * - Drafts are created with user_id attached
 *
 * DAY 6 ADDITIONS:
 * - Subscription gate: Bishop checks user's is_active status before running
 * - Unsubscribed users are blocked from running Bishop
 *
 * Drafts are STORED ONLY. No emails sent.
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
// USER SCOPING (DAY 5: MULTI-TENANCY)
// ============================================

// User ID can be passed via:
// 1. USER_ID environment variable (runtime)
// 2. BISHOP_USER_ID in .env (default)
const USER_ID = process.env.USER_ID || process.env.BISHOP_USER_ID;

if (!USER_ID) {
  console.error('[BISHOP] ERROR: No user_id provided');
  console.error('[BISHOP] Set USER_ID environment variable or BISHOP_USER_ID in .env');
  console.error('[BISHOP] Example: USER_ID=<your-uuid> npx tsx scripts/bishop-sweep.ts');
  process.exit(1);
}

console.log(`[BISHOP] User scope: ${USER_ID.substring(0, 8)}...`);

// ============================================
// DAY 6: SUBSCRIPTION SAFETY CHECK
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

  // Check if subscription is active
  const isActive = profile.is_active === true;
  const notExpired = !profile.subscription_expires_at ||
    new Date(profile.subscription_expires_at) > new Date();

  if (!isActive || !notExpired) {
    console.error('[BISHOP] User subscription is not active');
    console.error(`  is_active: ${profile.is_active}`);
    console.error(`  tier: ${profile.subscription_tier}`);
    console.error(`  expires_at: ${profile.subscription_expires_at || 'N/A'}`);
    return false;
  }

  console.log(`[BISHOP] Subscription OK: ${profile.subscription_tier} tier`);
  return true;
}

// ============================================
// TYPES
// ============================================

type BishopStatus =
  | 'INTRO_SENT'
  | 'FOLLOW_UP_NEEDED'
  | 'NUDGE_SENT'
  | 'BREAKUP_SENT'
  | 'ESCALATE_TO_KING';

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

type Strategy = 'INTRO_FOLLOW_UP' | 'NUDGE' | 'BREAKUP' | 'NONE' | 'ESCALATE';

// ============================================
// TIMING CONSTANTS (Hardcoded per PRD)
// ============================================

const TIMING = {
  INTRO_FOLLOW_UP_DAYS: 2,    // ≥2 days since last contact
  NUDGE_DAYS: 3,              // ≥3 days since last contact
  BREAKUP_DAYS: 4,            // ≥4 days since last contact
  NEXT_ACTION_INTRO: 3,       // Next action in 3 days
  NEXT_ACTION_NUDGE: 4,       // Next action in 4 days
};

// ============================================
// HELPERS
// ============================================

function daysSince(dateStr: string): number {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
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

// ============================================
// STRATEGY RESOLVER
// ============================================

function determineStrategy(lead: Lead): Strategy {
  const daysSinceContact = daysSince(lead.last_contact_date);

  console.log(`  Status: ${lead.bishop_status}, Days since contact: ${daysSinceContact}`);

  switch (lead.bishop_status) {
    case 'INTRO_SENT':
      // Strategy 1: Intro Follow-up (≥2 days)
      if (daysSinceContact >= TIMING.INTRO_FOLLOW_UP_DAYS) {
        return 'INTRO_FOLLOW_UP';
      }
      break;

    case 'FOLLOW_UP_NEEDED':
      // Strategy 2: Nudge (≥3 days)
      if (daysSinceContact >= TIMING.NUDGE_DAYS) {
        return 'NUDGE';
      }
      break;

    case 'NUDGE_SENT':
      // Strategy 3: Breakup (≥4 days)
      if (daysSinceContact >= TIMING.BREAKUP_DAYS) {
        return 'BREAKUP';
      }
      break;

    case 'BREAKUP_SENT':
    case 'ESCALATE_TO_KING':
      // Terminal states - no action
      return 'NONE';
  }

  return 'NONE';
}

// ============================================
// DRAFT GENERATION
// ============================================

interface Draft {
  subject: string;
  body: string;
}

async function generateDraft(lead: Lead, strategy: Strategy): Promise<Draft> {
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
  if (!prompt) {
    throw new Error(`No prompt for strategy: ${strategy}`);
  }

  try {
    const response = await openai.chat.completions.create({
      model: currentConfig.model,
      messages: [
        {
          role: 'system',
          content: 'You write short, professional, human-sounding emails. Return JSON only.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 300,
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

// ============================================
// STATE TRANSITIONS
// ============================================

function getNextState(strategy: Strategy): { status: BishopStatus; nextActionDue: string | null } {
  switch (strategy) {
    case 'INTRO_FOLLOW_UP':
      return {
        status: 'FOLLOW_UP_NEEDED',
        nextActionDue: daysFromNow(TIMING.NEXT_ACTION_INTRO),
      };

    case 'NUDGE':
      return {
        status: 'NUDGE_SENT',
        nextActionDue: daysFromNow(TIMING.NEXT_ACTION_NUDGE),
      };

    case 'BREAKUP':
      return {
        status: 'BREAKUP_SENT',
        nextActionDue: null, // Terminal state
      };

    default:
      throw new Error(`Unknown strategy: ${strategy}`);
  }
}

// ============================================
// PROCESS LEAD
// ============================================

async function processLead(lead: Lead): Promise<boolean> {
  console.log(`\n[BISHOP] Processing: ${lead.name} @ ${lead.company}`);

  // Determine strategy
  const strategy = determineStrategy(lead);

  if (strategy === 'NONE') {
    console.log('  → No action needed');
    return false;
  }

  if (strategy === 'ESCALATE') {
    console.log('  → Escalating to King');
    await supabase
      .from('leads')
      .update({
        bishop_status: 'ESCALATE_TO_KING',
        notes: appendNote(lead.notes, 'Escalated due to uncertainty'),
      })
      .eq('id', lead.id);
    return false;
  }

  console.log(`  → Strategy: ${strategy}`);

  // Generate draft
  console.log('  → Generating draft...');
  const draft = await generateDraft(lead, strategy);
  console.log(`  → Subject: "${draft.subject}"`);

  // Insert draft into ai_drafts (DAY 5: Include user_id for multi-tenancy)
  const { error: draftError } = await supabase.from('ai_drafts').insert({
    user_id: USER_ID, // CRITICAL: Attach user_id for RLS
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
      generated_by: 'bishop-sweep',
      generated_at: new Date().toISOString(),
    },
  });

  if (draftError) {
    console.error('  → Draft insert error:', draftError.message);
    return false;
  }

  console.log('  → Draft saved to ai_drafts');

  // Update lead state
  const { status: nextStatus, nextActionDue } = getNextState(strategy);
  const noteMessage = {
    INTRO_FOLLOW_UP: 'Sent intro follow-up',
    NUDGE: 'Sent nudge',
    BREAKUP: 'Sent breakup',
  }[strategy];

  const { error: updateError } = await supabase
    .from('leads')
    .update({
      bishop_status: nextStatus,
      last_contact_date: new Date().toISOString(),
      next_action_due: nextActionDue,
      notes: appendNote(lead.notes, noteMessage || `Processed with ${strategy}`),
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
  console.log('║       BISHOP SWEEP (MULTI-TENANT / DAY 6)                  ║');
  console.log('║                                                             ║');
  console.log('║   INTRO_SENT → FOLLOW_UP_NEEDED → NUDGE_SENT → BREAKUP    ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`[BISHOP] Provider: ${LLM_PROVIDER.toUpperCase()}`);
  console.log(`[BISHOP] User: ${USER_ID}`);
  console.log(`[BISHOP] Time: ${new Date().toISOString()}`);
  console.log('');

  // DAY 6: Subscription gate - Bishop will not run for unsubscribed users
  const hasSubscription = await checkUserSubscription();
  if (!hasSubscription) {
    console.error('[BISHOP] BLOCKED: User does not have an active subscription');
    console.error('[BISHOP] Subscribe at /subscribe to enable Bishop');
    process.exit(1);
  }

  // Phase 1: The Sweep
  console.log('[BISHOP] Phase 1: Fetching eligible leads...');

  // DAY 5: Filter by user_id for multi-tenancy
  const { data: leads, error } = await supabase
    .from('leads')
    .select('id, user_id, name, email, company, bishop_status, last_contact_date, next_action_due, notes')
    .eq('user_id', USER_ID) // CRITICAL: Only process this user's leads
    .lte('next_action_due', new Date().toISOString())
    .not('bishop_status', 'eq', 'ESCALATE_TO_KING')
    .not('bishop_status', 'eq', 'BREAKUP_SENT');

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

  // Phase 2 & 3: Process each lead
  let draftsCreated = 0;

  for (const lead of leads as Lead[]) {
    const created = await processLead(lead);
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

  if (draftsCreated === 3) {
    console.log('✓ DAY 4 COMPLETE: 3 drafts generated');
  }
}

// Run
runSweep().catch(console.error);
