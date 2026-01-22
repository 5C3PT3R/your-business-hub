/**
 * DAY 4 + DAY 5: SEED LEADS SCRIPT (MULTI-TENANT)
 *
 * Creates exactly 3 test leads for Bishop sweep testing:
 * 1. Satya - INTRO_SENT (3 days ago)
 * 2. Sam - FOLLOW_UP_NEEDED (4 days ago)
 * 3. Mark - NUDGE_SENT (5 days ago)
 *
 * DAY 5: Requires USER_ID for multi-tenancy
 *
 * Run: USER_ID=<uuid> npx tsx scripts/seed-leads.ts
 * Or:  npx tsx scripts/seed-leads.ts (uses BISHOP_USER_ID from .env)
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// Supabase setup
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('[SEED] Missing Supabase credentials');
  console.error('Required: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// DAY 5: User scoping for multi-tenancy
const USER_ID = process.env.USER_ID || process.env.BISHOP_USER_ID;

if (!USER_ID) {
  console.error('[SEED] ERROR: No user_id provided');
  console.error('[SEED] Set USER_ID environment variable or BISHOP_USER_ID in .env');
  console.error('[SEED] Example: USER_ID=<your-uuid> npx tsx scripts/seed-leads.ts');
  process.exit(1);
}

console.log(`[SEED] User scope: ${USER_ID.substring(0, 8)}...`);

// Helper to calculate days ago
function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

// The exact 3 leads from PRD (DAY 5: includes user_id)
const TEST_LEADS = [
  {
    user_id: USER_ID, // DAY 5: Attach to current user
    name: 'Satya Nadella',
    email: 'satya@microsoft.com',
    company: 'Microsoft',
    bishop_status: 'INTRO_SENT',
    last_contact_date: daysAgo(3).toISOString(),
    next_action_due: daysAgo(1).toISOString(), // Yesterday - eligible now
    notes: 'Initial intro sent. CEO of Microsoft.',
  },
  {
    user_id: USER_ID, // DAY 5: Attach to current user
    name: 'Sam Altman',
    email: 'sam@openai.com',
    company: 'OpenAI',
    bishop_status: 'FOLLOW_UP_NEEDED',
    last_contact_date: daysAgo(4).toISOString(),
    next_action_due: daysAgo(1).toISOString(), // Yesterday - eligible now
    notes: 'Intro sent, no reply yet. CEO of OpenAI.',
  },
  {
    user_id: USER_ID, // DAY 5: Attach to current user
    name: 'Mark Zuckerberg',
    email: 'mark@meta.com',
    company: 'Meta',
    bishop_status: 'NUDGE_SENT',
    last_contact_date: daysAgo(5).toISOString(),
    next_action_due: daysAgo(1).toISOString(), // Yesterday - eligible now
    notes: 'Nudge sent, still no reply. CEO of Meta.',
  },
];

async function seedLeads() {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║      SEED LEADS FOR BISHOP (MULTI-TENANT / DAY 5)         ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`[SEED] User: ${USER_ID}`);
  console.log('');

  // First, check if leads already exist
  const { data: existingLeads } = await supabase
    .from('leads')
    .select('email')
    .in('email', TEST_LEADS.map(l => l.email));

  if (existingLeads && existingLeads.length > 0) {
    console.log('[SEED] Found existing test leads. Updating instead of inserting...');

    for (const lead of TEST_LEADS) {
      const { error } = await supabase
        .from('leads')
        .update({
          user_id: lead.user_id, // DAY 5: Ensure user_id is set
          name: lead.name,
          company: lead.company,
          bishop_status: lead.bishop_status,
          last_contact_date: lead.last_contact_date,
          next_action_due: lead.next_action_due,
          notes: lead.notes,
        })
        .eq('email', lead.email);

      if (error) {
        console.error(`[SEED] Error updating ${lead.name}:`, error.message);
      } else {
        console.log(`[SEED] Updated: ${lead.name} (${lead.bishop_status})`);
      }
    }
  } else {
    console.log('[SEED] Inserting 3 test leads...');

    for (const lead of TEST_LEADS) {
      const { error } = await supabase.from('leads').insert({
        user_id: lead.user_id, // DAY 5: Required for multi-tenancy
        name: lead.name,
        email: lead.email,
        company: lead.company,
        bishop_status: lead.bishop_status,
        last_contact_date: lead.last_contact_date,
        next_action_due: lead.next_action_due,
        notes: lead.notes,
        status: 'new', // Required existing column
      });

      if (error) {
        console.error(`[SEED] Error inserting ${lead.name}:`, error.message);
      } else {
        console.log(`[SEED] Inserted: ${lead.name} (${lead.bishop_status})`);
      }
    }
  }

  // Verify
  const { data: verifyLeads, error: verifyError } = await supabase
    .from('leads')
    .select('name, email, company, bishop_status, last_contact_date, next_action_due')
    .in('email', TEST_LEADS.map(l => l.email));

  if (verifyError) {
    console.error('[SEED] Verification failed:', verifyError.message);
    process.exit(1);
  }

  console.log('');
  console.log('[SEED] Verification - Leads in database:');
  console.log('─'.repeat(60));

  for (const lead of verifyLeads || []) {
    const daysSinceContact = Math.floor(
      (Date.now() - new Date(lead.last_contact_date).getTime()) / (1000 * 60 * 60 * 24)
    );
    console.log(`  ${lead.name} @ ${lead.company}`);
    console.log(`    Status: ${lead.bishop_status}`);
    console.log(`    Last contact: ${daysSinceContact} days ago`);
    console.log(`    Next action due: ${new Date(lead.next_action_due).toLocaleDateString()}`);
    console.log('');
  }

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                    SEEDING COMPLETE                        ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('[SEED] 3 leads ready for Bishop sweep');
  console.log('[SEED] Run: npx tsx scripts/bishop-sweep.ts');
  console.log('');
}

seedLeads().catch(console.error);
