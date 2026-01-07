// ============================================
// DELETE ALL DUPLICATE WORKSPACES - FIXED VERSION
// ============================================
// 1. Open your app: https://upflo-lac.vercel.app/
// 2. Open Console (F12)
// 3. Paste this entire script and press Enter

(async () => {
    console.log('🔧 DELETING DUPLICATE WORKSPACES...\n');

    // Import Supabase dynamically
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');

    const supabase = createClient(
        'https://pesqbkgfsfkqdquhilsv.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBlc3Fia2dmc2ZrcWRxdWhpbHN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1MDU3MTYsImV4cCI6MjA4MjA4MTcxNn0.SuRLVpP_k8vbSiZeTG_aJY9qiOPvRLiZo8amZNv2YTQ'
    );

    // Get the session from localStorage (since the app is already logged in)
    const sessionStr = localStorage.getItem('sb-pesqbkgfsfkqdquhilsv-auth-token');
    if (!sessionStr) {
        console.error('❌ No session found! Are you logged in?');
        return;
    }

    const session = JSON.parse(sessionStr);
    if (!session || !session.access_token) {
        console.error('❌ Invalid session! Please log in again.');
        return;
    }

    // Set the session
    await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token
    });

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        console.error('❌ Not logged in!', authError);
        return;
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
        console.error('❌ Error fetching workspaces:', wsError.message);
        return;
    }

    console.log(`Found ${workspaces.length} workspaces\n`);

    if (workspaces.length <= 1) {
        console.log('✅ You only have 1 workspace. No cleanup needed.');
        return;
    }

    // Keep the FIRST workspace (oldest one)
    const keepWorkspace = workspaces[0];
    const deleteWorkspaces = workspaces.slice(1);

    console.log(`📌 KEEPING: ${keepWorkspace.name} (${keepWorkspace.id})`);
    console.log(`🗑️  DELETING ${deleteWorkspaces.length} duplicates...\n`);

    // Delete workspace_members first, then workspaces
    for (const ws of deleteWorkspaces) {
        console.log(`   Deleting: ${ws.name} (${ws.id})`);

        // Delete members
        await supabase
            .from('workspace_members')
            .delete()
            .eq('workspace_id', ws.id);

        // Delete workspace
        const { error: deleteError } = await supabase
            .from('workspaces')
            .delete()
            .eq('id', ws.id);

        if (deleteError) {
            console.error(`   ⚠️  Error: ${deleteError.message}`);
        } else {
            console.log(`   ✅ Deleted`);
        }
    }

    console.log(`\n✅ CLEANUP COMPLETE!`);
    console.log(`You now have 1 workspace: ${keepWorkspace.id}`);

    // Set the correct workspace in localStorage
    localStorage.setItem('current_workspace_id', keepWorkspace.id);
    console.log(`✅ Set localStorage to correct workspace`);

    console.log(`\n🔄 Refreshing in 2 seconds...`);
    setTimeout(() => location.reload(), 2000);
})();
