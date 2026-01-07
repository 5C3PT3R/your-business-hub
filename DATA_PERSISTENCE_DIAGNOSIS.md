# Data Persistence Issue - Root Cause Analysis

## Problem
Leads disappear after page refresh, even though they appear to be saved successfully.

## What's Happening

### Current Flow:
1. User adds a lead → Success toast appears ✅
2. Lead appears in the UI immediately ✅
3. User refreshes page (F5) → Lead disappears ❌

## Root Causes (3 Possibilities)

### Cause #1: RLS Policies Blocking Read Access (MOST LIKELY)
**What this means:**
- Data IS being saved to database
- But RLS (Row Level Security) policies are preventing it from being read back
- The INSERT policy allows writing, but SELECT policy blocks reading

**Why this happens:**
- RLS policies use subqueries that check `workspace_members` table
- If user isn't properly registered as workspace member, reads fail
- Even though they created the lead, they can't see it

**How to verify:**
1. Run [DIAGNOSE_AND_FIX.sql](DIAGNOSE_AND_FIX.sql)
2. Look at "ALL LEADS (RAW)" vs "LEADS VISIBLE WITH RLS"
3. If RAW shows leads but VISIBLE shows none → This is the issue

**Fix:** Run the SQL script to recreate policies correctly

### Cause #2: Workspace Member Missing
**What this means:**
- When workspace is created, user isn't added to `workspace_members` table
- Leads are saved with workspace_id, but user has no membership
- RLS policies check membership and block access

**How to verify:**
1. Check "ALL WORKSPACE MEMBERS" section in SQL output
2. Your user_id should appear for your workspace
3. If not found → This is the issue

**Fix:** SQL script will show this, but you may need to manually insert membership

### Cause #3: React State Management Issue (UNLIKELY)
**What this means:**
- Data is in database and readable
- But React state isn't updating after page reload
- Hooks aren't fetching properly

**How to verify:**
1. Open browser console (F12)
2. Look for `[useLeads] Successfully fetched X leads` log
3. If X is 0 but database has leads → Hook issue
4. If no fetch log at all → Workspace not loading

**Fix:** Already applied hook fixes, but may need more debugging

## Current Status of Fixes

### ✅ Already Fixed:
1. **Hook loading logic** - Only fetches when workspace is loaded
2. **Effect dependencies** - Properly triggers when workspace changes
3. **Debug logging** - Comprehensive console logs added

### ⚠️ Needs Testing:
1. **RLS policies** - Run DIAGNOSE_AND_FIX.sql to fix
2. **Workspace membership** - Verify in database

## Step-by-Step Fix Instructions

### STEP 1: Run Diagnostic SQL
1. Go to: https://supabase.com/dashboard/project/pesqbkgfsfkqdquhilsv/sql/new
2. Copy ENTIRE contents of [DIAGNOSE_AND_FIX.sql](DIAGNOSE_AND_FIX.sql)
3. Click "Run" (Ctrl+Enter)
4. **REVIEW THE OUTPUT** - Look at each section:
   - Current user ID
   - All workspaces
   - All workspace members (YOUR USER SHOULD BE HERE!)
   - All leads (raw - should show your leads)
   - Leads visible with RLS (should match raw after fix)

### STEP 2: Verify Console Logs
1. Open [http://localhost:8080](http://localhost:8080)
2. Open browser console (F12)
3. Go to Leads page
4. Look for these logs:
   ```
   [useWorkspace] Fetching workspaces for user: <user-id>
   [useWorkspace] Found workspaces: 1
   [useWorkspace] Setting saved workspace: <workspace-id>
   [useLeads] Effect triggered - user: true, workspace: <workspace-id>
   [useLeads] Fetching leads for workspace: <workspace-id>
   [useLeads] Successfully fetched X leads
   ```

### STEP 3: Test Adding Lead
1. Still in Leads page with console open
2. Click "Add Lead"
3. Enter name: "Test Lead"
4. Click "Add Lead" button
5. Watch console for:
   ```
   [useLeads] Adding lead to workspace: <workspace-id>, user: <user-id>
   [useLeads] Lead data: {name, email, phone, workspace_id, user_id}
   [useLeads] Lead added successfully: {...}
   ```

### STEP 4: Test Persistence
1. After lead is added successfully
2. Press F5 to refresh
3. Watch console logs again
4. Lead should still be visible!

## If It Still Doesn't Work

### Check #1: Database Direct Query
Run this in SQL Editor:
```sql
-- Raw check - are leads in database?
SELECT * FROM public.leads ORDER BY created_at DESC LIMIT 5;

-- RLS check - can current user see them?
SELECT * FROM public.leads
WHERE workspace_id IN (
  SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
)
ORDER BY created_at DESC LIMIT 5;
```

If first query shows leads but second is empty → RLS issue still exists

### Check #2: Workspace Membership
Run this:
```sql
-- Am I a workspace member?
SELECT
  wm.workspace_id,
  wm.user_id,
  wm.role,
  w.name as workspace_name,
  auth.uid() as my_user_id,
  CASE WHEN wm.user_id = auth.uid() THEN '✓ MEMBER' ELSE '✗ NOT MEMBER' END as status
FROM public.workspace_members wm
JOIN public.workspaces w ON w.id = wm.workspace_id
WHERE wm.user_id = auth.uid()
OR w.owner_id = auth.uid();
```

Should show "✓ MEMBER" for your workspace

### Check #3: Manual Membership Insert
If you're not a member, add yourself:
```sql
INSERT INTO public.workspace_members (workspace_id, user_id, role)
SELECT
  w.id as workspace_id,
  auth.uid() as user_id,
  'owner' as role
FROM public.workspaces w
WHERE w.owner_id = auth.uid()
AND NOT EXISTS (
  SELECT 1 FROM public.workspace_members
  WHERE workspace_id = w.id AND user_id = auth.uid()
);
```

## Technical Details

### RLS Policy Pattern
The working pattern uses explicit EXISTS clauses:
```sql
CREATE POLICY "Users can view leads"
ON public.leads FOR SELECT
USING (
  user_id = auth.uid()  -- Own data
  OR EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = leads.workspace_id
    AND user_id = auth.uid()
  )  -- Member of workspace
  OR EXISTS (
    SELECT 1 FROM workspaces
    WHERE id = leads.workspace_id
    AND owner_id = auth.uid()
  )  -- Owner of workspace
);
```

### Why Previous Pattern Failed
The old pattern used `IN (SELECT ...)`:
```sql
workspace_id IN (
  SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
)
```

This can fail in Postgres RLS context when:
- Subquery returns no rows
- RLS on workspace_members table blocks the subquery
- Query planner chooses wrong execution path

## Expected Result After Fix

After running the SQL fix, you should see:

1. ✅ Leads persist after refresh
2. ✅ Console shows "Successfully fetched X leads" where X > 0
3. ✅ No RLS errors in Supabase logs
4. ✅ Data visible in both app and database direct query

If not, share the console logs and SQL query results for further debugging.
