#!/usr/bin/env node

/**
 * Database Fix Runner
 * Applies critical database fixes to Supabase
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://pesqbkgfsfkqdquhilsv.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY not found in environment variables');
  console.log('\nPlease run the SQL scripts manually in Supabase SQL Editor:');
  console.log('1. https://supabase.com/dashboard/project/pesqbkgfsfkqdquhilsv/sql/new');
  console.log('2. Copy contents of fix_database.sql and run');
  console.log('3. Copy contents of fix_deals_table.sql and run');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function runSQL(filename, description) {
  console.log(`\n📝 ${description}...`);

  try {
    const sql = readFileSync(join(__dirname, filename), 'utf-8');

    // Split by semicolons but keep DO blocks together
    const statements = sql
      .split(/;\s*(?=(?:[^$]*\$\$[^$]*\$\$)*[^$]*$)/g)
      .filter(s => s.trim() && !s.trim().startsWith('--'))
      .map(s => s.trim());

    for (const statement of statements) {
      if (statement.startsWith('SELECT') && statement.includes('column_name')) {
        // Skip verification queries
        continue;
      }

      const { error } = await supabase.rpc('exec_sql', { sql_query: statement });

      if (error) {
        // Ignore "already exists" errors
        if (error.message.includes('already exists') ||
            error.message.includes('does not exist')) {
          console.log(`⚠️  Warning: ${error.message} (continuing...)`);
        } else {
          throw error;
        }
      }
    }

    console.log(`✅ ${description} completed`);
    return true;
  } catch (error) {
    console.error(`❌ Error in ${description}:`, error.message);
    return false;
  }
}

async function verifyTables() {
  console.log('\n🔍 Verifying database structure...');

  try {
    // Check leads table
    const { data: leadsColumns, error: leadsError } = await supabase
      .from('leads')
      .select('*')
      .limit(0);

    if (leadsError) {
      console.log('❌ Leads table check failed:', leadsError.message);
    } else {
      console.log('✅ Leads table exists');
    }

    // Check deals table
    const { data: dealsColumns, error: dealsError } = await supabase
      .from('deals')
      .select('*')
      .limit(0);

    if (dealsError) {
      console.log('❌ Deals table check failed:', dealsError.message);
    } else {
      console.log('✅ Deals table exists');
    }

    // Check contacts table
    const { data: contactsColumns, error: contactsError } = await supabase
      .from('contacts')
      .select('*')
      .limit(0);

    if (contactsError) {
      console.log('❌ Contacts table check failed:', contactsError.message);
    } else {
      console.log('✅ Contacts table exists');
    }

    return !leadsError && !dealsError && !contactsError;
  } catch (error) {
    console.error('Error during verification:', error);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting database fixes...\n');
  console.log('Target database:', SUPABASE_URL);

  const step1 = await runSQL('fix_database.sql', 'Fixing leads table');
  const step2 = await runSQL('fix_deals_table.sql', 'Creating deals and contacts tables');

  if (step1 && step2) {
    console.log('\n✅ All fixes applied successfully!');

    const verified = await verifyTables();

    if (verified) {
      console.log('\n🎉 Database is ready! All tables verified.');
      console.log('\n📋 Next steps:');
      console.log('1. Go to https://upflo-lac.vercel.app/');
      console.log('2. Add a new lead');
      console.log('3. Refresh the page - lead should persist!');
      console.log('4. Try the AI Agent with a conversation');
    } else {
      console.log('\n⚠️  Some tables need manual verification');
    }
  } else {
    console.log('\n❌ Some fixes failed. Please run scripts manually in Supabase SQL Editor.');
  }
}

main().catch(console.error);
