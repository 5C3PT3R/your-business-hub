/**
 * Apply Bishop schema changes directly
 * Run: npx tsx scripts/apply-bishop-schema.ts
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applySchema() {
  console.log('[SCHEMA] Applying Bishop schema changes...');

  // Run each ALTER separately to handle if columns already exist
  const alterStatements = [
    `ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS last_contact_date TIMESTAMPTZ`,
    `ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS next_action_due TIMESTAMPTZ`,
    `ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS notes TEXT`,
    `ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS bishop_status TEXT DEFAULT 'INTRO_SENT'`,
  ];

  for (const sql of alterStatements) {
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql }).single();
    if (error) {
      // Try direct approach via REST
      console.log(`[SCHEMA] Trying alternative for: ${sql.substring(0, 60)}...`);
    } else {
      console.log(`[SCHEMA] Applied: ${sql.substring(0, 60)}...`);
    }
  }

  // Verify columns exist
  const { data, error } = await supabase
    .from('leads')
    .select('id, bishop_status, last_contact_date, next_action_due, notes')
    .limit(1);

  if (error) {
    console.error('[SCHEMA] Verification failed:', error.message);
    console.log('[SCHEMA] You may need to run this SQL manually in Supabase Dashboard:');
    console.log('');
    console.log(`
-- Run in Supabase SQL Editor:
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS last_contact_date TIMESTAMPTZ;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS next_action_due TIMESTAMPTZ;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS bishop_status TEXT DEFAULT 'INTRO_SENT';
    `);
    process.exit(1);
  }

  console.log('[SCHEMA] Schema verified successfully!');
}

applySchema().catch(console.error);
