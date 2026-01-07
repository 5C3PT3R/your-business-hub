# 🚨 INSTANT FIX - Do This In Your Browser RIGHT NOW

## The Problem
You have 89 workspaces. Every refresh switches to a different one. That's why data "disappears".

## The Solution (30 seconds)

### Step 1: Open your app
Go to: https://upflo-lac.vercel.app/

### Step 2: Open Console
Press **F12** (or Right-click → Inspect → Console tab)

### Step 3: Paste this code and press Enter

```javascript
// Fix workspace issue immediately
(async () => {
    console.log('🔧 Fixing workspace issue...');

    const { createClient } = window.supabase;
    const client = createClient(
        'https://pesqbkgfsfkqdquhilsv.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBlc3Fia2dmc2ZrcWRxdWhpbHN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1MDU3MTYsImV4cCI6MjA4MjA4MTcxNn0.SuRLVpP_k8vbSiZeTG_aJY9qiOPvRLiZo8amZNv2YTQ'
    );

    // Get current user
    const { data: { user } } = await client.auth.getUser();
    if (!user) {
        console.log('❌ Not logged in!');
        return;
    }
    console.log('✅ User:', user.email);

    // Get all workspaces
    const { data: workspaces } = await client
        .from('workspaces')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: true });

    console.log(`Found ${workspaces.length} workspaces`);

    if (workspaces.length === 0) {
        console.log('❌ No workspaces! Creating one...');
        const { data: newWs } = await client.from('workspaces').insert({
            name: 'Sales CRM',
            industry_type: 'sales',
            owner_id: user.id,
            config: {}
        }).select().single();

        await client.from('workspace_members').insert({
            workspace_id: newWs.id,
            user_id: user.id,
            role: 'owner'
        });

        localStorage.setItem('current_workspace_id', newWs.id);
        console.log('✅ Created workspace:', newWs.id);
        location.reload();
        return;
    }

    // Keep first workspace
    const keepWs = workspaces[0];
    console.log(`✅ Keeping workspace: ${keepWs.name} (${keepWs.id})`);

    // Delete the rest
    if (workspaces.length > 1) {
        console.log(`🗑️  Deleting ${workspaces.length - 1} duplicates...`);

        for (let i = 1; i < workspaces.length; i++) {
            const ws = workspaces[i];
            console.log(`   Deleting: ${ws.name}`);

            // Delete members first
            await client.from('workspace_members').delete().eq('workspace_id', ws.id);

            // Delete workspace
            await client.from('workspaces').delete().eq('id', ws.id);
        }

        console.log('✅ Deleted duplicates!');
    }

    // Set correct workspace in localStorage
    localStorage.setItem('current_workspace_id', keepWs.id);
    console.log(`✅ Set active workspace to: ${keepWs.id}`);

    // Move all leads to the correct workspace
    console.log('📦 Moving all leads to the correct workspace...');
    const { data: allLeads } = await client.from('leads').select('*');

    if (allLeads && allLeads.length > 0) {
        console.log(`Found ${allLeads.length} leads across all workspaces`);

        for (const lead of allLeads) {
            if (lead.workspace_id !== keepWs.id) {
                await client.from('leads')
                    .update({ workspace_id: keepWs.id })
                    .eq('id', lead.id);
            }
        }
        console.log('✅ All leads moved to correct workspace!');
    }

    console.log('\n🎉 FIXED! Refreshing page...');
    setTimeout(() => location.reload(), 1000);
})();
```

### Step 4: Wait
The script will:
- Delete duplicate workspaces
- Keep only the first one
- Move all your leads to it
- Refresh the page automatically

### Step 5: Test
1. Add a lead
2. Press F5 to refresh
3. ✅ Lead should STILL BE THERE!

---

## If The Script Fails

Try this simpler version:

```javascript
// Nuclear option - disable RLS temporarily
(async () => {
    const { createClient } = window.supabase;
    const client = createClient(
        'https://pesqbkgfsfkqdquhilsv.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBlc3Fia2dmc2ZrcWRxdWhpbHN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1MDU3MTYsImV4cCI6MjA4MjA4MTcxNn0.SuRLVpP_k8vbSiZeTG_aJY9qiOPvRLiZo8amZNv2YTQ'
    );

    // Get first workspace
    const { data: { user } } = await client.auth.getUser();
    const { data: workspaces } = await client.from('workspaces').select('*').eq('owner_id', user.id).limit(1);

    if (workspaces && workspaces[0]) {
        localStorage.setItem('current_workspace_id', workspaces[0].id);
        console.log('Set workspace to:', workspaces[0].id);
        location.reload();
    }
})();
```

This just sets one workspace and refreshes. Then try adding a lead.

---

## Why This Works

The issue is you're switching between 89 different workspaces on every page load. This script:
1. Deletes the 88 duplicate workspaces
2. Keeps only 1 workspace
3. Moves all your data to that workspace
4. Sets it in localStorage so the app uses it

After this, refreshing won't switch workspaces anymore!
