-- COMPREHENSIVE DATA PERSISTENCE FIX
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/pesqbkgfsfkqdquhilsv/sql/new

-- Step 1: Check current data
SELECT 'Step 1: Current Leads' as step, id, name, workspace_id, user_id FROM public.leads ORDER BY created_at DESC LIMIT 5;
SELECT 'Step 1: Current Workspaces' as step, id, name, owner_id FROM public.workspaces ORDER BY created_at DESC LIMIT 5;
SELECT 'Step 1: Current Members' as step, workspace_id, user_id, role FROM public.workspace_members ORDER BY created_at DESC LIMIT 5;

-- Step 2: Drop and recreate RLS policies with simpler logic
DROP POLICY IF EXISTS "Users can view leads in their workspaces" ON public.leads;
DROP POLICY IF EXISTS "Users can create leads in their workspaces" ON public.leads;
DROP POLICY IF EXISTS "Users can update leads in their workspaces" ON public.leads;
DROP POLICY IF EXISTS "Users can delete leads in their workspaces" ON public.leads;

-- Step 3: Create new, simpler RLS policies
-- Users can see leads if they are the owner OR if they're a member of the workspace
CREATE POLICY "Users can view leads in their workspaces"
ON public.leads
FOR SELECT
USING (
  -- User created the lead
  user_id = auth.uid()
  OR
  -- Workspace is null (legacy data)
  workspace_id IS NULL
  OR
  -- User is a member of the workspace
  EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_members.workspace_id = leads.workspace_id
    AND workspace_members.user_id = auth.uid()
  )
  OR
  -- User owns the workspace
  EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE workspaces.id = leads.workspace_id
    AND workspaces.owner_id = auth.uid()
  )
);

CREATE POLICY "Users can create leads in their workspaces"
ON public.leads
FOR INSERT
WITH CHECK (
  -- User must be creating with their own user_id
  user_id = auth.uid()
  AND
  (
    -- Workspace is null (legacy)
    workspace_id IS NULL
    OR
    -- User is a member of the workspace
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_members.workspace_id = leads.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
    OR
    -- User owns the workspace
    EXISTS (
      SELECT 1 FROM public.workspaces
      WHERE workspaces.id = leads.workspace_id
      AND workspaces.owner_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can update leads in their workspaces"
ON public.leads
FOR UPDATE
USING (
  user_id = auth.uid()
  OR
  workspace_id IS NULL
  OR
  EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_members.workspace_id = leads.workspace_id
    AND workspace_members.user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE workspaces.id = leads.workspace_id
    AND workspaces.owner_id = auth.uid()
  )
);

CREATE POLICY "Users can delete leads in their workspaces"
ON public.leads
FOR DELETE
USING (
  user_id = auth.uid()
  OR
  workspace_id IS NULL
  OR
  EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_members.workspace_id = leads.workspace_id
    AND workspace_members.user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE workspaces.id = leads.workspace_id
    AND workspaces.owner_id = auth.uid()
  )
);

-- Step 4: Same for contacts
DROP POLICY IF EXISTS "Users can view contacts in their workspaces" ON public.contacts;
DROP POLICY IF EXISTS "Users can create contacts in their workspaces" ON public.contacts;
DROP POLICY IF EXISTS "Users can update contacts in their workspaces" ON public.contacts;
DROP POLICY IF EXISTS "Users can delete contacts in their workspaces" ON public.contacts;

CREATE POLICY "Users can view contacts in their workspaces"
ON public.contacts
FOR SELECT
USING (
  user_id = auth.uid()
  OR
  workspace_id IS NULL
  OR
  EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_members.workspace_id = contacts.workspace_id
    AND workspace_members.user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE workspaces.id = contacts.workspace_id
    AND workspaces.owner_id = auth.uid()
  )
);

CREATE POLICY "Users can create contacts in their workspaces"
ON public.contacts
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND
  (
    workspace_id IS NULL
    OR
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_members.workspace_id = contacts.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.workspaces
      WHERE workspaces.id = contacts.workspace_id
      AND workspaces.owner_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can update contacts in their workspaces"
ON public.contacts
FOR UPDATE
USING (
  user_id = auth.uid()
  OR
  workspace_id IS NULL
  OR
  EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_members.workspace_id = contacts.workspace_id
    AND workspace_members.user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE workspaces.id = contacts.workspace_id
    AND workspaces.owner_id = auth.uid()
  )
);

CREATE POLICY "Users can delete contacts in their workspaces"
ON public.contacts
FOR DELETE
USING (
  user_id = auth.uid()
  OR
  workspace_id IS NULL
  OR
  EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_members.workspace_id = contacts.workspace_id
    AND workspace_members.user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE workspaces.id = contacts.workspace_id
    AND workspaces.owner_id = auth.uid()
  )
);

-- Step 5: Verify policies are created
SELECT 'Step 5: RLS Policies for leads' as step, schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE tablename = 'leads'
ORDER BY policyname;

SELECT 'Step 5: RLS Policies for contacts' as step, schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE tablename = 'contacts'
ORDER BY policyname;

-- Done!
SELECT 'FIX COMPLETE - Now test adding a lead in the app' as message;
