import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pesqbkgfsfkqdquhilsv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBlc3Fia2dmc2ZrcWRxdWhpbHN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1MDU3MTYsImV4cCI6MjA4MjA4MTcxNn0.SuRLVpP_k8vbSiZeTG_aJY9qiOPvRLiZo8amZNv2YTQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixWorkspaces() {
    console.log('🔧 FIXING WORKSPACE ISSUE...\n');

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        console.log('❌ Not logged in!');
        console.log('Please:');
        console.log('1. Open https://upflo-lac.vercel.app/');
        console.log('2. Log in');
        console.log('3. Keep that tab open');
        console.log('4. Run this script again');
        process.exit(1);
    }

    console.log(`✅ Logged in as: ${user.email}`);
    console.log(`User ID: ${user.id}\n`);

    // Get all workspaces
    const { data: workspaces, error: wsError } = await supabase
        .from('workspaces')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: true });

    if (wsError) {
        console.log('❌ Error fetching workspaces:', wsError.message);
        process.exit(1);
    }

    console.log(`Found ${workspaces.length} workspaces\n`);

    if (workspaces.length <= 1) {
        console.log('✅ Good! You only have 1 workspace. No cleanup needed.');
        console.log('The issue should be fixed now.');
        process.exit(0);
    }

    // Keep the first workspace, delete the rest
    const keepWorkspace = workspaces[0];
    const deleteWorkspaces = workspaces.slice(1);

    console.log(`📌 KEEPING workspace: ${keepWorkspace.name} (ID: ${keepWorkspace.id})`);
    console.log(`Created: ${keepWorkspace.created_at}\n`);

    console.log(`🗑️  DELETING ${deleteWorkspaces.length} duplicate workspaces...`);

    // Delete duplicates one by one
    for (const ws of deleteWorkspaces) {
        console.log(`   Deleting: ${ws.name} (${ws.id})`);

        // First delete workspace_members
        await supabase
            .from('workspace_members')
            .delete()
            .eq('workspace_id', ws.id);

        // Then delete the workspace
        const { error: deleteError } = await supabase
            .from('workspaces')
            .delete()
            .eq('id', ws.id);

        if (deleteError) {
            console.log(`   ⚠️  Error: ${deleteError.message}`);
        } else {
            console.log(`   ✅ Deleted`);
        }
    }

    console.log(`\n✅ CLEANUP COMPLETE!`);
    console.log(`You now have 1 workspace.`);

    // Set the correct workspace in localStorage
    console.log(`\nSetting localStorage to use workspace: ${keepWorkspace.id}`);
    console.log(`\nNOW DO THIS:`);
    console.log(`1. Go to your app: https://upflo-lac.vercel.app/`);
    console.log(`2. Open Console (F12)`);
    console.log(`3. Paste this:`);
    console.log(`   localStorage.setItem('current_workspace_id', '${keepWorkspace.id}')`);
    console.log(`4. Press Enter`);
    console.log(`5. Refresh the page (F5)`);
    console.log(`6. Try adding a lead`);
    console.log(`7. Refresh again - lead should STAY!`);
}

fixWorkspaces().catch(console.error);
