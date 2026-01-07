-- COMPREHENSIVE DIAGNOSIS AND FIX FOR DATA PERSISTENCE
-- Run this ENTIRE script in Supabase SQL Editor
-- https://supabase.com/dashboard/project/pesqbkgfsfkqdquhilsv/sql/new

-- ==============================================
-- STEP 1: DIAGNOSE THE CURRENT STATE
-- ==============================================

-- Check current user
SELECT 'CURRENT AUTHENTICATED USER' as diagnostic, auth.uid() as user_id;

-- Check all users
SELECT 'ALL USERS' as diagnostic, id, email, created_at
FROM auth.users
ORDER BY created_at DESC;

-- Check workspaces
SELECT 'ALL WORKSPACES' as diagnostic, id, name, owner_id, created_at
FROM public.workspaces
ORDER BY created_at DESC;

-- Check workspace members
SELECT 'ALL WORKSPACE MEMBERS' as diagnostic,
  wm.id, wm.workspace_id, wm.user_id, wm.role, w.name as workspace_name
FROM public.workspace_members wm
LEFT JOIN public.workspaces w ON w.id = wm.workspace_id
ORDER BY wm.created_at DESC;

-- Check leads
SELECT 'ALL LEADS (RAW)' as diagnostic,
  id, name, workspace_id, user_id, created_at
FROM public.leads
ORDER BY created_at DESC;

-- Check if leads are visible with RLS
SELECT 'LEADS VISIBLE WITH RLS' as diagnostic,
  id, name, workspace_id, user_id
FROM public.leads
WHERE workspace_id IN (
  SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
) OR user_id = auth.uid()
ORDER BY created_at DESC;

-- ==============================================
-- STEP 2: FIX RLS POLICIES
-- ==============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view leads in their workspaces" ON public.leads;
DROP POLICY IF EXISTS "Users can create leads in their workspaces" ON public.leads;
DROP POLICY IF EXISTS "Users can update leads in their workspaces" ON public.leads;
DROP POLICY IF EXISTS "Users can delete leads in their workspaces" ON public.leads;

-- Create SIMPLE, PERMISSIVE policies for leads
-- Policy 1: SELECT (View) - User owns the lead OR is member of workspace OR owns workspace
CREATE POLICY "Users can view leads in their workspaces"
ON public.leads
FOR SELECT
USING (
  -- Option 1: User created this lead
  user_id = auth.uid()
  OR
  -- Option 2: User is member of workspace
  EXISTS (
    SELECT 1
    FROM public.workspace_members
    WHERE workspace_members.workspace_id = leads.workspace_id
    AND workspace_members.user_id = auth.uid()
  )
  OR
  -- Option 3: User owns the workspace
  EXISTS (
    SELECT 1
    FROM public.workspaces
    WHERE workspaces.id = leads.workspace_id
    AND workspaces.owner_id = auth.uid()
  )
  OR
  -- Option 4: Legacy data (no workspace)
  workspace_id IS NULL
);

-- Policy 2: INSERT (Create) - Must set own user_id and be in workspace
CREATE POLICY "Users can create leads in their workspaces"
ON public.leads
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND
  (
    workspace_id IS NULL
    OR
    EXISTS (
      SELECT 1
      FROM public.workspace_members
      WHERE workspace_members.workspace_id = leads.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1
      FROM public.workspaces
      WHERE workspaces.id = leads.workspace_id
      AND workspaces.owner_id = auth.uid()
    )
  )
);

-- Policy 3: UPDATE - Same as SELECT
CREATE POLICY "Users can update leads in their workspaces"
ON public.leads
FOR UPDATE
USING (
  user_id = auth.uid()
  OR
  EXISTS (
    SELECT 1
    FROM public.workspace_members
    WHERE workspace_members.workspace_id = leads.workspace_id
    AND workspace_members.user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1
    FROM public.workspaces
    WHERE workspaces.id = leads.workspace_id
    AND workspaces.owner_id = auth.uid()
  )
  OR
  workspace_id IS NULL
);

-- Policy 4: DELETE - Same as SELECT
CREATE POLICY "Users can delete leads in their workspaces"
ON public.leads
FOR DELETE
USING (
  user_id = auth.uid()
  OR
  EXISTS (
    SELECT 1
    FROM public.workspace_members
    WHERE workspace_members.workspace_id = leads.workspace_id
    AND workspace_members.user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1
    FROM public.workspaces
    WHERE workspaces.id = leads.workspace_id
    AND workspaces.owner_id = auth.uid()
  )
  OR
  workspace_id IS NULL
);

-- ==============================================
-- STEP 3: FIX CONTACTS POLICIES (SAME LOGIC)
-- ==============================================

DROP POLICY IF EXISTS "Users can view contacts in their workspaces" ON public.contacts;
DROP POLICY IF EXISTS "Users can create contacts in their workspaces" ON public.contacts;
DROP POLICY IF EXISTS "Users can update contacts in their workspaces" ON public.contacts;
DROP POLICY IF EXISTS "Users can delete contacts in their workspaces" ON public.contacts;

CREATE POLICY "Users can view contacts in their workspaces"
ON public.contacts FOR SELECT
USING (
  user_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_members.workspace_id = contacts.workspace_id AND workspace_members.user_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM public.workspaces WHERE workspaces.id = contacts.workspace_id AND workspaces.owner_id = auth.uid()) OR
  workspace_id IS NULL
);

CREATE POLICY "Users can create contacts in their workspaces"
ON public.contacts FOR INSERT
WITH CHECK (
  user_id = auth.uid() AND (
    workspace_id IS NULL OR
    EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_members.workspace_id = contacts.workspace_id AND workspace_members.user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.workspaces WHERE workspaces.id = contacts.workspace_id AND workspaces.owner_id = auth.uid())
  )
);

CREATE POLICY "Users can update contacts in their workspaces"
ON public.contacts FOR UPDATE
USING (
  user_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_members.workspace_id = contacts.workspace_id AND workspace_members.user_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM public.workspaces WHERE workspaces.id = contacts.workspace_id AND workspaces.owner_id = auth.uid()) OR
  workspace_id IS NULL
);

CREATE POLICY "Users can delete contacts in their workspaces"
ON public.contacts FOR DELETE
USING (
  user_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_members.workspace_id = contacts.workspace_id AND workspace_members.user_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM public.workspaces WHERE workspaces.id = contacts.workspace_id AND workspaces.owner_id = auth.uid()) OR
  workspace_id IS NULL
);

-- ==============================================
-- STEP 4: VERIFY POLICIES WERE CREATED
-- ==============================================

SELECT 'RLS POLICIES FOR LEADS' as verification,
  policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'leads'
AND schemaname = 'public'
ORDER BY policyname;

SELECT 'RLS POLICIES FOR CONTACTS' as verification,
  policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'contacts'
AND schemaname = 'public'
ORDER BY policyname;

-- ==============================================
-- STEP 5: TEST QUERY
-- ==============================================

-- This is what your app runs - test if it works
SELECT 'TEST QUERY - LEADS VISIBLE TO CURRENT USER' as test,
  id, name, email, workspace_id, user_id, created_at
FROM public.leads
WHERE workspace_id IN (
  SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
  UNION
  SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
)
ORDER BY created_at DESC;

-- ==============================================
-- DONE!
-- ==============================================

SELECT '✅ FIX COMPLETE - Now test in your app!' as status;
SELECT '1. Add a new lead' as step_1;
SELECT '2. Refresh the page (F5)' as step_2;
SELECT '3. Lead should persist!' as step_3;
