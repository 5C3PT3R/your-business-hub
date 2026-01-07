-- ============================================
-- ULTIMATE FIX - RUN THIS ONCE AND BE DONE
-- ============================================
-- Run in: https://supabase.com/dashboard/project/pesqbkgfsfkqdquhilsv/sql/new

-- This will:
-- 1. Clean up duplicate workspaces
-- 2. Fix all table schemas
-- 3. Set up proper RLS policies
-- 4. Show you what data you have

-- ==========================================
-- STEP 1: Clean up duplicate workspaces
-- ==========================================
SELECT 'STEP 1: Cleaning up duplicate workspaces...' as status;

-- Delete workspace members for duplicate workspaces
WITH ranked_workspaces AS (
    SELECT
        id,
        owner_id,
        ROW_NUMBER() OVER (PARTITION BY owner_id ORDER BY created_at ASC) as rn
    FROM public.workspaces
)
DELETE FROM public.workspace_members
WHERE workspace_id IN (
    SELECT id FROM ranked_workspaces WHERE rn > 1
);

-- Delete duplicate workspaces (keep only the first one)
WITH ranked_workspaces AS (
    SELECT
        id,
        owner_id,
        ROW_NUMBER() OVER (PARTITION BY owner_id ORDER BY created_at ASC) as rn
    FROM public.workspaces
)
DELETE FROM public.workspaces
WHERE id IN (
    SELECT id FROM ranked_workspaces WHERE rn > 1
);

SELECT COUNT(*) as total_workspaces FROM public.workspaces;

-- ==========================================
-- STEP 2: Ensure all tables exist with correct columns
-- ==========================================
SELECT 'STEP 2: Setting up table schemas...' as status;

-- Leads table
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS workspace_id UUID;

-- Contacts table
CREATE TABLE IF NOT EXISTS public.contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    company TEXT,
    position TEXT,
    role TEXT,
    avatar_url TEXT,
    status TEXT DEFAULT 'active',
    user_id UUID,
    workspace_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS workspace_id UUID;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS position TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Deals table
CREATE TABLE IF NOT EXISTS public.deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    company TEXT,
    value NUMERIC DEFAULT 0,
    stage TEXT DEFAULT 'lead',
    probability INTEGER DEFAULT 0,
    expected_close_date DATE,
    close_date DATE,
    contact_id UUID,
    lead_id UUID,
    user_id UUID,
    workspace_id UUID,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS workspace_id UUID;

-- Tasks table
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'pending',
    due_date TIMESTAMPTZ,
    related_deal_id UUID,
    related_contact_id UUID,
    user_id UUID,
    workspace_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS workspace_id UUID;

-- ==========================================
-- STEP 3: Enable RLS
-- ==========================================
SELECT 'STEP 3: Enabling RLS...' as status;

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- STEP 4: Drop ALL existing policies
-- ==========================================
SELECT 'STEP 4: Dropping old policies...' as status;

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

-- ==========================================
-- STEP 5: Create NEW, SIMPLE, WORKING policies
-- ==========================================
SELECT 'STEP 5: Creating new policies...' as status;

-- LEADS policies
CREATE POLICY "leads_select" ON public.leads FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
);

CREATE POLICY "leads_insert" ON public.leads FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "leads_update" ON public.leads FOR UPDATE TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "leads_delete" ON public.leads FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- CONTACTS policies
CREATE POLICY "contacts_select" ON public.contacts FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
);

CREATE POLICY "contacts_insert" ON public.contacts FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "contacts_update" ON public.contacts FOR UPDATE TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "contacts_delete" ON public.contacts FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- DEALS policies
CREATE POLICY "deals_select" ON public.deals FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
);

CREATE POLICY "deals_insert" ON public.deals FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "deals_update" ON public.deals FOR UPDATE TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "deals_delete" ON public.deals FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- TASKS policies
CREATE POLICY "tasks_select" ON public.tasks FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
);

CREATE POLICY "tasks_insert" ON public.tasks FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tasks_update" ON public.tasks FOR UPDATE TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tasks_delete" ON public.tasks FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- ==========================================
-- STEP 6: VERIFICATION
-- ==========================================
SELECT 'STEP 6: Verification...' as status;

-- Show workspaces
SELECT 'WORKSPACES:' as info, COUNT(*) as count FROM public.workspaces;

-- Show policies
SELECT 'POLICIES:' as info, tablename, COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('leads', 'contacts', 'deals', 'tasks')
GROUP BY tablename
ORDER BY tablename;

-- Show current data
SELECT 'LEADS:' as info, COUNT(*) as count FROM public.leads;
SELECT 'CONTACTS:' as info, COUNT(*) as count FROM public.contacts;
SELECT 'DEALS:' as info, COUNT(*) as count FROM public.deals;
SELECT 'TASKS:' as info, COUNT(*) as count FROM public.tasks;

SELECT '✅ COMPLETE! All tables should now persist data correctly.' as final_status;
