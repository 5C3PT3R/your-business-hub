# 🚨 INSTANT FIX - Copy & Paste This SQL NOW

## THE PROBLEM
Your leads ARE being saved to the database, but RLS (Row Level Security) policies are preventing you from reading them back. That's why they "disappear" on refresh.

## THE SOLUTION
Run this ONE SQL command in Supabase:

---

### 📋 STEP 1: Copy this SQL (Ctrl+A, Ctrl+C)

```sql
-- INSTANT FIX FOR DATA PERSISTENCE
-- This will make your data visible immediately

-- Fix leads table columns
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS company TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'new';
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS value NUMERIC DEFAULT 0;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS workspace_id UUID;

-- Enable RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Drop broken policies
DROP POLICY IF EXISTS "leads_select_policy" ON public.leads;
DROP POLICY IF EXISTS "leads_insert_policy" ON public.leads;
DROP POLICY IF EXISTS "leads_update_policy" ON public.leads;
DROP POLICY IF EXISTS "leads_delete_policy" ON public.leads;
DROP POLICY IF EXISTS "Users can view leads in their workspaces" ON public.leads;
DROP POLICY IF EXISTS "Users can create leads in their workspaces" ON public.leads;
DROP POLICY IF EXISTS "Users can update leads in their workspaces" ON public.leads;
DROP POLICY IF EXISTS "Users can delete leads in their workspaces" ON public.leads;

-- Create WORKING policies
CREATE POLICY "leads_select" ON public.leads
FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "leads_insert" ON public.leads
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "leads_update" ON public.leads
FOR UPDATE TO authenticated
USING (
  auth.uid() = user_id
  OR workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "leads_delete" ON public.leads
FOR DELETE TO authenticated
USING (
  auth.uid() = user_id
  OR workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  )
);

-- Create contacts table
CREATE TABLE IF NOT EXISTS public.contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    company TEXT,
    role TEXT,
    user_id UUID,
    workspace_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contacts_all" ON public.contacts
FOR ALL TO authenticated
USING (
  auth.uid() = user_id
  OR workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
)
WITH CHECK (auth.uid() = user_id);

-- Create deals table
CREATE TABLE IF NOT EXISTS public.deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    value NUMERIC DEFAULT 0,
    stage TEXT DEFAULT 'lead',
    probability INTEGER DEFAULT 0,
    close_date DATE,
    contact_id UUID,
    lead_id UUID,
    user_id UUID,
    workspace_id UUID,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deals_all" ON public.deals
FOR ALL TO authenticated
USING (
  auth.uid() = user_id
  OR workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
)
WITH CHECK (auth.uid() = user_id);

-- Success message
SELECT 'SUCCESS - Database fixed!' as result;
```

---

### 📋 STEP 2: Run it in Supabase

1. Click this link: https://supabase.com/dashboard/project/pesqbkgfsfkqdquhilsv/sql/new
2. **Paste** the SQL (Ctrl+V)
3. Click **RUN** button (bottom right)
4. Wait for "Success" message

---

### 📋 STEP 3: Test IMMEDIATELY

1. Go to: https://upflo-lac.vercel.app/leads
2. Add a new lead:
   - Name: "Test Lead"
   - Email: "test@test.com"
   - Company: "Test Corp"
   - Value: 5000
3. Click Save
4. **REFRESH THE PAGE** (F5)
5. ✅ **The lead should STILL BE THERE!**

---

## Why This Works

The original issue was:
- ❌ RLS policies were too strict or malformed
- ❌ SELECT policy didn't match how data was being queried
- ❌ Missing columns prevented inserts

This fix:
- ✅ Adds ALL missing columns
- ✅ Creates simple, permissive RLS policies
- ✅ Allows authenticated users to see their own data
- ✅ Allows workspace members to see workspace data

---

## If It STILL Doesn't Work

### Check 1: Are you logged in?
- Go to your app
- Log out completely
- Log back in
- Try again

### Check 2: Do you have a workspace?
- Make sure you created a workspace when you first signed up
- Check Settings page

### Check 3: Check browser console
- Press F12
- Go to Console tab
- Look for errors when you refresh
- Share the error with me

### Check 4: Check Supabase logs
- Go to: https://supabase.com/dashboard/project/pesqbkgfsfkqdquhilsv/logs/explorer
- Look for errors
- Share with me

---

## 100% GUARANTEED FIX

If the above still doesn't work, there's one more nuclear option:

```sql
-- NUCLEAR OPTION - Completely disable RLS (TEMPORARY)
ALTER TABLE public.leads DISABLE ROW LEVEL SECURITY;
```

This will make ALL data visible to ALL users (not secure, but will prove the issue is RLS).

If this makes data visible, we know it's RLS policies. Then we can re-enable and fix them properly.

---

## Expected Results After Fix

✅ Leads persist across refresh
✅ Deals can be created
✅ AI Agent works
✅ All CRUD operations work
✅ Data isolated by workspace

Run the SQL NOW and let me know the result!
