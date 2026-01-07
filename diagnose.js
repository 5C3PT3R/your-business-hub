import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pesqbkgfsfkqdquhilsv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBlc3Fia2dmc2ZrcWRxdWhpbHN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1MDU3MTYsImV4cCI6MjA4MjA4MTcxNn0.SuRLVpP_k8vbSiZeTG_aJY9qiOPvRLiZo8amZNv2YTQ';

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing environment variables!');
    console.log('VITE_SUPABASE_URL:', supabaseUrl);
    console.log('VITE_SUPABASE_PUBLISHABLE_KEY:', supabaseKey ? 'Present' : 'Missing');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
    console.log('🔍 DIAGNOSING DATABASE ISSUE...\n');

    // Check auth
    console.log('1. Checking Authentication...');
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        console.log('❌ Not authenticated. Please log in first at https://upflo-lac.vercel.app/');
        console.log('   Run this script AFTER logging in.');
        return;
    }
    console.log(`✅ Logged in as: ${user.email}`);
    console.log(`   User ID: ${user.id}\n`);

    // Check workspaces
    console.log('2. Checking Workspaces...');
    const { data: workspaces, error: wsError } = await supabase
        .from('workspaces')
        .select('*');

    if (wsError) {
        console.log('❌ Workspace error:', wsError.message);
        return;
    }

    if (!workspaces || workspaces.length === 0) {
        console.log('❌ No workspace found!');
        console.log('   Create a workspace in the app first.');
        return;
    }

    console.log(`✅ Found ${workspaces.length} workspace(s):`);
    workspaces.forEach(ws => {
        console.log(`   - ${ws.name} (ID: ${ws.id})`);
    });
    const workspace = workspaces[0];
    console.log(`   Using workspace: ${workspace.name}\n`);

    // Check workspace membership
    console.log('3. Checking Workspace Membership...');
    const { data: membership, error: memberError } = await supabase
        .from('workspace_members')
        .select('*')
        .eq('workspace_id', workspace.id)
        .eq('user_id', user.id)
        .single();

    if (memberError) {
        console.log('❌ NOT A MEMBER of this workspace!');
        console.log('   This is why you can\'t see data!');
        console.log('\n🔧 FIXING: Adding you as a member...');

        const { error: insertError } = await supabase
            .from('workspace_members')
            .insert({
                workspace_id: workspace.id,
                user_id: user.id,
                role: 'owner'
            });

        if (insertError) {
            console.log('❌ Failed to add membership:', insertError.message);
        } else {
            console.log('✅ Added you as a member!\n');
        }
    } else {
        console.log(`✅ Member with role: ${membership.role}\n`);
    }

    // Check leads table structure
    console.log('4. Checking Leads Table Structure...');
    const { data: leads, error: leadsError } = await supabase
        .from('leads')
        .select('*')
        .limit(1);

    if (leadsError) {
        console.log('❌ Leads table error:', leadsError.message);
        console.log('   The table might not exist or has wrong columns.');
        return;
    }
    console.log('✅ Leads table accessible\n');

    // Try to create a test lead
    console.log('5. Testing Lead Creation...');
    const testLead = {
        name: 'DIAGNOSTIC TEST ' + Date.now(),
        email: 'test@diagnostic.com',
        company: 'Test Corp',
        status: 'new',
        value: 1000,
        user_id: user.id,
        workspace_id: workspace.id
    };

    const { data: newLead, error: createError } = await supabase
        .from('leads')
        .insert(testLead)
        .select()
        .single();

    if (createError) {
        console.log('❌ FAILED TO CREATE LEAD!');
        console.log('   Error:', createError.message);
        console.log('   Details:', createError);

        if (createError.message.includes('column') || createError.message.includes('does not exist')) {
            console.log('\n💡 SOLUTION: The leads table is missing columns!');
            console.log('   Run the FIX_EVERYTHING.sql script in Supabase SQL Editor.');
        }

        if (createError.message.includes('policy') || createError.message.includes('permission')) {
            console.log('\n💡 SOLUTION: RLS policies are blocking you!');
            console.log('   Run the FIX_EVERYTHING.sql script to fix policies.');
        }
        return;
    }

    console.log('✅ Created test lead:', newLead.id);
    console.log(`   Name: ${newLead.name}\n`);

    // Try to fetch it back
    console.log('6. Testing Lead Retrieval...');
    const { data: fetchedLead, error: fetchError } = await supabase
        .from('leads')
        .select('*')
        .eq('id', newLead.id)
        .single();

    if (fetchError || !fetchedLead) {
        console.log('❌ CANNOT RETRIEVE THE LEAD WE JUST CREATED!');
        console.log('   Error:', fetchError?.message);
        console.log('\n💡 PROBLEM FOUND: RLS policies are blocking SELECT queries!');
        console.log('   This is why data disappears on refresh.');
        console.log('   Run the FIX_EVERYTHING.sql script to fix policies.');
        return;
    }

    console.log('✅ Retrieved lead successfully!\n');

    // Check all leads for this workspace
    console.log('7. Checking All Leads in Workspace...');
    const { data: allLeads, error: allError } = await supabase
        .from('leads')
        .select('*')
        .eq('workspace_id', workspace.id);

    if (allError) {
        console.log('❌ Error fetching leads:', allError.message);
    } else {
        console.log(`✅ Found ${allLeads.length} lead(s) in workspace:`);
        allLeads.forEach(lead => {
            console.log(`   - ${lead.name} (${lead.email || 'no email'})`);
        });
    }

    // Clean up test lead
    console.log('\n8. Cleaning up test data...');
    await supabase.from('leads').delete().eq('id', newLead.id);
    console.log('✅ Test lead deleted\n');

    console.log('='.repeat(60));
    console.log('✅ DIAGNOSIS COMPLETE - Everything is working!');
    console.log('='.repeat(60));
    console.log('\nIf you still see issues in the app:');
    console.log('1. Log out and log back in');
    console.log('2. Clear browser cache');
    console.log('3. Check browser console for errors (F12)');
}

diagnose().catch(console.error);
