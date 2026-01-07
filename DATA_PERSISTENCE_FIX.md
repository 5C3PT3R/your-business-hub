# Data Persistence Issue - Fix Applied

## Problem
Leads and contacts were disappearing after page reload. The user would add data, but upon refreshing the page, all saved data would be gone.

## Root Cause
The issue was a **race condition** during page load:

1. When the page loads, React hooks initialize in this order:
   - `useAuth` loads user
   - `useWorkspace` starts fetching workspace (takes time)
   - `useLeads` and `useContacts` effects trigger

2. The problem occurred when `workspace` was still `null` during initial renders:
   - Previous code would call `fetchLeads()` even when workspace was null
   - The query would filter by `workspace_id = null`, returning no results
   - State would be set to empty array `[]`, clearing any previously loaded data

## Fix Applied

### 1. Updated [useLeads.tsx](src/hooks/useLeads.tsx#L69-L77)
```typescript
useEffect(() => {
  console.log('[useLeads] Effect triggered - user:', !!user, 'workspace:', workspace?.id);
  if (user && workspace?.id) {
    fetchLeads(); // Only fetch when BOTH user and workspace are available
  } else if (!user) {
    setLeads([]);
    setLoading(false);
  }
}, [user, workspace?.id]);
```

**Key Changes:**
- Only calls `fetchLeads()` when BOTH `user` AND `workspace?.id` are present
- Prevents fetching with null workspace_id
- Clears data only when user is not authenticated

### 2. Updated [useContacts.tsx](src/hooks/useContacts.tsx#L60-L68)
Applied the same logic for contacts:
```typescript
useEffect(() => {
  console.log('[useContacts] Effect triggered - user:', !!user, 'workspace:', workspace?.id);
  if (user && workspace?.id) {
    fetchContacts(); // Only fetch when BOTH user and workspace are available
  } else if (!user) {
    setContacts([]);
    setLoading(false);
  }
}, [user, workspace?.id]);
```

### 3. Added Debug Logging to [Leads.tsx](src/pages/Leads.tsx#L72-L75)
```typescript
useEffect(() => {
  console.log('[Leads Page] Render - workspace:', workspace?.id, 'leads:', leads.length, 'loading:', loading);
}, [workspace?.id, leads.length, loading]);
```

This helps track exactly when workspace loads and when leads are fetched.

## How to Test

### 1. Check Console Logs
Open browser console (F12) and look for these logs in order:

**Expected sequence on page load:**
```
[useWorkspace] Fetching workspaces for user: <uuid>
[useLeads] Effect triggered - user: true, workspace: undefined
[useContacts] Effect triggered - user: true, workspace: undefined
[useWorkspace] Found workspaces: 1
[useWorkspace] Setting saved workspace: <workspace-id>
[useLeads] Effect triggered - user: true, workspace: <workspace-id>
[useLeads] Fetching leads for workspace: <workspace-id>
[useLeads] Successfully fetched X leads
[Leads Page] Render - workspace: <workspace-id>, leads: X, loading: false
```

**What to look for:**
- Workspace should load BEFORE leads are fetched
- `fetchLeads` should only be called when workspace has an ID
- Leads count should be > 0 if you've added data

### 2. Add a Lead
1. Go to Leads page
2. Click "Add Lead"
3. Fill in at least the name field
4. Click "Add Lead"
5. Check console for:
   ```
   [useLeads] Successfully fetched X leads
   ```

### 3. Reload the Page
1. Press F5 or Ctrl+R to reload
2. Watch the console logs
3. Verify leads appear after workspace loads
4. Data should persist!

### 4. Verify Data in Database
If data still doesn't persist, run the queries in [DEBUG_QUERY.sql](DEBUG_QUERY.sql):

1. Go to https://supabase.com/dashboard/project/pesqbkgfsfkqdquhilsv/sql/new
2. Copy queries from `DEBUG_QUERY.sql`
3. Run each query to check:
   - Are leads actually in the database?
   - Do leads have correct workspace_id?
   - Is user a member of that workspace?
   - Are RLS policies working correctly?

## Possible Issues

### If data still disappears after reload:

**Issue 1: User not a member of workspace**
- Check query #4 in DEBUG_QUERY.sql
- User must have a row in `workspace_members` table
- Fix: Re-create workspace or manually insert membership

**Issue 2: workspace_id mismatch**
- Check query #5 in DEBUG_QUERY.sql
- Lead's workspace_id must match user's workspace
- Fix: Update leads to use correct workspace_id

**Issue 3: RLS policies blocking read**
- Check query #1 to see if leads exist
- If leads exist but aren't showing, RLS may be blocking
- Fix: Check RLS policies in Supabase dashboard

**Issue 4: localStorage cleared**
- Workspace selection is stored in localStorage
- If cleared, it selects first workspace
- Not a bug, just switches workspace

## Technical Details

### RLS Policies
The leads table has these policies (from [20260107_fix_leads_table.sql](supabase/migrations/20260107_fix_leads_table.sql)):

```sql
CREATE POLICY "Users can view leads in their workspaces"
ON public.leads
FOR SELECT
USING (
  workspace_id IS NULL AND user_id = auth.uid()
  OR
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);
```

This means:
1. Users can see leads where workspace_id is NULL and they're the owner
2. OR users can see leads in workspaces they're a member of

The same pattern applies to INSERT, UPDATE, and DELETE.

### Dependency Array
The effect depends on `[user, workspace?.id]`:
- `workspace?.id` is `undefined` initially
- When workspace loads, it changes to actual UUID
- This triggers the effect to re-run
- Only then does `fetchLeads()` execute

## Next Steps
1. Test adding and reloading leads
2. Test adding and reloading contacts
3. Check console logs match expected sequence
4. If issue persists, run DEBUG_QUERY.sql to diagnose
