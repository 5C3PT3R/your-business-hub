-- ============================================
-- FINAL FIX - SIMPLE RLS POLICIES THAT ACTUALLY WORK
-- ============================================
-- Run in: https://supabase.com/dashboard/project/pesqbkgfsfkqdquhilsv/sql/new

-- Step 1: Drop ALL existing policies
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename IN ('leads', 'contacts', 'deals', 'tasks')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- Step 2: Create SUPER SIMPLE policies for LEADS
-- Allow users to see leads they created OR in their workspace
CREATE POLICY "leads_select" ON public.leads
FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR
  workspace_id IN (
    SELECT workspace_id
    FROM workspace_members
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "leads_insert" ON public.leads
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "leads_update" ON public.leads
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "leads_delete" ON public.leads
FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- Step 3: Create SUPER SIMPLE policies for CONTACTS
CREATE POLICY "contacts_select" ON public.contacts
FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR
  workspace_id IN (
    SELECT workspace_id
    FROM workspace_members
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "contacts_insert" ON public.contacts
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "contacts_update" ON public.contacts
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "contacts_delete" ON public.contacts
FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- Step 4: Create SUPER SIMPLE policies for DEALS
CREATE POLICY "deals_select" ON public.deals
FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR
  workspace_id IN (
    SELECT workspace_id
    FROM workspace_members
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "deals_insert" ON public.deals
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "deals_update" ON public.deals
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "deals_delete" ON public.deals
FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- Step 5: Create SUPER SIMPLE policies for TASKS
CREATE POLICY "tasks_select" ON public.tasks
FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR
  workspace_id IN (
    SELECT workspace_id
    FROM workspace_members
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "tasks_insert" ON public.tasks
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tasks_update" ON public.tasks
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tasks_delete" ON public.tasks
FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- Step 6: Verify policies were created
SELECT
    tablename,
    policyname,
    cmd
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('leads', 'contacts', 'deals', 'tasks')
ORDER BY tablename, policyname;
